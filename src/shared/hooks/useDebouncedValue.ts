// src/shared/hooks/useDebouncedValue.ts
// Hook genérico para debounce de valores reativos.
// Uso típico: evitar refetch a cada keystroke em campos de busca.

import { useEffect, useState } from 'react';

/**
 * Retorna `value` com atraso de `delayMs` (default 300ms).
 *
 * @example
 *   const [busca, setBusca] = useState('');
 *   const buscaDebounced = useDebouncedValue(busca, 300);
 *   useQuery(['leads', buscaDebounced], ...);
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
