import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

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

    // Cancelamento NF-e e feito via RecepcaoEvento (tpEvento 110111)
    // NFE_Cancelamento() nao existe — metodo correto e NFE_RecepcaoEvento()
    const resultado = await nfe.NFE_RecepcaoEvento({
      tpEvento: '110111',
      chNFe: chave_acesso,
      nProt: protocolo,
      xJust: justificativa,
    });

    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/cancelar]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
