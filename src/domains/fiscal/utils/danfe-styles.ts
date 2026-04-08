/**
 * DANFE — CSS profissional para impressao A4
 * Layout monocromatico, grid fiscal, tipografia compacta.
 * Baseado no padrao classico brasileiro de DANFE (Manual de Orientacao do Contribuinte - MOC).
 */

export const DANFE_CSS = `
/* ============================================================
   DANFE — CSS Profissional para PDF / Impressao A4
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
  font-family: Arial, Helvetica, sans-serif;
  font-size: 7pt;
  color: #000;
  background: #fff;
  line-height: 1.2;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ---- Pagina ---- */
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

/* ---- Tabela base (grid fiscal) ---- */
.danfe-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.danfe-table td,
.danfe-table th {
  border: 1px solid #000;
  padding: 1px 3px;
  vertical-align: top;
  font-size: 7pt;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Labels (titulos dos campos) ---- */
.lbl {
  font-size: 5.5pt;
  color: #000;
  text-transform: uppercase;
  font-weight: bold;
  display: block;
  line-height: 1.1;
  margin-bottom: 0.5px;
  letter-spacing: 0.2px;
}

/* ---- Valores dos campos ---- */
.val {
  font-size: 7.5pt;
  font-weight: normal;
  display: block;
  line-height: 1.3;
  min-height: 9pt;
  word-break: break-all;
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

/* ---- Canhoto ---- */
.canhoto {
  width: 100%;
  margin-bottom: 2px;
}

.canhoto td {
  border: 1px solid #000;
  padding: 2px 3px;
  font-size: 6pt;
}

.canhoto .canhoto-titulo {
  font-size: 6pt;
  font-weight: normal;
  line-height: 1.2;
}

.canhoto .canhoto-nfe {
  font-weight: bold;
  text-align: center;
  font-size: 8pt;
}

.canhoto-recorte {
  width: 100%;
  border: 0;
  border-top: 1px dashed #000;
  margin: 1px 0 3px 0;
}

/* ---- Cabecalho principal ---- */
.header-block {
  width: 100%;
}

.header-block td {
  border: 1px solid #000;
  vertical-align: top;
}

.emitente-box {
  padding: 3px 4px;
}

.emitente-razao {
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.2;
  margin-bottom: 2px;
}

.emitente-endereco {
  font-size: 7pt;
  line-height: 1.3;
}

.danfe-titulo-box {
  text-align: center;
  padding: 3px 4px;
}

.danfe-titulo {
  font-size: 12pt;
  font-weight: bold;
  letter-spacing: 1px;
}

.danfe-subtitulo {
  font-size: 7pt;
  line-height: 1.2;
  margin-top: 1px;
}

.danfe-tipo-box {
  margin: 4px 0;
}

.danfe-tipo-label {
  font-size: 7pt;
  font-weight: bold;
}

.danfe-tipo-check {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid #000;
  text-align: center;
  font-size: 8pt;
  font-weight: bold;
  line-height: 10px;
  vertical-align: middle;
  margin: 0 2px;
}

.danfe-tipo-check.active {
  background: #000;
  color: #fff;
}

.danfe-numero {
  font-size: 9pt;
  font-weight: bold;
  margin-top: 2px;
}

.danfe-serie {
  font-size: 9pt;
  font-weight: bold;
}

.danfe-folha {
  font-size: 9pt;
  font-weight: bold;
}

/* ---- Chave de acesso ---- */
.chave-box {
  padding: 3px 4px;
}

.chave-label {
  font-size: 5.5pt;
  font-weight: bold;
  text-transform: uppercase;
}

.chave-valor {
  font-family: 'Courier New', Courier, monospace;
  font-size: 7.5pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  word-break: break-all;
  line-height: 1.4;
}

.chave-consulta {
  font-size: 6.5pt;
  text-align: center;
  line-height: 1.3;
  margin-top: 3px;
}

/* ---- Barcode placeholder ---- */
.barcode-box {
  text-align: center;
  padding: 4px 2px;
}

.barcode-img {
  max-width: 100%;
  height: auto;
  max-height: 36px;
}

.barcode-placeholder {
  font-family: 'Libre Barcode 128', 'Courier New', monospace;
  font-size: 28pt;
  letter-spacing: 0;
  line-height: 1;
}

/* ---- Blocos fiscais ---- */
.bloco-titulo {
  font-size: 6pt;
  font-weight: bold;
  text-transform: uppercase;
  background: #e8e8e8;
  padding: 1.5px 3px;
  border: 1px solid #000;
  letter-spacing: 0.3px;
}

/* ---- Tabela de produtos ---- */
.produtos-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.produtos-table th {
  border: 1px solid #000;
  padding: 1.5px 2px;
  font-size: 5.5pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  background: #f0f0f0;
  line-height: 1.15;
}

.produtos-table td {
  border: 1px solid #000;
  border-top: none;
  padding: 1px 2px;
  font-size: 6.5pt;
  line-height: 1.2;
  vertical-align: top;
}

.produtos-table td.num {
  text-align: right;
  font-family: 'Courier New', Courier, monospace;
  font-size: 6.5pt;
}

.produtos-table td.center {
  text-align: center;
}

.produtos-table td.desc {
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Linhas alternadas sutis (opcional, desativar para impressao pura) */
.produtos-table tbody tr:nth-child(even) {
  /* background: #fafafa; */
}

/* ---- Dados adicionais ---- */
.dados-adicionais {
  font-size: 6.5pt;
  line-height: 1.3;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 40px;
}

/* ---- Rodape ---- */
.danfe-rodape {
  font-size: 5.5pt;
  color: #000;
  border-top: 1px solid #000;
  padding: 2px 3px;
  margin-top: 1px;
}

/* ---- Homologacao ---- */
.homologacao-banner {
  text-align: center;
  font-size: 8pt;
  font-weight: bold;
  color: #000;
  background: #ffffcc;
  border: 2px solid #000;
  padding: 3px;
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ---- Utilitarios ---- */
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
.bg-light { background: #f0f0f0; }
.p-0 { padding: 0 !important; }

/* ---- Print reset ---- */
@media print {
  body { margin: 0; padding: 0; }
  .danfe-page { margin: 0; width: 100%; min-height: auto; }
  .no-print { display: none !important; }
}
`;
