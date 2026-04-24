/**
 * DANFE — Template HTML profissional v2.0
 * Gera HTML completo do DANFE no padrão clássico brasileiro.
 * Suporta múltiplas páginas com continuação de produtos e dados adicionais.
 *
 * Referências: MOC (Manual de Orientação do Contribuinte) SEFAZ,
 * brasil-js/danfe (tipografia + grid), SrPattif.Danfe (blocos + organização).
 *
 * Revisão completa 2026-04-09 — refatoração profissional
 */

import { DANFE_CSS } from './danfe-styles';
import {
  formatCNPJ, formatCPF, formatCNPJouCPF, formatCEP, formatFone,
  formatChaveAcesso, formatMoeda, formatQtd, formatValorUnitario,
  formatAliquota, formatDataBR, formatDataHoraBR, formatNumeroNFe,
  formatSerie, tipoOperacao, fretePorConta, escapeHtml,
} from './danfe-format';

// ============================================================
// Tipos de dados de entrada
// ============================================================

export interface DanfeEmitente {
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie: string;
  ie_st?: string;
  endereco: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  fone?: string;
  logo_url?: string;
}

export interface DanfeDestinatario {
  razao_social: string;
  cnpj_cpf: string;
  ie?: string;
  endereco: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  fone?: string;
  complemento?: string;
}

export interface DanfeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cst: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  bc_icms: number;
  valor_icms: number;
  valor_ipi: number;
  aliq_icms: number;
  aliq_ipi: number;
}

export interface DanfeFatura {
  numero: string;
  valor_original: number;
  valor_desconto: number;
  valor_liquido: number;
}

export interface DanfeDuplicata {
  numero: string;
  vencimento: string;
  valor: number;
}

export interface DanfeTransportador {
  razao_social?: string;
  cnpj_cpf?: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  mod_frete: number | string;
  codigo_antt?: string;
  placa?: string;
  placa_uf?: string;
}

export interface DanfeVolumes {
  quantidade?: number;
  especie?: string;
  marca?: string;
  numeracao?: string;
  peso_bruto?: number;
  peso_liquido?: number;
}

export interface DanfeImpostos {
  bc_icms: number;
  valor_icms: number;
  icms_desonerado?: number;
  bc_icms_st: number;
  valor_icms_st: number;
  valor_imp_importacao?: number;
  valor_total_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  outras_despesas: number;
  valor_ipi: number;
  valor_pis: number;
  valor_cofins: number;
  valor_total_nota: number;
}

export interface DanfeData {
  numero: number | string;
  serie: number | string;
  chave_acesso: string;
  protocolo?: string;
  data_emissao: string;
  data_entrada_saida?: string;
  hora_entrada_saida?: string;
  natureza_operacao: string;
  tipo_operacao?: number | string;
  finalidade?: string;
  tp_amb?: number;
  emitente: DanfeEmitente;
  destinatario: DanfeDestinatario;
  impostos: DanfeImpostos;
  transportador?: DanfeTransportador;
  volumes?: DanfeVolumes;
  fatura?: DanfeFatura;
  duplicatas?: DanfeDuplicata[];
  itens: DanfeItem[];
  informacoes_complementares?: string;
  reservado_fisco?: string;
}

// ============================================================
// Constantes de paginação
// ============================================================

const ITENS_PAGINA_1 = 22;
const ITENS_PAGINA_CONT = 45;

// ============================================================
// Helpers
// ============================================================

/** Gera um campo fiscal (label + valor) padronizado */
function campo(label: string, valor: string, extra = ''): string {
  return `<span class="lbl">${label}</span><span class="val ${extra}">${valor}</span>`;
}

/** Gera um campo com valor alinhado à direita */
function campoR(label: string, valor: string, extra = ''): string {
  return campo(label, valor, `val-right ${extra}`);
}

// ============================================================
// Geradores de blocos HTML
// ============================================================

function renderCanhoto(d: DanfeData): string {
  return `
<table class="canhoto" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:75%;" class="canhoto-recebemos">
      RECEBEMOS DE <strong>${escapeHtml(d.emitente.razao_social)}</strong>
      OS PRODUTOS E/OU SERVI&Ccedil;OS CONSTANTES DA NOTA FISCAL ELETR&Ocirc;NICA INDICADA AO LADO.
      VALOR TOTAL: R$ ${formatMoeda(d.impostos.valor_total_nota)}
      &nbsp;&nbsp; DATA DE RECEBIMENTO: ____/____/______
      &nbsp;&nbsp; IDENTIFICA&Ccedil;&Atilde;O E ASSINATURA DO RECEBEDOR: ________________________________
    </td>
    <td style="width:8%;" class="canhoto-nfe">
      NF-e
    </td>
    <td style="width:17%; text-align:center; vertical-align:middle;">
      <span class="lbl">N&ordm;</span>
      <span style="font-size:10pt; font-weight:bold; display:block;">${formatNumeroNFe(d.numero)}</span>
      <span class="lbl">S&Eacute;RIE</span>
      <span style="font-size:9pt; font-weight:bold;">${formatSerie(d.serie)}</span>
    </td>
  </tr>
</table>
<hr class="canhoto-recorte"/>`;
}

function renderCabecalhoPrincipal(d: DanfeData, paginaAtual: number, totalPaginas: number): string {
  const tipoOp = d.tipo_operacao != null ? Number(d.tipo_operacao) : 1;
  const entradaCheck = tipoOp === 0 ? 'active' : '';
  const saidaCheck = tipoOp === 1 ? 'active' : '';

  const logoHtml = d.emitente.logo_url
    ? `<img src="${escapeHtml(d.emitente.logo_url)}" style="max-width:90px; max-height:45px; margin-bottom:1mm; display:block;"/>`
    : '';

  const fantasiaHtml = d.emitente.nome_fantasia
    ? `<span class="emitente-fantasia">${escapeHtml(d.emitente.nome_fantasia)}</span>`
    : '';

  const endParts = [
    d.emitente.endereco,
    d.emitente.bairro,
    `${d.emitente.municipio}-${d.emitente.uf}`,
    d.emitente.cep ? `CEP: ${formatCEP(d.emitente.cep)}` : '',
    d.emitente.fone ? `Fone: ${formatFone(d.emitente.fone)}` : '',
  ].filter(Boolean);

  return `
<table class="header-block" cellspacing="0" cellpadding="0">
  <tr>
    <!-- EMITENTE (38%) -->
    <td style="width:38%;" class="emitente-box" rowspan="2">
      ${logoHtml}
      <div class="emitente-razao">${escapeHtml(d.emitente.razao_social)}</div>
      ${fantasiaHtml}
      <div class="emitente-endereco">${endParts.map(p => escapeHtml(p)).join('<br/>')}</div>
    </td>
    <!-- DANFE TÍTULO + TIPO + NÚMERO (15%) -->
    <td style="width:15%;" class="danfe-titulo-box">
      <div class="danfe-titulo">DANFE</div>
      <div class="danfe-subtitulo">Documento Auxiliar da<br/>Nota Fiscal Eletr&ocirc;nica</div>
      <div class="danfe-tipo-box">
        <span class="danfe-tipo-check ${entradaCheck}">${tipoOp === 0 ? 'X' : '&nbsp;'}</span> ENTRADA<br/>
        <span class="danfe-tipo-check ${saidaCheck}">${tipoOp === 1 ? 'X' : '&nbsp;'}</span> SA&Iacute;DA
      </div>
      <div class="danfe-numero-box">
        <div class="danfe-numero">N&ordm; ${formatNumeroNFe(d.numero)}</div>
        <div class="danfe-serie">S&Eacute;RIE ${formatSerie(d.serie)}</div>
        <div class="danfe-folha">FOLHA ${paginaAtual}/${totalPaginas}</div>
      </div>
    </td>
    <!-- BARCODE + CHAVE (47%) -->
    <td style="width:47%;" class="chave-box" rowspan="2">
      <div class="barcode-box">
        ${renderBarcodeSVG(d.chave_acesso?.replace(/\D/g, '') || '')}
      </div>
      <span class="chave-label">CHAVE DE ACESSO</span>
      <div class="chave-valor">${formatChaveAcesso(d.chave_acesso)}</div>
      <div class="chave-consulta">
        Consulta de autenticidade no portal nacional da NF-e<br/>
        www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
      </div>
      ${d.protocolo ? `
      <div class="protocolo-box">
        <span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span>
        <span class="val val-mono" style="font-size:7pt; text-align:center;">${escapeHtml(d.protocolo)}</span>
      </div>` : ''}
    </td>
  </tr>
</table>`;
}

/**
 * Gera SVG inline de Code 128B para a chave de acesso.
 * Implementação simplificada — gera barras visuais representativas.
 * Para produção real, a chave de acesso usa Code 128C (numérico).
 */
function renderBarcodeSVG(digits: string): string {
  if (!digits || digits.length < 10) {
    return `<div style="height:12mm; display:flex; align-items:center; justify-content:center; font-size:6pt; color:#999;">C&Oacute;DIGO DE BARRAS</div>`;
  }

  // Gera barras pseudo-Code128 baseado nos dígitos
  // Cada par de dígitos gera um padrão de barras
  const bars: number[] = [];
  // Start code C
  bars.push(2, 1, 1, 2, 3, 2);

  for (let i = 0; i < digits.length; i += 2) {
    const pair = parseInt(digits.substring(i, i + 2), 10) || 0;
    // Simplified encoding — creates visual barcode pattern
    const b1 = ((pair >> 5) & 3) + 1;
    const s1 = ((pair >> 3) & 3) + 1;
    const b2 = ((pair >> 1) & 3) + 1;
    const s2 = (pair & 1) + 1;
    const b3 = 1;
    const s3 = Math.max(1, 6 - b1 - s1 - b2 + 2);
    bars.push(b1, s1, b2, s2, b3, s3);
  }

  // Stop pattern
  bars.push(2, 3, 3, 1, 1, 1, 2);

  const totalWidth = bars.reduce((a, b) => a + b, 0);
  let svgBars = '';
  let x = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i % 2 === 0) {
      // Bar (black)
      svgBars += `<rect x="${(x / totalWidth) * 100}%" y="0" width="${(bars[i] / totalWidth) * 100}%" height="100%" fill="#000"/>`;
    }
    x += bars[i];
  }

  return `<svg class="barcode-svg" viewBox="0 0 100 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${svgBars}</svg>`;
}

function renderNaturezaIE(d: DanfeData): string {
  return `
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:50%;" class="cell-compact">
      ${campo('NATUREZA DA OPERA&Ccedil;&Atilde;O', escapeHtml(d.natureza_operacao))}
    </td>
    <td style="width:50%;" class="cell-compact">
      ${campo('PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO', escapeHtml(d.protocolo || ''), 'val-mono')}
    </td>
  </tr>
  <tr>
    <td style="width:33%;" class="cell-compact">
      ${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', escapeHtml(d.emitente.ie))}
    </td>
    <td style="width:34%;" class="cell-compact">
      ${campo('INSC. ESTADUAL DO SUBST. TRIBUT&Aacute;RIO', escapeHtml(d.emitente.ie_st || ''))}
    </td>
    <td style="width:33%;" class="cell-compact">
      ${campo('CNPJ', formatCNPJ(d.emitente.cnpj))}
    </td>
  </tr>
</table>`;
}

function renderDestinatario(d: DanfeData): string {
  const dest = d.destinatario;
  return `
<div class="bloco-titulo">DESTINAT&Aacute;RIO / REMETENTE</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:52%;" class="cell-compact">
      ${campo('NOME / RAZ&Atilde;O SOCIAL', escapeHtml(dest.razao_social))}
    </td>
    <td style="width:26%;" class="cell-compact">
      ${campo('CNPJ / CPF', formatCNPJouCPF(dest.cnpj_cpf))}
    </td>
    <td style="width:22%;" class="cell-compact">
      ${campo('DATA DA EMISS&Atilde;O', formatDataBR(d.data_emissao))}
    </td>
  </tr>
  <tr>
    <td style="width:52%;" class="cell-compact">
      ${campo('ENDERE&Ccedil;O', escapeHtml(dest.endereco))}
    </td>
    <td style="width:26%;" class="cell-compact">
      ${campo('BAIRRO / DISTRITO', escapeHtml(dest.bairro))}
    </td>
    <td style="width:22%;" class="cell-compact">
      ${campo('CEP', formatCEP(dest.cep))}
    </td>
  </tr>
  <tr>
    <td style="width:35%;" class="cell-compact">
      ${campo('MUNIC&Iacute;PIO', escapeHtml(dest.municipio))}
    </td>
    <td style="width:15%;" class="cell-compact">
      ${campo('FONE / FAX', formatFone(dest.fone))}
    </td>
    <td style="width:5%;" class="cell-compact">
      ${campo('UF', escapeHtml(dest.uf))}
    </td>
    <td style="width:18%;" class="cell-compact">
      ${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', escapeHtml(dest.ie || ''))}
    </td>
    <td style="width:27%;" class="cell-compact">
      ${campo('DATA/HORA ENTRADA/SA&Iacute;DA', d.data_entrada_saida ? formatDataHoraBR(d.data_entrada_saida) : '')}
    </td>
  </tr>
</table>`;
}

function renderFaturaDuplicatas(d: DanfeData): string {
  const fat = d.fatura;
  const dups = d.duplicatas || [];

  if (!fat && dups.length === 0) return '';

  let faturaHtml = '';
  if (fat) {
    faturaHtml = `
<div class="bloco-titulo">FATURA</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:25%;" class="cell-compact">
      ${campo('N&Uacute;MERO', escapeHtml(fat.numero))}
    </td>
    <td style="width:25%;" class="cell-compact">
      ${campoR('VALOR ORIGINAL', formatMoeda(fat.valor_original))}
    </td>
    <td style="width:25%;" class="cell-compact">
      ${campoR('VALOR DESCONTO', formatMoeda(fat.valor_desconto))}
    </td>
    <td style="width:25%;" class="cell-compact">
      ${campoR('VALOR L&Iacute;QUIDO', formatMoeda(fat.valor_liquido), 'val-bold')}
    </td>
  </tr>
</table>`;
  }

  let dupsHtml = '';
  if (dups.length > 0) {
    const dupsPerRow = 3;
    let dupsRows = '';
    for (let i = 0; i < dups.length; i += dupsPerRow) {
      const chunk = dups.slice(i, i + dupsPerRow);
      let cells = '';
      for (const dup of chunk) {
        cells += `
      <td class="cell-compact">${campo('N&Uacute;MERO', escapeHtml(dup.numero))}</td>
      <td class="cell-compact">${campo('VENCIMENTO', formatDataBR(dup.vencimento))}</td>
      <td class="cell-compact">${campoR('VALOR', formatMoeda(dup.valor))}</td>`;
      }
      for (let j = chunk.length; j < dupsPerRow; j++) {
        cells += '<td class="cell-compact"></td><td class="cell-compact"></td><td class="cell-compact"></td>';
      }
      dupsRows += `<tr>${cells}</tr>`;
    }
    dupsHtml = `
<div class="bloco-titulo">DUPLICATAS</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  ${dupsRows}
</table>`;
  }

  return faturaHtml + dupsHtml;
}

function renderImpostos(d: DanfeData): string {
  const imp = d.impostos;
  return `
<div class="bloco-titulo">C&Aacute;LCULO DO IMPOSTO</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:15%;" class="cell-compact">
      ${campoR('BASE DE C&Aacute;LCULO DO ICMS', formatMoeda(imp.bc_icms))}
    </td>
    <td style="width:13%;" class="cell-compact">
      ${campoR('VALOR DO ICMS', formatMoeda(imp.valor_icms))}
    </td>
    <td style="width:15%;" class="cell-compact">
      ${campoR('BASE DE C&Aacute;LC. ICMS SUBST.', formatMoeda(imp.bc_icms_st))}
    </td>
    <td style="width:13%;" class="cell-compact">
      ${campoR('VALOR DO ICMS SUBST.', formatMoeda(imp.valor_icms_st))}
    </td>
    <td style="width:13%;" class="cell-compact">
      ${campoR('VALOR IMP. IMPORTA&Ccedil;&Atilde;O', formatMoeda(imp.valor_imp_importacao || 0))}
    </td>
    <td style="width:15%;" class="cell-compact">
      ${campoR('VALOR TOTAL DOS PRODUTOS', formatMoeda(imp.valor_total_produtos), 'val-bold')}
    </td>
  </tr>
  <tr>
    <td class="cell-compact">
      ${campoR('VALOR DO FRETE', formatMoeda(imp.valor_frete))}
    </td>
    <td class="cell-compact">
      ${campoR('VALOR DO SEGURO', formatMoeda(imp.valor_seguro))}
    </td>
    <td class="cell-compact">
      ${campoR('DESCONTO', formatMoeda(imp.valor_desconto))}
    </td>
    <td class="cell-compact">
      ${campoR('OUTRAS DESP. ACESS&Oacute;RIAS', formatMoeda(imp.outras_despesas))}
    </td>
    <td class="cell-compact">
      ${campoR('VALOR DO IPI', formatMoeda(imp.valor_ipi))}
    </td>
    <td class="cell-compact">
      ${campoR('VALOR TOTAL DA NOTA', formatMoeda(imp.valor_total_nota), 'val-bold val-lg')}
    </td>
  </tr>
</table>`;
}

function renderTransportador(d: DanfeData): string {
  const t = d.transportador;
  const v = d.volumes;
  return `
<div class="bloco-titulo">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:28%;" class="cell-compact">
      ${campo('RAZ&Atilde;O SOCIAL', escapeHtml(t?.razao_social || ''))}
    </td>
    <td style="width:18%;" class="cell-compact">
      ${campo('FRETE POR CONTA', fretePorConta(t?.mod_frete))}
    </td>
    <td style="width:12%;" class="cell-compact">
      ${campo('C&Oacute;DIGO ANTT', escapeHtml(t?.codigo_antt || ''))}
    </td>
    <td style="width:10%;" class="cell-compact">
      ${campo('PLACA DO VE&Iacute;CULO', escapeHtml(t?.placa || ''))}
    </td>
    <td style="width:5%;" class="cell-compact">
      ${campo('UF', escapeHtml(t?.placa_uf || ''))}
    </td>
    <td style="width:27%;" class="cell-compact">
      ${campo('CNPJ / CPF', formatCNPJouCPF(t?.cnpj_cpf))}
    </td>
  </tr>
  <tr>
    <td style="width:28%;" class="cell-compact">
      ${campo('ENDERE&Ccedil;O', escapeHtml(t?.endereco || ''))}
    </td>
    <td style="width:25%;" colspan="2" class="cell-compact">
      ${campo('MUNIC&Iacute;PIO', escapeHtml(t?.municipio || ''))}
    </td>
    <td style="width:5%;" class="cell-compact">
      ${campo('UF', escapeHtml(t?.uf || ''))}
    </td>
    <td style="width:22%;" colspan="2" class="cell-compact">
      ${campo('INSCRI&Ccedil;&Atilde;O ESTADUAL', escapeHtml(t?.ie || ''))}
    </td>
  </tr>
</table>
<table class="danfe-table" cellspacing="0" cellpadding="0" style="border-top:none;">
  <tr>
    <td style="width:14%; border-top:none;" class="cell-compact">
      ${campo('QUANTIDADE', v?.quantidade != null ? String(v.quantidade) : '')}
    </td>
    <td style="width:18%; border-top:none;" class="cell-compact">
      ${campo('ESP&Eacute;CIE', escapeHtml(v?.especie || ''))}
    </td>
    <td style="width:18%; border-top:none;" class="cell-compact">
      ${campo('MARCA', escapeHtml(v?.marca || ''))}
    </td>
    <td style="width:18%; border-top:none;" class="cell-compact">
      ${campo('NUMERA&Ccedil;&Atilde;O', escapeHtml(v?.numeracao || ''))}
    </td>
    <td style="width:16%; border-top:none;" class="cell-compact">
      ${campoR('PESO BRUTO', v?.peso_bruto != null ? formatMoeda(v.peso_bruto) : '')}
    </td>
    <td style="width:16%; border-top:none;" class="cell-compact">
      ${campoR('PESO L&Iacute;QUIDO', v?.peso_liquido != null ? formatMoeda(v.peso_liquido) : '')}
    </td>
  </tr>
</table>`;
}

function renderProdutosHeader(): string {
  return `
<div class="bloco-titulo">DADOS DOS PRODUTOS / SERVI&Ccedil;OS</div>
<table class="produtos-table" cellspacing="0" cellpadding="0">
  <thead>
    <tr>
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
    </tr>
  </thead>`;
}

function renderProdutoRow(item: DanfeItem): string {
  return `
    <tr>
      <td class="center">${escapeHtml(item.codigo)}</td>
      <td class="desc">${escapeHtml(item.descricao)}</td>
      <td class="center">${escapeHtml(item.ncm)}</td>
      <td class="center">${escapeHtml(item.cst)}</td>
      <td class="center">${escapeHtml(item.cfop)}</td>
      <td class="center">${escapeHtml(item.unidade)}</td>
      <td class="num">${formatQtd(item.quantidade)}</td>
      <td class="num">${formatValorUnitario(item.valor_unitario)}</td>
      <td class="num">${formatMoeda(item.valor_total)}</td>
      <td class="num">${formatMoeda(item.bc_icms)}</td>
      <td class="num">${formatMoeda(item.valor_icms)}</td>
      <td class="num">${formatMoeda(item.valor_ipi)}</td>
      <td class="num">${formatAliquota(item.aliq_icms)}</td>
      <td class="num">${formatAliquota(item.aliq_ipi)}</td>
    </tr>`;
}

function renderProdutosBlock(itens: DanfeItem[], linhasVazias = 0): string {
  let html = renderProdutosHeader();
  html += '<tbody>';
  for (const item of itens) {
    html += renderProdutoRow(item);
  }
  for (let i = 0; i < linhasVazias; i++) {
    html += `<tr class="empty-row">
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderDadosAdicionais(d: DanfeData, isContinuacao = false): string {
  return `
<div class="bloco-titulo">DADOS ADICIONAIS</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:65%; vertical-align:top;">
      ${campo('INFORMA&Ccedil;&Otilde;ES COMPLEMENTARES', '')}
      <div class="dados-adicionais">${escapeHtml(d.informacoes_complementares || '')}</div>
    </td>
    <td style="width:35%; vertical-align:top;">
      ${campo('RESERVADO AO FISCO', '')}
      <div class="dados-adicionais">${escapeHtml(d.reservado_fisco || '')}</div>
    </td>
  </tr>
</table>`;
}

function renderRodape(dataImpressao: string): string {
  return `<div class="danfe-rodape">
  DATA E HORA DA IMPRESS&Atilde;O: ${escapeHtml(dataImpressao)} &mdash; DANFE gerado pelo sistema Croma Print
</div>`;
}

function renderHomologacaoBanner(): string {
  return `<div class="homologacao-banner">
  SEM VALOR FISCAL &mdash; AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O
</div>`;
}

// ============================================================
// Gerador principal
// ============================================================

/**
 * Gera HTML completo do DANFE profissional, multi-página.
 */
export function gerarDanfeHTML(data: DanfeData): string {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const isHomologacao = data.tp_amb === 2;
  const itens = data.itens || [];

  // Calcular paginação
  const itensPg1 = itens.slice(0, ITENS_PAGINA_1);
  const itensRestantes = itens.slice(ITENS_PAGINA_1);
  const paginasContinuacao: DanfeItem[][] = [];
  let rest = itensRestantes;
  while (rest.length > 0) {
    paginasContinuacao.push(rest.slice(0, ITENS_PAGINA_CONT));
    rest = rest.slice(ITENS_PAGINA_CONT);
  }
  const totalPaginas = 1 + paginasContinuacao.length;

  // --- PÁGINA 1 ---
  const linhasVaziasPg1 = Math.max(0, ITENS_PAGINA_1 - itensPg1.length);
  let pagina1 = `<div class="danfe-page">`;
  if (isHomologacao) pagina1 += renderHomologacaoBanner();
  pagina1 += renderCanhoto(data);
  pagina1 += renderCabecalhoPrincipal(data, 1, totalPaginas);
  pagina1 += renderNaturezaIE(data);
  pagina1 += renderDestinatario(data);
  pagina1 += renderFaturaDuplicatas(data);
  pagina1 += renderImpostos(data);
  pagina1 += renderTransportador(data);
  pagina1 += renderProdutosBlock(itensPg1, linhasVaziasPg1);
  if (paginasContinuacao.length === 0) {
    pagina1 += renderDadosAdicionais(data);
  }
  pagina1 += renderRodape(agora);
  pagina1 += `</div>`;

  // --- PÁGINAS DE CONTINUAÇÃO ---
  let paginasCont = '';
  for (let i = 0; i < paginasContinuacao.length; i++) {
    const pgNum = i + 2;
    const itensPg = paginasContinuacao[i];
    const linhasVazias = Math.max(0, ITENS_PAGINA_CONT - itensPg.length);
    const isUltima = i === paginasContinuacao.length - 1;

    paginasCont += `<div class="danfe-page">`;
    if (isHomologacao) paginasCont += renderHomologacaoBanner();
    paginasCont += renderCabecalhoPrincipal(data, pgNum, totalPaginas);
    paginasCont += renderNaturezaIE(data);
    paginasCont += renderProdutosBlock(itensPg, linhasVazias);
    if (isUltima) {
      paginasCont += renderDadosAdicionais(data, true);
    }
    paginasCont += renderRodape(agora);
    paginasCont += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DANFE - NF-e ${formatNumeroNFe(data.numero)}</title>
  <style>${DANFE_CSS}</style>
</head>
<body>
${pagina1}
${paginasCont}
</body>
</html>`;
}

/**
 * Converte dados de um FiscalDocumento (do banco Supabase) para DanfeData.
 */
export function fiscalDocumentoToDanfeData(doc: any, empresa?: any): DanfeData {
  const itens: DanfeItem[] = (doc.fiscal_documentos_itens || []).map((item: any) => ({
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
  const emitente: DanfeEmitente = {
    razao_social: emp.razao_social || 'CROMA PRINT COMUNICAÇÃO VISUAL LTDA',
    nome_fantasia: emp.nome_fantasia || '',
    cnpj: emp.cnpj || '18923994000183',
    ie: emp.ie || '',
    endereco: emp.endereco || '',
    bairro: emp.bairro || '',
    municipio: emp.municipio || 'SAO PAULO',
    uf: emp.uf || 'SP',
    cep: emp.cep || '',
    fone: emp.telefone || '',
    logo_url: emp.logo_url,
  };

  const cli = doc.clientes || {};
  const destinatario: DanfeDestinatario = {
    razao_social: cli.razao_social || '',
    cnpj_cpf: cli.cnpj || cli.cpf || '',
    ie: cli.ie || '',
    endereco: cli.endereco || '',
    bairro: cli.bairro || '',
    municipio: cli.cidade || cli.municipio || '',
    uf: cli.estado || cli.uf || '',
    cep: cli.cep || '',
    fone: cli.telefone || '',
    complemento: cli.complemento || '',
  };

  const payloadCobranca = doc.payload_json?.NFe?.infNFe?.cobr;
  const duplicatas: DanfeDuplicata[] = [];
  let fatura: DanfeFatura | undefined;

  if (payloadCobranca) {
    if (payloadCobranca.fat) {
      fatura = {
        numero: payloadCobranca.fat.nFat || '',
        valor_original: parseFloat(payloadCobranca.fat.vOrig) || 0,
        valor_desconto: parseFloat(payloadCobranca.fat.vDesc) || 0,
        valor_liquido: parseFloat(payloadCobranca.fat.vLiq) || 0,
      };
    }
    const dups = payloadCobranca.dup;
    if (Array.isArray(dups)) {
      for (const dup of dups) {
        duplicatas.push({
          numero: dup.nDup || '',
          vencimento: dup.dVenc || '',
          valor: parseFloat(dup.vDup) || 0,
        });
      }
    } else if (dups) {
      duplicatas.push({
        numero: dups.nDup || '',
        vencimento: dups.dVenc || '',
        valor: parseFloat(dups.vDup) || 0,
      });
    }
  }

  const payloadTransp = doc.payload_json?.NFe?.infNFe?.transp;
  let transportador: DanfeTransportador | undefined;
  let volumes: DanfeVolumes | undefined;

  if (payloadTransp) {
    transportador = {
      razao_social: payloadTransp.transporta?.xNome || '',
      cnpj_cpf: payloadTransp.transporta?.CNPJ || payloadTransp.transporta?.CPF || '',
      ie: payloadTransp.transporta?.IE || '',
      endereco: payloadTransp.transporta?.xEnder || '',
      municipio: payloadTransp.transporta?.xMun || '',
      uf: payloadTransp.transporta?.UF || '',
      mod_frete: payloadTransp.modFrete ?? 9,
      codigo_antt: payloadTransp.veicTransp?.RNTC || '',
      placa: payloadTransp.veicTransp?.placa || '',
      placa_uf: payloadTransp.veicTransp?.UF || '',
    };

    const vol = Array.isArray(payloadTransp.vol) ? payloadTransp.vol[0] : payloadTransp.vol;
    if (vol) {
      volumes = {
        quantidade: vol.qVol ? parseInt(vol.qVol) : undefined,
        especie: vol.esp || '',
        marca: vol.marca || '',
        numeracao: vol.nVol || '',
        peso_bruto: vol.pesoB ? parseFloat(vol.pesoB) : undefined,
        peso_liquido: vol.pesoL ? parseFloat(vol.pesoL) : undefined,
      };
    }
  }

  const tpAmb = doc.fiscal_ambientes?.tipo === 'producao' ? 1 : 2;

  let protocolo = doc.protocolo || '';
  if (doc.data_autorizacao && protocolo) {
    protocolo = `${protocolo} ${formatDataHoraBR(doc.data_autorizacao)}`;
  }

  return {
    numero: doc.numero || 0,
    serie: doc.fiscal_series?.serie ?? 1,
    chave_acesso: doc.chave_acesso || '',
    protocolo,
    data_emissao: doc.data_emissao || '',
    data_entrada_saida: doc.data_emissao,
    natureza_operacao: doc.natureza_operacao || 'VENDA DE MERCADORIA',
    tipo_operacao: 1,
    tp_amb: tpAmb,
    emitente,
    destinatario,
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
    transportador,
    volumes,
    fatura,
    duplicatas,
    itens,
    informacoes_complementares: doc.informacoes_contribuinte || doc.observacoes || '',
    reservado_fisco: doc.informacoes_fisco || '',
  };
}
