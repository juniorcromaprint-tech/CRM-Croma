/**
 * DANFE — CSS profissional para impressão A4
 * Layout monocromático, tipografia Times (padrão fiscal brasileiro),
 * bordas finas, compactação inteligente, hierarquia visual clara.
 *
 * Referências: MOC/SEFAZ, brasil-js/danfe, SrPattif.Danfe
 * Revisão completa 2026-04-09
 */

export const DANFE_CSS = `
/* ============================================================
   DANFE — CSS Profissional v2.0
   Padrão visual de mercado brasileiro
   ============================================================ */

@page {
  size: A4 portrait;
  margin: 5mm 5mm 5mm 5mm;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html {
  font-family: 'Times New Roman', Times, serif;
  font-size: 7.5pt;
  color: #000;
  background: #fff;
  line-height: 1.15;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ================================================================
   PÁGINA
   ================================================================ */
.danfe-page {
  width: 200mm;
  min-height: 287mm;
  margin: 0 auto;
  padding: 0;
  page-break-after: always;
  position: relative;
}

.danfe-page:last-child {
  page-break-after: auto;
}

/* ================================================================
   TABELA-BASE (grid fiscal)
   Bordas finas 0.5pt — padrão fiscal profissional
   ================================================================ */
.danfe-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.danfe-table td,
.danfe-table th {
  border: 0.5pt solid #000;
  padding: 0.8mm 1mm;
  vertical-align: top;
  font-size: 7.5pt;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ================================================================
   LABELS (rótulos dos campos)
   Tamanho pequeno, bold, uppercase — padrão DANFE
   ================================================================ */
.lbl {
  font-size: 5pt;
  color: #000;
  text-transform: uppercase;
  font-weight: normal;
  display: block;
  line-height: 1;
  margin-bottom: 0;
  letter-spacing: 0.01em;
  font-family: Arial, Helvetica, sans-serif;
}

/* ================================================================
   VALORES (conteúdo dos campos)
   ================================================================ */
.val {
  font-size: 8pt;
  font-weight: normal;
  display: block;
  line-height: 1.2;
  min-height: 3mm;
  word-break: break-word;
}

.val-bold {
  font-weight: bold;
}

.val-mono {
  font-family: 'Courier New', Courier, monospace;
}

.val-right {
  text-align: right;
}

.val-center {
  text-align: center;
}

/* Valor grande para campos financeiros de destaque */
.val-lg {
  font-size: 9pt;
  font-weight: bold;
}

/* ================================================================
   CANHOTO (recibo)
   ================================================================ */
.canhoto {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
}

.canhoto td {
  border: 0.5pt solid #000;
  padding: 0.5mm 1mm;
  font-size: 6pt;
  vertical-align: middle;
}

.canhoto .canhoto-recebemos {
  font-size: 6pt;
  font-weight: normal;
  line-height: 1.2;
}

.canhoto .canhoto-recebemos strong {
  font-size: 6pt;
}

.canhoto .canhoto-nfe {
  font-weight: bold;
  text-align: center;
  font-size: 9pt;
  vertical-align: middle;
}

.canhoto .canhoto-dest {
  font-size: 6pt;
}

.canhoto-recorte {
  width: 100%;
  border: 0;
  border-top: 1px dashed #999;
  margin: 1mm 0 1.5mm 0;
}

/* ================================================================
   CABEÇALHO PRINCIPAL
   Layout 3 colunas: Emitente | DANFE titulo | Barcode+Chave
   ================================================================ */
.header-block {
  width: 100%;
  border-collapse: collapse;
}

.header-block td {
  border: 0.5pt solid #000;
  vertical-align: top;
}

/* Coluna do emitente */
.emitente-box {
  padding: 1.5mm 2mm;
}

.emitente-razao {
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.15;
  margin-bottom: 0.5mm;
}

.emitente-fantasia {
  font-size: 7pt;
  font-weight: normal;
  font-style: italic;
  margin-bottom: 0.5mm;
  display: block;
}

.emitente-endereco {
  font-size: 6.5pt;
  line-height: 1.25;
}

/* Coluna DANFE título */
.danfe-titulo-box {
  text-align: center;
  padding: 1.5mm 1mm;
}

.danfe-titulo {
  font-size: 14pt;
  font-weight: bold;
  letter-spacing: 2pt;
  line-height: 1;
}

.danfe-subtitulo {
  font-size: 6pt;
  line-height: 1.2;
  margin-top: 0.3mm;
  font-family: Arial, Helvetica, sans-serif;
}

.danfe-tipo-box {
  margin: 1.5mm 0 1mm 0;
  font-size: 6pt;
  line-height: 1.6;
  font-family: Arial, Helvetica, sans-serif;
}

.danfe-tipo-check {
  display: inline-block;
  width: 2.5mm;
  height: 2.5mm;
  border: 0.5pt solid #000;
  text-align: center;
  font-size: 6pt;
  font-weight: bold;
  line-height: 2.5mm;
  vertical-align: middle;
  margin: 0 0.5mm;
}

.danfe-tipo-check.active {
  background: #000;
  color: #fff;
}

.danfe-numero-box {
  margin-top: 1mm;
  border-top: 0.5pt solid #000;
  padding-top: 1mm;
}

.danfe-numero {
  font-size: 10pt;
  font-weight: bold;
}

.danfe-serie {
  font-size: 9pt;
  font-weight: bold;
}

.danfe-folha {
  font-size: 8pt;
  font-weight: bold;
}

/* Coluna barcode + chave de acesso */
.chave-box {
  padding: 1mm 1.5mm;
}

.barcode-box {
  text-align: center;
  padding: 1mm 0;
  min-height: 12mm;
  border-bottom: 0.5pt solid #000;
  margin-bottom: 0.5mm;
}

.barcode-img {
  max-width: 100%;
  height: 12mm;
}

.barcode-svg {
  width: 100%;
  height: 12mm;
}

.chave-label {
  font-size: 5pt;
  font-weight: normal;
  text-transform: uppercase;
  font-family: Arial, Helvetica, sans-serif;
  display: block;
  margin-top: 0.5mm;
}

.chave-valor {
  font-family: 'Courier New', Courier, monospace;
  font-size: 7pt;
  font-weight: bold;
  letter-spacing: 0.3pt;
  word-spacing: 2pt;
  line-height: 1.3;
  text-align: center;
  margin-top: 0.3mm;
}

.chave-consulta {
  font-size: 5.5pt;
  text-align: center;
  line-height: 1.2;
  margin-top: 1mm;
  font-family: Arial, Helvetica, sans-serif;
}

/* Protocolo */
.protocolo-box {
  border-top: 0.5pt solid #000;
  padding-top: 0.5mm;
  margin-top: 1mm;
}

.protocolo-box .lbl {
  text-align: center;
}

.protocolo-box .val {
  text-align: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 7pt;
  font-weight: bold;
}

/* ================================================================
   BLOCOS FISCAIS (títulos de seção)
   ================================================================ */
.bloco-titulo {
  font-size: 5.5pt;
  font-weight: bold;
  text-transform: uppercase;
  padding: 0.3mm 1mm;
  border: 0.5pt solid #000;
  border-bottom: none;
  letter-spacing: 0.02em;
  font-family: Arial, Helvetica, sans-serif;
  background: none;
}

/* ================================================================
   TABELA DE PRODUTOS
   Design limpo: cabeçalho cinza sutil, linhas finas horizontais,
   sem bordas laterais internas pesadas
   ================================================================ */
.produtos-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.produtos-table th {
  border: 0.5pt solid #000;
  padding: 0.5mm 0.5mm;
  font-size: 5pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  background: #e8e8e8;
  line-height: 1.15;
  font-family: Arial, Helvetica, sans-serif;
  vertical-align: middle;
}

.produtos-table td {
  border-left: 0.5pt solid #000;
  border-right: 0.5pt solid #000;
  border-bottom: 0.3pt solid #ccc;
  padding: 0.3mm 0.7mm;
  font-size: 6.5pt;
  line-height: 1.15;
  vertical-align: top;
}

/* Última linha com borda inferior preta */
.produtos-table tbody tr:last-child td {
  border-bottom: 0.5pt solid #000;
}

/* Borda externa da tabela */
.produtos-table {
  border: 0.5pt solid #000;
}

.produtos-table td.num {
  text-align: right;
  font-family: 'Courier New', Courier, monospace;
  font-size: 6.5pt;
  white-space: nowrap;
}

.produtos-table td.center {
  text-align: center;
}

.produtos-table td.desc {
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: 6pt;
}

/* Linhas vazias (preenchimento) */
.produtos-table tr.empty-row td {
  border-bottom: none;
  height: 3.2mm;
}

.produtos-table tr.empty-row:last-child td {
  border-bottom: 0.5pt solid #000;
}

/* ================================================================
   DADOS ADICIONAIS
   ================================================================ */
.dados-adicionais {
  font-size: 6pt;
  line-height: 1.25;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 15mm;
  font-family: Arial, Helvetica, sans-serif;
}

/* ================================================================
   RODAPÉ
   ================================================================ */
.danfe-rodape {
  font-size: 5pt;
  color: #555;
  border-top: 0.5pt solid #000;
  padding: 0.5mm 1mm;
  margin-top: 0.5mm;
  font-family: Arial, Helvetica, sans-serif;
}

/* ================================================================
   HOMOLOGAÇÃO
   ================================================================ */
.homologacao-banner {
  text-align: center;
  font-size: 7pt;
  font-weight: bold;
  color: #333;
  background: #fffde0;
  border: 0.5pt solid #ccc;
  padding: 1mm;
  margin-bottom: 1mm;
  text-transform: uppercase;
  letter-spacing: 1pt;
  font-family: Arial, Helvetica, sans-serif;
}

/* ================================================================
   UTILITÁRIOS
   ================================================================ */
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.font-bold { font-weight: bold; }
.font-mono { font-family: 'Courier New', Courier, monospace; }
.no-border { border: none !important; }
.border-top-none { border-top: none !important; }
.border-bottom-none { border-bottom: none !important; }
.border-left-none { border-left: none !important; }
.border-right-none { border-right: none !important; }

/* Célula compacta sem padding vertical */
.cell-compact {
  padding-top: 0.3mm !important;
  padding-bottom: 0.3mm !important;
}

/* Campo com altura fixa para uniformidade */
.field-h {
  height: 7mm;
}

/* ================================================================
   PRINT
   ================================================================ */
@media print {
  body { margin: 0; padding: 0; }
  .danfe-page { margin: 0; width: 100%; min-height: auto; }
  .no-print { display: none !important; }
}
`;
