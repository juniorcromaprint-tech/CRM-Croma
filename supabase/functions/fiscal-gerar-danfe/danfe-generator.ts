/**
 * DANFE Generator para Deno Edge Functions
 * Versao standalone do template DANFE profissional.
 * Gera HTML completo pronto para conversao em PDF.
 *
 * NOTA: Este arquivo e uma versao self-contained para rodar em Deno (Edge Functions).
 * A versao React (frontend) esta em src/domains/fiscal/utils/danfe-template.ts
 */

// ============================================================
// Formatadores
// ============================================================

function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const d = cnpj.replace(/\D/g, '').padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatCNPJouCPF(doc: string | null | undefined): string {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length <= 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  return formatCNPJ(doc);
}

function formatCEP(cep: string | null | undefined): string {
  if (!cep) return '';
  const d = cep.replace(/\D/g, '').padStart(8, '0');
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

function formatFone(fone: string | null | undefined): string {
  if (!fone) return '';
  const d = fone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)})${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)})${d.slice(2,6)}-${d.slice(6)}`;
  return fone;
}

function formatChaveAcesso(chave: string | null | undefined): string {
  if (!chave) return '';
  return chave.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0,00';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQtd(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function fmtUnit(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0,00';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtAliq(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0,00';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDataBR(data: string | null | undefined): string {
  if (!data) return '';
  try { return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return ''; }
}

function fmtDataHoraBR(data: string | null | undefined): string {
  if (!data) return '';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      + ' ' + d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return ''; }
}

function fmtNumNFe(n: number | string | null | undefined): string {
  if (n == null) return '';
  return String(n).padStart(9, '0');
}

function fretePorConta(mod: number | string | null | undefined): string {
  const m: Record<string, string> = {
    '0': '0-Contrat. por conta do Remetente',
    '1': '1-Contrat. por conta do Destinat\u00e1rio',
    '2': '2-Contrat. por conta de Terceiros',
    '3': '3-Transp. Pr\u00f3prio Remetente',
    '4': '4-Transp. Pr\u00f3prio Destinat\u00e1rio',
    '9': '9-Sem Ocorr\u00eancia de Transporte',
  };
  return m[String(mod)] ?? `${mod}`;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// CSS
// ============================================================

const CSS = `
@page { size: A4 portrait; margin: 5mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body,html { font-family:Arial,Helvetica,sans-serif; font-size:7pt; color:#000; background:#fff; line-height:1.2; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.pg { width:200mm; min-height:287mm; margin:0 auto; page-break-after:always; position:relative; }
.pg:last-child { page-break-after:auto; }
.tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
.tbl td,.tbl th { border:1px solid #000; padding:1px 3px; vertical-align:top; font-size:7pt; line-height:1.25; overflow:hidden; text-overflow:ellipsis; }
.lbl { font-size:5.5pt; color:#000; text-transform:uppercase; font-weight:bold; display:block; line-height:1.1; margin-bottom:.5px; letter-spacing:.2px; }
.v { font-size:7.5pt; display:block; line-height:1.3; min-height:9pt; word-break:break-all; }
.vb { font-weight:bold; }
.vm { font-family:'Courier New',monospace; }
.vr { text-align:right; }
.vc { text-align:center; }
.cn td { border:1px solid #000; padding:2px 3px; font-size:6pt; }
.cn-t { font-size:6pt; line-height:1.2; }
.cn-nfe { font-weight:bold; text-align:center; font-size:8pt; }
.cn-cut { border:0; border-top:1px dashed #000; margin:1px 0 3px; width:100%; }
.hd td { border:1px solid #000; vertical-align:top; }
.em-r { font-size:10pt; font-weight:bold; line-height:1.2; margin-bottom:2px; }
.em-a { font-size:7pt; line-height:1.3; }
.dt { text-align:center; padding:3px 4px; }
.dt-t { font-size:12pt; font-weight:bold; letter-spacing:1px; }
.dt-s { font-size:7pt; line-height:1.2; margin-top:1px; }
.dt-chk { display:inline-block; width:10px; height:10px; border:1px solid #000; text-align:center; font-size:8pt; font-weight:bold; line-height:10px; vertical-align:middle; margin:0 2px; }
.dt-chk.on { background:#000; color:#fff; }
.dt-n { font-size:9pt; font-weight:bold; margin-top:2px; }
.ch-b { text-align:center; padding:4px 2px; }
.ch-bc { font-family:'Libre Barcode 128','Courier New',monospace; font-size:28pt; line-height:1; }
.ch-l { font-size:5.5pt; font-weight:bold; text-transform:uppercase; }
.ch-v { font-family:'Courier New',monospace; font-size:7.5pt; font-weight:bold; letter-spacing:.5px; word-break:break-all; line-height:1.4; }
.ch-c { font-size:6.5pt; text-align:center; line-height:1.3; margin-top:3px; }
.bt { font-size:6pt; font-weight:bold; text-transform:uppercase; background:#e8e8e8; padding:1.5px 3px; border:1px solid #000; letter-spacing:.3px; }
.pt { width:100%; border-collapse:collapse; table-layout:fixed; }
.pt th { border:1px solid #000; padding:1.5px 2px; font-size:5.5pt; font-weight:bold; text-transform:uppercase; text-align:center; background:#f0f0f0; line-height:1.15; }
.pt td { border:1px solid #000; border-top:none; padding:1px 2px; font-size:6.5pt; line-height:1.2; vertical-align:top; }
.pt td.n { text-align:right; font-family:'Courier New',monospace; font-size:6.5pt; }
.pt td.c { text-align:center; }
.pt td.d { word-break:break-word; overflow-wrap:break-word; }
.da { font-size:6.5pt; line-height:1.3; white-space:pre-wrap; word-break:break-word; min-height:40px; }
.rf { font-size:5.5pt; border-top:1px solid #000; padding:2px 3px; margin-top:1px; }
.hb { text-align:center; font-size:8pt; font-weight:bold; background:#ffffcc; border:2px solid #000; padding:3px; margin-bottom:3px; text-transform:uppercase; letter-spacing:1px; }
@media print { body{margin:0;padding:0} .pg{margin:0;width:100%;min-height:auto} }
`;

// ============================================================
// Tipos
// ============================================================

interface Item { cod:string; desc:string; ncm:string; cst:string; cfop:string; un:string; qtd:number; vunit:number; vtot:number; bcicms:number; vicms:number; vipi:number; aicms:number; aipi:number; }
interface Dup { num:string; venc:string; val:number; }

interface DData {
  num: number|string; serie: number|string; chave: string; prot?: string;
  dtEmis: string; dtEntSai?: string; natOp: string; tpOp?: number|string; tpAmb?: number;
  emit: { rs:string; cnpj:string; ie:string; ieSt?:string; end:string; bairro:string; mun:string; uf:string; cep:string; fone?:string; logo?:string; };
  dest: { rs:string; doc:string; ie?:string; end:string; bairro:string; mun:string; uf:string; cep:string; fone?:string; compl?:string; };
  imp: { bcIcms:number; vIcms:number; icmsDes?:number; bcSt:number; vSt:number; vImpImp?:number; vProd:number; vFrete:number; vSeg:number; vDesc:number; vOutras:number; vIpi:number; vPis:number; vCofins:number; vNota:number; };
  transp?: { rs?:string; doc?:string; ie?:string; end?:string; mun?:string; uf?:string; modFr:number|string; antt?:string; placa?:string; placaUf?:string; };
  vol?: { qtd?:number; esp?:string; marca?:string; numer?:string; pBruto?:number; pLiq?:number; };
  fat?: { num:string; vOrig:number; vDesc:number; vLiq:number; };
  dups?: Dup[];
  itens: Item[];
  infCompl?: string; resFisco?: string;
}

// ============================================================
// Constantes de paginacao
// ============================================================
const IPG1 = 22;
const IPGC = 42;

// ============================================================
// Render
// ============================================================

function rCanhoto(d: DData): string {
  return `<table class="cn" cellspacing="0"><tr>
<td style="width:60%" rowspan="3"><span class="cn-t"><b>RECEBEMOS DE</b> ${esc(d.emit.rs)}<br/>OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span></td>
<td style="width:20%;text-align:center" class="cn-nfe">NF-e</td>
<td style="width:20%" rowspan="3" class="vc"><span class="lbl">N&ordm;</span><span class="v vb" style="font-size:9pt">${fmtNumNFe(d.num)}</span><br/><span class="lbl">S&eacute;rie</span><span class="v vb">${d.serie}</span></td>
</tr><tr><td><span class="lbl">VLR TOTAL NOTA</span><span class="v vb">${fmt(d.imp.vNota)}</span></td></tr>
<tr><td><span class="lbl">DATA DA EMISS&Atilde;O</span><span class="v">${fmtDataBR(d.dtEmis)}</span></td></tr>
<tr><td><span class="lbl">DATA DE RECEBIMENTO</span><span class="v">&nbsp;</span></td><td colspan="2"><span class="lbl">IDENTIFICA&Ccedil;&Atilde;O E ASSINATURA DO RECEBEDOR</span><span class="v">&nbsp;</span></td></tr>
<tr><td colspan="3"><span class="lbl">DESTINAT&Aacute;RIO</span><span class="v">${esc(d.dest.rs)}</span></td></tr></table><hr class="cn-cut"/>`;
}

function rCab(d: DData, pg: number, tot: number): string {
  const tp = d.tpOp != null ? Number(d.tpOp) : 1;
  const logo = d.emit.logo ? `<img src="${esc(d.emit.logo)}" style="max-width:80px;max-height:50px;margin-bottom:3px;display:block"/>` : '';
  return `<table class="hd" cellspacing="0"><tr>
<td style="width:40%" class="p-3" rowspan="2"><span class="lbl">IDENTIFICA&Ccedil;&Atilde;O DO EMITENTE</span>${logo}<div class="em-r">${esc(d.emit.rs)}</div><div class="em-a">${esc(d.emit.end)}<br/>${esc(d.emit.bairro)}<br/>${esc(d.emit.mun)}-${esc(d.emit.uf)}<br/>CEP: ${formatCEP(d.emit.cep)}<br/>Fone: ${formatFone(d.emit.fone)}</div></td>
<td style="width:24%" class="dt"><div class="dt-t">DANFE</div><div class="dt-s">Documento Auxiliar da<br/>Nota Fiscal Eletr&ocirc;nica</div>
<div style="margin:4px 0"><span style="font-size:7pt;font-weight:bold">0 - ENTRADA</span> <span class="dt-chk ${tp===0?'on':''}">${tp===0?'1':''}</span><br/><span style="font-size:7pt;font-weight:bold">1 - SA&Iacute;DA</span> <span class="dt-chk ${tp===1?'on':''}">${tp===1?'1':''}</span></div>
<div class="dt-n">N&ordm; ${fmtNumNFe(d.num)}</div><div class="dt-n">S&Eacute;RIE ${d.serie}</div><div class="dt-n">FL &nbsp;${pg} / ${tot}</div></td>
<td style="width:36%" rowspan="2"><div class="ch-b"><div class="ch-bc" title="Barcode">${esc(d.chave?.replace(/\D/g,''))}</div></div><div class="ch-l" style="padding:0 4px">CHAVE DE ACESSO</div><div class="ch-v" style="padding:0 4px">${formatChaveAcesso(d.chave)}</div><div class="ch-c">Consulta de autenticidade no portal nacional da<br/>NF-e www.nfe.fazenda.gov.br/portal ou no site<br/>da Sefaz Autorizadora</div>
${d.prot?`<div style="margin-top:3px;border-top:1px solid #000;padding:2px 4px"><span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span><span class="v vm" style="font-size:7pt">${esc(d.prot)}</span></div>`:''}</td>
</tr></table>`;
}

function rNatProt(d: DData): string {
  return `<table class="tbl" cellspacing="0"><tr>
<td style="width:50%"><span class="lbl">NATUREZA DA OPERA&Ccedil;&Atilde;O</span><span class="v">${esc(d.natOp)}</span></td>
<td style="width:50%"><span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span><span class="v vm">${esc(d.prot||'')}</span></td></tr>
<tr><td style="width:33%"><span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span><span class="v">${esc(d.emit.ie)}</span></td>
<td style="width:34%"><span class="lbl">INSC. ESTADUAL DO SUBST. TRIBUT&Aacute;RIO</span><span class="v">${esc(d.emit.ieSt||'')}</span></td>
<td style="width:33%"><span class="lbl">CPF/CNPJ</span><span class="v">${formatCNPJ(d.emit.cnpj)}</span></td></tr></table>`;
}

function rDest(d: DData): string {
  const t = d.dest;
  return `<div class="bt">DESTINAT&Aacute;RIO / REMETENTE</div><table class="tbl" cellspacing="0">
<tr><td style="width:50%"><span class="lbl">NOME / RAZ&Atilde;O SOCIAL</span><span class="v">${esc(t.rs)}</span></td>
<td style="width:28%"><span class="lbl">CNPJ / CPF / IDestr.</span><span class="v">${formatCNPJouCPF(t.doc)}</span></td>
<td style="width:22%"><span class="lbl">DATA DA EMISS&Atilde;O</span><span class="v">${fmtDataBR(d.dtEmis)}</span></td></tr>
<tr><td style="width:50%"><span class="lbl">ENDERE&Ccedil;O</span><span class="v">${esc(t.end)}</span></td>
<td style="width:28%"><span class="lbl">BAIRRO / DISTRITO</span><span class="v">${esc(t.bairro)}</span></td>
<td style="width:22%"><span class="lbl">COMPLEMENTO</span><span class="v">${esc(t.compl||'')}</span></td></tr>
<tr><td style="width:40%"><span class="lbl">MUNIC&Iacute;PIO</span><span class="v">${esc(t.mun)}</span></td>
<td style="width:15%"><span class="lbl">FONE / FAX</span><span class="v">${formatFone(t.fone)}</span></td>
<td style="width:6%"><span class="lbl">UF</span><span class="v">${esc(t.uf)}</span></td>
<td style="width:17%"><span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span><span class="v">${esc(t.ie||'')}</span></td>
<td style="width:10%"><span class="lbl">CEP</span><span class="v">${formatCEP(t.cep)}</span></td>
<td style="width:22%"><span class="lbl">DATA/HORA ENTRADA/SA&Iacute;DA</span><span class="v">${d.dtEntSai?fmtDataHoraBR(d.dtEntSai):''}</span></td></tr></table>`;
}

function rFatDup(d: DData): string {
  if (!d.fat && (!d.dups || d.dups.length === 0)) return '';
  let h = '';
  if (d.fat) {
    h += `<div class="bt">FATURA</div><table class="tbl" cellspacing="0"><tr>
<td style="width:25%"><span class="lbl">N&Uacute;MERO</span><span class="v">${esc(d.fat.num)}</span></td>
<td style="width:25%"><span class="lbl">VALOR ORIGINAL</span><span class="v vr">${fmt(d.fat.vOrig)}</span></td>
<td style="width:25%"><span class="lbl">VALOR DESCONTO</span><span class="v vr">${fmt(d.fat.vDesc)}</span></td>
<td style="width:25%"><span class="lbl">VALOR L&Iacute;QUIDO</span><span class="v vr">${fmt(d.fat.vLiq)}</span></td></tr></table>`;
  }
  if (d.dups && d.dups.length > 0) {
    h += `<div class="bt">DUPLICATAS</div><table class="tbl" cellspacing="0">`;
    for (let i = 0; i < d.dups.length; i += 3) {
      const ch = d.dups.slice(i, i + 3);
      let cells = '';
      for (const dp of ch) {
        cells += `<td><span class="lbl">N&Uacute;MERO</span><span class="v">${esc(dp.num)}</span></td><td><span class="lbl">VENC.</span><span class="v">${fmtDataBR(dp.venc)}</span></td><td><span class="lbl">VALOR</span><span class="v vr">${fmt(dp.val)}</span></td>`;
      }
      for (let j = ch.length; j < 3; j++) cells += '<td></td><td></td><td></td>';
      h += `<tr>${cells}</tr>`;
    }
    h += '</table>';
  }
  return h;
}

function rImp(d: DData): string {
  const i = d.imp;
  return `<div class="bt">C&Aacute;LCULO DO IMPOSTO</div><table class="tbl" cellspacing="0">
<tr><td style="width:14%"><span class="lbl">BC ICMS</span><span class="v vr">${fmt(i.bcIcms)}</span></td>
<td style="width:12%"><span class="lbl">VALOR ICMS</span><span class="v vr">${fmt(i.vIcms)}</span></td>
<td style="width:14%"><span class="lbl">ICMS DESONERADO</span><span class="v vr">${fmt(i.icmsDes||0)}</span></td>
<td style="width:14%"><span class="lbl">BC ICMS SUBSTITUI&Ccedil;&Atilde;O</span><span class="v vr">${fmt(i.bcSt)}</span></td>
<td style="width:14%"><span class="lbl">VALOR ICMS SUBS</span><span class="v vr">${fmt(i.vSt)}</span></td>
<td style="width:14%"><span class="lbl">VALOR IMP. IMPORTA&Ccedil;&Atilde;O</span><span class="v vr">${fmt(i.vImpImp||0)}</span></td>
<td style="width:18%"><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="v vr vb">${fmt(i.vProd)}</span></td></tr>
<tr><td><span class="lbl">VALOR FRETE</span><span class="v vr">${fmt(i.vFrete)}</span></td>
<td><span class="lbl">VALOR SEGURO</span><span class="v vr">${fmt(i.vSeg)}</span></td>
<td><span class="lbl">VALOR DESCONTO</span><span class="v vr">${fmt(i.vDesc)}</span></td>
<td><span class="lbl">OUTRAS DESP. ACES.</span><span class="v vr">${fmt(i.vOutras)}</span></td>
<td><span class="lbl">VALOR IPI</span><span class="v vr">${fmt(i.vIpi)}</span></td>
<td><span class="lbl">VALOR DO PIS</span><span class="v vr">${fmt(i.vPis)}</span></td>
<td><span class="lbl">VALOR DA COFINS</span><span class="v vr">${fmt(i.vCofins)}</span></td>
<td><span class="lbl">VALOR TOTAL DA NOTA</span><span class="v vr vb">${fmt(i.vNota)}</span></td></tr></table>`;
}

function rTransp(d: DData): string {
  const t = d.transp;
  const v = d.vol;
  return `<div class="bt">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div><table class="tbl" cellspacing="0">
<tr><td style="width:30%"><span class="lbl">RAZ&Atilde;O SOCIAL</span><span class="v">${esc(t?.rs||'')}</span></td>
<td style="width:20%"><span class="lbl">FRETE POR CONTA</span><span class="v">${fretePorConta(t?.modFr)}</span></td>
<td style="width:12%"><span class="lbl">C&Oacute;DIGO ANTT</span><span class="v">${esc(t?.antt||'')}</span></td>
<td style="width:10%"><span class="lbl">PLACA</span><span class="v">${esc(t?.placa||'')}</span></td>
<td style="width:5%"><span class="lbl">UF</span><span class="v">${esc(t?.placaUf||'')}</span></td>
<td style="width:23%"><span class="lbl">CNPJ / CPF</span><span class="v">${formatCNPJouCPF(t?.doc)}</span></td></tr>
<tr><td style="width:30%"><span class="lbl">ENDERE&Ccedil;O</span><span class="v">${esc(t?.end||'')}</span></td>
<td style="width:25%" colspan="2"><span class="lbl">MUNIC&Iacute;PIO</span><span class="v">${esc(t?.mun||'')}</span></td>
<td style="width:5%"><span class="lbl">UF</span><span class="v">${esc(t?.uf||'')}</span></td>
<td style="width:20%" colspan="2"><span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span><span class="v">${esc(t?.ie||'')}</span></td></tr></table>
<div class="bt">VOLUMES</div><table class="tbl" cellspacing="0"><tr>
<td style="width:14%"><span class="lbl">QUANTIDADE</span><span class="v">${v?.qtd??''}</span></td>
<td style="width:18%"><span class="lbl">ESP&Eacute;CIE</span><span class="v">${esc(v?.esp||'')}</span></td>
<td style="width:18%"><span class="lbl">MARCA</span><span class="v">${esc(v?.marca||'')}</span></td>
<td style="width:18%"><span class="lbl">NUMERA&Ccedil;&Atilde;O</span><span class="v">${esc(v?.numer||'')}</span></td>
<td style="width:16%"><span class="lbl">PESO BRUTO</span><span class="v vr">${v?.pBruto!=null?fmt(v.pBruto):''}</span></td>
<td style="width:16%"><span class="lbl">PESO L&Iacute;QUIDO</span><span class="v vr">${v?.pLiq!=null?fmt(v.pLiq):''}</span></td></tr></table>`;
}

function rProdH(): string {
  return `<div class="bt">DADOS DO PRODUTO / SERVI&Ccedil;O</div><table class="pt" cellspacing="0"><thead><tr>
<th style="width:9%">C&Oacute;D.<br/>PROD.</th><th style="width:23%">DESCRI&Ccedil;&Atilde;O DO PRODUTO / SERVI&Ccedil;O</th>
<th style="width:7%">NCM/SH</th><th style="width:4%">CST</th><th style="width:4%">CFOP</th><th style="width:3%">UN</th>
<th style="width:7%">QTD</th><th style="width:8%">V. UNIT&Aacute;RIO</th><th style="width:8%">V. TOTAL</th>
<th style="width:7%">BC ICMS</th><th style="width:6%">V. ICMS</th><th style="width:5%">V. IPI</th>
<th style="width:5%">AL&Iacute;Q.<br/>ICMS</th><th style="width:4%">AL&Iacute;Q.<br/>IPI</th></tr></thead>`;
}

function rProdRow(it: Item): string {
  return `<tr><td class="c" style="font-size:6pt">${esc(it.cod)}</td><td class="d">${esc(it.desc)}</td>
<td class="c">${esc(it.ncm)}</td><td class="c">${esc(it.cst)}</td><td class="c">${esc(it.cfop)}</td><td class="c">${esc(it.un)}</td>
<td class="n">${fmtQtd(it.qtd)}</td><td class="n">${fmtUnit(it.vunit)}</td><td class="n">${fmt(it.vtot)}</td>
<td class="n">${fmt(it.bcicms)}</td><td class="n">${fmt(it.vicms)}</td><td class="n">${fmt(it.vipi)}</td>
<td class="n">${fmtAliq(it.aicms)}</td><td class="n">${fmtAliq(it.aipi)}</td></tr>`;
}

function rProdBlock(itens: Item[], vazias: number): string {
  let h = rProdH() + '<tbody>';
  for (const it of itens) h += rProdRow(it);
  for (let i = 0; i < vazias; i++) h += '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
  h += '</tbody></table>';
  return h;
}

function rDadosAd(d: DData, cont = false): string {
  return `<div class="bt">DADOS ADICIONAIS${cont?' (COMPLEMENTO)':''}</div><table class="tbl" cellspacing="0"><tr>
<td style="width:65%;vertical-align:top;min-height:50px"><span class="lbl">INFORMA&Ccedil;&Otilde;ES COMPLEMENTARES</span><div class="da">${esc(d.infCompl||'')}</div></td>
<td style="width:35%;vertical-align:top;min-height:50px"><span class="lbl">RESERVADO AO FISCO</span><div class="da">${esc(d.resFisco||'')}</div></td></tr></table>`;
}

function rRodape(dt: string): string {
  return `<div class="rf"><b>DATA E HORA DA IMPRESS&Atilde;O</b> ${esc(dt)}</div>`;
}

// ============================================================
// Gerador principal (Deno Edge Function)
// ============================================================

export function gerarDanfeHTMLEdge(doc: any, empresa?: any): string {
  // Converter dados do banco para formato interno
  const itens: Item[] = (doc.fiscal_documentos_itens || []).map((it: any) => ({
    cod: it.codigo_produto || '',
    desc: it.descricao || '',
    ncm: it.ncm || '',
    cst: it.cst_ou_csosn || '',
    cfop: it.cfop || '',
    un: it.unidade || 'UN',
    qtd: it.quantidade || 0,
    vunit: it.valor_unitario || 0,
    vtot: it.valor_total || 0,
    bcicms: it.base_calculo_icms || 0,
    vicms: it.valor_icms || 0,
    vipi: 0,
    aicms: it.aliquota_icms || 0,
    aipi: 0,
  }));

  const emp = empresa || {};
  const cli = doc.clientes || {};

  // Extrair cobranca do payload
  const cobr = doc.payload_json?.NFe?.infNFe?.cobr;
  let fat: DData['fat'];
  const dups: Dup[] = [];
  if (cobr?.fat) fat = { num: cobr.fat.nFat||'', vOrig: parseFloat(cobr.fat.vOrig)||0, vDesc: parseFloat(cobr.fat.vDesc)||0, vLiq: parseFloat(cobr.fat.vLiq)||0 };
  if (cobr?.dup) {
    const arr = Array.isArray(cobr.dup) ? cobr.dup : [cobr.dup];
    for (const dp of arr) dups.push({ num: dp.nDup||'', venc: dp.dVenc||'', val: parseFloat(dp.vDup)||0 });
  }

  // Extrair transporte
  const tr = doc.payload_json?.NFe?.infNFe?.transp;
  let transp: DData['transp'];
  let vol: DData['vol'];
  if (tr) {
    transp = { rs: tr.transporta?.xNome||'', doc: tr.transporta?.CNPJ||tr.transporta?.CPF||'', ie: tr.transporta?.IE||'', end: tr.transporta?.xEnder||'', mun: tr.transporta?.xMun||'', uf: tr.transporta?.UF||'', modFr: tr.modFrete??9, antt: tr.veicTransp?.RNTC||'', placa: tr.veicTransp?.placa||'', placaUf: tr.veicTransp?.UF||'' };
    const v = Array.isArray(tr.vol) ? tr.vol[0] : tr.vol;
    if (v) vol = { qtd: v.qVol?parseInt(v.qVol):undefined, esp: v.esp||'', marca: v.marca||'', numer: v.nVol||'', pBruto: v.pesoB?parseFloat(v.pesoB):undefined, pLiq: v.pesoL?parseFloat(v.pesoL):undefined };
  }

  const tpAmb = doc.fiscal_ambientes?.tipo === 'producao' ? 1 : 2;
  let prot = doc.protocolo || '';
  if (doc.data_autorizacao && prot) prot = `${prot} ${fmtDataHoraBR(doc.data_autorizacao)}`;

  const d: DData = {
    num: doc.numero || 0, serie: doc.fiscal_series?.serie ?? 1,
    chave: doc.chave_acesso || '', prot: prot,
    dtEmis: doc.data_emissao || '', dtEntSai: doc.data_emissao,
    natOp: doc.natureza_operacao || 'VENDA DE MERCADORIA', tpOp: 1, tpAmb: tpAmb,
    emit: { rs: emp.razao_social||'CROMA PRINT COMUNICAÇÃO VISUAL LTDA', cnpj: emp.cnpj||'18923994000183', ie: emp.ie||'', end: emp.endereco||'', bairro: emp.bairro||'', mun: emp.municipio||'SAO PAULO', uf: emp.uf||'SP', cep: emp.cep||'', fone: emp.telefone||'', logo: emp.logo_url },
    dest: { rs: cli.razao_social||'', doc: cli.cnpj||cli.cpf||'', ie: cli.ie||'', end: cli.endereco||'', bairro: cli.bairro||'', mun: cli.cidade||cli.municipio||'', uf: cli.estado||cli.uf||'', cep: cli.cep||'', fone: cli.telefone||'', compl: cli.complemento||'' },
    imp: { bcIcms: doc.valor_total||0, vIcms: doc.valor_icms||0, bcSt:0, vSt:0, vProd: doc.valor_produtos||doc.valor_total||0, vFrete: doc.valor_frete||0, vSeg:0, vDesc: doc.valor_desconto||0, vOutras:0, vIpi:0, vPis: doc.valor_pis||0, vCofins: doc.valor_cofins||0, vNota: doc.valor_total||0 },
    transp, vol, fat, dups, itens,
    infCompl: doc.informacoes_contribuinte || doc.observacoes || '',
    resFisco: doc.informacoes_fisco || '',
  };

  // Gerar HTML multi-pagina
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const isHom = d.tpAmb === 2;

  const pg1Itens = d.itens.slice(0, IPG1);
  const restItens = d.itens.slice(IPG1);
  const pgsCont: Item[][] = [];
  let r = restItens;
  while (r.length > 0) { pgsCont.push(r.slice(0, IPGC)); r = r.slice(IPGC); }
  const totPg = 1 + pgsCont.length;

  // Pagina 1
  let html = `<div class="pg">`;
  if (isHom) html += `<div class="hb">SEM VALOR FISCAL - AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O</div>`;
  html += rCanhoto(d) + rCab(d, 1, totPg) + rNatProt(d) + rDest(d) + rFatDup(d) + rImp(d) + rTransp(d);
  html += rProdBlock(pg1Itens, Math.max(0, IPG1 - pg1Itens.length));
  if (pgsCont.length === 0) html += rDadosAd(d);
  html += rRodape(agora) + `</div>`;

  // Paginas continuacao
  for (let i = 0; i < pgsCont.length; i++) {
    const pgI = pgsCont[i];
    const isLast = i === pgsCont.length - 1;
    html += `<div class="pg">`;
    if (isHom) html += `<div class="hb">SEM VALOR FISCAL - AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O</div>`;
    html += rCab(d, i + 2, totPg) + rNatProt(d);
    html += rProdBlock(pgI, Math.max(0, IPGC - pgI.length));
    if (isLast) html += rDadosAd(d, true);
    html += rRodape(agora) + `</div>`;
  }

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>DANFE - NF-e ${fmtNumNFe(d.num)}</title><style>${CSS}</style></head><body>${html}</body></html>`;
}
