# Bulk Data Management — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build import/export/bulk-edit module for 11 entities in Croma Print ERP — hub central, wizard de importação, grid editável inline, templates e auditoria.

**Architecture:** Hybrid approach — generic import/export engine (config-driven) for standard flow, reusable DataGrid component for inline editing, custom components for complex entities (clients+contacts, compositions). Hub central at `/admin/dados` + quick buttons on existing listing pages.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query v5, Zod, Supabase, xlsx (already installed), existing exportExcel/exportCsv utilities.

**Spec:** `docs/superpowers/specs/2026-03-16-bulk-data-management-design.md`

---

## File Structure

### New files to create

```
supabase/migrations/031_import_logs.sql                     — DB migration

src/domains/dados/
  pages/DadosHubPage.tsx                                     — Hub central /admin/dados
  pages/ImportHistoricoPage.tsx                               — Histórico /admin/dados/historico
  components/FileDropzone.tsx                                 — Drag & drop file upload
  components/ImportWizard.tsx                                 — 4-step import wizard
  components/PreviewTable.tsx                                 — Preview with row status
  components/ValidationReport.tsx                             — Error details display
  components/ExportDialog.tsx                                 — Export with filters/format
  components/DataGrid.tsx                                     — Inline editable grid
  components/BulkActionBar.tsx                                — Batch action bar (checkbox)
  components/TemplateDownloadButton.tsx                       — Download template button
  components/EntityCard.tsx                                   — Card for hub (entity + actions)
  engine/file-parser.ts                                      — Parse CSV/XLSX to objects
  engine/import-engine.ts                                    — Validate → classify → apply
  engine/export-engine.ts                                    — Query → transform → download
  engine/template-generator.ts                               — Generate XLSX templates
  engine/validators/common.ts                                — CNPJ, CPF, email, phone, UF
  engine/validators/materiais.ts                             — Zod schema for materiais import
  engine/validators/produtos.ts
  engine/validators/clientes.ts                              — Includes contact validation
  engine/validators/fornecedores.ts
  engine/validators/modelo-materiais.ts                      — Compound key validation
  engine/validators/modelo-processos.ts
  engine/validators/contas-receber.ts
  engine/validators/contas-pagar.ts
  engine/validators/leads.ts
  engine/validators/acabamentos.ts
  engine/validators/servicos.ts
  configs/entity-registry.ts                                 — Central registry of all entities
  configs/materiais.config.ts
  configs/produtos.config.ts
  configs/clientes.config.ts
  configs/fornecedores.config.ts
  configs/modelo-materiais.config.ts
  configs/modelo-processos.config.ts
  configs/contas-receber.config.ts
  configs/contas-pagar.config.ts
  configs/leads.config.ts
  configs/acabamentos.config.ts
  configs/servicos.config.ts
  hooks/useImport.ts                                         — Import wizard state + mutation
  hooks/useExport.ts                                         — Filtered query + download
  hooks/useBulkEdit.ts                                       — Track edited cells + batch save
  hooks/useImportHistory.ts                                  — Query import_logs
  services/import.service.ts                                 — Upsert batch via Supabase
  services/export.service.ts                                 — Query + format for export
  services/bulk-edit.service.ts                              — Batch update via Supabase

src/domains/dados/__tests__/
  file-parser.test.ts
  validators-common.test.ts
  import-engine.test.ts
  export-engine.test.ts
  template-generator.test.ts
```

### Existing files to modify

```
src/routes/adminRoutes.tsx                                   — Add /admin/dados routes
src/shared/constants/navigation.ts                           — Add "Gestão de Dados" to ADMINISTRAÇÃO
src/integrations/supabase/types.ts                           — Regenerate after migration (or add manually)
```

---

## Chunk 1: Foundation — DB, File Parser, Common Validators, Entity Configs

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/031_import_logs.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 031_import_logs.sql
-- Tabela de auditoria para operações de importação/exportação/edição em massa

CREATE TABLE import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'export', 'bulk_edit')),
  filename TEXT,
  total_rows INT DEFAULT 0,
  inserted INT DEFAULT 0,
  updated INT DEFAULT 0,
  skipped INT DEFAULT 0,
  errors INT DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_import_logs_entity ON import_logs(entity);
CREATE INDEX idx_import_logs_user ON import_logs(user_id);
CREATE INDEX idx_import_logs_created ON import_logs(created_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs"
  ON import_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert own logs"
  ON import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Execute migration on Supabase**

Run in Supabase SQL editor at `https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` or use Supabase MCP tool `execute_sql`.

- [ ] **Step 3: Add TypeScript type for import_logs**

Add to `src/integrations/supabase/types.ts` inside `Tables` the `import_logs` type, or regenerate types with `npx supabase gen types typescript`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/031_import_logs.sql
git commit -m "feat(dados): add import_logs migration for bulk data audit"
```

---

### Task 2: File Parser (CSV/XLSX)

**Files:**
- Create: `src/domains/dados/engine/file-parser.ts`
- Test: `src/domains/dados/__tests__/file-parser.test.ts`

- [ ] **Step 1: Write failing tests for file parser**

```typescript
// src/domains/dados/__tests__/file-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseCSV, parseXLSX, detectHeaderRow, parseFile } from '../engine/file-parser';

describe('file-parser', () => {
  describe('parseCSV', () => {
    it('should parse semicolon-delimited CSV with BOM', () => {
      const csv = '\uFEFFnome;codigo;preco\nLona 380g;LONA-380;25.50\nVinil;VINIL-01;18.00';
      const result = parseCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ nome: 'Lona 380g', codigo: 'LONA-380', preco: '25.50' });
      expect(result[1]).toEqual({ nome: 'Vinil', codigo: 'VINIL-01', preco: '18.00' });
    });

    it('should handle quoted fields with semicolons', () => {
      const csv = 'nome;descricao\n"Lona; especial";teste';
      const result = parseCSV(csv);
      expect(result[0].nome).toBe('Lona; especial');
    });

    it('should handle empty values', () => {
      const csv = 'nome;codigo;preco\nLona;;25.50';
      const result = parseCSV(csv);
      expect(result[0].codigo).toBe('');
    });
  });

  describe('detectHeaderRow', () => {
    it('should detect header row when first row is instruction', () => {
      const rows = [
        { 'A': 'Preencha a partir da linha 4', 'B': '', 'C': '' },
        { 'A': 'nome*', 'B': 'codigo*', 'C': 'preco_medio' },
        { 'A': 'Exemplo Lona', 'B': 'LONA-001', 'C': '25.00' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(1);
    });

    it('should detect header row at index 0 when no instructions', () => {
      const rows = [
        { 'A': 'nome', 'B': 'codigo', 'C': 'preco_medio' },
        { 'A': 'Lona 380g', 'B': 'LONA-380', 'C': '25.50' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(0);
    });

    it('should strip asterisks from required column markers', () => {
      const rows = [
        { 'A': 'nome*', 'B': 'codigo*', 'C': 'preco_medio' },
        { 'A': 'Lona', 'B': 'LONA', 'C': '25' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/domains/dados/__tests__/file-parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement file-parser.ts**

```typescript
// src/domains/dados/engine/file-parser.ts
import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: string;
}

/**
 * Parse CSV content (semicolon-delimited, UTF-8 BOM) into array of objects.
 */
export function parseCSV(content: string): ParsedRow[] {
  // Remove BOM if present
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ';') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse XLSX file (first sheet) into array of objects.
 */
export function parseXLSX(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return rawRows.map(row => {
    const obj: ParsedRow = {};
    row.forEach((val, i) => {
      obj[String(i)] = String(val ?? '');
    });
    return obj;
  });
}

/**
 * Detect the header row index by matching known column names.
 * Strips asterisks (e.g. "nome*" → "nome") before matching.
 * Returns the index of the first row where >= 50% of values match known columns.
 */
export function detectHeaderRow(
  rows: ParsedRow[],
  knownColumns: string[],
): number {
  const knownSet = new Set(knownColumns.map(c => c.toLowerCase()));

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const values = Object.values(rows[i]).map(v =>
      String(v).replace(/\*$/, '').trim().toLowerCase()
    );
    const matches = values.filter(v => knownSet.has(v)).length;
    if (matches >= Math.ceil(knownColumns.length * 0.5)) {
      return i;
    }
  }
  return 0; // fallback: first row is header
}

/**
 * Parse uploaded file (CSV or XLSX) into normalized array of objects.
 * Automatically detects header row and skips instruction lines.
 */
export async function parseFile(
  file: File,
  knownColumns: string[],
): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const isCSV = file.name.endsWith('.csv');

  let rawRows: ParsedRow[];

  if (isCSV) {
    const text = await file.text();
    rawRows = parseCSV(text);
    // CSV already uses first row as headers
    return {
      headers: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
      rows: rawRows,
    };
  }

  // XLSX
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const allRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (allRows.length === 0) return { headers: [], rows: [] };

  // Build temp ParsedRows to detect header
  const tempRows = allRows.map(row => {
    const obj: ParsedRow = {};
    row.forEach((val, i) => { obj[String(i)] = String(val ?? ''); });
    return obj;
  });

  const headerIdx = detectHeaderRow(tempRows, knownColumns);
  const headerRow = allRows[headerIdx].map(h => String(h).replace(/\*$/, '').trim());

  const dataRows = allRows.slice(headerIdx + 1)
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .map(row => {
      const obj: ParsedRow = {};
      headerRow.forEach((h, i) => {
        obj[h] = String(row[i] ?? '').trim();
      });
      return obj;
    });

  return { headers: headerRow, rows: dataRows };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/domains/dados/__tests__/file-parser.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/dados/engine/file-parser.ts src/domains/dados/__tests__/file-parser.test.ts
git commit -m "feat(dados): add file-parser for CSV/XLSX with header detection"
```

---

### Task 3: Common Validators

**Files:**
- Create: `src/domains/dados/engine/validators/common.ts`
- Test: `src/domains/dados/__tests__/validators-common.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/domains/dados/__tests__/validators-common.test.ts
import { describe, it, expect } from 'vitest';
import { validateCNPJ, validateCPF, validateEmail, validatePhone, validateUF, parseBRDate } from '../engine/validators/common';

describe('common validators', () => {
  describe('validateCNPJ', () => {
    it('should accept valid CNPJ', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
    });
    it('should accept unformatted CNPJ', () => {
      expect(validateCNPJ('11222333000181')).toBe(true);
    });
    it('should reject invalid CNPJ', () => {
      expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
    });
    it('should reject empty', () => {
      expect(validateCNPJ('')).toBe(false);
    });
  });

  describe('validateCPF', () => {
    it('should accept valid CPF', () => {
      expect(validateCPF('529.982.247-25')).toBe(true);
    });
    it('should reject all same digits', () => {
      expect(validateCPF('111.111.111-11')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });
    it('should reject invalid email', () => {
      expect(validateEmail('not-email')).toBe(false);
    });
    it('should accept empty (optional field)', () => {
      expect(validateEmail('')).toBe(true);
    });
  });

  describe('validateUF', () => {
    it('should accept valid UF', () => {
      expect(validateUF('SP')).toBe(true);
      expect(validateUF('RJ')).toBe(true);
    });
    it('should reject invalid UF', () => {
      expect(validateUF('XX')).toBe(false);
    });
  });

  describe('parseBRDate', () => {
    it('should parse DD/MM/YYYY', () => {
      expect(parseBRDate('15/03/2026')).toBe('2026-03-15');
    });
    it('should pass through YYYY-MM-DD', () => {
      expect(parseBRDate('2026-03-15')).toBe('2026-03-15');
    });
    it('should return null for invalid', () => {
      expect(parseBRDate('invalid')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/domains/dados/__tests__/validators-common.test.ts
```

- [ ] **Step 3: Implement common.ts**

```typescript
// src/domains/dados/engine/validators/common.ts

const VALID_UFS = new Set([
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]);

export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  const calc = (digits: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(digits[i]) * w, 0);

  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];

  let remainder = calc(clean, w1) % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(clean[12]) !== d1) return false;

  remainder = calc(clean, w2) % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(clean[13]) === d2;
}

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      sum += parseInt(clean[i]) * (t + 1 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (parseInt(clean[t]) !== remainder) return false;
  }
  return true;
}

export function validateCNPJorCPF(value: string): boolean {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 14) return validateCNPJ(value);
  if (clean.length === 11) return validateCPF(value);
  return false;
}

export function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // optional
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

export function validateUF(uf: string): boolean {
  return VALID_UFS.has(uf.toUpperCase().trim());
}

export function parseBRDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

export interface ValidationError {
  row: number;
  column: string;
  value: string;
  reason: string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/domains/dados/__tests__/validators-common.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/dados/engine/validators/common.ts src/domains/dados/__tests__/validators-common.test.ts
git commit -m "feat(dados): add common validators (CNPJ, CPF, email, UF, date)"
```

---

### Task 4: Entity Config Type + Registry + First 4 Simple Configs

**Files:**
- Create: `src/domains/dados/configs/entity-registry.ts`
- Create: `src/domains/dados/configs/materiais.config.ts`
- Create: `src/domains/dados/configs/produtos.config.ts`
- Create: `src/domains/dados/configs/fornecedores.config.ts`
- Create: `src/domains/dados/configs/acabamentos.config.ts`
- Create: `src/domains/dados/configs/servicos.config.ts`
- Create: `src/domains/dados/configs/leads.config.ts`

- [ ] **Step 1: Create EntityConfig type and registry**

```typescript
// src/domains/dados/configs/entity-registry.ts
import { z } from 'zod';

export type ColumnType = 'text' | 'number' | 'select' | 'boolean' | 'date';

export interface ColumnDef {
  key: string;           // DB column name
  label: string;         // Display name in PT-BR
  type: ColumnType;
  required: boolean;
  options?: string[];    // For 'select' type
  editable?: boolean;    // Can be bulk-edited (default true)
  exportable?: boolean;  // Include in exports (default true)
}

export interface EntityConfig {
  key: string;           // Unique identifier (e.g., 'materiais')
  table: string;         // Supabase table name
  label: string;         // PT-BR display name
  labelPlural: string;   // PT-BR plural
  icon: string;          // lucide-react icon name
  updateKeys: string[];  // Fields used to identify existing records (first match wins)
  columns: ColumnDef[];
  requiredColumns: string[];  // Must be non-empty for import
  templateExamples: Record<string, string>[]; // 2-3 example rows for template
  bulkActions?: {        // Actions available in batch
    field: string;
    label: string;
    type: ColumnType;
    options?: string[];
  }[];
  importOrder: number;   // Recommended import order (for dependency resolution)
}

// Registry — imported by all consumers
const registry = new Map<string, EntityConfig>();

export function registerEntity(config: EntityConfig) {
  registry.set(config.key, config);
}

export function getEntity(key: string): EntityConfig | undefined {
  return registry.get(key);
}

export function getAllEntities(): EntityConfig[] {
  return Array.from(registry.values()).sort((a, b) => a.importOrder - b.importOrder);
}
```

- [ ] **Step 2: Create materiais.config.ts**

```typescript
// src/domains/dados/configs/materiais.config.ts
import { registerEntity, type EntityConfig } from './entity-registry';

export const materiaisConfig: EntityConfig = {
  key: 'materiais',
  table: 'materiais',
  label: 'Matéria-Prima',
  labelPlural: 'Matérias-Primas',
  icon: 'Package',
  updateKeys: ['id', 'codigo'],
  requiredColumns: ['nome', 'codigo'],
  importOrder: 2,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'codigo', label: 'Código', type: 'text', required: true },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'descricao', label: 'Descrição', type: 'text', required: false },
    { key: 'categoria', label: 'Categoria', type: 'select', required: false, options: ['lona', 'vinil', 'papel', 'chapa', 'perfil', 'tinta', 'substrato', 'acessorio', 'outros'] },
    { key: 'unidade', label: 'Unidade', type: 'select', required: false, options: ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] },
    { key: 'preco_medio', label: 'Preço Médio', type: 'number', required: false },
    { key: 'estoque_minimo', label: 'Estoque Mínimo', type: 'number', required: false },
    { key: 'fornecedor_principal', label: 'Fornecedor Principal', type: 'text', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { codigo: 'LONA-380G', nome: 'Lona Front 380g', categoria: 'lona', unidade: 'm²', preco_medio: '25.50', ativo: 'true' },
    { codigo: 'VINIL-ADH', nome: 'Vinil Adesivo Brilho', categoria: 'vinil', unidade: 'm²', preco_medio: '18.00', ativo: 'true' },
    { codigo: 'TINTA-ECO', nome: 'Tinta Eco-solvente Cyan', categoria: 'tinta', unidade: 'litro', preco_medio: '320.00', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'categoria', label: 'Alterar Categoria', type: 'select', options: ['lona', 'vinil', 'papel', 'chapa', 'perfil', 'tinta', 'substrato', 'acessorio', 'outros'] },
    { field: 'preco_medio', label: 'Alterar Preço Médio', type: 'number' },
    { field: 'unidade', label: 'Alterar Unidade', type: 'select', options: ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(materiaisConfig);
```

- [ ] **Step 3: Create remaining simple configs** (produtos, fornecedores, leads, acabamentos, servicos)

Follow the same pattern as materiais.config.ts. Key differences:

**produtos.config.ts**: `table: 'produtos'`, `updateKeys: ['id', 'codigo']`, columns include `codigo`, `nome`, `categoria`, `markup`, `preco_fixo`, `ativo`. `importOrder: 5`.

**fornecedores.config.ts**: `table: 'fornecedores'`, `updateKeys: ['id', 'cnpj_cpf']`, columns include `cnpj_cpf`, `razao_social`, `nome_fantasia`, `email`, `telefone`, `cidade`, `estado`, `ativo`. `importOrder: 1`.

**leads.config.ts**: `table: 'leads'`, `updateKeys: ['id', 'email']`, columns include `nome`, `email`, `telefone`, `empresa`, `origem`, `status`, `responsavel_id`. `importOrder: 9`.

**acabamentos.config.ts**: `table: 'acabamentos'`, `updateKeys: ['id', 'nome']`, columns include `nome`, `descricao`, `preco`, `ativo`. `importOrder: 3`.

**servicos.config.ts**: `table: 'servicos'`, `updateKeys: ['id', 'nome']`, columns include `nome`, `descricao`, `preco`, `unidade`, `ativo`. `importOrder: 4`.

Check actual column names against `src/integrations/supabase/types.ts` before creating each config.

- [ ] **Step 4: Create complex entity configs** (clientes, contas-receber, contas-pagar, modelo-materiais, modelo-processos)

**clientes.config.ts**: `table: 'clientes'`, `updateKeys: ['id', 'cnpj_cpf']`. Include columns for the base client AND flattened contact columns: `contato_1_nome`, `contato_1_email`, `contato_1_telefone`, `contato_1_cargo` (x3 contacts). `importOrder: 8`.

**contas-receber.config.ts**: `table: 'contas_receber'`, `updateKeys: ['id']`. Include `cliente_cnpj_cpf` as lookup column (not FK directly). `importOrder: 10`.

**contas-pagar.config.ts**: `table: 'contas_pagar'`, `updateKeys: ['id']`. Include `fornecedor_cnpj_cpf` as lookup column. `importOrder: 11`.

**modelo-materiais.config.ts**: `table: 'modelo_materiais'`, `updateKeys: ['modelo_id+material_id']`. Template columns: `produto_codigo`, `modelo_nome`, `material_codigo`, `quantidade_por_unidade`, `unidade`, `tipo`. `importOrder: 6`.

**modelo-processos.config.ts**: `table: 'modelo_processos'`, `updateKeys: ['modelo_id+etapa']`. Template columns: `produto_codigo`, `modelo_nome`, `etapa`, `tempo_por_unidade_min`, `tipo_processo`, `ordem`. `importOrder: 7`.

- [ ] **Step 5: Import all configs in entity-registry.ts** (add barrel import)

Add to the bottom of `entity-registry.ts`:
```typescript
// Auto-register all entities
import './materiais.config';
import './produtos.config';
import './clientes.config';
import './fornecedores.config';
import './modelo-materiais.config';
import './modelo-processos.config';
import './contas-receber.config';
import './contas-pagar.config';
import './leads.config';
import './acabamentos.config';
import './servicos.config';
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/dados/configs/
git commit -m "feat(dados): add entity configs and registry for 11 entities"
```

---

### Task 5: Entity Validators (Zod schemas per entity)

**Files:**
- Create: all 11 validator files in `src/domains/dados/engine/validators/`

- [ ] **Step 1: Create materiais.ts validator**

```typescript
// src/domains/dados/engine/validators/materiais.ts
import { z } from 'zod';

export const materiaisImportSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().optional().default(''),
  categoria: z.string().optional().default(''),
  unidade: z.string().optional().default(''),
  preco_medio: z.string().optional().transform(v => v ? parseFloat(v.replace(',', '.')) : null)
    .pipe(z.number().min(0, 'Preço deve ser >= 0').nullable()),
  estoque_minimo: z.string().optional().transform(v => v ? parseFloat(v.replace(',', '.')) : null)
    .pipe(z.number().min(0).nullable()),
  fornecedor_principal: z.string().optional().default(''),
  ativo: z.string().optional().transform(v => v === '' ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type MateriaisImportRow = z.infer<typeof materiaisImportSchema>;
```

- [ ] **Step 2: Create remaining validators** (same pattern, adjusting fields per entity)

For each entity, create a Zod schema that:
1. Accepts string inputs (everything from CSV/XLSX comes as strings)
2. Transforms to correct types (numbers, booleans, dates)
3. Validates required fields, formats, ranges
4. Uses `validateCNPJorCPF` from `common.ts` for client/supplier validators via `.refine()`

**clientes.ts**: Include `cnpj_cpf` with `.refine(validateCNPJorCPF)`, `email` with `.refine(validateEmail)`, `estado` with `.refine(validateUF)`. Also validate `contato_1_nome`, `contato_1_email`, etc. as optional strings.

**modelo-materiais.ts**: Validate `produto_codigo` and `material_codigo` as required strings, `quantidade_por_unidade` as positive number, `tipo` as enum.

- [ ] **Step 3: Commit**

```bash
git add src/domains/dados/engine/validators/
git commit -m "feat(dados): add Zod import validators for all 11 entities"
```

---

## Chunk 2: Import/Export Engine + Services

### Task 6: Export Engine + Service

**Files:**
- Create: `src/domains/dados/engine/export-engine.ts`
- Create: `src/domains/dados/services/export.service.ts`
- Test: `src/domains/dados/__tests__/export-engine.test.ts`

- [ ] **Step 1: Write failing tests for export engine**

```typescript
// src/domains/dados/__tests__/export-engine.test.ts
import { describe, it, expect } from 'vitest';
import { transformToExportFormat } from '../engine/export-engine';

describe('export-engine', () => {
  it('should transform query results to headers + rows format', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'preco_medio', label: 'Preço Médio', type: 'number' as const, required: false },
    ];
    const data = [
      { nome: 'Lona 380g', preco_medio: 25.5 },
      { nome: 'Vinil', preco_medio: 18.0 },
    ];
    const result = transformToExportFormat(data, columns);
    expect(result.headers).toEqual(['Nome', 'Preço Médio']);
    expect(result.rows).toEqual([
      ['Lona 380g', 25.5],
      ['Vinil', 18.0],
    ]);
  });

  it('should handle null values', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const data = [{ nome: 'Test', preco: null }];
    const result = transformToExportFormat(data, columns);
    expect(result.rows[0]).toEqual(['Test', null]);
  });

  it('should filter columns when selectedColumns provided', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'codigo', label: 'Código', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const data = [{ nome: 'Lona', codigo: 'LONA-01', preco: 25 }];
    const result = transformToExportFormat(data, columns, ['nome', 'preco']);
    expect(result.headers).toEqual(['Nome', 'Preço']);
    expect(result.rows[0]).toEqual(['Lona', 25]);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

- [ ] **Step 3: Implement export-engine.ts**

```typescript
// src/domains/dados/engine/export-engine.ts
import type { ColumnDef } from '../configs/entity-registry';
import { exportExcel } from '@/shared/utils/exportExcel';
import { exportCsv } from '@/shared/utils/exportCsv';

export function transformToExportFormat(
  data: Record<string, unknown>[],
  columns: ColumnDef[],
  selectedColumns?: string[],
): { headers: string[]; rows: (string | number | null)[][] } {
  const cols = selectedColumns
    ? columns.filter(c => selectedColumns.includes(c.key))
    : columns.filter(c => c.exportable !== false);

  const headers = cols.map(c => c.label);
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val == null) return null;
      if (c.type === 'boolean') return val ? 'Sim' : 'Não';
      if (c.type === 'date' && typeof val === 'string') {
        // Format YYYY-MM-DD to DD/MM/YYYY for display
        const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : val;
      }
      return val as string | number;
    })
  );

  return { headers, rows };
}

export function downloadExport(
  data: Record<string, unknown>[],
  columns: ColumnDef[],
  filename: string,
  format: 'csv' | 'xlsx',
  selectedColumns?: string[],
) {
  const { headers, rows } = transformToExportFormat(data, columns, selectedColumns);
  if (format === 'csv') {
    exportCsv(filename, headers, rows);
  } else {
    exportExcel({ filename, headers, rows });
  }
}
```

- [ ] **Step 4: Implement export.service.ts**

```typescript
// src/domains/dados/services/export.service.ts
import { supabase } from '@/integrations/supabase/client';
import { getEntity } from '../configs/entity-registry';
import { downloadExport } from '../engine/export-engine';

interface ExportOptions {
  entityKey: string;
  format: 'csv' | 'xlsx';
  filters?: Record<string, unknown>;
  selectedColumns?: string[];
}

export async function exportEntityData(options: ExportOptions) {
  const entity = getEntity(options.entityKey);
  if (!entity) throw new Error(`Entity not found: ${options.entityKey}`);

  const selectColumns = entity.columns
    .filter(c => c.exportable !== false)
    .map(c => c.key)
    .join(',');

  let query = supabase.from(entity.table).select(selectColumns);

  // Apply filters
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value != null && value !== '') {
        query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const filename = `${entity.labelPlural}_${new Date().toISOString().slice(0, 10)}`;
  downloadExport(
    data ?? [],
    entity.columns,
    filename,
    options.format,
    options.selectedColumns,
  );

  return { count: data?.length ?? 0 };
}
```

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run src/domains/dados/__tests__/export-engine.test.ts
git add src/domains/dados/engine/export-engine.ts src/domains/dados/services/export.service.ts src/domains/dados/__tests__/export-engine.test.ts
git commit -m "feat(dados): add export engine and service"
```

---

### Task 7: Template Generator

**Files:**
- Create: `src/domains/dados/engine/template-generator.ts`
- Test: `src/domains/dados/__tests__/template-generator.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/domains/dados/__tests__/template-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateTemplateData } from '../engine/template-generator';

describe('template-generator', () => {
  it('should generate template with instruction row, headers, and examples', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'codigo', label: 'Código', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const examples = [{ nome: 'Lona', codigo: 'LONA-01', preco: '25.00' }];
    const result = generateTemplateData(columns, examples, 'Matéria-Prima');

    // Row 0: instruction
    expect(result[0][0]).toContain('Preencha');
    // Row 1: headers with * on required
    expect(result[1]).toContain('nome*');
    expect(result[1]).toContain('codigo*');
    expect(result[1]).toContain('preco');
    // Row 2: example
    expect(result[2]).toContain('Lona');
  });
});
```

- [ ] **Step 2: Implement template-generator.ts**

```typescript
// src/domains/dados/engine/template-generator.ts
import * as XLSX from 'xlsx';
import type { ColumnDef, EntityConfig } from '../configs/entity-registry';

export function generateTemplateData(
  columns: ColumnDef[],
  examples: Record<string, string>[],
  entityLabel: string,
): (string | number)[][] {
  const importableColumns = columns.filter(c => c.key !== 'id');

  // Row 0: instruction
  const instruction = [`Modelo de importação: ${entityLabel}. Preencha a partir da linha 4. Colunas com * são obrigatórias. Não altere os cabeçalhos.`];

  // Row 1: headers
  const headers = importableColumns.map(c => c.required ? `${c.key}*` : c.key);

  // Rows 2+: examples
  const exampleRows = examples.map(ex =>
    importableColumns.map(c => ex[c.key] ?? '')
  );

  return [instruction, headers, ...exampleRows];
}

export function downloadTemplate(entity: EntityConfig) {
  const data = generateTemplateData(entity.columns, entity.templateExamples, entity.label);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-width
  const maxCols = Math.max(...data.map(r => r.length));
  ws['!cols'] = Array.from({ length: maxCols }, (_, i) => ({
    wch: Math.min(Math.max(...data.map(r => String(r[i] ?? '').length)) + 2, 40),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entity.label);
  XLSX.writeFile(wb, `modelo_${entity.key}.xlsx`);
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/domains/dados/__tests__/template-generator.test.ts
git add src/domains/dados/engine/template-generator.ts src/domains/dados/__tests__/template-generator.test.ts
git commit -m "feat(dados): add template generator for import models"
```

---

### Task 8: Import Engine + Import Service

**Files:**
- Create: `src/domains/dados/engine/import-engine.ts`
- Create: `src/domains/dados/services/import.service.ts`
- Test: `src/domains/dados/__tests__/import-engine.test.ts`

- [ ] **Step 1: Write failing tests for import engine**

Test: validate rows, classify as INSERT/UPDATE/SKIP, detect duplicates.

- [ ] **Step 2: Implement import-engine.ts**

Core functions:
- `validateRows(rows, schema)` → returns `{ valid: ValidatedRow[], errors: ValidationError[] }`
- `classifyRows(validRows, existingData, updateKeys)` → returns `{ inserts: Row[], updates: Row[], skips: Row[] }`
- `detectDuplicates(rows, updateKeys)` → returns duplicate pairs

The engine does NOT touch the database — it's pure logic. The service handles Supabase.

- [ ] **Step 3: Implement import.service.ts**

Core functions:
- `fetchExistingByKeys(table, keys, values)` → fetches existing records for classification
- `applyImport(table, inserts, updates, updateKeys)` → executes upserts in batches of 100
- `logImport(userId, entity, filename, results)` → writes to `import_logs`

Uses Supabase `.upsert()` with `onConflict` matching the update keys.

- [ ] **Step 4: Implement bulk-edit.service.ts**

```typescript
// src/domains/dados/services/bulk-edit.service.ts
import { supabase } from '@/integrations/supabase/client';

interface BulkEditParams {
  table: string;
  ids: string[];
  field: string;
  value: unknown;
}

export async function bulkUpdateField({ table, ids, field, value }: BulkEditParams) {
  const { error } = await supabase
    .from(table)
    .update({ [field]: value })
    .in('id', ids);

  if (error) throw error;
  return { updated: ids.length };
}

export async function bulkUpdateRows(
  table: string,
  changes: { id: string; updates: Record<string, unknown> }[],
) {
  // Execute in batches of 50
  const batchSize = 50;
  let updated = 0;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const promises = batch.map(({ id, updates }) =>
      supabase.from(table).update(updates).eq('id', id)
    );
    const results = await Promise.all(promises);
    results.forEach(r => { if (!r.error) updated++; });
  }
  return { updated };
}
```

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run src/domains/dados/__tests__/import-engine.test.ts
git add src/domains/dados/engine/import-engine.ts src/domains/dados/services/
git commit -m "feat(dados): add import engine, import service, and bulk-edit service"
```

---

## Chunk 3: UI Components

### Task 9: FileDropzone + ImportWizard

**Files:**
- Create: `src/domains/dados/components/FileDropzone.tsx`
- Create: `src/domains/dados/components/PreviewTable.tsx`
- Create: `src/domains/dados/components/ValidationReport.tsx`
- Create: `src/domains/dados/components/ImportWizard.tsx`
- Create: `src/domains/dados/hooks/useImport.ts`

- [ ] **Step 1: Create FileDropzone** — drag & drop area accepting .csv/.xlsx, uses shadcn/ui Card, shows file info after drop.

- [ ] **Step 2: Create PreviewTable** — table showing rows with status badges (insert/update/skip/error), row number, key columns. Uses shadcn/ui Table.

- [ ] **Step 3: Create ValidationReport** — expandable list of errors with row, column, value, reason. Uses shadcn/ui Accordion or Collapsible.

- [ ] **Step 4: Create useImport hook** — manages wizard state (step 1-4), file parsing, validation, classification, and submission. Uses TanStack Query `useMutation` for the actual import.

- [ ] **Step 5: Create ImportWizard** — 4-step wizard using shadcn/ui Tabs or Steps pattern. Step 1: FileDropzone + preview. Step 2: ValidationReport + badges. Step 3: PreviewTable + counters. Step 4: confirm button + progress bar + result report.

- [ ] **Step 6: Commit**

```bash
git add src/domains/dados/components/FileDropzone.tsx src/domains/dados/components/PreviewTable.tsx src/domains/dados/components/ValidationReport.tsx src/domains/dados/components/ImportWizard.tsx src/domains/dados/hooks/useImport.ts
git commit -m "feat(dados): add ImportWizard with 4-step flow"
```

---

### Task 10: ExportDialog + TemplateDownloadButton

**Files:**
- Create: `src/domains/dados/components/ExportDialog.tsx`
- Create: `src/domains/dados/components/TemplateDownloadButton.tsx`
- Create: `src/domains/dados/hooks/useExport.ts`

- [ ] **Step 1: Create useExport hook** — wraps `exportEntityData` with loading state. Logs to `import_logs` with `operation = 'export'`.

- [ ] **Step 2: Create ExportDialog** — shadcn/ui Dialog with: entity selector, format radio (CSV/XLSX), mode radio (Relatório/Template para reimportação), column checkboxes, optional status/category filters. Export button calls useExport.

- [ ] **Step 3: Create TemplateDownloadButton** — simple button that calls `downloadTemplate(entity)`. Icon: Download.

- [ ] **Step 4: Commit**

```bash
git add src/domains/dados/components/ExportDialog.tsx src/domains/dados/components/TemplateDownloadButton.tsx src/domains/dados/hooks/useExport.ts
git commit -m "feat(dados): add ExportDialog and TemplateDownloadButton"
```

---

### Task 11: DataGrid + BulkActionBar

**Files:**
- Create: `src/domains/dados/components/DataGrid.tsx`
- Create: `src/domains/dados/components/BulkActionBar.tsx`
- Create: `src/domains/dados/hooks/useBulkEdit.ts`

- [ ] **Step 1: Create useBulkEdit hook** — tracks: `editedCells: Map<rowId, Map<column, newValue>>`, `selectedIds: Set<string>`, `isEditMode: boolean`. Provides: `setCellValue`, `toggleSelect`, `selectAll`, `saveAll`, `discardAll`, `applyBulkAction`. Uses `bulkUpdateRows` from service.

- [ ] **Step 2: Create BulkActionBar** — sticky bar that appears when selections > 0 OR edits > 0. Shows count of selected/edited. Buttons: "Alterar campo" (dropdown → field select → value input → apply), "Ativar", "Inativar", "Descartar", "Salvar tudo". Confirmation dialog before apply.

- [ ] **Step 3: Create DataGrid** — table component that accepts `data`, `columns` (from EntityConfig), `entityKey`. Features:
  - Toggle "Modo edição" button
  - Checkbox column when in edit mode
  - Cells become inputs on click (text, number, select, boolean, date per column type)
  - Edited cells get `bg-amber-50 border-amber-300`
  - Invalid cells get `border-red-500` on blur
  - Pagination (50 per page)
  - BulkActionBar integration
  - Navigation warning when pending changes exist (beforeunload)

- [ ] **Step 4: Commit**

```bash
git add src/domains/dados/components/DataGrid.tsx src/domains/dados/components/BulkActionBar.tsx src/domains/dados/hooks/useBulkEdit.ts
git commit -m "feat(dados): add DataGrid editable component with bulk actions"
```

---

## Chunk 4: Pages, Routes, Navigation

### Task 12: EntityCard + DadosHubPage

**Files:**
- Create: `src/domains/dados/components/EntityCard.tsx`
- Create: `src/domains/dados/pages/DadosHubPage.tsx`

- [ ] **Step 1: Create EntityCard** — shadcn/ui Card showing entity name, icon, record count (query), 3 action buttons: Export (↓), Import (↑), Edit (✎). Export opens ExportDialog. Import opens ImportWizard in Dialog. Edit navigates to entity's admin page with `?edit=true` param.

- [ ] **Step 2: Create DadosHubPage** — page layout:
  - Header: "Gestão de Dados" + "Histórico" link button
  - Info banner: recommended import order
  - Grid of EntityCards (4 columns on desktop, 2 on tablet, 1 on mobile)
  - Bottom section: "Últimas operações" table (last 10 import_logs)
  - Uses `getAllEntities()` from registry

- [ ] **Step 3: Commit**

```bash
git add src/domains/dados/components/EntityCard.tsx src/domains/dados/pages/DadosHubPage.tsx
git commit -m "feat(dados): add DadosHubPage with entity cards and recent ops"
```

---

### Task 13: ImportHistoricoPage

**Files:**
- Create: `src/domains/dados/pages/ImportHistoricoPage.tsx`
- Create: `src/domains/dados/hooks/useImportHistory.ts`

- [ ] **Step 1: Create useImportHistory** — TanStack Query hook querying `import_logs` with filters (entity, operation, dateRange), ordered by `created_at DESC`, paginated.

- [ ] **Step 2: Create ImportHistoricoPage** — page with:
  - Filters: entity dropdown, operation dropdown (import/export/bulk_edit), date range
  - Table: date, user, operation, entity, total rows, inserted, updated, errors
  - Expandable row detail showing `error_details` JSON formatted
  - Pagination

- [ ] **Step 3: Commit**

```bash
git add src/domains/dados/pages/ImportHistoricoPage.tsx src/domains/dados/hooks/useImportHistory.ts
git commit -m "feat(dados): add ImportHistoricoPage with filters and pagination"
```

---

### Task 14: Register Routes + Navigation

**Files:**
- Modify: `src/routes/adminRoutes.tsx`
- Modify: `src/shared/constants/navigation.ts`

- [ ] **Step 1: Add routes to adminRoutes.tsx**

Add lazy imports and routes following existing pattern:

```typescript
const DadosHubPage = lazy(() => import("@/domains/dados/pages/DadosHubPage"));
const ImportHistoricoPage = lazy(() => import("@/domains/dados/pages/ImportHistoricoPage"));

// Inside JSX:
<Route path="admin/dados" element={
  <PermissionGuard module="admin" action="ver">
    <LazyPage><DadosHubPage /></LazyPage>
  </PermissionGuard>
} />
<Route path="admin/dados/historico" element={
  <PermissionGuard module="admin" action="ver">
    <LazyPage><ImportHistoricoPage /></LazyPage>
  </PermissionGuard>
} />
```

- [ ] **Step 2: Add to navigation.ts**

In the `ADMINISTRAÇÃO` group, add before 'Relatórios':

```typescript
{ name: 'Gestão de Dados', path: '/admin/dados', icon: 'Database', module: 'admin' },
```

- [ ] **Step 3: Verify build passes**

```bash
npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/adminRoutes.tsx src/shared/constants/navigation.ts
git commit -m "feat(dados): register routes and add navigation item"
```

---

## Chunk 5: Integration + Verification

### Task 15: Import all entity configs (ensure registry loads)

- [ ] **Step 1: Verify entity-registry loads all configs**

Import `getAllEntities()` in DadosHubPage and verify 11 entities are returned. If side-effect imports don't trigger, create an `index.ts` barrel in configs/ that imports all configs.

- [ ] **Step 2: Verify all config columns match Supabase types.ts**

Read `src/integrations/supabase/types.ts` for each entity table and confirm columns exist with correct names. Fix any mismatches.

- [ ] **Step 3: Commit fixes if any**

---

### Task 16: Build Verification + Final Tests

- [ ] **Step 1: Run all existing tests**

```bash
npx vitest run
```

Verify no regressions in the existing 102 tests.

- [ ] **Step 2: Run new tests**

```bash
npx vitest run src/domains/dados/
```

All new tests must pass.

- [ ] **Step 3: Build check**

```bash
npx vite build
```

Must complete without errors.

- [ ] **Step 4: Verify routes work** (manual or via preview tool)

Navigate to `/admin/dados` — should see hub with 11 entity cards.
Navigate to `/admin/dados/historico` — should see empty history page.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(dados): complete bulk data management module — Phase 1"
```

---

## Execution Notes for Sonnet

1. **Check types.ts before creating each config** — column names must match exactly what's in the database. The spec lists expected columns but the DB is the source of truth.

2. **Entity configs are the backbone** — if a config is wrong, everything downstream (validators, templates, export, import) will be wrong. Get these right first.

3. **Existing utilities** — `exportExcel` and `exportCsv` at `src/shared/utils/` are ready to use. Don't recreate them.

4. **Supabase client** — always import from `@/integrations/supabase/client.ts`.

5. **Toasts** — use `showSuccess()` / `showError()` from `@/utils/toast.ts`.

6. **UI patterns** — `rounded-2xl` for cards, `rounded-xl` for inputs, `bg-blue-600 hover:bg-blue-700` for primary buttons. All UI text in PT-BR.

7. **Permissions** — Hub route uses `<PermissionGuard module="admin" action="ver">`. Import buttons check `admin.criar`. Export buttons check `admin.exportar`. Bulk edit checks `admin.editar`.

8. **Complex entities** (Tasks 8-9) need special handling:
   - Clients: parse flattened contact columns, write to `cliente_contatos` table
   - Compositions: 2-step lookup (produto_codigo → produtos → produto_modelos → modelo_id)
   - Contas: lookup client/supplier by cnpj_cpf

9. **Commit frequently** — one commit per task minimum.
