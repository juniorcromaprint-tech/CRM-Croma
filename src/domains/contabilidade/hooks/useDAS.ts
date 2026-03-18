import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  calcularDAS,
  salvarDAS,
  fetchDASHistorico,
  marcarDASPago,
} from '../services/das-simples.service';
import { showSuccess, showError } from '@/utils/toast';

export function useDASHistorico(ano?: number) {
  return useQuery({
    queryKey: ['das-historico', ano],
    queryFn: () => fetchDASHistorico(ano),
  });
}

export function useCalcularDAS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (competencia: string) => {
      const calculo = await calcularDAS(competencia);
      return salvarDAS(calculo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das-historico'] });
      showSuccess('DAS calculado com sucesso');
    },
    onError: (err: Error) => showError(`Erro ao calcular DAS: ${err.message}`),
  });
}

export function useMarcarDASPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => marcarDASPago(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das-historico'] });
      showSuccess('DAS marcado como pago');
    },
    onError: (err: Error) => showError(`Erro: ${err.message}`),
  });
}
