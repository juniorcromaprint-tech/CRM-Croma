// src/domains/qualidade/hooks/useOcorrencias.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";
import { showSuccess, showError } from "@/utils/toast";

export function useOcorrencias(filtros?: { status?: string; prioridade?: string; tipo?: string }) {
  return useQuery({
    queryKey: ["ocorrencias", filtros],
    queryFn: () => qualidadeService.listarOcorrencias(filtros),
  });
}

export function useOcorrencia(id: string) {
  return useQuery({
    queryKey: ["ocorrencia", id],
    queryFn: () => qualidadeService.buscarOcorrencia(id),
    enabled: !!id,
  });
}

export function useCriarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qualidadeService.criarOcorrencia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      qc.invalidateQueries({ queryKey: ["qualidade-kpis"] });
      showSuccess("Ocorrência registrada");
    },
    onError: () => showError("Erro ao registrar ocorrência"),
  });
}

export function useAtualizarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Record<string, any> }) =>
      qualidadeService.atualizarOcorrencia(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      qc.invalidateQueries({ queryKey: ["ocorrencia"] });
      qc.invalidateQueries({ queryKey: ["qualidade-kpis"] });
      showSuccess("Ocorrência atualizada");
    },
    onError: () => showError("Erro ao atualizar ocorrência"),
  });
}
