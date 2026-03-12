import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing env vars. Run with: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/seed-demo.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log('🌱 Inserindo dados demo Croma Print...\n');

  // ── 1. Clientes ──
  console.log('📦 Clientes...');
  const { data: clientes, error: errClientes } = await supabase.from('clientes').upsert([
    { razao_social: 'Beira Rio Calçados S.A.', nome_fantasia: 'Beira Rio', cnpj: '89012345000178', segmento: 'calcados', classificacao: 'A', email: 'compras@beirario.com.br', telefone: '5133234567', cidade: 'Novo Hamburgo', estado: 'RS', ativo: true },
    { razao_social: 'Lojas Renner S.A.', nome_fantasia: 'Renner', cnpj: '92754738000162', segmento: 'varejo', classificacao: 'A', email: 'marketing@renner.com.br', telefone: '5132182000', cidade: 'Porto Alegre', estado: 'RS', ativo: true },
    { razao_social: 'Paquetá Calçados Ltda', nome_fantasia: 'Paquetá', cnpj: '90123456000189', segmento: 'calcados', classificacao: 'A', email: 'compras@paqueta.com.br', telefone: '5130258800', cidade: 'Sapiranga', estado: 'RS', ativo: true },
    { razao_social: 'Raia Drogasil S.A.', nome_fantasia: 'Droga Raia', cnpj: '61585865000151', segmento: 'farmacia', classificacao: 'B', email: 'visual@drogaraia.com.br', telefone: '1132221000', cidade: 'São Paulo', estado: 'SP', ativo: true },
    { razao_social: 'SmartFit Academia de Ginástica', nome_fantasia: 'Smart Fit', cnpj: '12345678000190', segmento: 'academia', classificacao: 'B', email: 'marketing@smartfit.com.br', telefone: '1133456789', cidade: 'São Paulo', estado: 'SP', ativo: true },
    { razao_social: 'Grupo BIG Brasil S.A.', nome_fantasia: 'BIG Supermercados', cnpj: '76430438000139', segmento: 'supermercado', classificacao: 'A', email: 'marketing@big.com.br', telefone: '5133333333', cidade: 'Porto Alegre', estado: 'RS', ativo: true },
    { razao_social: 'Kreatif Agência Criativa Ltda', nome_fantasia: 'Kreatif', cnpj: '34567890000112', segmento: 'escritorio', classificacao: 'C', email: 'contato@kreatif.com.br', telefone: '5134567890', cidade: 'Porto Alegre', estado: 'RS', ativo: true },
  ], { onConflict: 'cnpj' }).select();

  if (errClientes) { console.error('❌ Clientes:', errClientes.message); return; }
  console.log(`   ✅ ${clientes.length} clientes`);

  const cm = {};
  clientes.forEach(c => { cm[c.nome_fantasia] = c.id; });

  // ── 2. Unidades ──
  console.log('🏪 Unidades...');
  const { data: unidades, error: errU } = await supabase.from('cliente_unidades').insert([
    { cliente_id: cm['Beira Rio'], nome: 'Matriz Novo Hamburgo', cidade: 'Novo Hamburgo', estado: 'RS', cep: '93330-000', ativo: true },
    { cliente_id: cm['Renner'], nome: 'Renner Iguatemi POA', cidade: 'Porto Alegre', estado: 'RS', cep: '91349-900', ativo: true },
    { cliente_id: cm['Renner'], nome: 'Renner Center Shopping', cidade: 'Porto Alegre', estado: 'RS', cep: '91010-001', ativo: true },
    { cliente_id: cm['Paquetá'], nome: 'Paquetá Sapiranga', cidade: 'Sapiranga', estado: 'RS', cep: '93800-000', ativo: true },
    { cliente_id: cm['Droga Raia'], nome: 'Droga Raia Paulista', cidade: 'São Paulo', estado: 'SP', cep: '01311-200', ativo: true },
    { cliente_id: cm['Smart Fit'], nome: 'Smart Fit Faria Lima', cidade: 'São Paulo', estado: 'SP', cep: '04538-133', ativo: true },
    { cliente_id: cm['BIG Supermercados'], nome: 'BIG Assis Brasil', cidade: 'Porto Alegre', estado: 'RS', cep: '91010-000', ativo: true },
  ]).select();
  console.log(errU ? `   ❌ ${errU.message}` : `   ✅ ${unidades.length} unidades`);

  // ── 3. Contatos ──
  console.log('👥 Contatos...');
  const { data: contatos, error: errC } = await supabase.from('cliente_contatos').insert([
    { cliente_id: cm['Beira Rio'], nome: 'Carlos Mendes', cargo: 'Gerente de Marketing', telefone: '5199887766', email: 'carlos.mendes@beirario.com.br', e_decisor: true, principal: true },
    { cliente_id: cm['Renner'], nome: 'Ana Paula Silva', cargo: 'Coord. Visual Merchandising', telefone: '5198765432', email: 'ana.silva@renner.com.br', e_decisor: true, principal: true },
    { cliente_id: cm['Paquetá'], nome: 'Roberto Oliveira', cargo: 'Diretor Comercial', telefone: '5197654321', email: 'roberto@paqueta.com.br', e_decisor: true, principal: true },
    { cliente_id: cm['Droga Raia'], nome: 'Mariana Costa', cargo: 'Gerente de Expansão', telefone: '1199887766', email: 'mariana.costa@drogaraia.com.br', e_decisor: false, principal: true },
    { cliente_id: cm['BIG Supermercados'], nome: 'Fernando Pinto', cargo: 'Coord. de Compras', telefone: '5191234567', email: 'fernando.pinto@big.com.br', e_decisor: true, principal: true },
  ]).select();
  console.log(errC ? `   ❌ ${errC.message}` : `   ✅ ${contatos.length} contatos`);

  // ── 4. Leads ──
  console.log('🎯 Leads...');
  // Note: leads table uses: empresa, contato_nome, telefone, email, segmento, status, score, observacoes
  // contato_telefone, contato_email, temperatura, valor_estimado may not exist yet — fallback gracefully
  const leadsData = [
    { empresa: 'Arezzo & Co', contato_nome: 'Juliana Rocha', telefone: '1198765432', email: 'juliana@arezzo.com.br', segmento: 'calcados', status: 'qualificado', score: 90, observacoes: 'Rede 450+ lojas, interesse em padronização visual' },
    { empresa: 'Grupo Soma (Farm/Animale)', contato_nome: 'Pedro Augusto', telefone: '2199887766', email: 'pedro.a@gruposoma.com.br', segmento: 'varejo', status: 'em_contato', score: 85 },
    { empresa: 'Centauro Esportes', contato_nome: 'Marcos Vieira', telefone: '1197654321', email: 'marcos.v@centauro.com.br', segmento: 'varejo', status: 'qualificando', score: 92 },
    { empresa: 'Óticas Carol', contato_nome: 'Carla Mendonça', telefone: '1196543210', email: 'carla@oticascarol.com.br', segmento: 'franquia', status: 'novo', score: 60 },
    { empresa: 'O Boticário', contato_nome: 'Renata Souza', telefone: '4199988877', email: 'renata.souza@boticario.com.br', segmento: 'franquia', status: 'qualificado', score: 95 },
    { empresa: 'Riachuelo', contato_nome: 'Gustavo Lemos', telefone: '8499776655', email: 'gustavo.l@riachuelo.com.br', segmento: 'varejo', status: 'em_contato', score: 80 },
    { empresa: 'Leroy Merlin', contato_nome: 'Patricia Alves', telefone: '1195432100', email: 'patricia.a@leroymerlin.com.br', segmento: 'varejo', status: 'novo', score: 70 },
    { empresa: 'Vivara Joias', contato_nome: 'Beatriz Campos', telefone: '1194321099', email: 'beatriz.c@vivara.com.br', segmento: 'franquia', status: 'qualificando', score: 75 },
  ];

  // Try with extended columns first (UI uses these)
  const extendedLeads = leadsData.map((l, i) => ({
    ...l,
    contato_telefone: l.telefone,
    contato_email: l.email,
    temperatura: ['quente', 'morno', 'quente', 'frio', 'quente', 'morno', 'frio', 'morno'][i],
    valor_estimado: [85000, 120000, 200000, 45000, 180000, 150000, 95000, 65000][i],
  }));

  let { data: leads, error: errL } = await supabase.from('leads').insert(extendedLeads).select();
  if (errL && errL.message.includes('column')) {
    // Fallback: insert without extended columns
    console.log('   ⚠️  Colunas estendidas não existem, usando schema base...');
    ({ data: leads, error: errL } = await supabase.from('leads').insert(leadsData).select());
  }
  console.log(errL ? `   ❌ ${errL.message}` : `   ✅ ${leads.length} leads`);

  // ── 5. Oportunidades ──
  console.log('💰 Oportunidades...');
  const { data: oportunidades, error: errO } = await supabase.from('oportunidades').insert([
    { titulo: 'Padronização 120 lojas Beira Rio', cliente_id: cm['Beira Rio'], valor_estimado: 350000, fase: 'em_negociacao', probabilidade: 70, data_fechamento_prevista: '2026-04-15' },
    { titulo: 'Campanha Outono/Inverno Renner', cliente_id: cm['Renner'], valor_estimado: 85000, fase: 'proposta_enviada', probabilidade: 60, data_fechamento_prevista: '2026-03-30' },
    { titulo: 'Fachadas 15 lojas Paquetá', cliente_id: cm['Paquetá'], valor_estimado: 220000, fase: 'aberta', probabilidade: 40, data_fechamento_prevista: '2026-05-10' },
    { titulo: 'Sinalização Smart Fit SP', cliente_id: cm['Smart Fit'], valor_estimado: 45000, fase: 'ganha', probabilidade: 100, data_fechamento_prevista: '2026-03-01', data_fechamento_real: '2026-03-05' },
    { titulo: 'Material PDV BIG Supermercados', cliente_id: cm['BIG Supermercados'], valor_estimado: 65000, fase: 'proposta_enviada', probabilidade: 55, data_fechamento_prevista: '2026-04-01' },
  ]).select();
  console.log(errO ? `   ❌ ${errO.message}` : `   ✅ ${oportunidades.length} oportunidades`);

  // ── 6. Propostas ──
  console.log('📋 Propostas...');
  const { data: propostas, error: errP } = await supabase.from('propostas').insert([
    { numero: 'PROP-2026-001', cliente_id: cm['Beira Rio'], titulo: 'Padronização Visual 120 Lojas', status: 'enviada', subtotal: 360000, desconto_percentual: 3, desconto_valor: 10800, total: 349200, validade_dias: 15, condicoes_pagamento: '30/60/90 dias', cliente_nome_snapshot: 'Beira Rio Calçados S.A.' },
    { numero: 'PROP-2026-002', cliente_id: cm['Renner'], titulo: 'Campanha Outono/Inverno 2026', status: 'enviada', subtotal: 88000, desconto_percentual: 0, desconto_valor: 0, total: 88000, validade_dias: 10, condicoes_pagamento: '30 dias', cliente_nome_snapshot: 'Lojas Renner S.A.' },
    { numero: 'PROP-2026-003', cliente_id: cm['Smart Fit'], titulo: 'Sinalização Unidades SP', status: 'aprovada', subtotal: 47000, desconto_percentual: 5, desconto_valor: 2350, total: 44650, validade_dias: 10, condicoes_pagamento: 'À vista', aprovado_em: '2026-03-05T10:00:00Z', cliente_nome_snapshot: 'SmartFit' },
    { numero: 'PROP-2026-004', cliente_id: cm['BIG Supermercados'], titulo: 'Material PDV Campanha Março', status: 'rascunho', subtotal: 68000, desconto_percentual: 0, desconto_valor: 0, total: 68000, validade_dias: 10, condicoes_pagamento: '30/60 dias', cliente_nome_snapshot: 'Grupo BIG' },
    { numero: 'PROP-2026-005', cliente_id: cm['Droga Raia'], titulo: 'Fachadas Novas Unidades SP', status: 'em_revisao', subtotal: 125000, desconto_percentual: 2, desconto_valor: 2500, total: 122500, validade_dias: 15, condicoes_pagamento: '30/60/90 dias', cliente_nome_snapshot: 'Droga Raia' },
  ]).select();
  console.log(errP ? `   ❌ ${errP.message}` : `   ✅ ${propostas.length} propostas`);

  // ── 7. Pedidos ──
  console.log('📦 Pedidos...');
  const propSmartFit = propostas?.find(p => p.numero === 'PROP-2026-003')?.id;
  const { data: pedidos, error: errPed } = await supabase.from('pedidos').insert([
    { numero: 'PED-2026-001', proposta_id: propSmartFit, cliente_id: cm['Smart Fit'], status: 'em_producao', prioridade: 'alta', data_prometida: '2026-03-20', valor_total: 44650, observacoes: 'Priorizar — inauguração programada' },
    { numero: 'PED-2026-002', cliente_id: cm['Beira Rio'], status: 'aguardando_aprovacao', prioridade: 'normal', data_prometida: '2026-04-30', valor_total: 349200, observacoes: 'Fase 1: 40 lojas RS/SC' },
    { numero: 'PED-2026-003', cliente_id: cm['Kreatif'], status: 'aprovado', prioridade: 'normal', data_prometida: '2026-03-25', valor_total: 3500, observacoes: 'Banner + Adesivos escritório' },
  ]).select();
  console.log(errPed ? `   ❌ ${errPed.message}` : `   ✅ ${pedidos.length} pedidos`);

  // ── 8. Pedido Itens ──
  if (pedidos?.length) {
    console.log('📋 Itens de Pedido...');
    const pm = {};
    pedidos.forEach(p => { pm[p.numero] = p.id; });
    const { data: itens, error: errI } = await supabase.from('pedido_itens').insert([
      { pedido_id: pm['PED-2026-001'], descricao: 'Placa de fachada ACM 3x1m', especificacao: 'ACM preto c/ letra-caixa iluminada', quantidade: 5, valor_unitario: 4500, valor_total: 22500, status: 'em_producao' },
      { pedido_id: pm['PED-2026-001'], descricao: 'Adesivo vitrine 2x1.5m', especificacao: 'Vinil perfurado c/ impressão digital', quantidade: 10, valor_unitario: 850, valor_total: 8500, status: 'pendente' },
      { pedido_id: pm['PED-2026-001'], descricao: 'Totem entrada 0.6x1.8m', especificacao: 'Estrutura metálica com ACM', quantidade: 5, valor_unitario: 2730, valor_total: 13650, status: 'pendente' },
      { pedido_id: pm['PED-2026-003'], descricao: 'Banner roll-up 0.8x2m', especificacao: 'Lona 440g c/ estrutura retrátil', quantidade: 2, valor_unitario: 450, valor_total: 900, status: 'pendente' },
      { pedido_id: pm['PED-2026-003'], descricao: 'Adesivo parede 3x1.5m', especificacao: 'Vinil fosco c/ laminação', quantidade: 1, valor_unitario: 2600, valor_total: 2600, status: 'pendente' },
    ]).select();
    console.log(errI ? `   ❌ ${errI.message}` : `   ✅ ${itens.length} itens`);
  }

  // ── 9. Materiais ──
  console.log('🧱 Materiais...');
  const { data: materiais, error: errM } = await supabase.from('materiais').upsert([
    { codigo: 'MAT-001', nome: 'Lona Frontlit 440g', categoria: 'lona', unidade: 'm²', estoque_minimo: 50, preco_medio: 18.5000, localizacao: 'Galpão A - P1' },
    { codigo: 'MAT-002', nome: 'Lona Backlit 500g', categoria: 'lona', unidade: 'm²', estoque_minimo: 30, preco_medio: 28.0000, localizacao: 'Galpão A - P2' },
    { codigo: 'MAT-003', nome: 'Vinil Adesivo Branco', categoria: 'vinil', unidade: 'm²', estoque_minimo: 100, preco_medio: 12.8000, localizacao: 'Galpão A - P3' },
    { codigo: 'MAT-004', nome: 'Vinil Perfurado (Micro)', categoria: 'vinil', unidade: 'm²', estoque_minimo: 40, preco_medio: 22.5000, localizacao: 'Galpão A - P4' },
    { codigo: 'MAT-005', nome: 'ACM Preto 3mm', categoria: 'acm', unidade: 'chapa', estoque_minimo: 10, preco_medio: 380.0000, localizacao: 'Galpão B - R1' },
    { codigo: 'MAT-006', nome: 'ACM Branco 3mm', categoria: 'acm', unidade: 'chapa', estoque_minimo: 10, preco_medio: 350.0000, localizacao: 'Galpão B - R2' },
    { codigo: 'MAT-007', nome: 'Tinta Eco-Solvente Cyan', categoria: 'tinta', unidade: 'L', estoque_minimo: 5, preco_medio: 185.0000, localizacao: 'Almox - A1' },
    { codigo: 'MAT-008', nome: 'Tinta Eco-Solvente Magenta', categoria: 'tinta', unidade: 'L', estoque_minimo: 5, preco_medio: 185.0000, localizacao: 'Almox - A1' },
    { codigo: 'MAT-009', nome: 'Ilhós 10mm (pct 1000)', categoria: 'ferragem', unidade: 'pct', estoque_minimo: 5, preco_medio: 45.0000, localizacao: 'Almox - G3' },
    { codigo: 'MAT-010', nome: 'Laminação Fosca', categoria: 'acabamento', unidade: 'm²', estoque_minimo: 80, preco_medio: 8.5000, localizacao: 'Galpão A - P5' },
  ], { onConflict: 'codigo' }).select();
  console.log(errM ? `   ❌ ${errM.message}` : `   ✅ ${materiais.length} materiais`);

  // ── 10. Estoque Saldos ──
  if (materiais?.length) {
    console.log('📊 Estoque Saldos...');
    const qtds = { 'MAT-001': 120, 'MAT-002': 45, 'MAT-003': 200, 'MAT-004': 60, 'MAT-005': 15, 'MAT-006': 18, 'MAT-007': 8, 'MAT-008': 6, 'MAT-009': 12, 'MAT-010': 150 };
    const saldoData = materiais.map(m => ({ material_id: m.id, quantidade_disponivel: qtds[m.codigo] || 50, quantidade_reservada: 0 }));
    const { error: errS } = await supabase.from('estoque_saldos').upsert(saldoData, { onConflict: 'material_id' });
    console.log(errS ? `   ❌ ${errS.message}` : `   ✅ ${saldoData.length} saldos`);
  }

  // ── 11. Fornecedores ──
  console.log('🏭 Fornecedores...');
  const { data: fornecedores, error: errF } = await supabase.from('fornecedores').insert([
    { razao_social: 'Viniltec Materiais Gráficos', nome_fantasia: 'Viniltec', cnpj: '12345678000101', telefone: '5130001111', email: 'vendas@viniltec.com.br', contato_nome: 'Jorge Ferreira', categorias: ['vinil','lona','acabamento'], lead_time_dias: 3, condicao_pagamento: '28 dias' },
    { razao_social: 'ACM Brasil Ind. e Com.', nome_fantasia: 'ACM Brasil', cnpj: '23456789000102', telefone: '5130002222', email: 'comercial@acmbrasil.com.br', contato_nome: 'Sérgio Lima', categorias: ['acm'], lead_time_dias: 7, condicao_pagamento: '30/60 dias' },
    { razao_social: 'Tintas Especiais Print Shop', nome_fantasia: 'Print Shop', cnpj: '34567890000103', telefone: '1130003333', email: 'atendimento@printshop.com.br', contato_nome: 'Luciana Martins', categorias: ['tinta'], lead_time_dias: 5, condicao_pagamento: '30 dias' },
    { razao_social: 'Metalúrgica São Leopoldo', nome_fantasia: 'MetalSL', cnpj: '45678901000104', telefone: '5130004444', email: 'orcamentos@metalsl.com.br', contato_nome: 'Anderson Souza', categorias: ['ferragem','estrutura'], lead_time_dias: 10, condicao_pagamento: '30/60/90 dias' },
    { razao_social: 'LonaFort Distribuidora', nome_fantasia: 'LonaFort', cnpj: '56789012000105', telefone: '5130005555', email: 'vendas@lonafort.com.br', contato_nome: 'Patrícia Gomes', categorias: ['lona','acabamento'], lead_time_dias: 2, condicao_pagamento: '14 dias' },
  ]).select();
  console.log(errF ? `   ❌ ${errF.message}` : `   ✅ ${fornecedores.length} fornecedores`);

  // ── 12. Contas a Receber ──
  console.log('💵 Contas a Receber...');
  const { data: cr, error: errCR } = await supabase.from('contas_receber').insert([
    { cliente_id: cm['Smart Fit'], pedido_id: pedidos?.[0]?.id, numero_titulo: 'NF-2026-001', valor_original: 44650, valor_pago: 0, saldo: 44650, data_vencimento: '2026-04-05', status: 'a_vencer', forma_pagamento: 'Boleto' },
    { cliente_id: cm['Beira Rio'], numero_titulo: 'NF-2026-002A', valor_original: 116400, valor_pago: 116400, saldo: 0, data_vencimento: '2026-02-15', data_pagamento: '2026-02-14', status: 'pago', forma_pagamento: 'Transferência' },
    { cliente_id: cm['Beira Rio'], numero_titulo: 'NF-2026-002B', valor_original: 116400, valor_pago: 0, saldo: 116400, data_vencimento: '2026-03-15', status: 'vencido', forma_pagamento: 'Boleto' },
    { cliente_id: cm['Renner'], numero_titulo: 'NF-2026-003', valor_original: 88000, valor_pago: 44000, saldo: 44000, data_vencimento: '2026-03-30', status: 'parcial', forma_pagamento: 'Boleto' },
    { cliente_id: cm['Kreatif'], pedido_id: pedidos?.[2]?.id, numero_titulo: 'NF-2026-004', valor_original: 3500, valor_pago: 0, saldo: 3500, data_vencimento: '2026-04-25', status: 'a_vencer', forma_pagamento: 'PIX' },
  ]).select();
  console.log(errCR ? `   ❌ ${errCR.message}` : `   ✅ ${cr.length} contas a receber`);

  // ── 13. Contas a Pagar ──
  console.log('📉 Contas a Pagar...');
  const { data: cp, error: errCP } = await supabase.from('contas_pagar').insert([
    { fornecedor_id: fornecedores?.[0]?.id, categoria: 'material', numero_titulo: 'NF-F-001', numero_nf: '45678', valor_original: 8500, valor_pago: 8500, saldo: 0, data_vencimento: '2026-02-28', data_pagamento: '2026-02-27', status: 'pago', forma_pagamento: 'Boleto' },
    { fornecedor_id: fornecedores?.[1]?.id, categoria: 'material', numero_titulo: 'NF-F-002', numero_nf: '78901', valor_original: 15200, valor_pago: 0, saldo: 15200, data_vencimento: '2026-03-20', status: 'a_pagar', forma_pagamento: 'Boleto' },
    { fornecedor_id: fornecedores?.[2]?.id, categoria: 'material', numero_titulo: 'NF-F-003', numero_nf: '12345', valor_original: 3700, valor_pago: 0, saldo: 3700, data_vencimento: '2026-03-10', status: 'vencido', forma_pagamento: 'Transferência' },
    { categoria: 'aluguel', numero_titulo: 'ALG-MAR-2026', valor_original: 8500, valor_pago: 8500, saldo: 0, data_vencimento: '2026-03-05', data_pagamento: '2026-03-04', status: 'pago', forma_pagamento: 'Débito automático' },
    { categoria: 'energia', numero_titulo: 'ENE-MAR-2026', valor_original: 2800, valor_pago: 0, saldo: 2800, data_vencimento: '2026-03-15', status: 'a_pagar', forma_pagamento: 'Boleto' },
    { categoria: 'salarios', numero_titulo: 'SAL-MAR-2026', valor_original: 23744, valor_pago: 23744, saldo: 0, data_vencimento: '2026-03-05', data_pagamento: '2026-03-05', status: 'pago', forma_pagamento: 'Transferência' },
  ]).select();
  console.log(errCP ? `   ❌ ${errCP.message}` : `   ✅ ${cp.length} contas a pagar`);

  // ── 14. Produtos ──
  console.log('🏷️ Produtos...');
  const { data: produtos, error: errPr } = await supabase.from('produtos').upsert([
    { codigo: 'PROD-001', nome: 'Fachada ACM', categoria: 'fachadas', descricao: 'Fachada em alumínio composto premium' },
    { codigo: 'PROD-002', nome: 'Fachada Lona Tensionada', categoria: 'fachadas', descricao: 'Fachada em lona tensionada c/ iluminação frontal' },
    { codigo: 'PROD-003', nome: 'Letra-Caixa', categoria: 'fachadas', descricao: 'Letras volumétricas aço/acrílico/PVC' },
    { codigo: 'PROD-004', nome: 'Banner Roll-Up', categoria: 'pdv', descricao: 'Banner retrátil para ponto de venda' },
    { codigo: 'PROD-005', nome: 'Adesivo de Vitrine', categoria: 'pdv', descricao: 'Adesivação de vitrines em vinil' },
    { codigo: 'PROD-006', nome: 'Totem de Identificação', categoria: 'fachadas', descricao: 'Totem vertical c/ estrutura metálica' },
    { codigo: 'PROD-007', nome: 'Placa de Sinalização', categoria: 'comunicacao_interna', descricao: 'Sinalização interna e externa' },
    { codigo: 'PROD-008', nome: 'Adesivo de Parede', categoria: 'comunicacao_interna', descricao: 'Ambientação com adesivo personalizado' },
  ], { onConflict: 'codigo' }).select();
  console.log(errPr ? `   ❌ ${errPr.message}` : `   ✅ ${produtos.length} produtos`);

  // ── 15. Atividades Comerciais ──
  console.log('📞 Atividades Comerciais...');
  const { error: errAt } = await supabase.from('atividades_comerciais').insert([
    { tipo: 'reuniao', entidade_tipo: 'cliente', entidade_id: cm['Beira Rio'], descricao: 'Reunião alinhamento padronização 120 lojas', duracao_minutos: 90, resultado: 'Aprovado escopo preliminar' },
    { tipo: 'email', entidade_tipo: 'cliente', entidade_id: cm['Renner'], descricao: 'Enviado proposta campanha outono/inverno', resultado: 'Aguardando retorno marketing' },
    { tipo: 'ligacao', entidade_tipo: 'cliente', entidade_id: cm['Smart Fit'], descricao: 'Confirmação aprovação proposta', duracao_minutos: 15, resultado: 'Proposta aprovada — gerar pedido' },
    { tipo: 'visita', entidade_tipo: 'cliente', entidade_id: cm['BIG Supermercados'], descricao: 'Visita técnica medição loja Assis Brasil', duracao_minutos: 120, resultado: 'Medições realizadas' },
    { tipo: 'whatsapp', entidade_tipo: 'cliente', entidade_id: cm['Droga Raia'], descricao: 'Follow-up proposta fachadas', resultado: 'Pediu revisão de valores' },
  ]);
  console.log(errAt ? `   ❌ ${errAt.message}` : '   ✅ 5 atividades');

  console.log('\n🎉 Seed completo! Dados demo inseridos com sucesso.');
}

seed().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
