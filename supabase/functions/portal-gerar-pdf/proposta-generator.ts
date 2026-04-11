// supabase/functions/portal-gerar-pdf/proposta-generator.ts
// Gerador de HTML profissional para propostas da Croma Print
// Self-contained para Deno Edge Functions — sem imports externos

// ─── Formatadores ─────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null || isNaN(v)) return '0';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return ''; }
}

function fmtCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function fmtPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

function fmtCEP(c: string | null | undefined): string {
  if (!c) return '';
  const d = c.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0,5)}-${d.slice(5)}`;
  return c;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body, html {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #1e293b;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 60%, #1e3a5f 100%);
    color: #fff;
    padding: 16mm 12mm 10mm;
    position: relative;
    page-break-inside: avoid;
    margin-bottom: 6mm;
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8mm;
  }
  .header-logo { max-height: 14mm; max-width: 50mm; filter: brightness(0) invert(1); }
  .header-badge {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 20pt;
    padding: 2mm 5mm;
    font-size: 8pt;
    font-weight: 600;
    color: #bfdbfe;
  }
  .header-greeting { font-size: 16pt; font-weight: 700; color: #fff; margin-bottom: 1mm; }
  .header-sub { font-size: 9pt; color: #bfdbfe; }
  .header-empresa { margin-top: 5mm; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4mm; }
  .header-empresa-name { font-size: 9pt; font-weight: 600; color: rgba(255,255,255,0.9); }
  .header-empresa-detail { font-size: 7.5pt; color: rgba(191,219,254,0.8); margin-top: 0.5mm; }

  /* ── Cliente card ── */
  .cliente-card {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6pt;
    padding: 4mm 5mm;
    margin-top: 4mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2mm;
  }
  .cliente-label {
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    color: #93c5fd;
    font-weight: 600;
    margin-bottom: 2mm;
    grid-column: 1 / -1;
  }
  .cliente-name { font-size: 9pt; font-weight: 600; color: #fff; }
  .cliente-detail { font-size: 7.5pt; color: rgba(191,219,254,0.8); }

  /* ── Validade banner ── */
  .validity-ok {
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 5pt;
    padding: 2.5mm 4mm;
    font-size: 8pt;
    margin-bottom: 4mm;
    display: flex;
    align-items: center;
    gap: 2mm;
  }
  .validity-warn {
    border: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    border-radius: 5pt;
    padding: 2.5mm 4mm;
    font-size: 8pt;
    margin-bottom: 4mm;
  }
  .validity-expired {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 5pt;
    padding: 2.5mm 4mm;
    font-size: 8pt;
    margin-bottom: 4mm;
  }

  /* ── Seção ── */
  .section { margin-bottom: 5mm; page-break-inside: avoid; }
  .section-title {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8pt;
    color: #64748b;
    margin-bottom: 2mm;
    padding-bottom: 1.5mm;
    border-bottom: 1pt solid #e2e8f0;
  }

  /* ── Tabela de itens ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  .items-table thead tr {
    background: #f8fafc;
  }
  .items-table th {
    padding: 2mm 2.5mm;
    text-align: left;
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3pt;
    color: #64748b;
    border-bottom: 1.5pt solid #cbd5e1;
    border-top: 1pt solid #e2e8f0;
  }
  .items-table th.r, .items-table td.r { text-align: right; }
  .items-table th.c, .items-table td.c { text-align: center; }
  .items-table td {
    padding: 2.5mm 2.5mm;
    border-bottom: 0.5pt solid #f1f5f9;
    vertical-align: top;
    color: #334155;
  }
  .items-table tbody tr:last-child td { border-bottom: 1pt solid #cbd5e1; }
  .item-desc { font-weight: 600; color: #1e293b; }
  .item-spec { font-size: 7pt; color: #64748b; margin-top: 0.5mm; }
  .item-medida { font-size: 7pt; color: #94a3b8; margin-top: 0.3mm; }
  .grupo-header td {
    background: #f8fafc;
    font-weight: 700;
    font-size: 7.5pt;
    color: #475569;
    padding: 1.5mm 2.5mm;
    border-bottom: 0.5pt solid #e2e8f0;
    border-top: 0.5pt solid #e2e8f0;
  }

  /* ── Total ── */
  .total-box {
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
    color: #fff;
    border-radius: 6pt;
    padding: 5mm 6mm;
    margin-bottom: 4mm;
    page-break-inside: avoid;
  }
  .total-label { font-size: 8pt; color: #bfdbfe; font-weight: 500; margin-bottom: 1mm; }
  .total-value { font-size: 20pt; font-weight: 800; letter-spacing: -0.5pt; }
  .total-desconto {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border-radius: 4pt;
    padding: 1mm 3mm;
    font-size: 7.5pt;
    margin-top: 2mm;
  }

  /* ── Pagamento ── */
  .pagamento-box {
    border: 1pt solid #e2e8f0;
    border-radius: 6pt;
    padding: 4mm 5mm;
    background: #fff;
    margin-bottom: 4mm;
    page-break-inside: avoid;
  }
  .pagamento-titulo {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    color: #64748b;
    margin-bottom: 3mm;
    border-bottom: 0.5pt solid #f1f5f9;
    padding-bottom: 2mm;
  }
  .pagamento-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3mm;
  }
  .pagamento-item-label { font-size: 6.5pt; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5mm; }
  .pagamento-item-value { font-size: 9pt; font-weight: 600; color: #1e293b; }

  /* ── PIX ── */
  .pix-box {
    border: 1pt solid #d1fae5;
    border-radius: 6pt;
    padding: 3mm 4mm;
    background: #f0fdf4;
    margin-top: 3mm;
  }
  .pix-label { font-size: 7pt; font-weight: 700; color: #065f46; margin-bottom: 1mm; }
  .pix-chave { font-size: 8.5pt; font-weight: 600; color: #047857; font-family: 'Courier New', monospace; }

  /* ── Observações ── */
  .obs-box {
    border: 1pt solid #e2e8f0;
    border-radius: 6pt;
    padding: 4mm 5mm;
    background: #f8fafc;
    margin-bottom: 4mm;
    page-break-inside: avoid;
  }
  .obs-titulo { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2mm; }
  .obs-text { font-size: 8pt; color: #475569; white-space: pre-wrap; line-height: 1.5; }

  /* ── Footer ── */
  .footer {
    border-top: 1pt solid #e2e8f0;
    padding-top: 4mm;
    margin-top: 6mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-empresa { font-size: 7.5pt; color: #64748b; }
  .footer-empresa strong { color: #1e40af; }
  .footer-gerado { font-size: 7pt; color: #94a3b8; }

  /* ── Print overrides ── */
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .total-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

// ─── Gerador principal ────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export function gerarPropostaHTML(proposta: any): string {
  const empresa = proposta.empresa ?? {};
  const cliente = proposta.cliente ?? {};
  const itens: any[] = proposta.itens ?? [];

  const clienteNome = cliente.contato_nome || cliente.nome_fantasia || cliente.razao_social || '';
  const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Croma Print';

  // Calcular validade
  let dataValidade: Date | null = null;
  if (proposta.data_validade) {
    dataValidade = new Date(proposta.data_validade);
  } else if (proposta.validade && proposta.created_at) {
    dataValidade = new Date(new Date(proposta.created_at).getTime() + proposta.validade * 86400000);
  }
  const hoje = new Date();
  const expirada = dataValidade ? dataValidade < hoje : false;
  const diasRestantes = dataValidade
    ? Math.ceil((dataValidade.getTime() - hoje.getTime()) / 86400000)
    : null;

  // Validade HTML
  let validadeHtml = '';
  if (dataValidade) {
    if (expirada) {
      validadeHtml = `<div class="validity-expired">⚠ Esta proposta expirou em ${fmtDate(dataValidade.toISOString())}</div>`;
    } else if (diasRestantes !== null && diasRestantes <= 3) {
      validadeHtml = `<div class="validity-warn">⏳ Válida até ${fmtDate(dataValidade.toISOString())} — ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}</div>`;
    } else {
      validadeHtml = `<div class="validity-ok">✓ Válida até ${fmtDate(dataValidade.toISOString())}${diasRestantes !== null ? ` — ${diasRestantes} dias restantes` : ''}</div>`;
    }
  }

  // Endereço empresa
  const endEmpresa = [
    empresa.logradouro, empresa.numero_endereco ? `nº ${empresa.numero_endereco}` : null,
    empresa.bairro, empresa.municipio, empresa.uf ? empresa.uf : null,
    empresa.cep ? `CEP ${fmtCEP(empresa.cep)}` : null,
  ].filter(Boolean).join(' · ');

  // Logo empresa (inline base64 não é viável - usar URL direta)
  const logoHtml = empresa.logo_url
    ? `<img class="header-logo" src="${esc(empresa.logo_url)}" alt="${esc(nomeEmpresa)}" crossorigin="anonymous" />`
    : `<div style="font-size:13pt;font-weight:800;color:#fff;letter-spacing:-0.5pt;">${esc(nomeEmpresa)}</div>`;

  // Cliente card
  let clienteCardHtml = '';
  if (cliente.cnpj || cliente.telefone || cliente.email || cliente.cidade) {
    const endCliente = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(' · ')
      + (cliente.cep ? ` · CEP ${fmtCEP(cliente.cep)}` : '');
    clienteCardHtml = `
    <div class="cliente-card">
      <div class="cliente-label">Dados do Cliente</div>
      <div>
        <div class="cliente-name">${esc(cliente.razao_social || cliente.nome_fantasia)}</div>
        ${cliente.cnpj ? `<div class="cliente-detail">CNPJ: ${fmtCNPJ(cliente.cnpj)}</div>` : ''}
      </div>
      <div>
        ${cliente.telefone ? `<div class="cliente-detail">Tel: ${fmtPhone(cliente.telefone)}</div>` : ''}
        ${cliente.email ? `<div class="cliente-detail">${esc(cliente.email)}</div>` : ''}
        ${endCliente ? `<div class="cliente-detail">${esc(endCliente)}</div>` : ''}
      </div>
    </div>`;
  }

  // Agrupar itens por grupo_uniao
  const grupos: Map<string, any[]> = new Map();
  const semGrupo: any[] = [];
  for (const item of itens) {
    if (item.item_visivel === false) continue;
    if (item.grupo_uniao) {
      if (!grupos.has(item.grupo_uniao)) grupos.set(item.grupo_uniao, []);
      grupos.get(item.grupo_uniao)!.push(item);
    } else {
      semGrupo.push(item);
    }
  }

  // Montar linhas da tabela
  let itensHtml = '';
  let linhaIdx = 0;

  function renderItem(item: any): string {
    linhaIdx++;
    const medida = item.largura_cm && item.altura_cm
      ? `${fmtNum(item.largura_cm, 0)} × ${fmtNum(item.altura_cm, 0)} cm${item.area_m2 ? ` = ${fmtNum(item.area_m2, 3)} m²` : ''}`
      : item.area_m2 ? `${fmtNum(item.area_m2, 3)} m²` : '';
    return `
    <tr>
      <td class="c" style="color:#94a3b8;font-size:7.5pt;">${linhaIdx}</td>
      <td>
        <div class="item-desc">${esc(item.nome_exibicao || item.descricao)}</div>
        ${item.especificacao ? `<div class="item-spec">${esc(item.especificacao)}</div>` : ''}
        ${medida ? `<div class="item-medida">${medida}</div>` : ''}
      </td>
      <td class="c">${fmtNum(item.quantidade, 0)}</td>
      <td class="r">${fmt(item.valor_unitario)}</td>
      <td class="r" style="font-weight:600;">${fmt(item.valor_total)}</td>
    </tr>`;
  }

  // Itens sem grupo
  for (const item of semGrupo) {
    itensHtml += renderItem(item);
  }

  // Itens agrupados
  for (const [grupo, itensDo] of grupos.entries()) {
    const totalGrupo = itensDo.reduce((s: number, i: any) => s + (i.valor_total || 0), 0);
    itensHtml += `<tr class="grupo-header"><td colspan="4">${esc(grupo)}</td><td class="r">${fmt(totalGrupo)}</td></tr>`;
    for (const item of itensDo) {
      itensHtml += renderItem(item);
    }
  }

  // Forma de pagamento
  let pagamentoHtml = '';
  if (proposta.forma_pagamento) {
    const formaMap: Record<string, string> = {
      'pix': 'PIX',
      'boleto': 'Boleto Bancário',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'transferencia': 'Transferência Bancária',
      'dinheiro': 'Dinheiro',
      'cheque': 'Cheque',
      'a_prazo': 'A Prazo',
    };
    const formaNome = formaMap[proposta.forma_pagamento] || proposta.forma_pagamento;

    let condicoesHtml = '';
    if (proposta.parcelas_count > 1) {
      const valorParcela = (proposta.valor_total || 0) / proposta.parcelas_count;
      condicoesHtml = `<div><div class="pagamento-item-label">Parcelamento</div><div class="pagamento-item-value">${proposta.parcelas_count}× de ${fmt(valorParcela)}</div></div>`;
    }
    if (proposta.entrada_percentual > 0) {
      const valorEntrada = (proposta.valor_total || 0) * proposta.entrada_percentual / 100;
      condicoesHtml += `<div><div class="pagamento-item-label">Entrada</div><div class="pagamento-item-value">${proposta.entrada_percentual}% = ${fmt(valorEntrada)}</div></div>`;
    }
    if (proposta.prazo_dias?.length > 0) {
      const prazos = Array.isArray(proposta.prazo_dias)
        ? proposta.prazo_dias.map((d: number) => `${d}d`).join(' / ')
        : `${proposta.prazo_dias}d`;
      condicoesHtml += `<div><div class="pagamento-item-label">Prazo</div><div class="pagamento-item-value">${prazos}</div></div>`;
    }

    pagamentoHtml = `
    <div class="pagamento-box">
      <div class="pagamento-titulo">Condições de Pagamento</div>
      <div class="pagamento-grid">
        <div>
          <div class="pagamento-item-label">Forma</div>
          <div class="pagamento-item-value">${esc(formaNome)}</div>
        </div>
        ${condicoesHtml}
      </div>
      ${proposta.forma_pagamento === 'pix' ? `
      <div class="pix-box">
        <div class="pix-label">Chave PIX</div>
        <div class="pix-chave">18.923.994/0001-83 (CNPJ — Croma Print Comunicação Visual)</div>
      </div>` : ''}
    </div>`;
  }

  // Observações
  let obsHtml = '';
  if (proposta.observacoes) {
    obsHtml = `
    <div class="obs-box">
      <div class="obs-titulo">Observações</div>
      <div class="obs-text">${esc(proposta.observacoes)}</div>
    </div>`;
  }

  // Data de geração
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // HTML final
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Proposta ${esc(proposta.numero)} — ${esc(nomeEmpresa)}</title>
  <style>${CSS}</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      ${logoHtml}
      <div class="header-badge">Proposta ${esc(proposta.numero)}</div>
    </div>
    ${clienteNome ? `
    <div class="header-greeting">Olá, ${esc(clienteNome)}!</div>
    <div class="header-sub">Preparamos esta proposta comercial especialmente para você.</div>` : ''}
    ${empresa.razao_social || empresa.nome_fantasia ? `
    <div class="header-empresa">
      <div class="header-empresa-name">${esc(nomeEmpresa)}</div>
      ${empresa.cnpj ? `<div class="header-empresa-detail">CNPJ: ${fmtCNPJ(empresa.cnpj)}${empresa.ie ? ` · IE: ${esc(empresa.ie)}` : ''}</div>` : ''}
      ${endEmpresa ? `<div class="header-empresa-detail">${esc(endEmpresa)}</div>` : ''}
      ${empresa.telefone ? `<div class="header-empresa-detail">Tel: ${fmtPhone(empresa.telefone)}</div>` : ''}
    </div>` : ''}
    ${clienteCardHtml}
  </div>

  <!-- Validade -->
  ${validadeHtml}

  <!-- Itens -->
  <div class="section">
    <div class="section-title">Itens da Proposta</div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="c" style="width:6%;">#</th>
          <th style="width:52%;">Descrição / Especificação</th>
          <th class="c" style="width:10%;">Qtd</th>
          <th class="r" style="width:16%;">Unitário</th>
          <th class="r" style="width:16%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>
  </div>

  <!-- Total -->
  <div class="total-box">
    <div class="total-label">Valor Total da Proposta</div>
    <div class="total-value">${fmt(proposta.valor_total)}</div>
    ${proposta.desconto_percentual > 0
      ? `<div class="total-desconto">↓ Desconto de ${fmtNum(proposta.desconto_percentual, 0)}% aplicado</div>`
      : ''}
  </div>

  <!-- Pagamento -->
  ${pagamentoHtml}

  <!-- Observações -->
  ${obsHtml}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-empresa">
      <strong>${esc(nomeEmpresa)}</strong>
      ${empresa.cnpj ? ` · CNPJ ${fmtCNPJ(empresa.cnpj)}` : ''}
      ${empresa.telefone ? ` · Tel ${fmtPhone(empresa.telefone)}` : ''}
    </div>
    <div class="footer-gerado">Gerado em ${agora}</div>
  </div>

  <!-- Auto-print ao abrir -->
  <script>
    window.addEventListener('load', function() {
      document.title = 'Proposta ${esc(proposta.numero)} — ${esc(nomeEmpresa)}';
      setTimeout(function() { window.print(); }, 800);
    });
  </script>

</body>
</html>`;
}
