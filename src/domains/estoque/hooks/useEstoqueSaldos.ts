// src/domains/estoque/hooks/useEstoqueSaldos.ts

import { useQuery } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";

export const ESTOQUE_KEYS = {
  saldos: (filtros?: object) => ["estoque-saldos", filtros] as const,
  saldosView: (filtros?: object) => ["estoque-saldos-view", filtros] as const,
  semaforo: (filtros?: object) => ["estoque-semaforo", filtros] as const,
  alertas: ["estoque-alertas"] as const,
  movimentacoes: (filtros?: object) => ["estoque-movimentacoes", filtros] as const,
  reservas: (opId?: string) => ["estoque-reservas", opId] as const,
};

export function useEstoqueSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
  return useQuery({
    queryKey: ESTOQUE_KEYS.saldos(filtros),
    queryFn: () => estoqueService.listarSaldos(filtros),
  });
}

export function useEstoqueSaldosView(filtros?: { busca?: string }) {
  return useQuery({
    queryKey: ESTOQUE_KEYS.saldosView(filtros),
    queryFn: () => estoqueService.listarSaldosView(filtros),
  });
}

export function useEstoqueSemaforo(filtros?: { busca?: string; semaforo?: string }) {
  return useQuery({
    queryKey: ESTOQUE_KEYS.semaforo(filtros),
    queryFn: () => estoqueService.listarSemaforo(filtros),
  });
}

export function useAlertasEstoqueMinimo() {
  return useQuery({
    queryKey: ESTOQUE_KEYS.alertas,
    queryFn: () => estoqueService.alertasSemaforo(),
    refetchInterval: 5 * 60 * 1000,
  });
}
