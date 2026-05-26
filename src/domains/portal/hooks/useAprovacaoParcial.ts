// src/domains/portal/hooks/useAprovacaoParcial.ts
//
// State hook para aprovacao parcial de itens no portal.
// - mantem estado local otimista (Map<itemId, true | false | null>)
// - sincroniza com backend via RPC portal_aprovar_item
// - rollback em caso de erro

import { useCallback, useMemo, useState } from 'react';
import { aprovarItem, type AprovarItemResult, type PortalItem } from '../services/portal.service';

export type AprovacaoState = boolean | null; // true=aprovado, false=recusado, null=pendente

interface UseAprovacaoParcialOpts {
  token: string;
  itensIniciais: PortalItem[];
  onStatusChange?: (novoStatus: string, info: AprovarItemResult) => void;
  onErro?: (err: Error, itemId: string) => void;
}

interface UseAprovacaoParcialReturn {
  estados: Map<string, AprovacaoState>;
  loading: Set<string>;
  setItem: (itemId: string, aprovado: AprovacaoState) => Promise<void>;
  aprovarTodos: () => Promise<void>;
  recusarTodos: () => Promise<void>;
  resumo: {
    total: number;
    aprovados: number;
    recusados: number;
    pendentes: number;
  };
}

export function useAprovacaoParcial({
  token,
  itensIniciais,
  onStatusChange,
  onErro,
}: UseAprovacaoParcialOpts): UseAprovacaoParcialReturn {
  // Inicializa o map a partir dos itens vindos da RPC portal_get_proposta
  const [estados, setEstados] = useState<Map<string, AprovacaoState>>(() => {
    const m = new Map<string, AprovacaoState>();
    for (const it of itensIniciais) {
      // so itens visiveis entram (espelha PortalItemList)
      if (it.item_visivel === false) continue;
      m.set(it.id, (it.aprovado ?? null) as AprovacaoState);
    }
    return m;
  });

  const [loading, setLoading] = useState<Set<string>>(() => new Set());

  const setItem = useCallback(
    async (itemId: string, aprovado: AprovacaoState) => {
      // Rollback target
      const anterior = estados.get(itemId) ?? null;

      // Optimistic update
      setEstados((prev) => {
        const next = new Map(prev);
        next.set(itemId, aprovado);
        return next;
      });
      setLoading((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });

      try {
        // RPC so aceita boolean — se for null nao chamamos (UI nao expoe esse caminho)
        if (aprovado === null) return;
        const result = await aprovarItem(token, itemId, aprovado);
        if (result?.novo_status) onStatusChange?.(result.novo_status, result);
      } catch (err) {
        // Rollback
        setEstados((prev) => {
          const next = new Map(prev);
          next.set(itemId, anterior);
          return next;
        });
        onErro?.(err as Error, itemId);
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [estados, token, onStatusChange, onErro],
  );

  const aprovarTodos = useCallback(async () => {
    // Roda em sequencia pra o backend recalcular status consistente no final
    for (const id of estados.keys()) {
      await setItem(id, true);
    }
  }, [estados, setItem]);

  const recusarTodos = useCallback(async () => {
    for (const id of estados.keys()) {
      await setItem(id, false);
    }
  }, [estados, setItem]);

  const resumo = useMemo(() => {
    let aprovados = 0;
    let recusados = 0;
    let pendentes = 0;
    for (const v of estados.values()) {
      if (v === true) aprovados++;
      else if (v === false) recusados++;
      else pendentes++;
    }
    return {
      total: estados.size,
      aprovados,
      recusados,
      pendentes,
    };
  }, [estados]);

  return { estados, loading, setItem, aprovarTodos, recusarTodos, resumo };
}
