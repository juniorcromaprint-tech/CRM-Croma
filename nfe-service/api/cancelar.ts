import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

const UF_CODES: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29,
  CE: 23, DF: 53, ES: 32, GO: 52, MA: 21,
  MG: 31, MS: 50, MT: 51, PA: 15, PB: 25,
  PE: 26, PI: 22, PR: 41, RJ: 33, RN: 24,
  RO: 11, RR: 14, RS: 43, SC: 42, SE: 28,
  SP: 35, TO: 17,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Metodo nao permitido' });
  }

  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Nao autorizado' });
  }

  const { chave_acesso, protocolo, justificativa } = req.body;

  if (!chave_acesso || !protocolo || !justificativa) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Campos obrigatorios: chave_acesso, protocolo, justificativa',
    });
  }

  if (justificativa.length < 15) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Justificativa deve ter no minimo 15 caracteres',
    });
  }

  try {
    const nfe = await createNFeWizard();
    const ambiente = parseInt(process.env.NFE_AMBIENTE ?? '2');
    const uf = process.env.NFE_UF ?? 'SP';
    const cnpj = (process.env.NFE_CNPJ_EMITENTE ?? '').replace(/\D/g, '');

    const resultado = await nfe.NFE_Cancelamento({
      idLote: Date.now(),
      modelo: '55',
      evento: [{
        tpAmb: ambiente,
        cOrgao: UF_CODES[uf] ?? 35,
        CNPJ: cnpj,
        chNFe: chave_acesso,
        dhEvento: new Date().toISOString().replace('Z', '-03:00'),
        tpEvento: '110111',
        nSeqEvento: 1,
        verEvento: '1.00',
        detEvento: {
          descEvento: 'Cancelamento',
          nProt: protocolo,
          xJust: justificativa,
        },
      }],
    });

    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/cancelar]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
