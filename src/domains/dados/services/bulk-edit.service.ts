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
