// ============================================================================
// EXPORT CSV — Croma Print ERP/CRM
// Utilitário para exportar dados como arquivo CSV UTF-8 BOM
// ============================================================================

/**
 * Exports data as a UTF-8 BOM CSV file download.
 * @param filename - File name without extension
 * @param headers - Column headers
 * @param rows - Array of row arrays (values will be stringified)
 */
export function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const BOM = '\uFEFF'
  const csvContent = [
    headers.join(';'),
    ...rows.map(row =>
      row.map(cell => {
        const str = cell == null ? '' : String(cell)
        // Wrap in quotes if contains semicolons, quotes, or newlines
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(';')
    ),
  ].join('\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
