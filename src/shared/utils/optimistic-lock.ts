import { supabase } from '@/integrations/supabase/client';

/**
 * Error thrown when an optimistic lock conflict is detected.
 * This means another user updated the record between when you loaded it and when you tried to save.
 */
export class OptimisticLockError extends Error {
  constructor(table: string) {
    super(
      `Este registro foi alterado por outro usuário. Recarregue a página e tente novamente.`
    );
    this.name = 'OptimisticLockError';
  }
}

/**
 * Updates a record only if its version matches currentVersion.
 * If the version has changed (another user saved first), throws OptimisticLockError.
 *
 * The version is auto-incremented by a DB trigger on every update.
 *
 * @param table - Supabase table name
 * @param id - Record UUID
 * @param updates - Fields to update (should NOT include version)
 * @param currentVersion - The version number you loaded the record with
 * @returns The updated record (with new version)
 * @throws OptimisticLockError if the record was modified by someone else
 */
export async function updateWithLock<T extends Record<string, unknown>>(
  table: string,
  id: string,
  updates: Partial<T>,
  currentVersion: number
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .eq('version', currentVersion)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // No row matched — either ID doesn't exist or version mismatch
    throw new OptimisticLockError(table);
  }

  return data as T;
}
