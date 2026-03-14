// ============================================================================
// EXPORT EXCEL — Croma Print ERP/CRM
// Utilitário para exportar dados como arquivo .xlsx
// ============================================================================

import * as XLSX from 'xlsx';

interface ExportExcelOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export function exportExcel({
  filename,
  sheetName = 'Relatório',
  headers,
  rows,
}: ExportExcelOptions): void {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-width columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
