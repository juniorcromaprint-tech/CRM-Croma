// src/domains/comercial/hooks/useLeadsSelection.ts
// Gerencia seleção múltipla de leads (Set de IDs).
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.5

import { useState, useCallback } from 'react';

export function useLeadsSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((newIds: string[]) => {
    setIds(prev => new Set([...prev, ...newIds]));
  }, []);

  const deselectMany = useCallback((removeIds: string[]) => {
    setIds(prev => {
      const next = new Set(prev);
      removeIds.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const isAllSelected = useCallback(
    (allIds: string[]) => allIds.length > 0 && allIds.every(id => ids.has(id)),
    [ids]
  );

  const isPartialSelected = useCallback(
    (allIds: string[]) => allIds.some(id => ids.has(id)) && !allIds.every(id => ids.has(id)),
    [ids]
  );

  const toggleAll = useCallback((allIds: string[]) => {
    const allSelected = allIds.length > 0 && allIds.every(id => ids.has(id));
    if (allSelected) {
      deselectMany(allIds);
    } else {
      selectMany(allIds);
    }
  }, [ids, selectMany, deselectMany]);

  return {
    ids,
    toggle,
    selectMany,
    deselectMany,
    toggleAll,
    clear,
    has,
    isAllSelected,
    isPartialSelected,
    count: ids.size,
    toArray: () => [...ids],
  };
}
