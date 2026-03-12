import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns today's date as "yyyy-MM-dd" in local timezone (avoids UTC offset bug). */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContaPagarStatus = 'a_pagar' | 'vencido' | 'parcial' | 'pago' | 'cancelado';

export interface ContaPagar {
  id: string;
  pedido_compra_id: string | null;
  fornecedor_id: string | null;
  categoria: string | null;
  numero_titulo: string | null;
  numero_nf: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaPagarStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  // joins
  fornecedores?: { nome_fantasia: string | null; razao_social: string } | null;
}

export interface ContaPagarCreate {
  pedido_compra_id?: string | null;
  fornecedor_id?: string | null;
  categoria?: string | null;
  numero_titulo?: string | null;
  numero_nf?: string | null;
  valor_original: number;
  data_vencimento: string;
  status?: ContaPagarStatus;
  forma_pagamento?: string | null;
  observacoes?: string | null;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const CP_KEY = ['financeiro', 'contas_pagar'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista contas a pagar com filtros.
 */
export function useContasPagar(opts?: { status?: ContaPagarStatus; fornecedor_id?: string }) {
  return useQuery({
    queryKey: [...CP_KEY, opts],
    queryFn: async (): Promise<ContaPagar[]> => {
      let query = supabase
        .from('contas_pagar')
        .select('*, fornecedores(nome_fantasia, razao_social)')
        .is('excluido_em', null)
        .order('data_vencimento', { ascending: true });

      if (opts?.status) query = query.eq('status', opts.status);
      if (opts?.fornecedor_id) query = query.eq('fornecedor_id', opts.fornecedor_id);

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar contas a pagar: ${error.message}`);
      return (data ?? []) as ContaPagar[];
    },
  });
}

/**
 * Estatísticas de contas a pagar.
 */
export function useContasPagarStats() {
  return useQuery({
    queryKey: [...CP_KEY, 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('status, valor_original, valor_pago, data_vencimento')
        .is('excluido_em', null);
      if (error) throw new Error(`Erro: ${error.message}`);

      const contas = data ?? [];
      let totalOriginal = 0;
      let totalPago = 0;
      let totalVencido = 0;
      const today = localDateStr();

      for (const c of contas) {
        const valor = Number(c.valor_original) || 0;
        const pago = Number(c.valor_pago) || 0;
        totalOriginal += valor;
        totalPago += pago;

        if (c.data_vencimento < today && c.status !== 'pago' && c.status !== 'cancelado') {
          totalVencido += valor - pago;
        }
      }

      return { total: contas.length, totalOriginal, totalPago, totalVencido };
    },
  });
}

/**
 * Cria uma nova conta a pagar.
 */
export function useCreateContaPagar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContaPagarCreate): Promise<ContaPagar> => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar conta a pagar: ${error.message}`);
      return data as ContaPagar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CP_KEY });
      showSuccess('Conta a pagar criada');
    },
    onError: (error: Error) => showError(error.message),
  });
}
