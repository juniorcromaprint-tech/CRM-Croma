/**
 * DANFE Generator para Deno Edge Functions — v2.0
 * Versão standalone do template DANFE profissional.
 * Espelha o template React em src/domains/fiscal/utils/danfe-template.ts
 *
 * NOTA: Self-contained para Deno (Edge Functions). Sem imports externos.
 * Revisão completa 2026-04-09
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

function fmtSerie(s: number | string | null | undefined): string {
  if (s == null) return '';
  return String(s).padStart(3, '0');
}

function fretePorConta(mod: number | string | null | undefined): string {
  const m: Record<string, string> = {
    '0': '0-Contrat. por conta do Remetente',
    '1': '1-Contrat. por conta do Destinatário',
    '2': '2-Contrat. por conta de Terceiros',
    '3': '3-Transp. Próprio Remetente',
    '4': '4-Transp. Próprio Destinatário',
    '9': '9-Sem Ocorrência de Transporte',
  };
  return m[String(mod)] ?? `${mod}`;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// CSS — Profissional v2.0
// ============================================================

const CSS = `
@page { size: A4 portrait; margin: 5mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body,html { font-family:'Times New Roman',Times,serif; font-size:7.5pt; color:#000; background:#fff; line-height:1.15; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.pg { width:200mm; min-height:287mm; margin:0 auto; page-break-after:always; position:relative; }
.pg:last-child { page-break-after:auto; }
.tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
.tbl td,.tbl th { border:0.5pt solid #000; padding:0.8mm 1mm; vertical-align:top; font-size:7.5pt; line-height:1.15; overflow:hidden; text-overflow:ellipsis; }
.lbl { font-size:5pt; color:#000; text-transform:uppercase; font-weight:normal; display:block; line-height:1; margin-bottom:0; letter-spacing:0.01em; font-family:Arial,Helvetica,sans-serif; }
.v { font-size:8pt; display:block; line-height:1.2; min-height:3mm; word-break:break-word; }
.vb { font-weight:bold; }
.vm { font-family:'Courier New',monospace; }
.vr { text-align:right; }
.vc { text-align:center; }
.vlg { font-size:9pt; font-weight:bold; }
.cc { padding-top:0.3mm !important; padding-bottom:0.3mm !important; }
.cn { width:100%; border-collapse:collapse; margin-bottom:0; }
.cn td { border:0.5pt solid #000; padding:0.5mm 1mm; font-size:6pt; vertical-align:middle; }
.cn-r { font-size:6pt; line-height:1.2; }
.cn-nfe { font-weight:bold; text-align:center; font-size:9pt; vertical-align:middle; }
.cn-cut { border:0; border-top:1px dashed #999; margin:1mm 0 1.5mm; width:100%; }
.hd { width:100%; border-collapse:collapse; }
.hd td { border:0.5pt solid #000; vertical-align:top; }
.em-b { padding:1.5mm 2mm; }
.em-r { font-size:10pt; font-weight:bold; line-height:1.15; margin-bottom:0.5mm; }
.em-f { font-size:7pt; font-style:italic; margin-bottom:0.5mm; display:block; }
.em-a { font-size:6.5pt; line-height:1.25; }
.dt { text-align:center; padding:1.5mm 1mm; }
.dt-t { font-size:14pt; font-weight:bold; letter-spacing:2pt; line-height:1; }
.dt-s { font-size:6pt; line-height:1.2; margin-top:0.3mm; font-family:Arial,Helvetica,sans-serif; }
.dt-tb { margin:1.5mm 0 1mm; font-size:6pt; line-height:1.6; font-family:Arial,Helvetica,sans-serif; }
.dt-chk { display:inline-block; width:2.5mm; height:2.5mm; border:0.5pt solid #000; text-align:center; font-size:6pt; font-weight:bold; line-height:2.5mm; vertical-align:middle; margin:0 0.5mm; }
.dt-chk.on { background:#000; color:#fff; }
.dt-nb { margin-top:1mm; border-top:0.5pt solid #000; padding-top:1mm; }
.dt-n { font-size:10pt; font-weight:bold; }
.dt-sr { font-size:9pt; font-weight:bold; }
.dt-fl { font-size:8pt; font-weight:bold; }
.ch-b { padding:1mm 1.5mm; }
.ch-bc { text-align:center; padding:1mm 0; min-height:12mm; border-bottom:0.5pt solid #000; margin-bottom:0.5mm; }
.ch-l { font-size:5pt; font-weight:normal; text-transform:uppercase; font-family:Arial,Helvetica,sans-serif; display:block; margin-top:0.5mm; }
.ch-v { font-family:'Courier New',monospace; font-size:7pt; font-weight:bold; letter-spacing:0.3pt; word-spacing:2pt; line-height:1.3; text-align:center; margin-top:0.3mm; }
.ch-c { font-size:5.5pt; text-align:center; line-height:1.2; margin-top:1mm; font-family:Arial,Helvetica,sans-serif; }
.ch-p { border-top:0.5pt solid #000; padding-top:0.5mm; margin-top:1mm; }
.ch-p .lbl { text-align:center; }
.ch-p .v { text-align:center; font-family:'Courier New',monospace; font-size:7pt; font-weight:bold; }
.bt { font-size:5.5pt; font-weight:bold; text-transform:uppercase; padding:0.3mm 1mm; border:0.5pt solid #000; border-bottom:none; letter-spacing:0.02em; font-family:Arial,Helvetica,sans-serif; background:none; }
.pt { width:100%; border-collapse:collapse; table-layout:fixed; border:0.5pt solid #000; }
.pt th { border:0.5pt solid #000; padding:0.5mm; font-size:5pt; font-weight:bold; text-transform:uppercase; text-align:center; background:#e8e8e8; line-height:1.15; font-family:Arial,Helvetica,sans-serif; vertical-align:middle; }
.pt td { border-left:0.5pt solid #000; border-right:0.5pt solid #000; border-bottom:0.3pt solid #ccc; padding:0.3mm 0.7mm; font-size:6.5pt; line-height:1.15; vertical-align:top; }
.pt tbody tr:last-child td { border-bottom:0.5pt solid #000; }
.pt td.n { text-align:right; font-family:'Courier New',monospace; font-size:6.5pt; white-space:nowrap; }
.pt td.c { text-align:center; }
.pt td.d { word-break:break-word; overflow-wrap:break-word; font-size:6pt; }
.pt tr.er td { border-bottom:none; height:3.2mm; }
.pt tr.er:last-child td { border-bottom:0.5pt solid #000; }
.da { font-size:6pt; line-height:1.25; white-space:pre-wrap; word-break:break-word; min-height:15mm; font-family:Arial,Helvetica,sans-serif; }
.rf { font-size:5pt; color:#555; border-top:0.5pt solid #000; padding:0.5mm 1mm; margin-top:0.5mm; font-family:Arial,Helvetica,sans-serif; }
.hb { text-align:center; font-size:7pt; font-weight:bold; color:#333; background:#fffde0; border:0.5pt solid #ccc; padding:1mm; margin-bottom:1mm; text-transform:uppercase; letter-spacing:1pt; font-family:Arial,Helvetica,sans-serif; }
.bc-svg { width:100%; height:12mm; }
@media print { body{margin:0;padding:0} .pg{margin:0;width:100%;min-height:auto} }
`;

// ============================================================
// Helpers
// ============================================================

function campo(label: string, valor: string, extra = ''): string {
  return `<span class="lbl">${label}</span><span class="v ${extra}">${valor}</span>`;
}

function campoR(label: string, valor: string, extra = ''): string {
  return campo(label, valor, `vr ${extra}`);
}

// ============================================================
// Barcode SVG
// ============================================================

function renderBarcodeSVG(digits: string): string {
  if (!digits || digits.length < 10) {
    return `<div style="height:12mm;display:flex;align-items:center;justify-content:center;font-size:6pt;color:#999;">C&Oacute;DIGO DE BARRAS</div>`;
  }
  const bars: number[] = [];
  bars.push(2, 1, 1, 2, 3, 2);
  for (let i = 0; i < digits.length; i += 2) {
    const pair = parseInt(digits.substring(i, i + 2), 10) || 0;
    const b1 = ((pair >> 5) & 3) + 1;
    const s1 = ((pair >> 3) & 3) + 1;
    const b2 = ((pair >> 1) & 3) + 1;
    const s2 = (pair & 1) + 1;
    const b3 = 1;
    const s3 = Math.max(1, 6 - b1 - s1 - b2 + 2);
    bars.push(b1, s1, b2, s2, b3, s3);
  }
  bars.push(2, 3, 3, 1, 1, 1, 2);
  const totalWidth = bars.reduce((a, b) => a + b, 0);
  let svgBars = '';
  let x = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i % 2 === 0) {
      svgBars += `<rect x="${(x / totalWidth) * 100}%" y="0" width="${(bars[i] / totalWidth) * 100}%" height="100%" fill="#000"/>`;
    }
    x += bars[i];
  }
  return `<svg class="bc-svg" viewBox="0 0 100 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${svgBars}</svg>`;
}

// ============================================================
// Constantes de paginação
// ============================================================

const ITENS_PG1 = 22;
const ITENS_CONT = 45;

// ============================================================
// Blocos HTML
// ============================================================

// deno-lint-ignore no-explicit-any
function renderCanhoto(d: any): string {
  return `
<table class="cn" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:75%;" class="cn-r">
      RECEBEMOS DE <strong>${esc(d.emitente?.razao_social)}</strong>
      OS PRODUTOS E/OU SERVI&Ccedil;OS CONSTANTES DA NOTA FISCAL ELETR&Ocirc;NICA INDICADA AO LADO.
      VALOR TOTAL: R$ ${fmt(d.impostos?.valor_total_nota)}
      &nbsp;&nbsp; DATA DE RECEBIMENTO: ____/____/______
      &nbsp;&nbsp; IDENTIFICA&Ccedil;&Atilde;O E ASSINATURA DO RECEBEDOR: ________________________________
    </td>
    <td style="width:8%;" class="cn-nfe">NF-e</td>
    <td style="width:17%; text-align:center; vertical-align:middle;">
      <span class="lbl">N&ordm;</span>
      <span style="font-size:10pt; font-weight:bold; display:block;">${fmtNumNFe(d.numero)}</span>
      <span class="lbl">S&Eacute;RIE</span>
      <span style="font-size:9pt; font-weight:bold;">${fmtSerie(d.serie)}</span>
    </td>
  </tr>
</table>
<hr class="cn-cut"/>`;
}

// deno-lint-ignore no-explicit-any
function renderCabecalho(d: any, pgAtual: number, totalPgs: number): string {
  const tipoOp = d.tipo_operacao != null ? Number(d.tipo_operacao) : 1;
  const entChk = tipoOp === 0 ? 'on' : '';
  const saiChk = tipoOp === 1 ? 'on' : '';

  const logoHtml = d.emitente?.logo_url
    ? `<img src="${esc(d.emitente.logo_url)}" style="max-width:90px;max-height:45px;margin-bottom:1mm;display:block;"/>`
    : '';

  const fantasiaHtml = d.emitente?.nome_fantasia
    ? `<span class="em-f">${esc(d.emitente.nome_fantasia)}</span>`
    : '';

  const endParts = [
    d.emitente?.endereco, d.emitente?.bairro,
    `${d.emitente?.municipio || ''}-${d.emitente?.uf || ''}`,
    d.emitente?.cep ? `CEP: ${formatCEP(d.emitente.cep)}` : '',
    d.emitente?.fone ? `Fone: ${formatFone(d.emitente.fone)}` : '',
  ].filter(Boolean);

  return `
<table class="hd" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:38%;" class="em-b" rowspan="2">
      ${logoHtml}
      <div class="em-r">${esc(d.emitente?.razao_social)}</div>
      ${fantasiaHtml}
      <div class="em-a">${endParts.map((p: string) => esc(p)).join('<br/>')}</div>
    </td>
    <td style="width:15%;" class="dt">
      <div class="dt-t">DANFE</div>
      <div class="dt-s">Documento Auxiliar da<br/>Nota Fiscal Eletr&ocirc;nica</div>
      <div class="dt-tb">
        <span class="dt-chk ${entChk}">${tipoOp === 0 ? 'X' : '&nbsp;'}</span> ENTRADA<br/>
        <span class="dt-chk ${saiChk}">${tipoOp === 1 ? 'X' : '&nbsp;'}</span> SA&Iacute;DA
      </div>
      <div class="dt-nb">
        <div class="dt-n">N&ordm; ${fmtNumNFe(d.numero)}</div>
        <div class="dt-sr">S&Eacute;RIE ${fmtSerie(d.serie)}</div>
        <div class="dt-fl">FOLHA ${pgAtual}/${totalPgs}</div>
      </div>
    </td>
    <td style="width:47%;" class="ch-b" rowspan="2">
      <div class="ch-bc">
        ${renderBarcodeSVG(d.chave_acesso?.replace(/\D/g, '') || '')}
      </div>
      <span class="ch-l">CHAVE DE ACESSO</span>
      <div class="ch-v">${formatChaveAcesso(d.chave_acesso)}</div>
      <div class="ch-c">
        Consulta de autenticidade no portal nacional da NF-e<br/>
        www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
      </div>
      ${d.protocolo ? `
      <div class="ch-p">
        <span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span>
        <span class="v vm" style="font-size:7pt;text-align:center;">${esc(d.protocolo)}</span>
      </div>` : ''}
    </td>
  </tr>
</table>`;
}

// deno-lint-ignore no-explicit-any
function renderNaturezaIE(d: any): string {
  return `
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:50%;" class="cc">${campo('NATUREZA DA OPERA&Ccedil;&Atilde;O', esc(d.natureza_operacao))}</td>
    <td style="width:50%;" class="cc">${campo('PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO', esc(d.protocolo || ''), 'vm')}</td>
  </tr>
  <tr>
    <td style="width:33%;" class="cc">${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', esc(d.emitente?.ie))}</td>
    <td style="width:34%;" class="cc">${campo('INSC. ESTADUAL DO SUBST. TRIBUT&Aacute;RIO', esc(d.emitente?.ie_st || ''))}</td>
    <td style="width:33%;" class="cc">${campo('CNPJ', formatCNPJ(d.emitente?.cnpj))}</td>
  </tr>
</table>`;
}

// deno-lint-ignore no-explicit-any
function renderDest(d: any): string {
  const ds = d.destinatario || {};
  return `
<div class="bt">DESTINAT&Aacute;RIO / REMETENTE</div>
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:52%;" class="cc">${campo('NOME / RAZ&Atilde;O SOCIAL', esc(ds.razao_social))}</td>
    <td style="width:26%;" class="cc">${campo('CNPJ / CPF', formatCNPJouCPF(ds.cnpj_cpf))}</td>
    <td style="width:22%;" class="cc">${campo('DATA DA EMISS&Atilde;O', fmtDataBR(d.data_emissao))}</td>
  </tr>
  <tr>
    <td style="width:52%;" class="cc">${campo('ENDERE&Ccedil;O', esc(ds.endereco))}</td>
    <td style="width:26%;" class="cc">${campo('BAIRRO / DISTRITO', esc(ds.bairro))}</td>
    <td style="width:22%;" class="cc">${campo('CEP', formatCEP(ds.cep))}</td>
  </tr>
  <tr>
    <td style="width:35%;" class="cc">${campo('MUNIC&Iacute;PIO', esc(ds.municipio))}</td>
    <td style="width:15%;" class="cc">${campo('FONE / FAX', formatFone(ds.fone))}</td>
    <td style="width:5%;" class="cc">${campo('UF', esc(ds.uf))}</td>
    <td style="width:18%;" class="cc">${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', esc(ds.ie || ''))}</td>
    <td style="width:27%;" class="cc">${campo('DATA/HORA ENTRADA/SA&Iacute;DA', d.data_entrada_saida ? fmtDataHoraBR(d.data_entrada_saida) : '')}</td>
  </tr>
</table>`;
}

// deno-lint-ignore no-explicit-any
function renderFatura(d: any): string {
  const fat = d.fatura;
  const dups = d.duplicatas || [];
  if (!fat && dups.length === 0) return '';

  let html = '';
  if (fat) {
    html += `
<div class="bt">FATURA</div>
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:25%;" class="cc">${campo('N&Uacute;MERO', esc(fat.numero))}</td>
    <td style="width:25%;" class="cc">${campoR('VALOR ORIGINAL', fmt(fat.valor_original))}</td>
    <td style="width:25%;" class="cc">${campoR('VALOR DESCONTO', fmt(fat.valor_desconto))}</td>
    <td style="width:25%;" class="cc">${campoR('VALOR L&Iacute;QUIDO', fmt(fat.valor_liquido), 'vb')}</td>
  </tr>
</table>`;
  }
  if (dups.length > 0) {
    let rows = '';
    for (let i = 0; i < dups.length; i += 3) {
      const chunk = dups.slice(i, i + 3);
      let cells = '';
      // deno-lint-ignore no-explicit-any
      for (const dp of chunk) { cells += `<td class="cc">${campo('N&Uacute;MERO',esc(dp.numero))}</td><td class="cc">${campo('VENC.',fmtDataBR(dp.vencimento))}</td><td class="cc">${campoR('VALOR',fmt(dp.valor))}</td>`; }
      for (let j = chunk.length; j < 3; j++) { cells += '<td class="cc"></td><td class="cc"></td><td class="cc"></td>'; }
      rows += `<tr>${cells}</tr>`;
    }
    html += `<div class="bt">DUPLICATAS</div><table class="tbl" cellspacing="0" cellpadding="0">${rows}</table>`;
  }
  return html;
}

// deno-lint-ignore no-explicit-any
function renderImpostos(d: any): string {
  const i = d.impostos || {};
  return `
<div class="bt">C&Aacute;LCULO DO IMPOSTO</div>
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:15%;" class="cc">${campoR('BASE DE C&Aacute;LCULO DO ICMS', fmt(i.bc_icms))}</td>
    <td style="width:13%;" class="cc">${campoR('VALOR DO ICMS', fmt(i.valor_icms))}</td>
    <td style="width:15%;" class="cc">${campoR('BASE DE C&Aacute;LC. ICMS SUBST.', fmt(i.bc_icms_st))}</td>
    <td style="width:13%;" class="cc">${campoR('VALOR DO ICMS SUBST.', fmt(i.valor_icms_st))}</td>
    <td style="width:13%;" class="cc">${campoR('VALOR IMP. IMPORTA&Ccedil;&Atilde;O', fmt(i.valor_imp_importacao || 0))}</td>
    <td style="width:15%;" class="cc">${campoR('VALOR TOTAL DOS PRODUTOS', fmt(i.valor_total_produtos), 'vb')}</td>
  </tr>
  <tr>
    <td class="cc">${campoR('VALOR DO FRETE', fmt(i.valor_frete))}</td>
    <td class="cc">${campoR('VALOR DO SEGURO', fmt(i.valor_seguro))}</td>
    <td class="cc">${campoR('DESCONTO', fmt(i.valor_desconto))}</td>
    <td class="cc">${campoR('OUTRAS DESP. ACESS&Oacute;RIAS', fmt(i.outras_despesas))}</td>
    <td class="cc">${campoR('VALOR DO IPI', fmt(i.valor_ipi))}</td>
    <td class="cc">${campoR('VALOR TOTAL DA NOTA', fmt(i.valor_total_nota), 'vb vlg')}</td>
  </tr>
</table>`;
}

// deno-lint-ignore no-explicit-any
function renderTransp(d: any): string {
  const t = d.transportador || {};
  const v = d.volumes || {};
  return `
<div class="bt">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:28%;" class="cc">${campo('RAZ&Atilde;O SOCIAL', esc(t.razao_social || ''))}</td>
    <td style="width:18%;" class="cc">${campo('FRETE POR CONTA', fretePorConta(t.mod_frete))}</td>
    <td style="width:12%;" class="cc">${campo('C&Oacute;DIGO ANTT', esc(t.codigo_antt || ''))}</td>
    <td style="width:10%;" class="cc">${campo('PLACA DO VE&Iacute;CULO', esc(t.placa || ''))}</td>
    <td style="width:5%;" class="cc">${campo('UF', esc(t.placa_uf || ''))}</td>
    <td style="width:27%;" class="cc">${campo('CNPJ / CPF', formatCNPJouCPF(t.cnpj_cpf))}</td>
  </tr>
  <tr>
    <td style="width:28%;" class="cc">${campo('ENDERE&Ccedil;O', esc(t.endereco || ''))}</td>
    <td style="width:25%;" colspan="2" class="cc">${campo('MUNIC&Iacute;PIO', esc(t.municipio || ''))}</td>
    <td style="width:5%;" class="cc">${campo('UF', esc(t.uf || ''))}</td>
    <td style="width:22%;" colspan="2" class="cc">${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', esc(t.ie || ''))}</td>
  </tr>
</table>
<table class="tbl" cellspacing="0" cellpadding="0" style="border-top:none;">
  <tr>
    <td style="width:14%;border-top:none;" class="cc">${campo('QUANTIDADE', v.quantidade != null ? String(v.quantidade) : '')}</td>
    <td style="width:18%;border-top:none;" class="cc">${campo('ESP&Eacute;CIE', esc(v.especie || ''))}</td>
    <td style="width:18%;border-top:none;" class="cc">${campo('MARCA', esc(v.marca || ''))}</td>
    <td style="width:18%;border-top:none;" class="cc">${campo('NUMERA&Ccedil;&Atilde;O', esc(v.numeracao || ''))}</td>
    <td style="width:16%;border-top:none;" class="cc">${campoR('PESO BRUTO', v.peso_bruto != null ? fmt(v.peso_bruto) : '')}</td>
    <td style="width:16%;border-top:none;" class="cc">${campoR('PESO L&Iacute;QUIDO', v.peso_liquido != null ? fmt(v.peso_liquido) : '')}</td>
  </tr>
</table>`;
}

// deno-lint-ignore no-explicit-any
function renderProdutos(itens: any[], linhasVazias = 0): string {
  let html = `
<div class="bt">DADOS DOS PRODUTOS / SERVI&Ccedil;OS</div>
<table class="pt" cellspacing="0" cellpadding="0">
  <thead><tr>
    <th style="width:8%;">C&Oacute;DIGO<br/>PRODUTO</th>
    <th style="width:24%;">DESCRI&Ccedil;&Atilde;O DO PRODUTO / SERVI&Ccedil;O</th>
    <th style="width:7%;">NCM/SH</th>
    <th style="width:3%;">O/CST</th>
    <th style="width:4%;">CFOP</th>
    <th style="width:3%;">UN</th>
    <th style="width:7%;">QUANT.</th>
    <th style="width:8%;">VALOR<br/>UNIT&Aacute;RIO</th>
    <th style="width:8%;">VALOR<br/>TOTAL</th>
    <th style="width:8%;">B.C&Aacute;LC.<br/>ICMS</th>
    <th style="width:7%;">VALOR<br/>ICMS</th>
    <th style="width:5%;">VALOR<br/>IPI</th>
    <th style="width:4%;">AL&Iacute;Q.<br/>ICMS</th>
    <th style="width:4%;">AL&Iacute;Q.<br/>IPI</th>
  </tr></thead><tbody>`;

  // deno-lint-ignore no-explicit-any
  for (const it of itens) {
    html += `<tr>
      <td class="c">${esc(it.codigo)}</td>
      <td class="d">${esc(it.descricao)}</td>
      <td class="c">${esc(it.ncm)}</td>
      <td class="c">${esc(it.cst)}</td>
      <td class="c">${esc(it.cfop)}</td>
      <td class="c">${esc(it.unidade)}</td>
      <td class="n">${fmtQtd(it.quantidade)}</td>
      <td class="n">${fmtUnit(it.valor_unitario)}</td>
      <td class="n">${fmt(it.valor_total)}</td>
      <td class="n">${fmt(it.bc_icms)}</td>
      <td class="n">${fmt(it.valor_icms)}</td>
      <td class="n">${fmt(it.valor_ipi)}</td>
      <td class="n">${fmtAliq(it.aliq_icms)}</td>
      <td class="n">${fmtAliq(it.aliq_ipi)}</td>
    </tr>`;
  }
  for (let i = 0; i < linhasVazias; i++) {
    html += `<tr class="er"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

// deno-lint-ignore no-explicit-any
function renderDadosAd(d: any): string {
  return `
<div class="bt">DADOS ADICIONAIS</div>
<table class="tbl" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:65%;vertical-align:top;">
      ${campo('INFORMA&Ccedil;&Otilde;ES COMPLEMENTARES', '')}
      <div class="da">${esc(d.informacoes_complementares || '')}</div>
    </td>
    <td style="width:35%;vertical-align:top;">
      ${campo('RESERVADO AO FISCO', '')}
      <div class="da">${esc(d.reservado_fisco || '')}</div>
    </td>
  </tr>
</table>`;
}

function renderRodape(dataImpressao: string): string {
  return `<div class="rf">DATA E HORA DA IMPRESS&Atilde;O: ${esc(dataImpressao)} &mdash; DANFE gerado pelo sistema Croma Print</div>`;
}

// ============================================================
// Gerador principal
// ============================================================

// deno-lint-ignore no-explicit-any
export function gerarDanfeHTMLEdge(doc: any, empresa: any): string {
  // Montar dados
  const itens = (doc.fiscal_documentos_itens || []).map((item: any) => ({
    codigo: item.codigo_produto || '',
    descricao: item.descricao || '',
    ncm: item.ncm || '',
    cst: item.cst_ou_csosn || '',
    cfop: item.cfop || '',
    unidade: item.unidade || 'UN',
    quantidade: item.quantidade || 0,
    valor_unitario: item.valor_unitario || 0,
    valor_total: item.valor_total || 0,
    bc_icms: item.base_calculo_icms || 0,
    valor_icms: item.valor_icms || 0,
    valor_ipi: 0,
    aliq_icms: item.aliquota_icms || 0,
    aliq_ipi: 0,
  }));

  const emp = empresa || {};
  const cli = doc.clientes || {};
  const tpAmb = doc.fiscal_ambientes?.tipo === 'producao' ? 1 : 2;
  let protocolo = doc.protocolo || '';
  if (doc.data_autorizacao && protocolo) protocolo = `${protocolo} ${fmtDataHoraBR(doc.data_autorizacao)}`;

  const d = {
    numero: doc.numero || 0,
    serie: doc.fiscal_series?.serie ?? 1,
    chave_acesso: doc.chave_acesso || '',
    protocolo,
    data_emissao: doc.data_emissao || '',
    data_entrada_saida: doc.data_emissao,
    natureza_operacao: doc.natureza_operacao || 'VENDA DE MERCADORIA',
    tipo_operacao: 1,
    tp_amb: tpAmb,
    emitente: {
      razao_social: emp.razao_social || 'CROMA PRINT COMUNICAÇÃO VISUAL LTDA',
      nome_fantasia: emp.nome_fantasia || '',
      cnpj: emp.cnpj || '18923994000183',
      ie: emp.ie || '',
      ie_st: emp.ie_st || '',
      endereco: emp.endereco || '',
      bairro: emp.bairro || '',
      municipio: emp.municipio || 'SAO PAULO',
      uf: emp.uf || 'SP',
      cep: emp.cep || '',
      fone: emp.telefone || '',
      logo_url: emp.logo_url,
    },
    destinatario: {
      razao_social: cli.razao_social || '',
      cnpj_cpf: cli.cnpj || cli.cpf || '',
      ie: cli.ie || '',
      endereco: cli.endereco || '',
      bairro: cli.bairro || '',
      municipio: cli.cidade || cli.municipio || '',
      uf: cli.estado || cli.uf || '',
      cep: cli.cep || '',
      fone: cli.telefone || '',
    },
    impostos: {
      bc_icms: doc.valor_total || 0,
      valor_icms: doc.valor_icms || 0,
      bc_icms_st: 0,
      valor_icms_st: 0,
      valor_total_produtos: doc.valor_produtos || doc.valor_total || 0,
      valor_frete: doc.valor_frete || 0,
      valor_seguro: 0,
      valor_desconto: doc.valor_desconto || 0,
      outras_despesas: 0,
      valor_ipi: 0,
      valor_pis: doc.valor_pis || 0,
      valor_cofins: doc.valor_cofins || 0,
      valor_total_nota: doc.valor_total || 0,
    },
    transportador: null as any,
    volumes: null as any,
    fatura: null as any,
    duplicatas: [] as any[],
    itens,
    informacoes_complementares: doc.informacoes_contribuinte || doc.observacoes || '',
    reservado_fisco: doc.informacoes_fisco || '',
  };

  // Extrair cobrança
  const cobr = doc.payload_json?.NFe?.infNFe?.cobr;
  if (cobr) {
    if (cobr.fat) d.fatura = { numero: cobr.fat.nFat || '', valor_original: parseFloat(cobr.fat.vOrig)||0, valor_desconto: parseFloat(cobr.fat.vDesc)||0, valor_liquido: parseFloat(cobr.fat.vLiq)||0 };
    const dps = cobr.dup;
    if (Array.isArray(dps)) { for (const dp of dps) d.duplicatas.push({ numero: dp.nDup||'', vencimento: dp.dVenc||'', valor: parseFloat(dp.vDup)||0 }); }
    else if (dps) d.duplicatas.push({ numero: dps.nDup||'', vencimento: dps.dVenc||'', valor: parseFloat(dps.vDup)||0 });
  }

  // Extrair transporte
  const tr = doc.payload_json?.NFe?.infNFe?.transp;
  if (tr) {
    d.transportador = { razao_social: tr.transporta?.xNome||'', cnpj_cpf: tr.transporta?.CNPJ||tr.transporta?.CPF||'', ie: tr.transporta?.IE||'', endereco: tr.transporta?.xEnder||'', municipio: tr.transporta?.xMun||'', uf: tr.transporta?.UF||'', mod_frete: tr.modFrete??9, codigo_antt: tr.veicTransp?.RNTC||'', placa: tr.veicTransp?.placa||'', placa_uf: tr.veicTransp?.UF||'' };
    const vol = Array.isArray(tr.vol) ? tr.vol[0] : tr.vol;
    if (vol) d.volumes = { quantidade: vol.qVol?parseInt(vol.qVol):undefined, especie: vol.esp||'', marca: vol.marca||'', numeracao: vol.nVol||'', peso_bruto: vol.pesoB?parseFloat(vol.pesoB):undefined, peso_liquido: vol.pesoL?parseFloat(vol.pesoL):undefined };
  }

  // Paginação
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const isHom = d.tp_amb === 2;
  const itensPg1 = itens.slice(0, ITENS_PG1);
  const rest = itens.slice(ITENS_PG1);
  const contPages: any[][] = [];
  let r = rest;
  while (r.length > 0) { contPages.push(r.slice(0, ITENS_CONT)); r = r.slice(ITENS_CONT); }
  const totalPgs = 1 + contPages.length;

  // Página 1
  let pg1 = `<div class="pg">`;
  if (isHom) pg1 += `<div class="hb">SEM VALOR FISCAL &mdash; AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O</div>`;
  pg1 += renderCanhoto(d);
  pg1 += renderCabecalho(d, 1, totalPgs);
  pg1 += renderNaturezaIE(d);
  pg1 += renderDest(d);
  pg1 += renderFatura(d);
  pg1 += renderImpostos(d);
  pg1 += renderTransp(d);
  pg1 += renderProdutos(itensPg1, Math.max(0, ITENS_PG1 - itensPg1.length));
  if (contPages.length === 0) pg1 += renderDadosAd(d);
  pg1 += renderRodape(agora);
  pg1 += `</div>`;

  // Páginas de continuação
  let cont = '';
  for (let i = 0; i < contPages.length; i++) {
    const pgItens = contPages[i];
    const isLast = i === contPages.length - 1;
    cont += `<div class="pg">`;
    if (isHom) cont += `<div class="hb">SEM VALOR FISCAL &mdash; AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O</div>`;
    cont += renderCabecalho(d, i + 2, totalPgs);
    cont += renderNaturezaIE(d);
    cont += renderProdutos(pgItens, Math.max(0, ITENS_CONT - pgItens.length));
    if (isLast) cont += renderDadosAd(d);
    cont += renderRodape(agora);
    cont += `</div>`;
  }

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>DANFE - NF-e ${fmtNumNFe(d.numero)}</title><style>${CSS}</style></head><body>${pg1}${cont}</body></html>`;
}
