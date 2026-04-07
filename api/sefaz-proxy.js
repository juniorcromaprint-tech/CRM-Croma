/**
 * Vercel Serverless Function - SEFAZ Proxy v4
 * Croma Print - Modulo Fiscal NF-e
 *
 * Motivo: Supabase Edge Runtime (Deno) nao tem CAs ICP-Brasil.
 * Node.js faz mTLS com o certificado A1 PFX do emitente.
 *
 * POST /api/sefaz-proxy
 * Body: { soap_envelope, sefaz_url, cert_base64, cert_password }
 * Header: x-proxy-secret
 */

import https from 'https';
import http from 'http';

const PROXY_SECRET = process.env.SEFAZ_PROXY_SECRET || 'croma-sefaz-2026';

const SEFAZ_WHITELIST = [
  'homologacao.nfe.fazenda.sp.gov.br',
  'nfe.fazenda.sp.gov.br',
  'nfe-homologacao.svrs.rs.gov.br',
  'nfe.svrs.rs.gov.br',
  'homologacao.nfce.fazenda.sp.gov.br',
  'nfce.fazenda.sp.gov.br',
];

function sendSoapRequest(urlStr, soapBody, certBase64, certPassword) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlStr); } catch (e) { return reject(new Error('URL invalida: ' + urlStr)); }

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyBuffer = Buffer.from(soapBody, 'utf8');

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        // SOAP 1.2: action vai dentro do Content-Type, NAO como header SOAPAction separado
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        'Content-Length': bodyBuffer.length,
      },
      rejectUnauthorized: false,
      timeout: 30000,
    };

    // Adicionar certificado de cliente (mTLS) se fornecido
    if (certBase64 && certPassword) {
      try {
        // Limpar espacos/quebras de linha do base64 antes de decodificar
        const certClean = certBase64.replace(/[\s\r\n]/g, '');
        const pfxBuffer = Buffer.from(certClean, 'base64');
        console.log(`[sefaz-proxy] PFX buffer size: ${pfxBuffer.length} bytes`);
        if (pfxBuffer.length < 100) throw new Error(`PFX muito pequeno: ${pfxBuffer.length} bytes`);
        options.pfx = pfxBuffer;
        options.passphrase = certPassword;
      } catch (pfxErr) {
        console.error('[sefaz-proxy] Erro ao processar PFX:', pfxErr.message);
        throw new Error('Certificado PFX invalido: ' + pfxErr.message);
      }
    }

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout SEFAZ (30s)')); });
    req.write(bodyBuffer);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', service: 'sefaz-proxy-croma', ts: new Date().toISOString() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticacao
  const secret = req.headers['x-proxy-secret'];
  if (PROXY_SECRET && PROXY_SECRET !== 'croma-sefaz-2026' && secret !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { soap_envelope, sefaz_url, cert_base64, cert_password } = req.body || {};

  if (!soap_envelope || !sefaz_url) {
    return res.status(400).json({ error: 'soap_envelope e sefaz_url sao obrigatorios' });
  }

  let urlHost;
  try { urlHost = new URL(sefaz_url).hostname; } catch {
    return res.status(400).json({ error: 'sefaz_url invalida' });
  }
  if (!SEFAZ_WHITELIST.includes(urlHost)) {
    return res.status(403).json({ error: 'Host nao permitido: ' + urlHost });
  }

  try {
    console.log(`[sefaz-proxy] -> ${sefaz_url} | cert=${!!cert_base64}`);
    const result = await sendSoapRequest(sefaz_url, soap_envelope, cert_base64, cert_password);
    const cStat = result.body.match(/<cStat>(\d+)<\/cStat>/)?.[1];
    const xMotivo = result.body.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
    console.log(`[sefaz-proxy] HTTP ${result.status} | cStat:${cStat ?? '-'} | ${xMotivo ?? '-'}`);
    return res.status(200).json({ status: result.status, body: result.body });
  } catch (err) {
    console.error('[sefaz-proxy] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
