import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// ---- PRODUTOS ----
try {
  const prodWb = XLSX.readFile(path.resolve('C:/Users/Caldera/Downloads/Produtos.xls'));
  const prodWs = prodWb.Sheets[prodWb.SheetNames[0]];
  const prods = XLSX.utils.sheet_to_json(prodWs);
  console.log('=== PRODUTOS ===');
  console.log('Total:', prods.length);
  console.log('Columns:', JSON.stringify(Object.keys(prods[0] || {})));
  console.log();
  prods.slice(0, 10).forEach((r, i) => console.log(`P${i}:`, JSON.stringify(r)));
  console.log('...');
  prods.slice(-3).forEach((r, i) => console.log(`P-END${i}:`, JSON.stringify(r)));
  writeFileSync('scripts/parsed-produtos.json', JSON.stringify(prods, null, 2));
  console.log('Saved scripts/parsed-produtos.json');
} catch(e) { console.error('PRODUTOS ERROR:', e.message); }

console.log('\n========================================\n');

// ---- MATERIA PRIMA ----
try {
  const mpWb = XLSX.readFile(path.resolve('C:/Users/Caldera/Downloads/09_03_2026_listaMateriaPrima.xls'));
  const mpWs = mpWb.Sheets[mpWb.SheetNames[0]];
  const mps = XLSX.utils.sheet_to_json(mpWs);
  console.log('=== MATERIA PRIMA ===');
  console.log('Total:', mps.length);
  console.log('Columns:', JSON.stringify(Object.keys(mps[0] || {})));
  console.log();
  mps.slice(0, 10).forEach((r, i) => console.log(`M${i}:`, JSON.stringify(r)));
  console.log('...');
  mps.slice(-3).forEach((r, i) => console.log(`M-END${i}:`, JSON.stringify(r)));
  writeFileSync('scripts/parsed-materiaprima.json', JSON.stringify(mps, null, 2));
  console.log('Saved scripts/parsed-materiaprima.json');
} catch(e) { console.error('MATERIA PRIMA ERROR:', e.message); }

console.log('\n========================================\n');

// ---- CLIENTES (from HTML sheet) ----
try {
  const htmlPath = path.resolve('D:/OneDrive/Área de Trabalho/09_03_2026_listaCliente (2)_arquivos/sheet001.htm');
  const htmlContent = readFileSync(htmlPath, 'utf-8');
  const clientWb = XLSX.read(htmlContent, { type: 'string' });
  const clientWs = clientWb.Sheets[clientWb.SheetNames[0]];
  const clients = XLSX.utils.sheet_to_json(clientWs);
  console.log('=== CLIENTES ===');
  console.log('Total:', clients.length);
  console.log('Columns:', JSON.stringify(Object.keys(clients[0] || {})));
  console.log();
  clients.slice(0, 8).forEach((r, i) => console.log(`C${i}:`, JSON.stringify(r)));
  console.log('...');
  clients.slice(-3).forEach((r, i) => console.log(`C-END${i}:`, JSON.stringify(r)));
  writeFileSync('scripts/parsed-clientes.json', JSON.stringify(clients, null, 2));
  console.log('Saved scripts/parsed-clientes.json');
} catch(e) { console.error('CLIENTES ERROR:', e.message); }
