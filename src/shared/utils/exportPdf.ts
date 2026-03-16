// ============================================================================
// EXPORT PDF — Croma Print ERP/CRM
// Utilitário para exportar dados como arquivo .pdf via html2pdf.js
// ============================================================================

interface ExportPdfOptions {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

function buildTableHtml(
  title: string,
  subtitle: string | undefined,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerCells = headers
    .map(
      h =>
        `<th style="border:1px solid #ddd;padding:6px 8px;background:#f1f5f9;font-size:11px;text-align:left">${h}</th>`
    )
    .join('');
  const bodyRows = rows
    .map(row => {
      const cells = row
        .map(
          cell =>
            `<td style="border:1px solid #eee;padding:4px 8px;font-size:10px">${cell ?? ''}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;padding:20px">
      <h1 style="font-size:18px;margin:0 0 4px">${title}</h1>
      ${subtitle ? `<p style="font-size:12px;color:#666;margin:0 0 12px">${subtitle}</p>` : ''}
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p style="font-size:9px;color:#999;margin-top:12px">Gerado por Croma ERP em ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  `;
}

export async function exportPdf({
  filename,
  title,
  subtitle,
  headers,
  rows,
}: ExportPdfOptions): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = buildTableHtml(title, subtitle, headers, rows);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `${filename}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait',
      },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}
