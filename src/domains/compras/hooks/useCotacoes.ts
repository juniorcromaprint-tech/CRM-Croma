// src/domains/compras/hooks/useCotacoes.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cotacoesService } from "../services/cotacoesService";
import { showSuccess, showError } from "@/utils/toast";

export function useSolicitacoesCompra(filtros?: { status?: string }) {
  return useQuery({
    queryKey: ["solicitacoes-compra", filtros],
    queryFn: () => cotacoesService.listarSolicitacoes(filtros),
  });
}

export function useCotacoesPorSolicitacao(solicitacaoId: string) {
  return useQuery({
    queryKey: ["cotacoes-compra", solicitacaoId],
    queryFn: () => cotacoesService.listarCotacoes(solicitacaoId),
    enabled: !!solicitacaoId,
  });
}

export function useCriarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cotacoesService.criarSolicitacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacoes-compra"] });
      showSuccess("Solicitação de cotação criada");
    },
    onError: () => showError("Erro ao criar solicitação"),
  });
}

export function useCriarCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cotacoesService.criarCotacao,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cotacoes-compra"] });
      qc.invalidateQueries({ queryKey: ["solicitacoes-compra"] });
      showSuccess("Cotação registrada");
    },
    onError: () => showError("Erro ao registrar cotação"),
  });
}

export function useSelecionarCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotacaoId, solicitacaoId }: { cotacaoId: string; solicitacaoId: string }) =>
      cotacoesService.selecionarCotacao(cotacaoId, solicitacaoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacoes-compra"] });
      qc.invalidateQueries({ queryKey: ["solicitacoes-compra"] });
      showSuccess("Cotação selecionada como vencedora");
    },
    onError: () => showError("Erro ao selecionar cotação"),
  });
}

export function useAtualizarStatusSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      cotacoesService.atualizarStatusSolicitacao(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacoes-compra"] });
      showSuccess("Status atualizado");
    },
    onError: () => showError("Erro ao atualizar status"),
  });
}
