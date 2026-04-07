/**
 * Vercel Serverless Function - SEFAZ Proxy
 * Croma Print - Módulo Fiscal NF-e
 *
 * Necessário porque o Supabase Edge Runtime (Deno) não tem CAs ICP-Brasil.
 * Esta função Node.js faz a chamada ao WebService SEFAZ com rejectUnauthorized: false.
 *
 * Endpoint: POST /api/sefaz-proxy
 * Body: { soap_envelope: string, sefaz_url: string }
 * Header: x-proxy-secret: <SEFAZ_PROXY_SECRET>
 */

const https = require('https');
const http = require('http');

const PROXY_SECRET = process.env.SEFAZ_PROXY_SECRET || 'croma-sefaz-2026';

function sendSoapRequest(urlStr, soapBody) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlStr); } catch { return reject(new Error('URL inválida: ' + urlStr)); }

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyBuffer = Buffer.from(soapBody, 'utf8');
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        'Content-Length': bodyBuffer.length,
      },
      rejectUnauthorized: false, // Aceita CAs ICP-Brasil (SEFAZ homologação)
      timeout: 30000,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout SEFAZ')); });
    req.write(bodyBuffer);
    req.end();
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'sefaz-proxy-croma', ts: new Date().toISOString() });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validar secret
  const secret = req.headers['x-proxy-secret'];
  if (secret !== PROXY_SECRET) {
    console.error('[sefaz-proxy] Unauthorized - secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { soap_envelope, sefaz_url } = req.body;

  if (!soap_envelope || !sefaz_url) {
    return res.status(400).json({ error: 'soap_envelope e sefaz_url são obrigatórios' });
  }

  // Whitelist de URLs SEFAZ permitidas
  const SEFAZ_WHITELIST = [
    'homologacao.nfe.fazenda.sp.gov.br',
    'nfe.fazenda.sp.gov.br',
    'nfe-homologacao.svrs.rs.gov.br',
    'nfe.svrs.rs.gov.br',
    'homologacao.nfce.fazenda.sp.gov.br',
  ];

  let urlHost;
  try { urlHost = new URL(sefaz_url).hostname; } catch { return res.status(400).json({ error: 'sefaz_url inválida' }); }

  if (!SEFAZ_WHITELIST.includes(urlHost)) {
    return res.status(403).json({ error: 'Host SEFAZ não permitido: ' + urlHost });
  }

  try {
    console.log(`[sefaz-proxy] → ${sefaz_url}`);
    const result = await sendSoapRequest(sefaz_url, soap_envelope);

    // Log do resultado
    const cStat = result.body.match(/<cStat>(\d+)<\/cStat>/)?.[1];
    const xMotivo = result.body.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
    console.log(`[sefaz-proxy] ← HTTP ${result.status} | cStat: ${cStat} | ${xMotivo}`);

    return res.status(200).json({ status: result.status, body: result.body });
  } catch (err) {
    console.error('[sefaz-proxy] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
