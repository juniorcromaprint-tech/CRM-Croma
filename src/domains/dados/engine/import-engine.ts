// src/domains/dados/engine/import-engine.ts
import { z } from 'zod';
import type { ValidationError } from './validators/common';
import type { ParsedRow } from './file-parser';

export interface ValidatedRow {
  [key: string]: unknown;
}

export interface ClassifiedRow extends ValidatedRow {
  _existingId?: string;
}

export interface DuplicatePair {
  key: string;
  rows: number[];
}

/**
 * Validate rows against a Zod schema.
 * Returns valid (transformed) rows and per-row errors.
 */
export function validateRows<T extends z.ZodTypeAny>(
  rows: ParsedRow[],
  schema: T,
): { valid: z.infer<T>[]; errors: ValidationError[] } {
  const valid: z.infer<T>[] = [];
  const errors: ValidationError[] = [];

  rows.forEach((row, rowIndex) => {
    const result = schema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      const firstIssue = result.error.issues[0];
      errors.push({
        row: rowIndex,
        column: firstIssue?.path?.[0]?.toString() ?? 'unknown',
        value: String(row[firstIssue?.path?.[0]?.toString() ?? ''] ?? ''),
        reason: firstIssue?.message ?? 'Erro de validação',
      });
    }
  });

  return { valid, errors };
}

/**
 * Classify validated rows as INSERT, UPDATE, or SKIP.
 * Matches incoming rows against existing DB data using updateKeys.
 */
export function classifyRows(
  validRows: ValidatedRow[],
  existingData: Record<string, unknown>[],
  updateKeys: string[],
): { inserts: ValidatedRow[]; updates: ClassifiedRow[]; skips: ValidatedRow[] } {
  const inserts: ValidatedRow[] = [];
  const updates: ClassifiedRow[] = [];
  const skips: ValidatedRow[] = [];

  // Build lookup maps per key
  const existingMaps = updateKeys.map(key => {
    const map = new Map<string, string>();
    existingData.forEach(record => {
      if (record[key] != null && record.id != null) {
        map.set(String(record[key]).toLowerCase(), String(record.id));
      }
    });
    return { key, map };
  });

  validRows.forEach(row => {
    let existingId: string | undefined;

    for (const { key, map } of existingMaps) {
      if (row[key] != null) {
        const id = map.get(String(row[key]).toLowerCase());
        if (id) {
          existingId = id;
          break;
        }
      }
    }

    if (existingId) {
      updates.push({ ...row, _existingId: existingId });
    } else {
      inserts.push(row);
    }
  });

  return { inserts, updates, skips };
}

/**
 * Detect duplicate rows within the import file itself (not vs DB).
 */
export function detectDuplicates(
  rows: Record<string, unknown>[],
  updateKeys: string[],
): DuplicatePair[] {
  const seen = new Map<string, number[]>();

  rows.forEach((row, idx) => {
    for (const key of updateKeys) {
      if (row[key] != null) {
        const mapKey = `${key}:${String(row[key])}`;
        if (!seen.has(mapKey)) {
          seen.set(mapKey, []);
        }
        seen.get(mapKey)!.push(idx);
      }
    }
  });

  return Array.from(seen.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([key, rows]) => ({ key, rows }));
}
