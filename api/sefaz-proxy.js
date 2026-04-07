/**
 * Vercel Serverless Function - SEFAZ Proxy v5
 * Croma Print - Modulo Fiscal NF-e
 *
 * v5: Agora faz assinatura XMLDSIG usando xml-crypto (C14N real)
 * + transmissao mTLS ao SEFAZ.
 *
 * MODOS:
 *   mode: "sign_and_send" - Recebe XML nao-assinado, assina com xml-crypto, envia ao SEFAZ
 *   mode: "send_only"     - Recebe SOAP pronto, envia diretamente (legado)
 *
 * POST /api/sefaz-proxy
 * Header: x-proxy-secret
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { SignedXml } from 'xml-crypto';

const PROXY_SECRET = process.env.SEFAZ_PROXY_SECRET || 'croma-sefaz-2026';

const SEFAZ_WHITELIST = [
  'homologacao.nfe.fazenda.sp.gov.br',
  'nfe.fazenda.sp.gov.br',
  'nfe-homologacao.svrs.rs.gov.br',
  'nfe.svrs.rs.gov.br',
  'homologacao.nfce.fazenda.sp.gov.br',
  'nfce.fazenda.sp.gov.br',
];

/**
 * Assina o XML da NFe usando xml-crypto (XMLDSIG com C14N real).
 * Retorna o XML assinado.
 */
function signNFeXml(xmlNFe, certPem, keyPem, certDerBase64) {
  // Extrair o Id do infNFe para a Reference URI
  const idMatch = xmlNFe.match(/infNFe[^>]+Id="([^"]+)"/);
  if (!idMatch) throw new Error('Id do infNFe nao encontrado');
  const infNFeId = idMatch[1];

  const sig = new SignedXml({
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    privateKey: keyPem,
  });

  sig.addReference({
    xpath: `//*[@Id='${infNFeId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certDerBase64}</X509Certificate></X509Data>`,
  };

  sig.computeSignature(xmlNFe, {
    location: { reference: "//*[local-name()='NFe']", action: 'append' },
  });

  return sig.getSignedXml();
}

/**
 * Extrai chave privada PEM e certificado PEM/DER de um PFX base64.
 */
function extractFromPfx(certBase64, certPassword) {
  const pfxBuffer = Buffer.from(certBase64.replace(/[\s\r\n]/g, ''), 'base64');
  
  // Node.js crypto pode extrair do PFX
  // Usando openssl-like parsing via crypto
  const pfx = crypto.createSecureContext({
    pfx: pfxBuffer,
    passphrase: certPassword,
  });

  // Para xml-crypto precisamos da chave PEM e cert PEM separados
  // Node.js nao tem API direta para extrair PEM de PFX,
  // mas podemos usar a abordagem com tls.
  // Alternativa: usar forge no proxy tambem, ou passar PEM do edge function.
  
  // Na verdade, a melhor abordagem: a edge function ja extrai com node-forge
  // no Deno. Vamos receber PEM da edge function.
  throw new Error('extractFromPfx nao implementado - use PEM direto');
}

/**
 * Monta o envelope SOAP para NF-e 4.00 SEFAZ SP
 */
function buildSoapEnvelope(xmlAssinado) {
  // Remove declaracao XML do NFe
  const xmlSemDecl = xmlAssinado.replace(/^<\?xml[^?]*\?>\s*/i, '');
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><cUF>35</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>1</idLote><indSinc>1</indSinc>${xmlSemDecl}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

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
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        'Content-Length': bodyBuffer.length,
      },
      rejectUnauthorized: false,
      timeout: 30000,
    };

    if (certBase64 && certPassword) {
      try {
        const certClean = certBase64.replace(/[\s\r\n]/g, '');
        const pfxBuffer = Buffer.from(certClean, 'base64');
        if (pfxBuffer.length < 100) throw new Error('PFX muito pequeno: ' + pfxBuffer.length);
        options.pfx = pfxBuffer;
        options.passphrase = certPassword;
      } catch (pfxErr) {
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
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', service: 'sefaz-proxy-croma-v5', ts: new Date().toISOString() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-proxy-secret'];
  if (PROXY_SECRET && PROXY_SECRET !== 'croma-sefaz-2026' && secret !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const mode = body.mode || 'send_only';

  try {
    if (mode === 'sign_and_send') {
      // NOVO: Recebe XML nao-assinado, assina com xml-crypto, monta SOAP, envia
      const { xml_nfe, sefaz_url, cert_base64, cert_password, key_pem, cert_pem, cert_der_base64 } = body;
      if (!xml_nfe || !sefaz_url || !key_pem) {
        return res.status(400).json({ error: 'xml_nfe, sefaz_url, key_pem sao obrigatorios para sign_and_send' });
      }

      let urlHost;
      try { urlHost = new URL(sefaz_url).hostname; } catch {
        return res.status(400).json({ error: 'sefaz_url invalida' });
      }
      if (!SEFAZ_WHITELIST.includes(urlHost)) {
        return res.status(403).json({ error: 'Host nao permitido: ' + urlHost });
      }

      console.log('[sefaz-proxy] mode=sign_and_send, signing XML...');
      const xmlAssinado = signNFeXml(xml_nfe, cert_pem, key_pem, cert_der_base64);

      console.log('[sefaz-proxy] Building SOAP envelope...');
      const soapEnvelope = buildSoapEnvelope(xmlAssinado);

      console.log(`[sefaz-proxy] Sending to ${sefaz_url}...`);
      const result = await sendSoapRequest(sefaz_url, soapEnvelope, cert_base64, cert_password);
      
      const cStat = result.body.match(/<cStat>(\d+)<\/cStat>/)?.[1];
      const xMotivo = result.body.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
      console.log(`[sefaz-proxy] HTTP ${result.status} | cStat:${cStat ?? '-'} | ${xMotivo ?? '-'}`);

      return res.status(200).json({
        status: result.status,
        body: result.body,
        xml_assinado: xmlAssinado,
        soap_enviado: soapEnvelope,
      });

    } else {
      // LEGADO: Recebe SOAP pronto, envia diretamente
      const { soap_envelope, sefaz_url, cert_base64, cert_password } = body;
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

      console.log(`[sefaz-proxy] mode=send_only -> ${sefaz_url}`);
      const result = await sendSoapRequest(sefaz_url, soap_envelope, cert_base64, cert_password);
      const cStat = result.body.match(/<cStat>(\d+)<\/cStat>/)?.[1];
      const xMotivo = result.body.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
      console.log(`[sefaz-proxy] HTTP ${result.status} | cStat:${cStat ?? '-'} | ${xMotivo ?? '-'}`);
      return res.status(200).json({ status: result.status, body: result.body });
    }
  } catch (err) {
    console.error('[sefaz-proxy] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
