// src/domains/qualidade/hooks/useTratativas.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";
import { showSuccess, showError } from "@/utils/toast";

export function useAdicionarTratativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qualidadeService.adicionarTratativa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencia"] });
      showSuccess("Tratativa adicionada");
    },
    onError: () => showError("Erro ao adicionar tratativa"),
  });
}
