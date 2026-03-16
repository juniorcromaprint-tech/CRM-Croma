// src/domains/dados/services/import.service.ts
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch existing records for classification, by one or more key fields.
 */
export async function fetchExistingByKeys(
  table: string,
  keyFields: string[],
): Promise<Record<string, unknown>[]> {
  const selectFields = ['id', ...keyFields].join(',');
  const { data, error } = await supabase.from(table).select(selectFields);
  if (error) throw error;
  return data ?? [];
}

/**
 * Apply import — batch upsert inserts + updates.
 * Batches in groups of 100 to avoid payload limits.
 */
export async function applyImport(
  table: string,
  inserts: Record<string, unknown>[],
  updates: Record<string, unknown & { _existingId?: string }>[],
  updateKeys: string[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Process inserts in batches of 100
  const BATCH = 100;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  // Process updates one by one (or batch upsert by id)
  for (const row of updates) {
    const { _existingId, ...data } = row;
    if (!_existingId) continue;
    const { error } = await supabase.from(table).update(data).eq('id', _existingId);
    if (error) errors++;
    else updated++;
  }

  return { inserted, updated, errors };
}

/**
 * Log an import/export/bulk_edit operation to import_logs.
 */
export async function logImport(
  userId: string,
  entity: string,
  operation: 'import' | 'export' | 'bulk_edit',
  filename: string | null,
  results: {
    total_rows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    error_details?: unknown[];
  },
) {
  await supabase.from('import_logs').insert({
    user_id: userId,
    entity,
    operation,
    filename,
    ...results,
    error_details: results.error_details ?? [],
  });
}
