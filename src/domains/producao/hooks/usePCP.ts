import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarSetores,
  listarOpsAtivas,
  listarCapacidadeSetores,
  calcularKpis,
  moverOpParaSetor,
  atualizarStatusOp,
  listarOpsAgendadasMaquina,
  listarUtilizacaoMaquinas,
} from '../services/pcp.service';
import {
  iniciarEtapa,
  pausarEtapa,
  concluirEtapa,
  apontamentoAberto,
} from '../services/apontamento.service';
import { showSuccess, showError } from '@/utils/toast';

// ─── Query Keys ────────────────────────────────────────────────────────────────
export const PCP_KEYS = {
  setores: ['pcp', 'setores'] as const,
  ops: ['pcp', 'ops-ativas'] as const,
  capacidade: ['pcp', 'capacidade'] as const,
  kpis: ['pcp', 'kpis'] as const,
  opsAgendadas: ['pcp', 'ops-agendadas-maquina'] as const,
  utilizacaoMaquinas: ['pcp', 'utilizacao-maquinas'] as const,
  apontamentoAberto: (etapaId: string) => ['pcp', 'apontamento-aberto', etapaId] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────────
export function useSetores() {
  return useQuery({
    queryKey: PCP_KEYS.setores,
    queryFn: listarSetores,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOpsAtivas() {
  return useQuery({
    queryKey: PCP_KEYS.ops,
    queryFn: listarOpsAtivas,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // atualiza a cada 1 min
  });
}

export function useCapacidadeSetores() {
  return useQuery({
    queryKey: PCP_KEYS.capacidade,
    queryFn: listarCapacidadeSetores,
    staleTime: 60 * 1000,
  });
}

export function usePCPKpis() {
  return useQuery({
    queryKey: PCP_KEYS.kpis,
    queryFn: calcularKpis,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useApontamentoAberto(etapaId: string | undefined) {
  return useQuery({
    queryKey: PCP_KEYS.apontamentoAberto(etapaId ?? ''),
    queryFn: () => apontamentoAberto(etapaId!),
    enabled: !!etapaId,
    staleTime: 0, // sempre revalida — estado em tempo real
    refetchInterval: 15 * 1000,
  });
}

export function useOpsAgendadasMaquina() {
  return useQuery({
    queryKey: PCP_KEYS.opsAgendadas,
    queryFn: listarOpsAgendadasMaquina,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useUtilizacaoMaquinas() {
  return useQuery({
    queryKey: PCP_KEYS.utilizacaoMaquinas,
    queryFn: listarUtilizacaoMaquinas,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────
export function useMoverOpParaSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ opId, setorId }: { opId: string; setorId: string | null }) =>
      moverOpParaSetor(opId, setorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PCP_KEYS.ops });
      qc.invalidateQueries({ queryKey: PCP_KEYS.capacidade });
      qc.invalidateQueries({ queryKey: PCP_KEYS.kpis });
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useAtualizarStatusOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ opId, status }: { opId: string; status: string }) =>
      atualizarStatusOp(opId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PCP_KEYS.ops });
      qc.invalidateQueries({ queryKey: PCP_KEYS.kpis });
      showSuccess('Status da OP atualizado');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useIniciarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ etapaId, opId }: { etapaId: string; opId: string }) =>
      iniciarEtapa(etapaId, opId),
    onSuccess: (_data, { etapaId }) => {
      qc.invalidateQueries({ queryKey: PCP_KEYS.apontamentoAberto(etapaId) });
      qc.invalidateQueries({ queryKey: PCP_KEYS.ops });
      showSuccess('Produção iniciada');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function usePausarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apontamentoId }: { apontamentoId: string }) =>
      pausarEtapa(apontamentoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pcp', 'apontamento-aberto'] });
      showSuccess('Produção pausada');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useConcluirEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      etapaId,
      apontamentoId,
      observacoes,
    }: {
      etapaId: string;
      apontamentoId: string | null;
      observacoes?: string;
    }) => concluirEtapa(etapaId, apontamentoId, observacoes),
    onSuccess: (_data, { etapaId }) => {
      qc.invalidateQueries({ queryKey: PCP_KEYS.apontamentoAberto(etapaId) });
      qc.invalidateQueries({ queryKey: PCP_KEYS.ops });
      qc.invalidateQueries({ queryKey: PCP_KEYS.kpis });
      showSuccess('Etapa concluída!');
    },
    onError: (e: Error) => showError(e.message),
  });
}
