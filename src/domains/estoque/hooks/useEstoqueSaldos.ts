// src/domains/estoque/hooks/useEstoqueSaldos.ts

import { useQuery } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";

export function useEstoqueSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
  return useQuery({
    queryKey: ["estoque-saldos", filtros],
    queryFn: () => estoqueService.listarSaldos(filtros),
  });
}

export function useAlertasEstoqueMinimo() {
  return useQuery({
    queryKey: ["estoque-alertas"],
    queryFn: () => estoqueService.alertasEstoqueMinimo(),
    refetchInterval: 5 * 60 * 1000, // 5 min
  });
}
