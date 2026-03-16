// src/domains/dados/hooks/useImport.ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { parseFile } from '../engine/file-parser';
import { validateRows, classifyRows, detectDuplicates } from '../engine/import-engine';
import { fetchExistingByKeys, applyImport, logImport } from '../services/import.service';
import { getEntity } from '../configs/entity-registry';
import { showSuccess, showError } from '@/utils/toast';
import type { ValidationError } from '../engine/validators/common';
import type { ValidatedRow, ClassifiedRow } from '../engine/import-engine';

export type ImportStep = 1 | 2 | 3 | 4;

interface ImportState {
  step: ImportStep;
  file: File | null;
  headers: string[];
  rawRows: Record<string, string>[];
  validRows: ValidatedRow[];
  validationErrors: ValidationError[];
  inserts: ValidatedRow[];
  updates: ClassifiedRow[];
  duplicates: { key: string; rows: number[] }[];
  isProcessing: boolean;
}

const initialState: ImportState = {
  step: 1,
  file: null,
  headers: [],
  rawRows: [],
  validRows: [],
  validationErrors: [],
  inserts: [],
  updates: [],
  duplicates: [],
  isProcessing: false,
};

export function useImport(entityKey: string) {
  const [state, setState] = useState<ImportState>(initialState);
  const { user } = useAuth();

  const entity = getEntity(entityKey);

  const setFile = async (file: File) => {
    if (!entity) return;
    setState(s => ({ ...s, file, isProcessing: true }));

    try {
      const knownColumns = entity.columns.map(c => c.key);
      const { headers, rows } = await parseFile(file, knownColumns);
      setState(s => ({ ...s, headers, rawRows: rows, step: 2, isProcessing: false }));
    } catch {
      showError('Erro ao ler arquivo');
      setState(s => ({ ...s, isProcessing: false }));
    }
  };

  const runValidation = async (schemaModule: Record<string, unknown>) => {
    if (!entity) return;
    setState(s => ({ ...s, isProcessing: true }));

    // Get schema from module (schema name is entityKeyImportSchema in camelCase)
    const schemaKey = `${entityKey.replace(/-./g, c => c[1].toUpperCase())}ImportSchema`;
    const schema = schemaModule[schemaKey];
    if (!schema) {
      showError(`Schema não encontrado: ${schemaKey}`);
      setState(s => ({ ...s, isProcessing: false }));
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { valid, errors } = validateRows(state.rawRows, schema as any);
    const updateKeysSingle = entity.updateKeys.filter(k => !k.includes('+'));
    const dupes = detectDuplicates(state.rawRows, updateKeysSingle);

    // Fetch existing for classification
    const existingData = await fetchExistingByKeys(entity.table, updateKeysSingle);
    const { inserts, updates } = classifyRows(valid, existingData, updateKeysSingle);

    setState(s => ({
      ...s,
      validRows: valid,
      validationErrors: errors,
      inserts,
      updates,
      duplicates: dupes,
      step: errors.length > 0 ? 2 : 3,
      isProcessing: false,
    }));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error('Entidade não encontrada');
      const result = await applyImport(entity.table, state.inserts, state.updates, entity.updateKeys);
      await logImport(
        user!.id,
        entityKey,
        'import',
        state.file?.name ?? null,
        {
          total_rows: state.rawRows.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: 0,
          errors: result.errors,
          error_details: state.validationErrors,
        },
      );
      return result;
    },
    onSuccess: (result) => {
      showSuccess(`Importação concluída: ${result.inserted} inseridos, ${result.updated} atualizados`);
      setState(s => ({ ...s, step: 4 }));
    },
    onError: () => {
      showError('Erro ao importar dados');
    },
  });

  const reset = () => setState(initialState);

  return {
    ...state,
    entity,
    setFile,
    runValidation,
    importMutation,
    reset,
  };
}
