import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCertificateExpiryDays, validateInternalSecret } from './_cert';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Metodo nao permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Nao autorizado' });
  }

  const diasRestantes = getCertificateExpiryDays();

  if (diasRestantes < 0) {
    return res.status(200).json({
      sucesso: false,
      valido: false,
      mensagem: 'Nao foi possivel ler o certificado',
      dias_restantes: null,
    });
  }

  const vencido = diasRestantes <= 0;
  const alerta = diasRestantes > 0 && diasRestantes <= 30;

  return res.status(200).json({
    sucesso: true,
    valido: !vencido,
    dias_restantes: diasRestantes,
    status: vencido ? 'vencido' : alerta ? 'vencendo' : 'ok',
    mensagem: vencido
      ? 'Certificado expirado — emissao bloqueada'
      : alerta
        ? `Certificado vence em ${diasRestantes} dias — renovar urgente`
        : `Certificado valido por ${diasRestantes} dias`,
  });
}
