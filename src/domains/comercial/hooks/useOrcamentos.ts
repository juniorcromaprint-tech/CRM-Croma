import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  orcamentoService,
  type OrcamentoFiltros,
  type OrcamentoCreateInput,
  type OrcamentoItemCreateInput,
  type OrcamentoItemCreateDetalhado,
  type OrcamentoServicoCreateInput,
} from "../services/orcamento.service";
import { showSuccess, showError } from "@/utils/toast";

export const ORCAMENTOS_QUERY_KEY = "orcamentos";

// ─── Lista de orçamentos ─────────────────────────────────────────────────────

export function useOrcamentos(filtros?: OrcamentoFiltros) {
  return useQuery({
    queryKey: [ORCAMENTOS_QUERY_KEY, filtros],
    queryFn: () => orcamentoService.listar(filtros),
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Orçamento por ID ────────────────────────────────────────────────────────

export function useOrcamento(id: string | undefined) {
  return useQuery({
    queryKey: [ORCAMENTOS_QUERY_KEY, id],
    queryFn: () => orcamentoService.buscarPorId(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 1,
  });
}

// ─── Criar orçamento ─────────────────────────────────────────────────────────

export function useCriarOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OrcamentoCreateInput) => orcamentoService.criar(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      showSuccess("Orçamento criado com sucesso!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao criar orçamento"),
  });
}

// ─── Atualizar orçamento ─────────────────────────────────────────────────────

export function useAtualizarOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof orcamentoService.atualizar>[1] }) =>
      orcamentoService.atualizar(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, id] });
      showSuccess("Orçamento atualizado!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao atualizar orçamento"),
  });
}

// ─── Excluir orçamento ───────────────────────────────────────────────────────

export function useExcluirOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId?: string }) =>
      orcamentoService.excluir(id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      showSuccess("Orçamento excluído!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao excluir orçamento"),
  });
}

// ─── Adicionar item ──────────────────────────────────────────────────────────

export function useAdicionarItemOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propostaId, item }: { propostaId: string; item: OrcamentoItemCreateInput }) =>
      orcamentoService.adicionarItem(propostaId, item),
    onSuccess: (_data, { propostaId }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
    },
    onError: (err: Error) => showError(err.message || "Erro ao adicionar item"),
  });
}

// ─── Adicionar item detalhado (com materiais + acabamentos) ──────────────────

export function useAdicionarItemDetalhado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propostaId, item }: { propostaId: string; item: OrcamentoItemCreateDetalhado }) => {
      const result = await orcamentoService.adicionarItemDetalhado(propostaId, item);
      await orcamentoService.recalcularTotais(propostaId);
      return result;
    },
    onSuccess: (_data, { propostaId }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      showSuccess("Item adicionado com sucesso!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao adicionar item"),
  });
}

// ─── Salvar serviços do orçamento ────────────────────────────────────────────

export function useSalvarServicos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propostaId, servicos }: { propostaId: string; servicos: OrcamentoServicoCreateInput[] }) => {
      await orcamentoService.salvarServicos(propostaId, servicos);
      await orcamentoService.recalcularTotais(propostaId);
    },
    onSuccess: (_data, { propostaId }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
    },
    onError: (err: Error) => showError(err.message || "Erro ao salvar serviços"),
  });
}

// ─── Remover item ────────────────────────────────────────────────────────────

export function useRemoverItemOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, propostaId }: { itemId: string; propostaId: string }) => {
      await orcamentoService.removerItem(itemId);
      await orcamentoService.recalcularTotais(propostaId);
    },
    onSuccess: (_data, { propostaId }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
    },
    onError: (err: Error) => showError(err.message || "Erro ao remover item"),
  });
}

// ─── Duplicar orçamento ──────────────────────────────────────────────────────

export function useDuplicarOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orcamentoService.duplicar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      showSuccess("Orçamento duplicado com sucesso!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao duplicar orçamento"),
  });
}

// ─── Converter para pedido ───────────────────────────────────────────────────

export function useConverterParaPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orcamentoId: string) => orcamentoService.converterParaPedido(orcamentoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      showSuccess("Orçamento convertido em pedido!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao converter em pedido"),
  });
}
