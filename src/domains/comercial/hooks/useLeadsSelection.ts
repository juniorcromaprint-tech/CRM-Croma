// src/domains/comercial/hooks/useLeadsSelection.ts
// Gerencia seleção múltipla de leads (Set de IDs).
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.5
//
// v2 (2026-05-11): persistência em sessionStorage e estado por lead.id —
// a cesta sobrevive a mudança de filtro, busca, paginação e reload.

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'leads-cesta-selection';

function readInitialIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v: unknown): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function persistIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    if (ids.size === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // sessionStorage pode estar bloqueado (modo privado, quota); ignora
  }
}

export function useLeadsSelection() {
  const [ids, setIds] = useState<Set<string>>(() => readInitialIds());

  // Persiste a cada mudança
  useEffect(() => {
    persistIds(ids);
  }, [ids]);

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
