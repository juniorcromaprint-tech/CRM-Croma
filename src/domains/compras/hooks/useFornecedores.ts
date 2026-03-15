// src/domains/compras/hooks/useFornecedores.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comprasService } from "../services/comprasService";
import { showSuccess, showError } from "@/utils/toast";

export function useFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
  return useQuery({
    queryKey: ["fornecedores", filtros],
    queryFn: () => comprasService.listarFornecedores(filtros),
  });
}

export function useCriarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: comprasService.criarFornecedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor cadastrado");
    },
    onError: () => showError("Erro ao cadastrar fornecedor"),
  });
}

export function useAtualizarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Record<string, any> }) =>
      comprasService.atualizarFornecedor(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor atualizado");
    },
    onError: () => showError("Erro ao atualizar fornecedor"),
  });
}

export function useExcluirFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: comprasService.excluirFornecedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor excluído");
    },
    onError: () => showError("Erro ao excluir fornecedor"),
  });
}
