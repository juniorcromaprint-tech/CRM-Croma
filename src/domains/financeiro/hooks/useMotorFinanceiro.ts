import { useQuery } from '@tanstack/react-query';
import { listarFluxoCaixaProjetado, saldoRealizado } from '../services/fluxo-caixa.service';
import { listarAgingPorCliente, calcularResumoAging } from '../services/aging.service';
import { calcularDRE } from '../services/dre-real.service';
import { listarInadimplentes, clienteInadimplente } from '../services/inadimplencia.service';

const STALE_5_MIN = 5 * 60 * 1000;

export const MOTOR_FIN_KEYS = {
  fluxoCaixa: (dias: number) => ['motor-fin', 'fluxo-caixa', dias] as const,
  saldoRealizado: ['motor-fin', 'saldo-realizado'] as const,
  aging: ['motor-fin', 'aging'] as const,
  agingResumo: ['motor-fin', 'aging-resumo'] as const,
  dre: (inicio: string, fim: string) => ['motor-fin', 'dre', inicio, fim] as const,
  inadimplentes: ['motor-fin', 'inadimplentes'] as const,
  clienteInadimplente: (id: string) => ['motor-fin', 'inadimplente', id] as const,
};

export function useFluxoCaixa(dias = 90) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.fluxoCaixa(dias),
    queryFn: () => listarFluxoCaixaProjetado(dias),
    staleTime: STALE_5_MIN,
  });
}

export function useSaldoRealizado() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.saldoRealizado,
    queryFn: () => saldoRealizado(),
    staleTime: STALE_5_MIN,
  });
}

export function useAging() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.aging,
    queryFn: () => listarAgingPorCliente(),
    staleTime: STALE_5_MIN,
  });
}

export function useAgingResumo() {
  const { data: agingData } = useAging();

  return useQuery({
    queryKey: MOTOR_FIN_KEYS.agingResumo,
    queryFn: () => calcularResumoAging(agingData!),
    enabled: !!agingData,
    staleTime: STALE_5_MIN,
  });
}

export function useDREReal(dataInicio: string | null, dataFim: string | null) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.dre(dataInicio ?? '', dataFim ?? ''),
    queryFn: () => calcularDRE(dataInicio!, dataFim!),
    enabled: !!dataInicio && !!dataFim,
    staleTime: STALE_5_MIN,
  });
}

export function useInadimplentes() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.inadimplentes,
    queryFn: () => listarInadimplentes(),
    staleTime: STALE_5_MIN,
  });
}

export function useClienteInadimplente(clienteId: string | null) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.clienteInadimplente(clienteId ?? ''),
    queryFn: () => clienteInadimplente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE_5_MIN,
  });
}
