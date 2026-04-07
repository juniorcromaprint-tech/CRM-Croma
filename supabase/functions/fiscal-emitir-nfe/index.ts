/**
 * CROMA PRINT ERP - Edge Function: Emitir NF-e v27
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-service-token',
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


// Canonicaliza XML (C14N simplificado para NF-e)
function canonicalize(xml: string): string {
  let c = xml.replace(/<\?xml[^>]*\?>/g, '');
  c = c.replace(/\s+/g, ' ').trim();
  return c;
}

/**
 * Assina o XML da NF-e com RSA-SHA1 usando certificado A1 PFX
 */
async function assinarXmlNFe(xmlNFe: string, certBase64: string, certPassword: string): Promise<string> {
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

  const idMatch = xmlNFe.match(/infNFe[^>]+Id="([^"]+)"/);
  if (!idMatch) throw new Error('Id do infNFe nao encontrado no XML');
  const infNFeId = idMatch[1];

  const infNFeMatch = xmlNFe.match(/<infNFe[\s\S]*?<\/infNFe>/);
  if (!infNFeMatch) throw new Error('Elemento infNFe nao encontrado no XML');
  const infNFeXml = infNFeMatch[0];

  const md = forge.md.sha1.create();
  md.update(infNFeXml, 'utf8');
  const digestBytes = md.digest().bytes();
  const digestBase64 = forge.util.encode64(digestBytes);

  const signedInfo = `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${infNFeId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfo, 'utf8');
  const signature = privateKey.sign(mdSig);
  const signatureBase64 = forge.util.encode64(signature);

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
  const certBase64Der = forge.util.encode64(certDer);

  const signatureElement = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureBase64}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64Der}</X509Certificate></X509Data></KeyInfo></Signature>`;

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

  const destXml = (() => {
    const cnpjCpf = dest.CNPJ ? `<CNPJ>${dest.CNPJ}</CNPJ>` : `<CPF>${dest.CPF}</CPF>`;
    const ieXml = dest.IE ? `<IE>${dest.IE}</IE>` : '';
    const emailXml = dest.email ? `<email>${dest.email}</email>` : '';
    return `<dest>
      ${cnpjCpf}
      <xNome>${dest.xNome}</xNome>
      <enderDest>
        <xLgr>${dest.enderDest.xLgr}</xLgr>
        <nro>${dest.enderDest.nro}</nro>
        <xBairro>${dest.enderDest.xBairro}</xBairro>
        <cMun>${dest.enderDest.cMun}</cMun>
        <xMun>${dest.enderDest.xMun}</xMun>
        <UF>${dest.enderDest.UF}</UF>
        <CEP>${dest.enderDest.CEP}</CEP>
        <cPais>${dest.enderDest.cPais}</cPais>
        <xPais>${dest.enderDest.xPais}</xPais>
      </enderDest>
      <indIEDest>${dest.indIEDest}</indIEDest>
      ${ieXml}
      ${emailXml}
    </dest>`;
  })();

  const detsXml = dets.map((det: any) => {
    const prod = det.prod;
    const imp = det.imposto;
    const icms = imp.ICMS.ICMSSN102 || imp.ICMS.ICMS40 || {};
    const icmsTag = imp.ICMS.ICMSSN102 ? 'ICMSSN102' : 'ICMS40';
    return `<det nItem="${det['@nItem']}">
      <prod>
        <cProd>${prod.cProd}</cProd>
        <cEAN>${prod.cEAN}</cEAN>
        <xProd>${prod.xProd}</xProd>
        <NCM>${prod.NCM}</NCM>
        <CFOP>${prod.CFOP}</CFOP>
        <uCom>${prod.uCom}</uCom>
        <qCom>${prod.qCom}</qCom>
        <vUnCom>${prod.vUnCom}</vUnCom>
        <vProd>${prod.vProd}</vProd>
        <cEANTrib>${prod.cEANTrib}</cEANTrib>
        <uTrib>${prod.uTrib}</uTrib>
        <qTrib>${prod.qTrib}</qTrib>
        <vUnTrib>${prod.vUnTrib}</vUnTrib>
        <indTot>${prod.indTot}</indTot>
      </prod>
      <imposto>
        <ICMS><${icmsTag}><orig>${icms.orig || '0'}</orig><CSOSN>${icms.CSOSN || '102'}</CSOSN></${icmsTag}></ICMS>
        <PIS><PISOutr><CST>${imp.PIS.PISOutr.CST}</CST><vBC>${imp.PIS.PISOutr.vBC}</vBC><pPIS>${imp.PIS.PISOutr.pPIS}</pPIS><vPIS>${imp.PIS.PISOutr.vPIS}</vPIS></PISOutr></PIS>
        <COFINS><COFINSOutr><CST>${imp.COFINS.COFINSOutr.CST}</CST><vBC>${imp.COFINS.COFINSOutr.vBC}</vBC><pCOFINS>${imp.COFINS.COFINSOutr.pCOFINS}</pCOFINS><vCOFINS>${imp.COFINS.COFINSOutr.vCOFINS}</vCOFINS></COFINSOutr></COFINS>
      </imposto>
    </det>`;
  }).join('\n');

  const infAdicXml = (infAdic?.infCpl || infAdic?.infAdFisco)
    ? `<infAdic>${infAdic.infCpl ? `<infCpl>${infAdic.infCpl}</infCpl>` : ''}${infAdic.infAdFisco ? `<infAdFisco>${infAdic.infAdFisco}</infAdFisco>` : ''}</infAdic>`
    : '';

  const cNF = chaveAcesso.slice(35, 43);
  const cDV = chaveAcesso.slice(43, 44);

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>${ide.cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${ide.natOp}</natOp>
      <mod>${ide.mod}</mod>
      <serie>${ide.serie}</serie>
      <nNF>${ide.nNF}</nNF>
      <dhEmi>${ide.dhEmi}</dhEmi>
      <tpNF>${ide.tpNF}</tpNF>
      <idDest>${ide.idDest}</idDest>
      <cMunFG>${ide.cMunFG}</cMunFG>
      <tpImp>${ide.tpImp}</tpImp>
      <tpEmis>${ide.tpEmis}</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${ide.tpAmb}</tpAmb>
      <finNFe>${ide.finNFe}</finNFe>
      <indFinal>${ide.indFinal}</indFinal>
      <indPres>${ide.indPres}</indPres>
    </ide>
    <emit>
      <CNPJ>${emit.CNPJ}</CNPJ>
      <xNome>${emit.xNome}</xNome>
      <enderEmit>
        <xLgr>${emit.enderEmit.xLgr}</xLgr>
        <nro>${emit.enderEmit.nro}</nro>
        <xBairro>${emit.enderEmit.xBairro}</xBairro>
        <cMun>${emit.enderEmit.cMun}</cMun>
        <xMun>${emit.enderEmit.xMun}</xMun>
        <UF>${emit.enderEmit.UF}</UF>
        <CEP>${emit.enderEmit.CEP}</CEP>
        <cPais>${emit.enderEmit.cPais}</cPais>
        <xPais>${emit.enderEmit.xPais}</xPais>
      </enderEmit>
      <IE>${emit.IE}</IE>
      <CRT>${emit.CRT}</CRT>
    </emit>
    ${destXml}
    ${detsXml}
    <total>
      <ICMSTot>
        <vBC>${total.vBC}</vBC>
        <vICMS>${total.vICMS}</vICMS>
        <vICMSDeson>${total.vICMSDeson}</vICMSDeson>
        <vFCPUFDest>${total.vFCPUFDest}</vFCPUFDest>
        <vICMSUFDest>${total.vICMSUFDest}</vICMSUFDest>
        <vICMSUFRemet>${total.vICMSUFRemet}</vICMSUFRemet>
        <vFCP>${total.vFCP}</vFCP>
        <vBCST>${total.vBCST}</vBCST>
        <vST>${total.vST}</vST>
        <vFCPST>${total.vFCPST}</vFCPST>
        <vFCPSTRet>${total.vFCPSTRet}</vFCPSTRet>
        <vProd>${total.vProd}</vProd>
        <vFrete>${total.vFrete}</vFrete>
        <vSeg>${total.vSeg}</vSeg>
        <vDesc>${total.vDesc}</vDesc>
        <vII>${total.vII}</vII>
        <vIPI>${total.vIPI}</vIPI>
        <vIPIDevol>${total.vIPIDevol}</vIPIDevol>
        <vPIS>${total.vPIS}</vPIS>
        <vCOFINS>${total.vCOFINS}</vCOFINS>
        <vOutro>${total.vOutro}</vOutro>
        <vNF>${total.vNF}</vNF>
        <vTotTrib>${total.vTotTrib}</vTotTrib>
      </ICMSTot>
    </total>
    <transp><modFrete>${transp.modFrete}</modFrete></transp>
    ${infAdicXml}
  </infNFe>
</NFe>`;
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>35</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>1</idLote>
        <indSinc>1</indSinc>
        ${xmlAssinado}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

// URLs dos WebServices SEFAZ
const SEFAZ_URLS = {
  homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
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
      CNPJ: cnpjEmitente, xNome: empresa.razao_social ?? '',
      IE: empresa.ie?.replace(/\D/g, '') ?? '', CRT: String(empresa.crt ?? 1),
      xLgr: empresa.logradouro ?? '', nro: empresa.numero_endereco ?? 'S/N',
      xBairro: empresa.bairro ?? '', cMun: empresa.codigo_municipio_ibge ?? '3550308',
      xMun: empresa.municipio ?? '', UF: empresa.uf ?? 'SP',
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
            cUF: '35', natOp: doc.natureza_operacao ?? 'Venda de mercadoria',
            mod: '55', serie: serie.toString(), nNF: numero.toString(),
            dhEmi: new Date().toISOString(), tpNF: '1', idDest: '1',
            cMunFG: emitente.cMun, tpImp: '1', tpEmis: '1',
            tpAmb, finNFe: '1',
            indFinal: doc.consumidor_final?.toString() ?? '1', indPres: '1',
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
            xNome: cliente?.razao_social ?? cliente?.nome_fantasia ?? 'Consumidor Final',
            enderDest: {
              xLgr: cliente?.endereco ?? '', nro: cliente?.numero ?? 'SN',
              xBairro: cliente?.bairro ?? '',
              cMun: doc.codigo_ibge_municipio_dest ?? '9999999',
              xMun: cliente?.cidade ?? '', UF: cliente?.estado ?? 'SP',
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
              cEAN: 'SEM GTIN', xProd: item.descricao,
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
          infAdic: { infCpl: doc.informacoes_contribuinte, infAdFisco: doc.informacoes_fisco },
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
        console.log('[fiscal-emitir-nfe] Modo real - gerando XML...');
        const xmlNFe = nfePayloadToXml(nfePayload, chaveAcesso);
        console.log('[fiscal-emitir-nfe] XML gerado, assinando...');
        const xmlAssinado = await assinarXmlNFe(xmlNFe, certBase64, certPassword);
        console.log('[fiscal-emitir-nfe] XML assinado, transmitindo via proxy...');
        const soapEnvelope = montarEnvelopeSoap(xmlAssinado, ambiente);
        const sefazUrl = SEFAZ_URLS[ambiente as keyof typeof SEFAZ_URLS] ?? SEFAZ_URLS.homologacao;

        // Chama proxy Vercel (Node.js com rejectUnauthorized:false para ICP-Brasil)
        const proxyResult = await transmitirViaProxy(soapEnvelope, sefazUrl, proxyUrl, proxySecret, certBase64, certPassword);
        const sefazBody = proxyResult.body;
        console.log('[fiscal-emitir-nfe] Resposta SEFAZ via proxy, HTTP:', proxyResult.status);

        const cStatMatch = sefazBody.match(/<cStat>(\d+)<\/cStat>/);
        const xMotivoMatch = sefazBody.match(/<xMotivo>([^<]+)<\/xMotivo>/);
        const nProtMatch = sefazBody.match(/<nProt>(\d+)<\/nProt>/);
        const dhRecbtoMatch = sefazBody.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
        const chNFeMatch = sefazBody.match(/<chNFe>([^<]+)<\/chNFe>/);

        const cStat = cStatMatch?.[1];
        const xMotivo = xMotivoMatch?.[1] ?? 'Sem descricao';
        const nProt = nProtMatch?.[1];
        const dhRecbto = dhRecbtoMatch?.[1];
        const chNFe = chNFeMatch?.[1] ?? chaveAcesso;

        console.log(`[fiscal-emitir-nfe] cStat: ${cStat}, xMotivo: ${xMotivo}`);

        if (cStat === '100') {
          resultado = {
            sucesso: true, status: 'autorizado', numero,
            chave_acesso: chNFe, protocolo: nProt,
            data_autorizacao: dhRecbto,
            xml_autorizado: sefazBody,
            retorno_raw: { cStat, xMotivo, nProt, dhRecbto, sefazStatus: proxyResult.status },
          };
        } else if (cStat === '103') {
          resultado = {
            sucesso: false, status: 'processando', numero, chave_acesso: chNFe,
            retorno_raw: { cStat, xMotivo, sefazStatus: proxyResult.status },
          };
        } else {
          resultado = {
            sucesso: false,
            status: cStat ? 'rejeitado' : 'erro_transmissao',
            numero,
            mensagem_erro: `${cStat ? `[${cStat}] ` : ''}${xMotivo}`,
            codigo_erro: cStat,
            retorno_raw: { cStat, xMotivo, sefazStatus: proxyResult.status, preview: sefazBody.slice(0, 500) },
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
