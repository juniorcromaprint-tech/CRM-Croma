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
