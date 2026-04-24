/**
 * CROMA PRINT ERP - Edge Function: Emitir NF-e v47
 *
 * AUTENTICACAO: verify_jwt=false + verificacao manual via /auth/v1/user
 * ASSINATURA: XML assinado internamente com certificado A1 PFX via node-forge
 * TRANSMISSAO: Via proxy Vercel (Node.js) com rejectUnauthorized:false para ICP-Brasil
 *
 * Secrets necessarios no Supabase:
 *   NFE_CERT_BASE64        - certificado PFX codificado em base64
 *   NFE_CERT_PASSWORD      - senha do certificado PFX
 *   NFE_SERVICE_ENABLED    - "true" ativa transmissao real (sem isso = modo demo)
 *   SEFAZ_PROXY_URL        - URL do proxy Vercel (ex: https://crm-croma.vercel.app/api/sefaz-proxy)
 *   SEFAZ_PROXY_SECRET     - secret compartilhado para autenticar no proxy
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
// @ts-ignore - node-forge para PFX/assinatura XML
import forge from 'https://esm.sh/node-forge@1.3.1';

// Normaliza texto para XML SEFAZ: remove acentos e caracteres nao-ASCII
// SEFAZ rejeita XML com acentos no body (400 Bad Request) mesmo com UTF-8 declarado
function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacriticos
    .replace(/[^\x00-\x7F]/g, '')    // remove qualquer char nao-ASCII restante
    .replace(/&/g, 'e')               // & vira e (nao pode escapar como &amp; aqui pois ja vai no XML)
    .trim();
}

// Escapa caracteres especiais XML alem de normalizar
function xmlText(str: string): string {
  return normalizeText(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-service-token, x-forense-debug',
  };
}

const SERVICE_TOKEN = 'croma-fiscal-interno-2026';

async function verificarAutenticacao(req: Request, authHeader: string, supabaseUrl: string, anonKey: string, serviceRoleKey: string): Promise<boolean> {
  // Aceita x-service-token para chamadas internas (automacoes, cron, etc)
  const serviceToken = req.headers.get('x-service-token');
  if (serviceToken === SERVICE_TOKEN) return true;
  // Aceita service_role key diretamente
  const token = authHeader.replace('Bearer ', '');
  if (token === serviceRoleKey) return true;
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    });
    if (!resp.ok) return false;
    const user = await resp.json();
    return !!user?.id;
  } catch {
    return false;
  }
}


// ============================================================
// C14N + ASSINATURA XMLDSIG — v44
//
// PROBLEMA CORRIGIDO (v30 e anteriores):
//   canonicalize() extraia <infNFe> SEM o namespace xmlns herdado
//   do elemento pai <NFe xmlns="http://www.portalfiscal.inf.br/nfe">.
//   Isso gerava digest divergente do calculado pelo SEFAZ.
//
// SOLUCAO (v31):
//   c14nInfNFe() extrai o elemento infNFe e injeta o xmlns herdado.
//   c14nSignedInfo() normaliza whitespace do SignedInfo (sem namespace extra).
//   assinarXmlNFe() usa c14nInfNFe + c14nSignedInfo + node-forge (RSA-SHA1).
//
// Ground-truth validado em Python (C:\Temp\test_c14n_nfe.py):
//   XML fixture digest: fCygXtK3Iog1yIGv7AA2qOp5wFI=
//
// ESCOPO: apenas esta camada. Sem alteracao de regra fiscal,
//         SOAP, proxy, montagem de payload ou qualquer outra funcao.
// ============================================================

const NAMESPACE_NFE = 'http://www.portalfiscal.inf.br/nfe';

/**
 * C14N para o elemento <infNFe> — usado para calcular o DigestValue.
 *
 * Subconjunto do W3C Canonical XML 1.0 suficiente para NF-e:
 *   1. Remove declaracao <?xml ...?>
 *   2. Remove whitespace inter-element (>\s+< -> ><)
 *   3. Extrai o elemento infNFe
 *   4. Propaga xmlns do elemento pai <NFe xmlns="..."> para <infNFe>
 *      (C14N inclusivo: namespaces em uso devem ser declarados no
 *       elemento de referencia quando o contexto do documento e perdido)
 *
 * Por que este subconjunto e suficiente para NF-e:
 *   - Um unico namespace default (xmlns=...nfe), sem prefixos
 *   - Sem atributos com namespace
 *   - Sem entidades customizadas
 *   - Sem PI ou comentarios relevantes no escopo
 */
function c14nInfNFe(xmlNFe: string): string {
  // ========================================================
  // v44: C14N INCLUSIVO W3C (Canonical XML 1.0)
  //
  // Comprovado byte-a-byte contra lxml etree.tostring(method='c14n')
  // Ground truth: 3442 bytes, digest ptedvSzXubfQTM/UqJzUAUN30zc=
  //
  // Regras:
  //   1. <infNFe> recebe xmlns="nfe" + atributos em ordem lexico
  //   2. Filhos diretos de infNFe (depth=1): sem xmlns=""
  //   3. Todos os demais (depth>=2): recebem xmlns=""
  // ========================================================
  const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

  // Passo 1: Limpar
  let xml = xmlNFe.replace(/<\?xml[^?]*\?>\s*/gi, '');
  xml = xml.replace(/>\s+</g, '><');
  xml = xml.replace(/\s{2,}/g, ' ').trim();

  // Passo 2: Extrair infNFe
  const m = xml.match(/<infNFe[\s\S]*?<\/infNFe>/);
  if (!m) throw new Error('c14nInfNFe: elemento <infNFe> nao encontrado no XML');
  const infnfe = m[0];

  // Passo 3: Processar tag por tag com depth tracking
  const result: string[] = [];
  let pos = 0;
  let depth = -1; // infNFe sera depth 0

  while (pos < infnfe.length) {
    if (infnfe[pos] !== '<') {
      // Texto entre tags
      const nextLt = infnfe.indexOf('<', pos);
      if (nextLt === -1) {
        result.push(infnfe.slice(pos));
        break;
      }
      result.push(infnfe.slice(pos, nextLt));
      pos = nextLt;
      continue;
    }

    // Encontrar fim da tag
    const gtPos = infnfe.indexOf('>', pos);
    if (gtPos === -1) break;
    let tag = infnfe.slice(pos, gtPos + 1);

    if (tag.startsWith('</')) {
      // Tag de fechamento
      depth--;
      result.push(tag);
    } else if (tag.startsWith('<infNFe')) {
      // Tag raiz: xmlns primeiro, depois atributos em ordem lexico
      depth = 0;
      const attrRegex = /([\w:]+)="([^"]*)"/g;
      let attrMatch: RegExpExecArray | null;
      let xmlnsVal: string | null = null;
      const normalAttrs: [string, string][] = [];
      while ((attrMatch = attrRegex.exec(tag)) !== null) {
        if (attrMatch[1] === 'xmlns') {
          xmlnsVal = attrMatch[2];
        } else {
          normalAttrs.push([attrMatch[1], attrMatch[2]]);
        }
      }
      if (!xmlnsVal) xmlnsVal = NFE_NS;
      normalAttrs.sort((a, b) => a[0].localeCompare(b[0]));
      let newTag = `<infNFe xmlns="${xmlnsVal}"`;
      for (const [k, v] of normalAttrs) {
        newTag += ` ${k}="${v}"`;
      }
      newTag += '>';
      result.push(newTag);
    } else if (tag.endsWith('/>')) {
      // Self-closing tag
      depth++;
      if (depth >= 2) {
        const tnMatch = tag.match(/^<(\w+)/);
        if (tnMatch) {
          const tagName = tnMatch[1];
          const rest = tag.slice(tagName.length + 1, -2).trim();
          tag = rest ? `<${tagName} xmlns="" ${rest}/>` : `<${tagName} xmlns=""/>`;
        }
      }
      result.push(tag);
      depth--; // Self-closing nao aumenta depth permanente
    } else {
      // Tag de abertura normal
      depth++;
      if (depth >= 2) {
        const tnMatch = tag.match(/^<(\w+)/);
        if (tnMatch) {
          const tagName = tnMatch[1];
          const rest = tag.slice(tagName.length + 1, -1).trim();
          tag = rest ? `<${tagName} xmlns="" ${rest}>` : `<${tagName} xmlns="">`;
        }
      }
      result.push(tag);
    }

    pos = gtPos + 1;
  }

  return result.join('');
}

/**
 * C14N para o elemento <SignedInfo> — usado para calcular a assinatura RSA.
 *
 * SignedInfo e construido inline (sem elemento pai com namespace a herdar).
 * Aplica apenas normalizacao de whitespace — estruturalmente correto para
 * o contexto em que e usado (dentro de <Signature xmlns="...xmldsig#">).
 */
function c14nSignedInfo(signedInfo: string): string {
  // ========================================================
  // v46: C14N STANDALONE do SignedInfo
  //
  // Descoberta forense: a assinatura RSA verifica localmente (Python/lxml)
  // com C14N inclusive (722 bytes, xmlns="" nos netos), MAS o SEFAZ
  // (Apache Santuario/Java) trata o SignedInfo como fragmento standalone
  // para verificacao de assinatura. Resultado: C14N SEM xmlns="" em
  // nenhum elemento filho — apenas xmlns="xmldsig#" no SignedInfo.
  //
  // Regras (XMLDSIG spec, Section 3.3.2):
  //   1. Adicionar xmlns="xmldsig#" no <SignedInfo>
  //   2. Expandir self-closing: <Tag .../> -> <Tag ...></Tag>
  //   3. NAO adicionar xmlns="" (SignedInfo e standalone para assinatura)
  //
  // Comprovado: lxml etree.tostring(si_reparsed, method='c14n')
  // onde si_reparsed = etree.fromstring(etree.tostring(si))
  // produz resultado SEM xmlns="" — identico ao Apache Santuario.
  // ========================================================
  const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
  let s = signedInfo.replace(/<\?xml[^?]*\?>\s*/gi, '');
  s = s.replace(/>\s+</g, '><');
  s = s.replace(/\s{2,}/g, ' ').trim();

  // 1. Adicionar xmlns se nao presente
  if (s.includes('<SignedInfo>') && !s.split('>')[0].includes('xmlns=')) {
    s = s.replace('<SignedInfo>', `<SignedInfo xmlns="${DSIG_NS}">`);
  }

  // 2. Expandir self-closing tags: <Tag .../> -> <Tag ...></Tag>
  s = s.replace(/<(\w+)([^>]*)\/>/g, (_: string, tag: string, attrs: string) => `<${tag}${attrs}></${tag}>`);

  // v46: NAO adicionar xmlns="" - SignedInfo e tratado como standalone
  return s;
}

/**
 * Assina o XML da NF-e com RSA-SHA1 (XMLDSIG enveloped signature).
 *
 * Fluxo:
 *   1. Extrair chave privada e certificado do PFX (node-forge)
 *   2. c14nInfNFe(xmlNFe) → infNFe canonicalizado com xmlns herdado
 *   3. SHA1(infNFe C14N) → DigestValue
 *   4. Montar SignedInfo com DigestValue correto
 *   5. c14nSignedInfo(signedInfo) → SignedInfo canonicalizado
 *   6. SHA1(SignedInfo C14N) → RSA.sign() → SignatureValue
 *   7. Montar <Signature> e inserir como ultimo filho de <NFe>
 */
async function assinarXmlNFe(xmlNFe: string, certBase64: string, certPassword: string): Promise<string> {
  // --- Extrair PFX ---
  const pfxDer = forge.util.decode64(certBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPassword);

  const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBags = bags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBagsArr = certBags[forge.pki.oids.certBag] || [];

  if (keyBags.length === 0) throw new Error('assinarXmlNFe: chave privada nao encontrada no PFX');
  if (certBagsArr.length === 0) throw new Error('assinarXmlNFe: certificado nao encontrado no PFX');

  const privateKey = keyBags[0].key;
  const certificate = certBagsArr[0].cert;

  // --- Extrair Id do infNFe para Reference URI ---
  const idMatch = xmlNFe.match(/infNFe[^>]+Id="([^"]+)"/);
  if (!idMatch) throw new Error('assinarXmlNFe: Id do infNFe nao encontrado no XML');
  const infNFeId = idMatch[1];

  // --- PASSO 2: C14N do infNFe com namespace herdado ---
  const infNFeC14N = c14nInfNFe(xmlNFe);

  // --- PASSO 3: DigestValue = base64(SHA1(infNFe C14N)) ---
  const mdDigest = forge.md.sha1.create();
  mdDigest.update(infNFeC14N, 'utf8');
  const digestBase64 = forge.util.encode64(mdDigest.digest().bytes());

  // --- PASSO 4: Montar SignedInfo ---
  const signedInfo = [
    '<SignedInfo>',
    '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>',
    `<Reference URI="#${infNFeId}">`,
    '<Transforms>',
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
    '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    '</Transforms>',
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>',
    `<DigestValue>${digestBase64}</DigestValue>`,
    '</Reference>',
    '</SignedInfo>',
  ].join('');

  // --- PASSO 5: C14N do SignedInfo (v45 dual mode) ---
  // signedInfoC14N = 722 bytes COM xmlns="" nos depth>=2 (para assinar)
  // signedInfoClean = SEM xmlns="" (para inserir no XML)
  //
  // Quando o SEFAZ recebe XML com SignedInfo LIMPO e faz C14N inclusive
  // no contexto do documento (<NFe xmlns="nfe"> > <Signature xmlns="dsig#">),
  // o resultado e 722 bytes COM xmlns="" — IDENTICO ao que assinamos.
  // Se inserirmos COM xmlns="", o SEFAZ recalcula 704 bytes (Transform
  // herda xmlns="" de Transforms pai, nao repete) -> mismatch -> 297.
  const signedInfoC14N = c14nSignedInfo(signedInfo);

  // SignedInfo limpo: expandir self-closing + xmlns dsig, mas SEM xmlns=""
  const DSIG_NS_CLEAN = 'http://www.w3.org/2000/09/xmldsig#';
  let signedInfoClean = signedInfo.replace(/<\?xml[^?]*\?>\s*/gi, '');
  signedInfoClean = signedInfoClean.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
  if (signedInfoClean.includes('<SignedInfo>') && !signedInfoClean.split('>')[0].includes('xmlns=')) {
    signedInfoClean = signedInfoClean.replace('<SignedInfo>', `<SignedInfo xmlns="${DSIG_NS_CLEAN}">`);
  }
  signedInfoClean = signedInfoClean.replace(/<(\w+)([^>]*)\/>/g, (_: string, tag: string, attrs: string) => `<${tag}${attrs}></${tag}>`);

  // --- PASSO 6: SignatureValue = base64(RSA-SHA1(SignedInfo C14N)) ---
  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfoC14N, 'utf8');
  const signatureBase64 = forge.util.encode64(privateKey.sign(mdSig));

  // --- Certificado DER base64 para X509Certificate ---
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
  const certBase64Der = forge.util.encode64(certDer);

  // --- PASSO 7: Montar <Signature> e inserir como ultimo filho de <NFe> ---
  const signatureElement = [
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
    signedInfoClean,  // v45: inserir SignedInfo LIMPO (sem xmlns="") no XML
    `<SignatureValue>${signatureBase64}</SignatureValue>`,
    '<KeyInfo><X509Data>',
    `<X509Certificate>${certBase64Der}</X509Certificate>`,
    '</X509Data></KeyInfo>',
    '</Signature>',
  ].join('');

  return xmlNFe.replace('</NFe>', `${signatureElement}</NFe>`);
}



/**
 * Converte o payload JSON NF-e para XML string
 */
function nfePayloadToXml(payload: any, chaveAcesso: string): string {
  const inf = payload.NFe.infNFe;
  const ide = inf.ide;
  const emit = inf.emit;
  const dest = inf.dest;
  const dets = inf.det;
  const total = inf.total.ICMSTot;
  const transp = inf.transp;
  const infAdic = inf.infAdic;

  // v38: XML compacto na origem - sem whitespace entre tags, gerado ANTES da assinatura
  // Regra: o XML assinado NAO pode ser alterado estruturalmente depois - proibido qualquer replace pos-assinatura
  const destXml = (() => {
    const cnpjCpf = dest.CNPJ ? `<CNPJ>${dest.CNPJ}</CNPJ>` : `<CPF>${dest.CPF}</CPF>`;
    // xBairro e opcional (0..1) para enderDest no schema NF-e 4.00 - omitir se vazio
    const xBairroDestVal = dest.enderDest.xBairro?.trim() || '..';
    const xBairroXml = `<xBairro>${xBairroDestVal}</xBairro>`;
    const ieXml = dest.IE ? `<IE>${dest.IE}</IE>` : '';
    const emailXml = dest.email ? `<email>${dest.email}</email>` : '';
    return `<dest>${cnpjCpf}<xNome>${dest.xNome}</xNome><enderDest><xLgr>${dest.enderDest.xLgr}</xLgr><nro>${dest.enderDest.nro}</nro>${xBairroXml}<cMun>${dest.enderDest.cMun}</cMun><xMun>${dest.enderDest.xMun}</xMun><UF>${dest.enderDest.UF}</UF><CEP>${dest.enderDest.CEP}</CEP><cPais>${dest.enderDest.cPais}</cPais><xPais>${dest.enderDest.xPais}</xPais></enderDest><indIEDest>${dest.indIEDest}</indIEDest>${ieXml}${emailXml}</dest>`;
  })();

  const detsXml = dets.map((det: any) => {
    const prod = det.prod;
    const imp = det.imposto;
    const icms = imp.ICMS.ICMSSN102 || imp.ICMS.ICMS40 || {};
    const icmsTag = imp.ICMS.ICMSSN102 ? 'ICMSSN102' : 'ICMS40';
    return `<det nItem="${det['@nItem']}"><prod><cProd>${prod.cProd}</cProd><cEAN>${prod.cEAN}</cEAN><xProd>${prod.xProd}</xProd><NCM>${prod.NCM}</NCM><CFOP>${prod.CFOP}</CFOP><uCom>${prod.uCom}</uCom><qCom>${prod.qCom}</qCom><vUnCom>${prod.vUnCom}</vUnCom><vProd>${prod.vProd}</vProd><cEANTrib>${prod.cEANTrib}</cEANTrib><uTrib>${prod.uTrib}</uTrib><qTrib>${prod.qTrib}</qTrib><vUnTrib>${prod.vUnTrib}</vUnTrib><indTot>${prod.indTot}</indTot></prod><imposto><ICMS><${icmsTag}><orig>${icms.orig || '0'}</orig><CSOSN>${icms.CSOSN || '102'}</CSOSN></${icmsTag}></ICMS><PIS><PISOutr><CST>${imp.PIS.PISOutr.CST}</CST><vBC>${imp.PIS.PISOutr.vBC}</vBC><pPIS>${imp.PIS.PISOutr.pPIS}</pPIS><vPIS>${imp.PIS.PISOutr.vPIS}</vPIS></PISOutr></PIS><COFINS><COFINSOutr><CST>${imp.COFINS.COFINSOutr.CST}</CST><vBC>${imp.COFINS.COFINSOutr.vBC}</vBC><pCOFINS>${imp.COFINS.COFINSOutr.pCOFINS}</pCOFINS><vCOFINS>${imp.COFINS.COFINSOutr.vCOFINS}</vCOFINS></COFINSOutr></COFINS></imposto></det>`;
  }).join('');

  const infAdicXml = (infAdic?.infCpl || infAdic?.infAdFisco)
    ? `<infAdic>${infAdic.infCpl ? `<infCpl>${infAdic.infCpl}</infCpl>` : ''}${infAdic.infAdFisco ? `<infAdFisco>${infAdic.infAdFisco}</infAdFisco>` : ''}</infAdic>`
    : '';

  // v48: chaveAcesso tem prefixo 'NFe' (47 chars), offset +3
  const chaveNumerica = chaveAcesso.replace('NFe', '');
  const cNF = chaveNumerica.slice(35, 43);
  const cDV = chaveNumerica.slice(43, 44);

  // v40: XML 100% compacto gerado na origem - NENHUM whitespace entre tags
  // Regra absoluta: o XML assinado nao pode sofrer nenhuma transformacao estrutural posterior
  // v40 adds: procEmi, verProc em <ide>; <pag> entre </transp> e </infNFe>; SOAP compacto
  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="${chaveAcesso}" versao="4.00"><ide><cUF>${ide.cUF}</cUF><cNF>${cNF}</cNF><natOp>${ide.natOp}</natOp><mod>${ide.mod}</mod><serie>${ide.serie}</serie><nNF>${ide.nNF}</nNF><dhEmi>${ide.dhEmi}</dhEmi><tpNF>${ide.tpNF}</tpNF><idDest>${ide.idDest}</idDest><cMunFG>${ide.cMunFG}</cMunFG><tpImp>${ide.tpImp}</tpImp><tpEmis>${ide.tpEmis}</tpEmis><cDV>${cDV}</cDV><tpAmb>${ide.tpAmb}</tpAmb><finNFe>${ide.finNFe}</finNFe><indFinal>${ide.indFinal}</indFinal><indPres>${ide.indPres}</indPres><procEmi>${ide.procEmi}</procEmi><verProc>${ide.verProc}</verProc></ide><emit><CNPJ>${emit.CNPJ}</CNPJ><xNome>${emit.xNome}</xNome><enderEmit><xLgr>${emit.enderEmit.xLgr}</xLgr><nro>${emit.enderEmit.nro}</nro><xBairro>${emit.enderEmit.xBairro}</xBairro><cMun>${emit.enderEmit.cMun}</cMun><xMun>${emit.enderEmit.xMun}</xMun><UF>${emit.enderEmit.UF}</UF><CEP>${emit.enderEmit.CEP}</CEP><cPais>${emit.enderEmit.cPais}</cPais><xPais>${emit.enderEmit.xPais}</xPais></enderEmit><IE>${emit.IE}</IE><CRT>${emit.CRT}</CRT></emit>${destXml}${detsXml}<total><ICMSTot><vBC>${total.vBC}</vBC><vICMS>${total.vICMS}</vICMS><vICMSDeson>${total.vICMSDeson}</vICMSDeson><vFCPUFDest>${total.vFCPUFDest}</vFCPUFDest><vICMSUFDest>${total.vICMSUFDest}</vICMSUFDest><vICMSUFRemet>${total.vICMSUFRemet}</vICMSUFRemet><vFCP>${total.vFCP}</vFCP><vBCST>${total.vBCST}</vBCST><vST>${total.vST}</vST><vFCPST>${total.vFCPST}</vFCPST><vFCPSTRet>${total.vFCPSTRet}</vFCPSTRet><vProd>${total.vProd}</vProd><vFrete>${total.vFrete}</vFrete><vSeg>${total.vSeg}</vSeg><vDesc>${total.vDesc}</vDesc><vII>${total.vII}</vII><vIPI>${total.vIPI}</vIPI><vIPIDevol>${total.vIPIDevol}</vIPIDevol><vPIS>${total.vPIS}</vPIS><vCOFINS>${total.vCOFINS}</vCOFINS><vOutro>${total.vOutro}</vOutro><vNF>${total.vNF}</vNF><vTotTrib>${total.vTotTrib}</vTotTrib></ICMSTot></total><transp><modFrete>${transp.modFrete}</modFrete></transp><pag><detPag><tPag>${inf.pag?.tPag || "90"}</tPag><vPag>${(inf.pag?.tPag || "90") === "90" ? "0.00" : (inf.pag?.vPag || total.vNF)}</vPag></detPag></pag>${infAdicXml}</infNFe></NFe>`;
}


/**
 * Calcula a chave de acesso da NF-e (44 digitos)
 */
function calcularChaveAcesso(
  cUF: string, aamm: string, cnpj: string, mod: string,
  serie: string, nNF: string, tpEmis: string, cNF: string
): string {
  const chave = `${cUF}${aamm}${cnpj.padStart(14, '0')}${mod}${serie.padStart(3, '0')}${nNF.padStart(9, '0')}${tpEmis}${cNF.padStart(8, '0')}`;
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return `NFe${chave}${dv}`;
}

/**
 * Monta o envelope SOAP para envio ao WebService SEFAZ
 */
function montarEnvelopeSoap(xmlAssinado: string, ambiente: string): string {
  // Remove declaracao XML do NFe antes de embutir no SOAP
  // Declaracao <?xml?> NAO pode aparecer em posicao diferente de 0 num documento XML
  let xmlSemDeclaracao = xmlAssinado.replace(/^<\?xml[^?]*\?>\s*/i, '');
  // v42: NAO remover xmlns de <NFe> - causa cStat 297 (assinatura diverge)\n  // Invariante B=C: xml_assinado deve ser identico ao XML dentro do SOAP\n  // v38: PROIBIDO qualquer replace estrutural apos a assinatura.
  // O XML ja chega compacto de nfePayloadToXml - nenhuma transformacao de conteudo aqui.
  // v40: SOAP 100% compacto - sem whitespace entre tags no enviNFe
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><cUF>35</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>1</idLote><indSinc>1</indSinc>${xmlSemDeclaracao}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

// URLs dos WebServices SEFAZ
const SEFAZ_URLS = {
  homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
  producao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
};

/**
 * Chama o proxy Vercel para transmitir ao SEFAZ.
 * O proxy Node.js usa rejectUnauthorized:false para aceitar CA ICP-Brasil.
 */
async function transmitirViaProxy(soapEnvelope: string, sefazUrl: string, proxyUrl: string, proxySecret: string, certBase64: string, certPassword: string): Promise<{ status: number; body: string }> {
  const resp = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-secret': proxySecret,
    },
    body: JSON.stringify({
      soap_envelope: soapEnvelope,
      sefaz_url: sefazUrl,
      cert_base64: certBase64,
      cert_password: certPassword,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Proxy SEFAZ retornou HTTP ${resp.status}: ${errText}`);
  }
  const json = await resp.json() as { status: number; body: string };
  return json;
}

interface EmitirRequest {
  documento_id: string;
}


serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ sucesso: false, mensagem_erro: 'Nao autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const autenticado = await verificarAutenticacao(req, authHeader, supabaseUrl, anonKey, serviceRoleKey);
  if (!autenticado) {
    return new Response(JSON.stringify({ sucesso: false, mensagem_erro: 'Token invalido ou sessao expirada' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } });

    const body: EmitirRequest = await req.json();
    const { documento_id } = body;

    if (!documento_id) {
      return new Response(JSON.stringify({ sucesso: false, mensagem_erro: 'documento_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('fiscal_documentos')
      .select(`
        *,
        fiscal_documentos_itens(*),
        clientes(*),
        pedidos!fiscal_documentos_pedido_id_fkey(numero, valor_total),
        fiscal_ambientes(tipo, endpoint_base, empresa_id, empresas(*)),
        fiscal_series(serie),
        fiscal_certificados(id, nome, arquivo_encriptado_url, senha_secret_ref, cnpj_titular)
      `)
      .eq('id', documento_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ sucesso: false, mensagem_erro: 'Documento fiscal nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['apto', 'rascunho', 'rejeitado', 'erro_transmissao'].includes(doc.status)) {
      return new Response(JSON.stringify({ sucesso: false, mensagem_erro: `Documento com status '${doc.status}' nao pode ser emitido` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const errosValidacao: string[] = [];
    const clienteVal = doc.clientes;
    const cpfCnpjVal = clienteVal?.cpf_cnpj?.replace(/\D/g, '');
    if (!cpfCnpjVal || (cpfCnpjVal.length !== 11 && cpfCnpjVal.length !== 14)) {
      errosValidacao.push('Cliente sem CPF/CNPJ valido');
    }
    const itensVal = doc.fiscal_documentos_itens ?? [];
    if (itensVal.length === 0) errosValidacao.push('Documento sem itens');
    itensVal.forEach((item: any, idx: number) => {
      if (!item.ncm || item.ncm.replace(/\D/g, '').length !== 8) errosValidacao.push(`Item ${idx + 1}: NCM invalido`);
      if (!item.cfop || item.cfop.length < 4) errosValidacao.push(`Item ${idx + 1}: CFOP ausente`);
      if (!item.descricao) errosValidacao.push(`Item ${idx + 1}: Descricao ausente`);
      if (!item.valor_unitario || item.valor_unitario <= 0) errosValidacao.push(`Item "${item.descricao}" sem valor unitario valido`);
      if (!item.quantidade || item.quantidade <= 0) errosValidacao.push(`Item "${item.descricao}" sem quantidade valida`);
    });
    if (!doc.fiscal_series) errosValidacao.push('Serie fiscal nao configurada');
    if (!doc.valor_total || doc.valor_total <= 0) errosValidacao.push('Valor total deve ser maior que zero');
    const codigoIbgeDest = doc.codigo_ibge_municipio_dest;
    if (!codigoIbgeDest || codigoIbgeDest === '9999999') {
      errosValidacao.push('Codigo IBGE do municipio do destinatario nao configurado');
    }

    if (errosValidacao.length > 0) {
      await supabaseAdmin.from('fiscal_documentos')
        .update({ status: 'rascunho', mensagem_erro: errosValidacao.join('; ') })
        .eq('id', documento_id);
      return new Response(JSON.stringify({ sucesso: false, status: 'erro_validacao', mensagem_erro: 'Dados fiscais incompletos', erros: errosValidacao }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // Marca como emitindo
    await supabaseAdmin.from('fiscal_documentos')
      .update({ status: 'emitindo', updated_at: new Date().toISOString() })
      .eq('id', documento_id);

    const { data: numeroData, error: numError } = await supabaseAdmin.rpc('fiscal_proximo_numero_serie', { p_serie_id: doc.serie_id });
    if (numError) throw new Error('Erro ao gerar numero da serie: ' + numError.message);

    const numero = numeroData as number;
    const serie = doc.fiscal_series?.serie ?? 1;
    const ambiente = doc.fiscal_ambientes?.tipo ?? 'homologacao';
    const empresa = (doc.fiscal_ambientes as any)?.empresas;

    if (!empresa) {
      return new Response(JSON.stringify({ sucesso: false, mensagem_erro: 'Empresa emitente nao configurada no ambiente fiscal.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cnpjEmitente = empresa.cnpj?.replace(/\D/g, '') ?? '';
    const emitente = {
      CNPJ: cnpjEmitente, xNome: normalizeText(empresa.razao_social ?? ''),
      IE: empresa.ie?.replace(/\D/g, '') ?? '', CRT: String(empresa.crt ?? 1),
      xLgr: normalizeText(empresa.logradouro ?? ''), nro: empresa.numero_endereco ?? 'S/N',
      xBairro: normalizeText(empresa.bairro ?? '') || 'S/B', cMun: empresa.codigo_municipio_ibge ?? '3550308',
      xMun: normalizeText(empresa.municipio ?? ''), UF: empresa.uf ?? 'SP',
      CEP: empresa.cep?.replace(/\D/g, '') ?? '',
    };

    const cliente = doc.clientes;
    const itens = doc.fiscal_documentos_itens ?? [];
    const cNF = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    const aamm = new Date().toISOString().slice(2, 7).replace('-', '');
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const chaveAcesso = calcularChaveAcesso('35', aamm, cnpjEmitente, '55', serie.toString(), numero.toString(), '1', cNF);

    const nfePayload = {
      NFe: {
        infNFe: {
          ide: {
            cUF: '35', natOp: normalizeText(doc.natureza_operacao ?? 'Venda de mercadoria'),
            mod: '55', serie: serie.toString(), nNF: numero.toString(),
            dhEmi: (() => {
                const now = new Date();
                const offset = -3 * 60; // BRT = UTC-3
                const local = new Date(now.getTime() + offset * 60000);
                const iso = local.toISOString().replace('Z', '').slice(0, 19);
                return iso + '-03:00';
              })(), tpNF: '1', idDest: '1',
            cMunFG: emitente.cMun, tpImp: '1', tpEmis: '1',
            tpAmb, finNFe: '1',
            indFinal: doc.consumidor_final?.toString() ?? '1', indPres: '1',
            procEmi: '0', verProc: '1.0.0',
          },
          emit: {
            CNPJ: emitente.CNPJ, xNome: emitente.xNome,
            enderEmit: {
              xLgr: emitente.xLgr, nro: emitente.nro, xBairro: emitente.xBairro,
              cMun: emitente.cMun, xMun: emitente.xMun, UF: emitente.UF,
              CEP: emitente.CEP, cPais: '1058', xPais: 'Brasil',
            },
            IE: emitente.IE, CRT: emitente.CRT,
          },
          dest: {
            ...(cliente?.cpf_cnpj?.replace(/\D/g, '').length === 11
              ? { CPF: cliente.cpf_cnpj.replace(/\D/g, '') }
              : { CNPJ: cliente?.cpf_cnpj?.replace(/\D/g, '') ?? '' }),
            xNome: tpAmb === '2'
              ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
              : normalizeText(cliente?.razao_social ?? cliente?.nome_fantasia ?? 'Consumidor Final'),
            enderDest: {
              xLgr: normalizeText(cliente?.endereco ?? ''), nro: cliente?.numero ?? 'SN',
              xBairro: normalizeText(cliente?.bairro ?? '') || '..',
              cMun: doc.codigo_ibge_municipio_dest ?? '9999999',
              xMun: normalizeText(cliente?.cidade ?? ''), UF: cliente?.estado ?? 'SP',
              CEP: cliente?.cep?.replace(/\D/g, '') ?? '',
              cPais: '1058', xPais: 'Brasil',
            },
            indIEDest: cliente?.indicador_ie_destinatario ?? '9',
            email: cliente?.email_fiscal ?? cliente?.email,
          },
          det: itens.map((item: any, idx: number) => ({
            '@nItem': (idx + 1).toString(),
            prod: {
              cProd: item.codigo_produto ?? `PROD${idx + 1}`,
              cEAN: 'SEM GTIN', xProd: normalizeText(item.descricao),
              NCM: item.ncm?.replace(/\D/g, '') ?? '49119900',
              CFOP: item.cfop ?? '5102', uCom: item.unidade ?? 'UN',
              qCom: item.quantidade?.toString(), vUnCom: item.valor_unitario?.toFixed(2),
              vProd: item.valor_bruto?.toFixed(2),
              cEANTrib: 'SEM GTIN', uTrib: item.unidade ?? 'UN',
              qTrib: item.quantidade?.toString(), vUnTrib: item.valor_unitario?.toFixed(2), indTot: '1',
            },
            imposto: {
              ICMS: { ICMSSN102: { orig: item.origem_mercadoria ?? '0', CSOSN: item.cst_ou_csosn ?? '102' } },
              PIS: { PISOutr: { CST: '99', vBC: '0.00', pPIS: '0.00', vPIS: '0.00' } },
              COFINS: { COFINSOutr: { CST: '99', vBC: '0.00', pCOFINS: '0.00', vCOFINS: '0.00' } },
            },
          })),
          total: {
            ICMSTot: {
              vBC: '0.00', vICMS: '0.00', vICMSDeson: '0.00',
              vFCPUFDest: '0.00', vICMSUFDest: '0.00', vICMSUFRemet: '0.00',
              vFCP: '0.00', vBCST: '0.00', vST: '0.00',
              vFCPST: '0.00', vFCPSTRet: '0.00',
              vProd: (doc.valor_produtos ?? 0).toFixed(2),
              vFrete: (doc.valor_frete ?? 0).toFixed(2),
              vSeg: (doc.valor_seguro ?? 0).toFixed(2),
              vDesc: (doc.valor_desconto ?? 0).toFixed(2),
              vII: '0.00', vIPI: '0.00', vIPIDevol: '0.00',
              vPIS: '0.00', vCOFINS: '0.00',
              vOutro: (doc.valor_outras_despesas ?? 0).toFixed(2),
              vNF: (doc.valor_total ?? 0).toFixed(2), vTotTrib: '0.00',
            },
          },
          transp: { modFrete: '9' },
          pag: { tPag: '90', vPag: '0.00' },
          infAdic: { infCpl: doc.informacoes_contribuinte ? normalizeText(doc.informacoes_contribuinte) : undefined, infAdFisco: doc.informacoes_fisco ? normalizeText(doc.informacoes_fisco) : undefined },
        },
      },
    };


    const nfeServiceEnabled = Deno.env.get('NFE_SERVICE_ENABLED') === 'true';
    const certBase64 = Deno.env.get('NFE_CERT_BASE64') ?? '';
    const certPassword = Deno.env.get('NFE_CERT_PASSWORD') ?? '';
    const proxyUrl = Deno.env.get('SEFAZ_PROXY_URL') ?? 'https://crm-croma.vercel.app/api/sefaz-proxy';
    const proxySecret = Deno.env.get('SEFAZ_PROXY_SECRET') ?? 'croma-sefaz-2026';

    let resultado: any;

    if (!nfeServiceEnabled || !certBase64 || !certPassword) {
      // MODO DEMO
      console.log('[fiscal-emitir-nfe] MODO DEMO - NFE_SERVICE_ENABLED nao configurado ou certificado ausente');
      resultado = {
        sucesso: true, status: 'autorizado', numero,
        chave_acesso: chaveAcesso,
        protocolo: `1${Date.now()}`, recibo: `${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        xml_autorizado: `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="${chaveAcesso}"/></NFe></nfeProc>`,
        retorno_raw: { status: 'DEMO', numero, ambiente },
      };
    } else {
      // MODO REAL - Assinar e transmitir via proxy Vercel
      try {
        // ============================================================
        // v47: ASSINATURA NO PROXY (xml-crypto com C14N real)
        //
        // A edge function gera o XML nao-assinado e extrai PEM do PFX.
        // O proxy Node.js (Vercel) assina com xml-crypto e transmite.
        // Isso garante C14N identico ao que o SEFAZ recalcula (Apache Santuario).
        // ============================================================
        console.log('SIGN_ENGINE_VERSION=v47_PROXY_XMLCRYPTO');

        console.log('[fiscal-emitir-nfe] Modo real - gerando XML nao-assinado...');
        const xmlNFe = nfePayloadToXml(nfePayload, chaveAcesso);

        const dhEmiGerado = nfePayload.NFe.infNFe.ide.dhEmi;
        console.log('FORENSE_DHEMI=' + dhEmiGerado);

        // Extrair chave privada PEM e certificado do PFX
        console.log('[fiscal-emitir-nfe] Extraindo PEM do PFX...');
        const pfxDer = forge.util.decode64(certBase64);
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);
        const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPassword);

        const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const keyBags = bags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
        const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
        const certBagsArr = certBags[forge.pki.oids.certBag] || [];

        if (keyBags.length === 0) throw new Error('Chave privada nao encontrada no PFX');
        if (certBagsArr.length === 0) throw new Error('Certificado nao encontrado no PFX');

        const privateKey = keyBags[0].key;
        const certificate = certBagsArr[0].cert;

        // Converter para PEM
        const keyPem = forge.pki.privateKeyToPem(privateKey);
        const certPem = forge.pki.certificateToPem(certificate);
        
        // Certificado DER base64 para X509Certificate no XML
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
        const certDerBase64 = forge.util.encode64(certDer);

        console.log('[fiscal-emitir-nfe] Enviando para proxy com mode=sign_and_send...');
        
        const forenseDebug = req.headers.get('x-forense-debug');
        const sefazUrl = SEFAZ_URLS[ambiente as keyof typeof SEFAZ_URLS] ?? SEFAZ_URLS.homologacao;

        // Chamar proxy com mode sign_and_send
        const proxyResp = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-proxy-secret': proxySecret,
          },
          body: JSON.stringify({
            mode: 'sign_and_send',
            xml_nfe: xmlNFe,
            sefaz_url: sefazUrl,
            cert_base64: certBase64,
            cert_password: certPassword,
            key_pem: keyPem,
            cert_pem: certPem,
            cert_der_base64: certDerBase64,
          }),
        });

        if (!proxyResp.ok) {
          const errText = await proxyResp.text();
          throw new Error('Proxy retornou HTTP ' + proxyResp.status + ': ' + errText);
        }

        const proxyResult = await proxyResp.json() as { 
          status: number; body: string; xml_assinado?: string; soap_enviado?: string 
        };
        const sefazBody = proxyResult.body;
        const xmlAssinado = proxyResult.xml_assinado || '';
        
        console.log('[fiscal-emitir-nfe] Resposta SEFAZ via proxy, HTTP:', proxyResult.status);

        // v45: capturar TODOS os cStat e usar o ULTIMO (protNFe level)
        const allCStats = [...sefazBody.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((m: any) => m[1]);
        const allMotivos = [...sefazBody.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map((m: any) => m[1]);
        const nProtMatch = sefazBody.match(/<nProt>(\d+)<\/nProt>/);
        const dhRecbtoMatch = sefazBody.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
        const chNFeMatch = sefazBody.match(/<chNFe>([^<]+)<\/chNFe>/);

        const cStat = allCStats.length > 0 ? allCStats[allCStats.length - 1] : undefined;
        const xMotivo = allMotivos.length > 0 ? allMotivos[allMotivos.length - 1] : 'Sem descricao';
        const nProt = nProtMatch?.[1];
        const dhRecbto = dhRecbtoMatch?.[1];
        const chNFe = chNFeMatch?.[1] ?? chaveAcesso;

        console.log('[fiscal-emitir-nfe] cStat:', cStat, '| xMotivo:', xMotivo);

        // Extrair DigestValue e SignatureValue do XML assinado (para log/forense)
        const digestMatch = xmlAssinado.match(/<DigestValue>([^<]+)<\/DigestValue>/);
        const sigMatch = xmlAssinado.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);

        const forensePayload = forenseDebug === 'croma-forense-2026' ? {
          _forense: {
            sign_engine_version: 'v47_proxy_xmlcrypto',
            dhEmi: dhEmiGerado,
            xml_pre_sign: xmlNFe,
            xml_assinado: xmlAssinado,
            soap_enviado: proxyResult.soap_enviado || '',
            digest_value: digestMatch?.[1] ?? 'NAO_ENCONTRADO',
            signature_value_head: sigMatch?.[1]?.slice(0, 80) ?? 'NAO_ENCONTRADO',
            sefaz_response_raw: sefazBody,
            sefaz_http_status: proxyResult.status,
          }
        } : {};

        if (cStat === '100') {
          resultado = {
            sucesso: true, status: 'autorizado', numero,
            chave_acesso: chNFe, protocolo: nProt,
            data_autorizacao: dhRecbto,
            xml_autorizado: sefazBody,
            retorno_raw: { cStat, xMotivo, nProt, dhRecbto, allCStats, sefazStatus: proxyResult.status },
            ...forensePayload,
          };
        } else if (cStat === '103') {
          resultado = {
            sucesso: false, status: 'processando', numero, chave_acesso: chNFe,
            retorno_raw: { cStat, xMotivo, allCStats, sefazStatus: proxyResult.status },
            ...forensePayload,
          };
        } else {
          resultado = {
            sucesso: false,
            status: cStat ? 'rejeitado' : 'erro_transmissao',
            numero,
            mensagem_erro: cStat ? '[' + cStat + '] ' + xMotivo : xMotivo,
            codigo_erro: cStat,
            retorno_raw: { cStat, xMotivo, allCStats, sefazStatus: proxyResult.status, preview: sefazBody.slice(0, 500) },
            ...forensePayload,
          };
        }
      } catch (sefazErr) {
        console.error('[fiscal-emitir-nfe] Erro na transmissao:', sefazErr);
        resultado = {
          sucesso: false, status: 'erro_transmissao',
          mensagem_erro: `Falha SEFAZ: ${String(sefazErr)}`,
          retorno_raw: { error: String(sefazErr) },
        };
      }
    }


    // Persistir resultado
    if (resultado.sucesso) {
      await supabaseAdmin.from('fiscal_documentos').update({
        status: 'autorizado', numero: resultado.numero,
        chave_acesso: resultado.chave_acesso, protocolo: resultado.protocolo,
        recibo: resultado.recibo, data_emissao: new Date().toISOString(),
        data_autorizacao: resultado.data_autorizacao,
        retorno_json: resultado.retorno_raw, mensagem_erro: null,
        updated_at: new Date().toISOString(),
      }).eq('id', documento_id);

      if (resultado.xml_autorizado) {
        try {
          const xmlBytes = new TextEncoder().encode(resultado.xml_autorizado);
          const xmlPath = `documentos/${documento_id}/nfe_autorizada.xml`;
          await supabaseAdmin.storage.from('fiscal-xmls')
            .upload(xmlPath, xmlBytes, { contentType: 'application/xml', upsert: true });
          await supabaseAdmin.from('fiscal_xmls').insert({
            fiscal_documento_id: documento_id, tipo_arquivo: 'xml_autorizado',
            storage_path: xmlPath, tamanho_bytes: resultado.xml_autorizado.length,
          });
        } catch (storageErr) {
          console.error('[fiscal-emitir-nfe] Erro ao salvar XML no storage:', storageErr);
        }
      }

      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id, tipo_evento: 'emissao', status: 'sucesso',
        protocolo: resultado.protocolo, mensagem: 'NF-e autorizada com sucesso',
        payload_retorno: resultado.retorno_raw,
      });
    } else {
      await supabaseAdmin.from('fiscal_documentos').update({
        status: resultado.status === 'rejeitado' ? 'rejeitado' : 'erro_transmissao',
        mensagem_erro: resultado.mensagem_erro,
        retorno_json: resultado.retorno_raw,
        updated_at: new Date().toISOString(),
      }).eq('id', documento_id);

      await supabaseAdmin.from('fiscal_erros_transmissao').insert({
        fiscal_documento_id: documento_id, provider: 'sefaz-proxy-vercel', etapa: 'emissao',
        codigo_erro: resultado.codigo_erro,
        mensagem_erro: resultado.mensagem_erro ?? 'Erro na emissao',
        payload_resumido: { numero, serie, ambiente },
      });

      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id, tipo_evento: 'emissao', status: 'falha',
        mensagem: resultado.mensagem_erro, payload_retorno: resultado.retorno_raw,
      });
    }

    return new Response(JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[fiscal-emitir-nfe] Erro:', err);
    return new Response(JSON.stringify({ sucesso: false, status: 'erro_transmissao', mensagem_erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});







