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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.replace(/\*$/, '').trim(), String(v ?? '')])
    )
  );
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
  if (knownColumns.length === 0) return 0;
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
