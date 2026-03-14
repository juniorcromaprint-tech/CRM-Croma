import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a date as "yyyy-MM-dd" anchored to America/Sao_Paulo timezone.
 * Using Intl.DateTimeFormat ensures correctness regardless of the browser/OS
 * timezone setting — critical for users in UTC-3 (Brazil Standard Time) or
 * UTC-2 (Brasília Summer Time).
 */
function localDateStr(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContaReceberStatus =
  | 'previsto'
  | 'faturado'
  | 'a_vencer'
  | 'vencido'
  | 'parcial'
  | 'pago'
  | 'cancelado';

export interface ContaReceber {
  id: string;
  pedido_id: string | null;
  cliente_id: string;
  numero_titulo: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaReceberStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  // joins
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  pedidos?: { numero: string | null } | null;
}

export interface ContaReceberCreate {
  pedido_id?: string | null;
  cliente_id: string;
  numero_titulo?: string | null;
  valor_original: number;
  data_vencimento: string;
  status?: ContaReceberStatus;
  forma_pagamento?: string | null;
  observacoes?: string | null;
}

export interface ContaReceberUpdate extends Partial<ContaReceberCreate> {
  id: string;
  valor_pago?: number;
  data_pagamento?: string | null;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const CR_KEY = ['financeiro', 'contas_receber'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista contas a receber com filtros.
 */
export function useContasReceber(opts?: { status?: ContaReceberStatus; cliente_id?: string }) {
  return useQuery({
    queryKey: [...CR_KEY, opts],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ContaReceber[]> => {
      let query = supabase
        .from('contas_receber')
        .select('*, clientes(nome_fantasia, razao_social), pedidos(numero)')
        .is('excluido_em', null)
        .order('data_vencimento', { ascending: true });

      if (opts?.status) query = query.eq('status', opts.status);
      if (opts?.cliente_id) query = query.eq('cliente_id', opts.cliente_id);

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar contas a receber: ${error.message}`);
      return (data ?? []) as ContaReceber[];
    },
  });
}

/**
 * Estatísticas financeiras de contas a receber.
 */
export function useContasReceberStats() {
  return useQuery({
    queryKey: [...CR_KEY, 'stats'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('status, valor_original, valor_pago, saldo, data_vencimento')
        .is('excluido_em', null);
      if (error) throw new Error(`Erro ao buscar stats: ${error.message}`);

      const contas = data ?? [];
      let totalOriginal = 0;
      let totalPago = 0;
      let totalVencido = 0;
      let totalAVencer = 0;
      const today = localDateStr();

      for (const c of contas) {
        const valor = Number(c.valor_original) || 0;
        const pago = Number(c.valor_pago) || 0;
        totalOriginal += valor;
        totalPago += pago;

        if (c.status === 'vencido' || (c.data_vencimento < today && c.status !== 'pago' && c.status !== 'cancelado')) {
          totalVencido += valor - pago;
        }
        if (c.status === 'a_vencer' || (c.data_vencimento >= today && c.status !== 'pago' && c.status !== 'cancelado')) {
          totalAVencer += valor - pago;
        }
      }

      return {
        total: contas.length,
        totalOriginal,
        totalPago,
        totalVencido,
        totalAVencer,
        saldoDevedor: totalOriginal - totalPago,
      };
    },
  });
}

/**
 * Registra pagamento (baixa) de uma conta a receber.
 */
export function useBaixaConta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor_pago, data_pagamento }: { id: string; valor_pago: number; data_pagamento?: string }) => {
      // Busca conta atual
      const { data: conta, error: fetchError } = await supabase
        .from('contas_receber')
        .select('valor_original, valor_pago')
        .eq('id', id)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      const novoValorPago = (Number(conta.valor_pago) || 0) + valor_pago;
      const valorOriginal = Number(conta.valor_original) || 0;
      const novoStatus: ContaReceberStatus = novoValorPago >= valorOriginal ? 'pago' : 'parcial';
      const saldo = valorOriginal - novoValorPago;

      const { data, error } = await supabase
        .from('contas_receber')
        .update({
          valor_pago: novoValorPago,
          saldo,
          status: novoStatus,
          data_pagamento: data_pagamento || localDateStr(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CR_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Pagamento registrado com sucesso');
    },
    onError: (error: Error) => showError(error.message),
  });
}
