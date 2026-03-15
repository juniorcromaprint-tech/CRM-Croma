// src/domains/estoque/hooks/useMovimentacoes.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";
import { showSuccess, showError } from "@/utils/toast";

export function useMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
  return useQuery({
    queryKey: ["estoque-movimentacoes", filtros],
    queryFn: () => estoqueService.listarMovimentacoes(filtros),
  });
}

export function useCriarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.criarMovimentacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      showSuccess("Movimentação registrada");
    },
    onError: () => showError("Erro ao registrar movimentação"),
  });
}
