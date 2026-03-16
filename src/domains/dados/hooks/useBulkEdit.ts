import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkUpdateField, bulkUpdateRows } from '../services/bulk-edit.service';
import { showSuccess, showError } from '@/utils/toast';

interface PendingChange {
  field: string;
  value: unknown;
}

export function useBulkEdit(table: string, queryKey: string[]) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // editedCells: Map<rowId, Map<column, newValue>>
  const [editedCells, setEditedCells] = useState<Map<string, Map<string, unknown>>>(new Map());
  const queryClient = useQueryClient();

  const setCellValue = useCallback((rowId: string, column: string, value: unknown) => {
    setEditedCells(prev => {
      const next = new Map(prev);
      if (!next.has(rowId)) next.set(rowId, new Map());
      next.get(rowId)!.set(column, value);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const discardAll = useCallback(() => {
    setEditedCells(new Map());
    setSelectedIds(new Set());
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changes = Array.from(editedCells.entries()).map(([id, fields]) => ({
        id,
        updates: Object.fromEntries(fields.entries()),
      }));
      return bulkUpdateRows(table, changes);
    },
    onSuccess: (result) => {
      showSuccess(`${result.updated} registros atualizados`);
      setEditedCells(new Map());
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => showError('Erro ao salvar alterações'),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ field, value }: PendingChange) => {
      return bulkUpdateField({ table, ids: Array.from(selectedIds), field, value });
    },
    onSuccess: () => {
      showSuccess(`${selectedIds.size} registros atualizados`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => showError('Erro ao aplicar ação em massa'),
  });

  return {
    isEditMode,
    setIsEditMode,
    selectedIds,
    editedCells,
    setCellValue,
    toggleSelect,
    selectAll,
    clearSelection,
    discardAll,
    saveAll: () => saveMutation.mutate(),
    applyBulkAction: (field: string, value: unknown) => bulkActionMutation.mutate({ field, value }),
    isSaving: saveMutation.isPending,
    isApplying: bulkActionMutation.isPending,
    hasEdits: editedCells.size > 0,
    selectedCount: selectedIds.size,
  };
}
