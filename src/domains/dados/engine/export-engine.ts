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
      if (c.type === 'boolean') return (val as boolean) ? 'Sim' : 'Não';
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
