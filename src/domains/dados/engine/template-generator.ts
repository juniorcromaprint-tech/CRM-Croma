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
