import * as fs from 'fs';

const CERT_DIR = '/tmp/nfewizard';
const CERT_PATH = `${CERT_DIR}/croma_cert.pfx`;

/**
 * Extrai o certificado A1 da variavel de ambiente NFE_CERT_BASE64
 * e escreve em /tmp para ser usado pelo nfewizard-io.
 * Reutiliza o arquivo se ja existir na invocacao atual.
 */
export function loadCertificate(): { certPath: string; certPassword: string } {
  const certBase64 = process.env.NFE_CERT_BASE64;
  const certPassword = process.env.NFE_CERT_PASSWORD;

  if (!certBase64) throw new Error('NFE_CERT_BASE64 nao configurado');
  if (!certPassword) throw new Error('NFE_CERT_PASSWORD nao configurado');

  // Cria diretorio se nao existe (Vercel /tmp e writeable)
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  // Cria subdiretorios para XMLs
  const subdirs = ['autorizados', 'cancelados'];
  for (const sub of subdirs) {
    const subPath = `${CERT_DIR}/${sub}`;
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  }

  if (!fs.existsSync(CERT_PATH)) {
    const certBuffer = Buffer.from(certBase64, 'base64');
    fs.writeFileSync(CERT_PATH, certBuffer);
  }

  return { certPath: CERT_PATH, certPassword };
}

/**
 * Le a validade do certificado A1 e retorna os dias restantes.
 * Retorna -1 se nao conseguir ler.
 */
export function getCertificateExpiryDays(): number {
  try {
    const { certPath, certPassword } = loadCertificate();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const forge = require('node-forge');
    const pfxBuffer = fs.readFileSync(certPath);
    const p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(pfxBuffer.toString('binary')),
      certPassword,
    );
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    if (!cert) return -1;
    const validTo = new Date(cert.validity.notAfter);
    const hoje = new Date();
    return Math.floor((validTo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

/**
 * Valida o header de autenticacao interna entre Edge Function e microservico.
 */
export function validateInternalSecret(
  req: { headers: Record<string, string | string[] | undefined> },
): boolean {
  const secret = process.env.NFE_INTERNAL_SECRET;
  if (!secret) return false;
  return req.headers['x-internal-secret'] === secret;
}
