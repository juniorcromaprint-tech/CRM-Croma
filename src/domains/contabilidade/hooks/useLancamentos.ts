import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLancamentos,
  createLancamento,
  fetchContasAnaliticas,
  fetchBalancete,
  fetchRazaoConta,
} from '../services/lancamento.service';
import type { OrigemTipo } from '../types/contabilidade.types';
import { showSuccess, showError } from '@/utils/toast';

export function useLancamentos(filters: {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  origemTipo?: OrigemTipo;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: ['lancamentos', filters],
    queryFn: () => fetchLancamentos(filters),
  });
}

export function useContasAnaliticas() {
  return useQuery({
    queryKey: ['contas-analiticas'],
    queryFn: fetchContasAnaliticas,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useCreateLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLancamento,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['balancete'] });
      showSuccess('Lançamento criado com sucesso');
    },
    onError: (err: Error) => showError(`Erro ao criar lançamento: ${err.message}`),
  });
}

export function useBalancete(dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['balancete', dataInicio, dataFim],
    queryFn: () => fetchBalancete(dataInicio, dataFim),
  });
}

export function useRazaoConta(contaId: string, dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['razao', contaId, dataInicio, dataFim],
    queryFn: () => fetchRazaoConta(contaId, dataInicio, dataFim),
    enabled: !!contaId,
  });
}
