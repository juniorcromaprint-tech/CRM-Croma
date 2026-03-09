#!/usr/bin/env node
/**
 * CROMA PRINT — Importador Mubisys → Supabase
 * Importa dados reais: clientes, contatos, materiais, produtos, processos produtivos
 */

import { readFileSync } from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://djwjmfgplnqyffdcgdaw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE';

async function api(table, method, body, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${table}: ${res.status} - ${err}`);
  }
  return res.json();
}

async function upsert(table, data, onConflict = 'id') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UPSERT ${table}: ${res.status} - ${err}`);
  }
  return res.json();
}

async function insert(table, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`INSERT ${table}: ${res.status} - ${err}`);
  }
  return res.json();
}

async function deleteAll(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=minimal'
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`  ⚠ DELETE ${table}: ${res.status} - ${err.substring(0, 100)}`);
  }
}

function parseBRL(val) {
  if (!val || val === 'R$ 0,00') return 0;
  return parseFloat(String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function parsePercentage(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace('%', '').replace(',', '.').trim()) || 0;
}

function cleanCNPJ(cnpj) {
  if (!cnpj) return null;
  return String(cnpj).replace(/[^\d\/\.\-]/g, '').trim() || null;
}

function cleanPhone(phone) {
  if (!phone) return null;
  return String(phone).trim() || null;
}

function mapUnidade(unidCusto) {
  if (!unidCusto) return 'un';
  const u = unidCusto.toLowerCase();
  if (u.includes('metro') && u.includes('quadrado')) return 'm²';
  if (u.includes('metro') && u.includes('linear')) return 'm';
  if (u.includes('litro')) return 'L';
  if (u.includes('kilo') || u.includes('quilo')) return 'kg';
  return 'un';
}

function mapCategoria(plano) {
  if (!plano) return 'Material';
  const p = plano.toLowerCase();
  if (p.includes('acm')) return 'ACM';
  if (p.includes('acabamento') || p.includes('serralheria')) return 'Acabamento';
  if (p.includes('produção') || p.includes('producao')) return 'Produção';
  return 'Material';
}

function mapProdutoCategoria(plano) {
  if (!plano) return 'Comunicação Visual';
  const p = plano.toLowerCase();
  if (p.includes('acm')) return 'Fachadas';
  if (p.includes('ps') || p.includes('pvc') || p.includes('acrílico') || p.includes('acrilico')) return 'Placas e Displays';
  if (p.includes('outros')) return 'Outros';
  if (p.includes('produto')) return 'Comunicação Visual';
  return 'Comunicação Visual';
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  CROMA PRINT — Importador Mubisys v2.0      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // ── 1. LIMPAR DADOS DEMO ──
  console.log('🧹 Limpando dados demo anteriores...');
  const tablesToClean = [
    'atividades_comerciais', 'cliente_contatos', 'cliente_unidades',
    'estoque_saldos', 'pedido_itens', 'pedidos', 'propostas',
    'oportunidades', 'leads', 'clientes', 'materiais', 'produtos',
    'contas_receber', 'contas_pagar'
  ];
  for (const t of tablesToClean) {
    try { await deleteAll(t); } catch {}
  }
  console.log('  ✅ Dados demo limpos\n');

  // ── 2. IMPORTAR CLIENTES ──
  console.log('👥 Importando clientes...');
  const clientsRaw = JSON.parse(readFileSync('scripts/parsed-clientes.json', 'utf-8'));

  // Separate companies from extra contacts
  const companies = clientsRaw.filter(r => r.Empresa);
  const extraContacts = clientsRaw.filter(r => !r.Empresa && r.Contato);
  console.log(`  Encontrados: ${companies.length} empresas, ${extraContacts.length} contatos extras`);

  // Deduplicate by CNPJ (keep first occurrence)
  const seen = new Set();
  const uniqueCompanies = [];
  for (const c of companies) {
    const cnpj = cleanCNPJ(c['CNPJ/CPF']);
    const key = cnpj || c.Empresa;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCompanies.push(c);
    }
  }
  console.log(`  Únicas após dedup: ${uniqueCompanies.length}`);

  // Map to Supabase schema
  const clientesBatch = uniqueCompanies.map(c => {
    const cnpj = cleanCNPJ(c['CNPJ/CPF']);
    const ie = c['Insc. Estadual'];
    const endereco = [c['Endereço'], c['Número']].filter(Boolean).join(', ');
    return {
      razao_social: (c['Razão social'] || c.Empresa || '').trim(),
      nome_fantasia: (c.Empresa || '').trim(),
      cnpj: cnpj,
      inscricao_estadual: ie ? String(ie).trim() : null,
      telefone: cleanPhone(c['Telefone 1']),
      email: (c.Email || '').trim() || null,
      segmento: 'Varejo',
      classificacao: 'C',
      tipo_cliente: 'cliente_final',
      origem: 'mubisys',
      endereco: endereco || null,
      cidade: (c.Cidade || '').trim() || null,
      estado: (c.Estado || '').trim() || null,
      cep: c.CEP ? String(c.CEP).trim() : null,
      ativo: true,
      observacoes: c.Vendedor ? `Vendedor: ${c.Vendedor}` : null
    };
  }).filter(c => c.razao_social);

  // Insert in batches of 50
  let insertedClientes = [];
  for (let i = 0; i < clientesBatch.length; i += 50) {
    const batch = clientesBatch.slice(i, i + 50);
    try {
      const result = await insert('clientes', batch);
      insertedClientes.push(...result);
    } catch (err) {
      // Try one by one for failed batches
      for (const c of batch) {
        try {
          const result = await insert('clientes', [c]);
          insertedClientes.push(...result);
        } catch (e2) {
          console.warn(`  ⚠ Skip cliente: ${c.nome_fantasia} — ${e2.message.substring(0, 80)}`);
        }
      }
    }
  }
  console.log(`  ✅ ${insertedClientes.length} clientes importados\n`);

  // ── 3. IMPORTAR CONTATOS ──
  console.log('📇 Importando contatos...');
  // Build a lookup: empresa name → client ID
  const clienteLookup = {};
  for (const c of insertedClientes) {
    clienteLookup[c.nome_fantasia?.toUpperCase()] = c.id;
    clienteLookup[c.razao_social?.toUpperCase()] = c.id;
  }

  // Add main contact from each company row
  let contatoCount = 0;
  const contatosBatch = [];
  for (const c of companies) {
    if (!c.Contato) continue;
    const key = (c.Empresa || '').toUpperCase();
    const clienteId = clienteLookup[key];
    if (!clienteId) continue;
    contatosBatch.push({
      cliente_id: clienteId,
      nome: c.Contato.trim(),
      telefone: cleanPhone(c.Celular),
      email: (c.Email_1 || c.Email || '').trim() || null,
      whatsapp: cleanPhone(c.Celular),
      principal: true,
      e_decisor: true,
      ativo: true
    });
  }

  // Insert contacts in batches
  for (let i = 0; i < contatosBatch.length; i += 50) {
    const batch = contatosBatch.slice(i, i + 50);
    try {
      await insert('cliente_contatos', batch);
      contatoCount += batch.length;
    } catch (err) {
      for (const ct of batch) {
        try { await insert('cliente_contatos', [ct]); contatoCount++; } catch {}
      }
    }
  }
  console.log(`  ✅ ${contatoCount} contatos importados\n`);

  // ── 4. IMPORTAR MATÉRIAS-PRIMAS ──
  console.log('🧪 Importando matérias-primas...');
  const mpRaw = JSON.parse(readFileSync('scripts/parsed-materiaprima.json', 'utf-8'));
  console.log(`  Encontradas: ${mpRaw.length} matérias-primas`);

  const materiaisBatch = mpRaw.map(m => ({
    codigo: `MP-${String(m.Codigo).padStart(4, '0')}`,
    nome: (m['Materia prima'] || '').trim(),
    categoria: m.Tipo === 'Midia' ? 'Mídia' : mapCategoria(m['Plano de contas Saida']),
    unidade: mapUnidade(m.UnidCusto),
    preco_medio: parseBRL(m.Valor),
    estoque_minimo: 0,
    ativo: true
  })).filter(m => m.nome);

  let insertedMateriais = 0;
  for (let i = 0; i < materiaisBatch.length; i += 50) {
    const batch = materiaisBatch.slice(i, i + 50);
    try {
      await upsert('materiais', batch, 'codigo');
      insertedMateriais += batch.length;
    } catch (err) {
      for (const m of batch) {
        try { await upsert('materiais', [m], 'codigo'); insertedMateriais++; } catch {}
      }
    }
  }
  console.log(`  ✅ ${insertedMateriais} materiais importados\n`);

  // ── 5. IMPORTAR PRODUTOS ──
  console.log('📦 Importando produtos...');

  // Parse products from HTML
  const prodHtml = readFileSync(path.resolve('C:/Users/Caldera/Downloads/Produtos.xls'), 'utf-8');
  const headerMatch = prodHtml.match(/<tr class='header-report'>([\s\S]*?)<\/tr>/);
  const allTrs = [...prodHtml.matchAll(/<tr(?:\s+[^>]*)?>(?!.*<th)([\s\S]*?)<\/tr>/g)];

  const products = [];
  let currentProduct = null;

  for (const row of allTrs) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());
    if (cells.length < 5) continue;

    // Full row with product name in first cell and enough columns
    if (cells[0] && cells.length >= 12) {
      currentProduct = cells[0];
      products.push({
        nome: cells[0],
        modelo: cells[1] || '',
        ncm: cells[3] || '',
        acabamento: cells[4] || '',
        unidade: cells[5] || 'un',
        plano: cells[6] || '',
        markup: parsePercentage(cells[7]),
        margem_min: parsePercentage(cells[8]),
      });
    } else if (currentProduct && cells.length >= 8 && !cells[0]) {
      // Sub-model row (first cell empty)
      products.push({
        nome: currentProduct,
        modelo: cells[0] || '',
        ncm: cells[2] || '',
        acabamento: cells[3] || '',
        unidade: cells[4] || 'un',
        plano: cells[5] || '',
        markup: parsePercentage(cells[6]),
        margem_min: parsePercentage(cells[7]),
      });
    }
  }

  // Deduplicate by name (keep first)
  const seenProducts = new Set();
  const uniqueProducts = [];
  for (const p of products) {
    const key = `${p.nome}__${p.modelo}`.toLowerCase();
    if (!seenProducts.has(key) && p.nome.length > 1) {
      seenProducts.add(key);
      uniqueProducts.push(p);
    }
  }
  console.log(`  Parseados: ${products.length} linhas → ${uniqueProducts.length} produtos únicos`);

  // Map to supabase schema
  let prodIdx = 1;
  const produtosBatch = uniqueProducts.map(p => ({
    codigo: `PROD-${String(prodIdx++).padStart(4, '0')}`,
    nome: p.modelo ? `${p.nome} - ${p.modelo}` : p.nome,
    categoria: mapProdutoCategoria(p.plano) || 'Comunicação Visual',
    descricao: [p.acabamento, p.ncm ? `NCM: ${p.ncm}` : ''].filter(Boolean).join(' | ') || null,
    unidade_padrao: p.unidade === 'm²' ? 'm2' : p.unidade || 'un',
    ativo: true
  })).filter(p => p.nome);

  let insertedProdutos = 0;
  for (let i = 0; i < produtosBatch.length; i += 50) {
    const batch = produtosBatch.slice(i, i + 50);
    try {
      await upsert('produtos', batch, 'codigo');
      insertedProdutos += batch.length;
    } catch (err) {
      for (const p of batch) {
        try { await upsert('produtos', [p], 'codigo'); insertedProdutos++; } catch (e2) {
          console.warn(`  ⚠ Skip produto: ${p.nome} — ${e2.message.substring(0, 80)}`);
        }
      }
    }
  }
  console.log(`  ✅ ${insertedProdutos} produtos importados\n`);

  // ── 6. CRIAR SALDOS DE ESTOQUE ──
  console.log('📊 Criando saldos de estoque iniciais...');
  // Get all material IDs
  const materiaisRes = await fetch(`${SUPABASE_URL}/rest/v1/materiais?select=id&limit=1000`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const allMateriais = await materiaisRes.json();

  const saldosBatch = allMateriais.map(m => ({
    material_id: m.id,
    deposito: 'Geral',
    quantidade_disponivel: 0,
    quantidade_reservada: 0
  }));

  let saldoCount = 0;
  for (let i = 0; i < saldosBatch.length; i += 50) {
    const batch = saldosBatch.slice(i, i + 50);
    try {
      await insert('estoque_saldos', batch);
      saldoCount += batch.length;
    } catch (err) {
      // May already exist
      console.warn(`  ⚠ Saldos batch ${i}: ${err.message.substring(0, 80)}`);
    }
  }
  console.log(`  ✅ ${saldoCount} saldos criados\n`);

  // ── SUMMARY ──
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  ✅ IMPORTAÇÃO CONCLUÍDA                     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  👥 Clientes:    ${String(insertedClientes.length).padStart(4)}                        ║`);
  console.log(`║  📇 Contatos:    ${String(contatoCount).padStart(4)}                        ║`);
  console.log(`║  🧪 Materiais:   ${String(insertedMateriais).padStart(4)}                        ║`);
  console.log(`║  📦 Produtos:    ${String(insertedProdutos).padStart(4)}                        ║`);
  console.log(`║  📊 Saldos est:  ${String(saldoCount).padStart(4)}                        ║`);
  console.log('╚══════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('❌ ERRO FATAL:', err.message);
  process.exit(1);
});
