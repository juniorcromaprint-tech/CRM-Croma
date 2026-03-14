import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

// NFE_RetornoAutorizacao nao existe como metodo publico no nfewizard-io v1.0+
// Polling por recibo e feito internamente pelo NFE_Autorizacao.
// Para verificar status pos-emissao, usar /api/consultar com a chave_acesso.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Metodo nao permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Nao autorizado' });
  }

  const { chave_acesso } = req.body;
  if (!chave_acesso) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Use chave_acesso para consultar status. O endpoint /api/consultar e o caminho correto para polling.',
    });
  }

  try {
    const nfe = await createNFeWizard();
    const resultado = await nfe.NFE_ConsultaProtocolo(chave_acesso);
    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/recibo]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
