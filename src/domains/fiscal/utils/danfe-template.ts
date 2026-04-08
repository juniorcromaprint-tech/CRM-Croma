/**
 * DANFE — Template HTML profissional
 * Gera HTML completo do DANFE no padrao classico brasileiro.
 * Suporta multiplas paginas com continuacao de produtos e dados adicionais.
 *
 * Referencia: MOC (Manual de Orientacao do Contribuinte) SEFAZ
 * Layout baseado no modelo VinilSul/classico SP.
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
  // Identificacao
  numero: number | string;
  serie: number | string;
  chave_acesso: string;
  protocolo?: string;
  data_emissao: string;
  data_entrada_saida?: string;
  hora_entrada_saida?: string;
  natureza_operacao: string;
  tipo_operacao?: number | string; // 0=entrada, 1=saida
  finalidade?: string;
  tp_amb?: number; // 1=producao, 2=homologacao

  // Entidades
  emitente: DanfeEmitente;
  destinatario: DanfeDestinatario;

  // Impostos
  impostos: DanfeImpostos;

  // Transporte
  transportador?: DanfeTransportador;
  volumes?: DanfeVolumes;

  // Fatura/duplicatas
  fatura?: DanfeFatura;
  duplicatas?: DanfeDuplicata[];

  // Itens
  itens: DanfeItem[];

  // Observacoes
  informacoes_complementares?: string;
  reservado_fisco?: string;
}

// ============================================================
// Constantes de paginacao
// ============================================================

/** Itens por pagina: ~25 na primeira (com canhoto+cabecalhos), ~45 nas continuacoes */
const ITENS_PAGINA_1 = 22;
const ITENS_PAGINA_CONT = 42;

// ============================================================
// Geradores de blocos HTML
// ============================================================

function renderCanhoto(d: DanfeData): string {
  return `
<table class="canhoto" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:60%;" rowspan="3">
      <span class="canhoto-titulo">
        <strong>RECEBEMOS DE</strong> ${escapeHtml(d.emitente.razao_social)}<br/>
        OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
      </span>
    </td>
    <td style="width:20%; text-align:center;" class="canhoto-nfe">NF-e</td>
    <td style="width:20%;" rowspan="3" class="text-center">
      <span class="lbl">N&ordm;</span>
      <span class="val val-bold" style="font-size:9pt;">${formatNumeroNFe(d.numero)}</span><br/>
      <span class="lbl">S&eacute;rie</span>
      <span class="val val-bold">${d.serie}</span>
    </td>
  </tr>
  <tr>
    <td>
      <span class="lbl">VLR TOTAL NOTA</span>
      <span class="val val-bold">${formatMoeda(d.impostos.valor_total_nota)}</span>
    </td>
  </tr>
  <tr>
    <td><span class="lbl">DATA DA EMISS&Atilde;O</span><span class="val">${formatDataBR(d.data_emissao)}</span></td>
  </tr>
  <tr>
    <td>
      <span class="lbl">DATA DE RECEBIMENTO</span>
      <span class="val">&nbsp;</span>
    </td>
    <td colspan="2">
      <span class="lbl">IDENTIFICA&Ccedil;&Atilde;O E ASSINATURA DO RECEBEDOR</span>
      <span class="val">&nbsp;</span>
    </td>
  </tr>
  <tr>
    <td colspan="3">
      <span class="lbl">DESTINAT&Aacute;RIO</span>
      <span class="val">${escapeHtml(d.destinatario.razao_social)}</span>
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
    ? `<img src="${escapeHtml(d.emitente.logo_url)}" style="max-width:80px; max-height:50px; margin-bottom:3px; display:block;"/>`
    : '';

  return `
<table class="header-block" cellspacing="0" cellpadding="0">
  <tr>
    <!-- EMITENTE -->
    <td style="width:40%;" class="emitente-box" rowspan="2">
      <span class="lbl">IDENTIFICA&Ccedil;&Atilde;O DO EMITENTE</span>
      ${logoHtml}
      <div class="emitente-razao">${escapeHtml(d.emitente.razao_social)}</div>
      <div class="emitente-endereco">
        ${escapeHtml(d.emitente.endereco)}<br/>
        ${escapeHtml(d.emitente.bairro)}<br/>
        ${escapeHtml(d.emitente.municipio)}-${escapeHtml(d.emitente.uf)}<br/>
        CEP: ${formatCEP(d.emitente.cep)}<br/>
        Fone: ${formatFone(d.emitente.fone) || ''}
      </div>
    </td>
    <!-- DANFE TITULO + TIPO + NUMERO -->
    <td style="width:24%;" class="danfe-titulo-box">
      <div class="danfe-titulo">DANFE</div>
      <div class="danfe-subtitulo">Documento Auxiliar da<br/>Nota Fiscal Eletr&ocirc;nica</div>
      <div class="danfe-tipo-box">
        <span class="danfe-tipo-label">0 - ENTRADA</span>
        <span class="danfe-tipo-check ${entradaCheck}">${tipoOp === 0 ? '1' : ''}</span>
        <br/>
        <span class="danfe-tipo-label">1 - SA&Iacute;DA</span>
        <span class="danfe-tipo-check ${saidaCheck}">${tipoOp === 1 ? '1' : ''}</span>
      </div>
      <div class="danfe-numero">N&ordm; ${formatNumeroNFe(d.numero)}</div>
      <div class="danfe-serie">S&Eacute;RIE ${d.serie}</div>
      <div class="danfe-folha">FL &nbsp; ${paginaAtual} &nbsp;/&nbsp; ${totalPaginas}</div>
    </td>
    <!-- BARCODE + CHAVE -->
    <td style="width:36%;" class="chave-box" rowspan="2">
      <div class="barcode-box">
        <div class="barcode-placeholder" title="Codigo de barras">${escapeHtml(d.chave_acesso?.replace(/\D/g, ''))}</div>
      </div>
      <div class="chave-label">CHAVE DE ACESSO</div>
      <div class="chave-valor">${formatChaveAcesso(d.chave_acesso)}</div>
      <div class="chave-consulta">
        Consulta de autenticidade no portal nacional da<br/>
        NF-e www.nfe.fazenda.gov.br/portal ou no site<br/>
        da Sefaz Autorizadora
      </div>
      ${d.protocolo ? `
      <div style="margin-top:3px; border-top:1px solid #000; padding-top:2px;">
        <span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span>
        <span class="val val-mono" style="font-size:7pt;">${escapeHtml(d.protocolo)}</span>
      </div>` : ''}
    </td>
  </tr>
</table>`;
}

function renderNaturezaProtocolo(d: DanfeData): string {
  return `
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:50%;">
      <span class="lbl">NATUREZA DA OPERA&Ccedil;&Atilde;O</span>
      <span class="val">${escapeHtml(d.natureza_operacao)}</span>
    </td>
    <td style="width:50%;">
      <span class="lbl">PROTOCOLO DE AUTORIZA&Ccedil;&Atilde;O DE USO</span>
      <span class="val val-mono">${escapeHtml(d.protocolo || '')}</span>
    </td>
  </tr>
  <tr>
    <td style="width:33%;">
      <span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span>
      <span class="val">${escapeHtml(d.emitente.ie)}</span>
    </td>
    <td style="width:34%;">
      <span class="lbl">INSC. ESTADUAL DO SUBST. TRIBUT&Aacute;RIO</span>
      <span class="val">${escapeHtml(d.emitente.ie_st || '')}</span>
    </td>
    <td style="width:33%;">
      <span class="lbl">CPF/CNPJ</span>
      <span class="val">${formatCNPJ(d.emitente.cnpj)}</span>
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
    <td style="width:50%;">
      <span class="lbl">NOME / RAZ&Atilde;O SOCIAL</span>
      <span class="val">${escapeHtml(dest.razao_social)}</span>
    </td>
    <td style="width:28%;">
      <span class="lbl">CNPJ / CPF / IDestr.</span>
      <span class="val">${formatCNPJouCPF(dest.cnpj_cpf)}</span>
    </td>
    <td style="width:22%;">
      <span class="lbl">DATA DA EMISS&Atilde;O</span>
      <span class="val">${formatDataBR(d.data_emissao)}</span>
    </td>
  </tr>
  <tr>
    <td style="width:50%;">
      <span class="lbl">ENDERE&Ccedil;O</span>
      <span class="val">${escapeHtml(dest.endereco)}</span>
    </td>
    <td style="width:28%;">
      <span class="lbl">BAIRRO / DISTRITO</span>
      <span class="val">${escapeHtml(dest.bairro)}</span>
    </td>
    <td style="width:22%;">
      <span class="lbl">COMPLEMENTO</span>
      <span class="val">${escapeHtml(dest.complemento || '')}</span>
    </td>
  </tr>
  <tr>
    <td style="width:40%;">
      <span class="lbl">MUNIC&Iacute;PIO</span>
      <span class="val">${escapeHtml(dest.municipio)}</span>
    </td>
    <td style="width:15%;">
      <span class="lbl">FONE / FAX</span>
      <span class="val">${formatFone(dest.fone)}</span>
    </td>
    <td style="width:6%;">
      <span class="lbl">UF</span>
      <span class="val">${escapeHtml(dest.uf)}</span>
    </td>
    <td style="width:17%;">
      <span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span>
      <span class="val">${escapeHtml(dest.ie || '')}</span>
    </td>
    <td style="width:10%;">
      <span class="lbl">CEP</span>
      <span class="val">${formatCEP(dest.cep)}</span>
    </td>
    <td style="width:22%;">
      <span class="lbl">DATA/HORA ENTRADA/SA&Iacute;DA</span>
      <span class="val">${d.data_entrada_saida ? formatDataHoraBR(d.data_entrada_saida) : ''}</span>
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
    <td style="width:25%;">
      <span class="lbl">N&Uacute;MERO</span>
      <span class="val">${escapeHtml(fat.numero)}</span>
    </td>
    <td style="width:25%;">
      <span class="lbl">VALOR ORIGINAL</span>
      <span class="val val-right">${formatMoeda(fat.valor_original)}</span>
    </td>
    <td style="width:25%;">
      <span class="lbl">VALOR DESCONTO</span>
      <span class="val val-right">${formatMoeda(fat.valor_desconto)}</span>
    </td>
    <td style="width:25%;">
      <span class="lbl">VALOR L&Iacute;QUIDO</span>
      <span class="val val-right">${formatMoeda(fat.valor_liquido)}</span>
    </td>
  </tr>
</table>`;
  }

  let dupsHtml = '';
  if (dups.length > 0) {
    // Até 6 duplicatas por linha (3 grupos de numero+venc+valor)
    const dupsPerRow = 3;
    let dupsRows = '';
    for (let i = 0; i < dups.length; i += dupsPerRow) {
      const chunk = dups.slice(i, i + dupsPerRow);
      let cells = '';
      for (const dup of chunk) {
        cells += `
      <td><span class="lbl">N&Uacute;MERO</span><span class="val">${escapeHtml(dup.numero)}</span></td>
      <td><span class="lbl">VENC.</span><span class="val">${formatDataBR(dup.vencimento)}</span></td>
      <td><span class="lbl">VALOR</span><span class="val val-right">${formatMoeda(dup.valor)}</span></td>`;
      }
      // Preencher celulas vazias
      for (let j = chunk.length; j < dupsPerRow; j++) {
        cells += '<td></td><td></td><td></td>';
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
    <td style="width:14%;">
      <span class="lbl">BC ICMS</span>
      <span class="val val-right">${formatMoeda(imp.bc_icms)}</span>
    </td>
    <td style="width:12%;">
      <span class="lbl">VALOR ICMS</span>
      <span class="val val-right">${formatMoeda(imp.valor_icms)}</span>
    </td>
    <td style="width:14%;">
      <span class="lbl">ICMS DESONERADO</span>
      <span class="val val-right">${formatMoeda(imp.icms_desonerado || 0)}</span>
    </td>
    <td style="width:14%;">
      <span class="lbl">BC ICMS SUBSTITUI&Ccedil;&Atilde;O</span>
      <span class="val val-right">${formatMoeda(imp.bc_icms_st)}</span>
    </td>
    <td style="width:14%;">
      <span class="lbl">VALOR ICMS SUBS</span>
      <span class="val val-right">${formatMoeda(imp.valor_icms_st)}</span>
    </td>
    <td style="width:14%;">
      <span class="lbl">VALOR IMP. IMPORTA&Ccedil;&Atilde;O</span>
      <span class="val val-right">${formatMoeda(imp.valor_imp_importacao || 0)}</span>
    </td>
    <td style="width:18%;">
      <span class="lbl">VALOR TOTAL DOS PRODUTOS</span>
      <span class="val val-right val-bold">${formatMoeda(imp.valor_total_produtos)}</span>
    </td>
  </tr>
  <tr>
    <td>
      <span class="lbl">VALOR FRETE</span>
      <span class="val val-right">${formatMoeda(imp.valor_frete)}</span>
    </td>
    <td>
      <span class="lbl">VALOR SEGURO</span>
      <span class="val val-right">${formatMoeda(imp.valor_seguro)}</span>
    </td>
    <td>
      <span class="lbl">VALOR DESCONTO</span>
      <span class="val val-right">${formatMoeda(imp.valor_desconto)}</span>
    </td>
    <td>
      <span class="lbl">OUTRAS DESP. ACES.</span>
      <span class="val val-right">${formatMoeda(imp.outras_despesas)}</span>
    </td>
    <td>
      <span class="lbl">VALOR IPI</span>
      <span class="val val-right">${formatMoeda(imp.valor_ipi)}</span>
    </td>
    <td>
      <span class="lbl">VALOR DO PIS</span>
      <span class="val val-right">${formatMoeda(imp.valor_pis)}</span>
    </td>
    <td>
      <span class="lbl">VALOR DA COFINS</span>
      <span class="val val-right">${formatMoeda(imp.valor_cofins)}</span>
    </td>
    <td>
      <span class="lbl">VALOR TOTAL DA NOTA</span>
      <span class="val val-right val-bold">${formatMoeda(imp.valor_total_nota)}</span>
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
    <td style="width:30%;">
      <span class="lbl">RAZ&Atilde;O SOCIAL</span>
      <span class="val">${escapeHtml(t?.razao_social || '')}</span>
    </td>
    <td style="width:20%;">
      <span class="lbl">FRETE POR CONTA</span>
      <span class="val">${fretePorConta(t?.mod_frete)}</span>
    </td>
    <td style="width:12%;">
      <span class="lbl">C&Oacute;DIGO ANTT</span>
      <span class="val">${escapeHtml(t?.codigo_antt || '')}</span>
    </td>
    <td style="width:10%;">
      <span class="lbl">PLACA</span>
      <span class="val">${escapeHtml(t?.placa || '')}</span>
    </td>
    <td style="width:5%;">
      <span class="lbl">UF</span>
      <span class="val">${escapeHtml(t?.placa_uf || '')}</span>
    </td>
    <td style="width:23%;">
      <span class="lbl">CNPJ / CPF</span>
      <span class="val">${formatCNPJouCPF(t?.cnpj_cpf)}</span>
    </td>
  </tr>
  <tr>
    <td style="width:30%;">
      <span class="lbl">ENDERE&Ccedil;O</span>
      <span class="val">${escapeHtml(t?.endereco || '')}</span>
    </td>
    <td style="width:25%" colspan="2">
      <span class="lbl">MUNIC&Iacute;PIO</span>
      <span class="val">${escapeHtml(t?.municipio || '')}</span>
    </td>
    <td style="width:5%;">
      <span class="lbl">UF</span>
      <span class="val">${escapeHtml(t?.uf || '')}</span>
    </td>
    <td style="width:20%" colspan="2">
      <span class="lbl">INSCRI&Ccedil;&Atilde;O ESTADUAL</span>
      <span class="val">${escapeHtml(t?.ie || '')}</span>
    </td>
  </tr>
</table>
<div class="bloco-titulo">VOLUMES</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:14%;">
      <span class="lbl">QUANTIDADE</span>
      <span class="val">${v?.quantidade ?? ''}</span>
    </td>
    <td style="width:18%;">
      <span class="lbl">ESP&Eacute;CIE</span>
      <span class="val">${escapeHtml(v?.especie || '')}</span>
    </td>
    <td style="width:18%;">
      <span class="lbl">MARCA</span>
      <span class="val">${escapeHtml(v?.marca || '')}</span>
    </td>
    <td style="width:18%;">
      <span class="lbl">NUMERA&Ccedil;&Atilde;O</span>
      <span class="val">${escapeHtml(v?.numeracao || '')}</span>
    </td>
    <td style="width:16%;">
      <span class="lbl">PESO BRUTO</span>
      <span class="val val-right">${v?.peso_bruto != null ? formatMoeda(v.peso_bruto) : ''}</span>
    </td>
    <td style="width:16%;">
      <span class="lbl">PESO L&Iacute;QUIDO</span>
      <span class="val val-right">${v?.peso_liquido != null ? formatMoeda(v.peso_liquido) : ''}</span>
    </td>
  </tr>
</table>`;
}

function renderProdutosHeader(): string {
  return `
<div class="bloco-titulo">DADOS DO PRODUTO / SERVI&Ccedil;O</div>
<table class="produtos-table" cellspacing="0" cellpadding="0">
  <thead>
    <tr>
      <th style="width:9%;">C&Oacute;D.<br/>PROD.</th>
      <th style="width:23%;">DESCRI&Ccedil;&Atilde;O DO PRODUTO / SERVI&Ccedil;O</th>
      <th style="width:7%;">NCM/SH</th>
      <th style="width:4%;">CST</th>
      <th style="width:4%;">CFOP</th>
      <th style="width:3%;">UN</th>
      <th style="width:7%;">QTD</th>
      <th style="width:8%;">V. UNIT&Aacute;RIO</th>
      <th style="width:8%;">V. TOTAL</th>
      <th style="width:7%;">BC ICMS</th>
      <th style="width:6%;">V. ICMS</th>
      <th style="width:5%;">V. IPI</th>
      <th style="width:5%;">AL&Iacute;Q.<br/>ICMS</th>
      <th style="width:4%;">AL&Iacute;Q.<br/>IPI</th>
    </tr>
  </thead>`;
}

function renderProdutoRow(item: DanfeItem): string {
  return `
    <tr>
      <td class="center" style="font-size:6pt;">${escapeHtml(item.codigo)}</td>
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
  // Linhas vazias para preencher espaco
  for (let i = 0; i < linhasVazias; i++) {
    html += `<tr>
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
<div class="bloco-titulo">DADOS ADICIONAIS${isContinuacao ? ' (COMPLEMENTO)' : ''}</div>
<table class="danfe-table" cellspacing="0" cellpadding="0">
  <tr>
    <td style="width:65%; vertical-align:top; min-height:50px;">
      <span class="lbl">INFORMA&Ccedil;&Otilde;ES COMPLEMENTARES</span>
      <div class="dados-adicionais">${escapeHtml(d.informacoes_complementares || '')}</div>
    </td>
    <td style="width:35%; vertical-align:top; min-height:50px;">
      <span class="lbl">RESERVADO AO FISCO</span>
      <div class="dados-adicionais">${escapeHtml(d.reservado_fisco || '')}</div>
    </td>
  </tr>
</table>`;
}

function renderRodape(dataImpressao: string): string {
  return `<div class="danfe-rodape">
  <strong>DATA E HORA DA IMPRESS&Atilde;O</strong> ${escapeHtml(dataImpressao)}
</div>`;
}

function renderHomologacaoBanner(): string {
  return `<div class="homologacao-banner">
  SEM VALOR FISCAL - AMBIENTE DE HOMOLOGA&Ccedil;&Atilde;O
</div>`;
}

// ============================================================
// Gerador principal
// ============================================================

/**
 * Gera HTML completo do DANFE profissional, multi-pagina.
 */
export function gerarDanfeHTML(data: DanfeData): string {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const isHomologacao = data.tp_amb === 2;
  const itens = data.itens || [];

  // Calcular paginacao
  const itensPg1 = itens.slice(0, ITENS_PAGINA_1);
  const itensRestantes = itens.slice(ITENS_PAGINA_1);
  const paginasContinuacao: DanfeItem[][] = [];
  let rest = itensRestantes;
  while (rest.length > 0) {
    paginasContinuacao.push(rest.slice(0, ITENS_PAGINA_CONT));
    rest = rest.slice(ITENS_PAGINA_CONT);
  }
  const totalPaginas = 1 + paginasContinuacao.length;

  // --- PAGINA 1 ---
  const linhasVaziasPg1 = Math.max(0, ITENS_PAGINA_1 - itensPg1.length);
  let pagina1 = `<div class="danfe-page">`;
  if (isHomologacao) pagina1 += renderHomologacaoBanner();
  pagina1 += renderCanhoto(data);
  pagina1 += renderCabecalhoPrincipal(data, 1, totalPaginas);
  pagina1 += renderNaturezaProtocolo(data);
  pagina1 += renderDestinatario(data);
  pagina1 += renderFaturaDuplicatas(data);
  pagina1 += renderImpostos(data);
  pagina1 += renderTransportador(data);
  pagina1 += renderProdutosBlock(itensPg1, linhasVaziasPg1);
  // Dados adicionais so na primeira pagina se nao ha continuacao,
  // senao na ultima pagina
  if (paginasContinuacao.length === 0) {
    pagina1 += renderDadosAdicionais(data);
  }
  pagina1 += renderRodape(agora);
  pagina1 += `</div>`;

  // --- PAGINAS DE CONTINUACAO ---
  let paginasCont = '';
  for (let i = 0; i < paginasContinuacao.length; i++) {
    const pgNum = i + 2;
    const itensPg = paginasContinuacao[i];
    const linhasVazias = Math.max(0, ITENS_PAGINA_CONT - itensPg.length);
    const isUltima = i === paginasContinuacao.length - 1;

    paginasCont += `<div class="danfe-page">`;
    if (isHomologacao) paginasCont += renderHomologacaoBanner();
    // Cabecalho reduzido nas continuacoes
    paginasCont += renderCabecalhoPrincipal(data, pgNum, totalPaginas);
    paginasCont += renderNaturezaProtocolo(data);
    // Continuacao dos produtos
    paginasCont += renderProdutosBlock(itensPg, linhasVazias);
    // Dados adicionais na ultima pagina
    if (isUltima) {
      paginasCont += renderDadosAdicionais(data, paginasContinuacao.length > 0);
    }
    paginasCont += renderRodape(agora);
    paginasCont += `</div>`;
  }

  // --- HTML COMPLETO ---
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
 * Isso permite usar os dados reais do sistema para gerar o DANFE.
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

  // Extrair dados do emitente (empresa ou defaults)
  const emp = empresa || {};
  const emitente: DanfeEmitente = {
    razao_social: emp.razao_social || 'CROMA PRINT COMUNICAÇÃO VISUAL LTDA',
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

  // Extrair dados do destinatario (cliente)
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

  // Extrair duplicatas do payload se disponivel
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

  // Extrair transporte do payload
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

  // Detectar ambiente
  const tpAmb = doc.fiscal_ambientes?.tipo === 'producao' ? 1 : 2;

  // Protocolo formatado
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
