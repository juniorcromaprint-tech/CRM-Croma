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

  const { numero_recibo } = req.body;
  if (!numero_recibo) {
    return res.status(400).json({ sucesso: false, mensagem_erro: 'numero_recibo e obrigatorio' });
  }

  try {
    const nfe = await createNFeWizard();
    const resultado = await nfe.NFE_RetornoAutorizacao({ nRec: numero_recibo });
    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/recibo]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
