// src/domains/estoque/hooks/useInventario.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";
import { showSuccess, showError } from "@/utils/toast";

export function useInventarios() {
  return useQuery({
    queryKey: ["inventarios"],
    queryFn: () => estoqueService.listarInventarios(),
  });
}

export function useInventario(id: string) {
  return useQuery({
    queryKey: ["inventario", id],
    queryFn: () => estoqueService.buscarInventario(id),
    enabled: !!id,
  });
}

export function useCriarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.criarInventario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      showSuccess("Inventário criado com saldos atuais");
    },
    onError: () => showError("Erro ao criar inventário"),
  });
}

export function useAtualizarItemInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantidade_contada, justificativa }: { id: string; quantidade_contada: number; justificativa?: string }) =>
      estoqueService.atualizarItemInventario(id, quantidade_contada, justificativa),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario"] });
      showSuccess("Contagem atualizada");
    },
    onError: () => showError("Erro ao atualizar contagem"),
  });
}

export function useFinalizarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.finalizarInventario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      showSuccess("Inventário finalizado");
    },
    onError: () => showError("Erro ao finalizar inventário"),
  });
}
