import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

/**
 * DANFE — Geracao de PDF da NF-e via NFE_GerarDanfe() do nfewizard-io.
 *
 * Recebe: { nfe_payload } — o mesmo payload usado na autorizacao
 * Retorna: PDF base64
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Metodo nao permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Nao autorizado' });
  }

  const { nfe_payload } = req.body;

  if (!nfe_payload) {
    return res.status(400).json({ sucesso: false, mensagem_erro: 'nfe_payload e obrigatorio' });
  }

  try {
    const nfe = await createNFeWizard();

    // NFE_GerarDanfe e nativo no nfewizard-io
    const resultado = await nfe.NFE_GerarDanfe({ nfe: nfe_payload });

    // O resultado pode ser um caminho de arquivo ou buffer — normalizar para base64
    let pdfBase64: string;
    if (typeof resultado === 'string' && fs.existsSync(resultado)) {
      pdfBase64 = fs.readFileSync(resultado).toString('base64');
    } else if (Buffer.isBuffer(resultado)) {
      pdfBase64 = resultado.toString('base64');
    } else {
      pdfBase64 = Buffer.from(String(resultado)).toString('base64');
    }

    return res.status(200).json({
      sucesso: true,
      pdf_base64: pdfBase64,
    });
  } catch (err) {
    console.error('[nfe-service/danfe]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
