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

  try {
    const nfe = await createNFeWizard();
    const payload = req.body;

    // NFE_Autorizacao — metodo correto (nao e AutorizacaoLote)
    const resultado = await nfe.NFE_Autorizacao(payload);

    return res.status(200).json({
      sucesso: true,
      retorno: resultado,
    });
  } catch (err) {
    console.error('[nfe-service/emitir]', err);
    return res.status(500).json({
      sucesso: false,
      mensagem_erro: String(err),
    });
  }
}
