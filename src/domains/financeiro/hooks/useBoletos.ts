// ─── Boletos Hooks ──────────────────────────────────────────────────────────
// Croma Print ERP — TanStack Query hooks para boletos e remessas
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import type {
  BankAccount,
  BankAccountCreate,
  BankSlip,
  BankSlipCreate,
  BankSlipUpdate,
  BankRemittance,
  BoletoFilters,
  BoletoStatus,
} from '../types/boleto.types';
import {
  createBoleto,
  updateBoleto,
  emitirBoleto,
  marcarProntoRemessa,
  cancelBoleto,
} from '../services/boleto.service';
import {
  gerarRemessa,
  baixarRemessa,
  marcarRemessaEnviada,
} from '../services/remessa.service';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const BANK_ACCOUNT_KEY = ['financeiro', 'bank_accounts'] as const;
const BOLETO_KEY = ['financeiro', 'boletos'] as const;
const REMESSA_KEY = ['financeiro', 'remessas'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════
// BANK ACCOUNTS
// ═══════════════════════════════════════

export function useBankAccounts() {
  return useQuery({
    queryKey: [...BANK_ACCOUNT_KEY],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BankAccount[]> => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw new Error(`Erro ao buscar contas bancárias: ${error.message}`);
      return (data ?? []) as unknown as BankAccount[];
    },
  });
}

export function useBankAccount(id: string | undefined) {
  return useQuery({
    queryKey: [...BANK_ACCOUNT_KEY, id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BankAccount> => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw new Error(error.message);
      return data as unknown as BankAccount;
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BankAccountCreate) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BANK_ACCOUNT_KEY });
      showSuccess('Conta bancária cadastrada com sucesso');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: BankAccountCreate & { id: string }) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BANK_ACCOUNT_KEY });
      showSuccess('Conta bancária atualizada');
    },
    onError: (e: Error) => showError(e.message),
  });
}

// ═══════════════════════════════════════
// BOLETOS
// ═══════════════════════════════════════

export function useBoletos(filters?: BoletoFilters) {
  return useQuery({
    queryKey: [...BOLETO_KEY, filters],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<BankSlip[]> => {
      let query = supabase
        .from('bank_slips')
        .select('*, clientes(nome_fantasia, razao_social), bank_accounts(nome, banco_nome), pedidos(numero)')
        .order('data_vencimento', { ascending: true });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.cliente_id) query = query.eq('cliente_id', filters.cliente_id);
      if (filters?.bank_account_id) query = query.eq('bank_account_id', filters.bank_account_id);
      if (filters?.data_vencimento_de) query = query.gte('data_vencimento', filters.data_vencimento_de);
      if (filters?.data_vencimento_ate) query = query.lte('data_vencimento', filters.data_vencimento_ate);

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar boletos: ${error.message}`);
      return (data ?? []) as unknown as BankSlip[];
    },
  });
}

export function useBoleto(id: string | undefined) {
  return useQuery({
    queryKey: [...BOLETO_KEY, id],
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<BankSlip> => {
      const { data, error } = await supabase
        .from('bank_slips')
        .select('*, clientes(nome_fantasia, razao_social), bank_accounts(*), pedidos(numero)')
        .eq('id', id!)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as BankSlip;
    },
  });
}

export function useBoletoStats() {
  return useQuery({
    queryKey: [...BOLETO_KEY, 'stats'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_slips')
        .select('status, valor_nominal, data_vencimento');

      if (error) throw new Error(error.message);

      const boletos = data ?? [];
      const today = localDateStr();
      let totalEmitidos = 0;
      let valorEmitidos = 0;
      let totalAVencer = 0;
      let valorAVencer = 0;
      let totalVencidos = 0;
      let valorVencidos = 0;
      let totalPagos = 0;
      let valorPagos = 0;

      for (const b of boletos) {
        const valor = Number(b.valor_nominal) || 0;
        const status = b.status as BoletoStatus;

        if (status === 'cancelado') continue;

        if (status === 'pago') {
          totalPagos++;
          valorPagos += valor;
          continue;
        }

        // Ativos (não cancelados, não pagos)
        totalEmitidos++;
        valorEmitidos += valor;

        if (b.data_vencimento < today) {
          totalVencidos++;
          valorVencidos += valor;
        } else {
          totalAVencer++;
          valorAVencer += valor;
        }
      }

      return {
        totalEmitidos,
        valorEmitidos,
        totalAVencer,
        valorAVencer,
        totalVencidos,
        valorVencidos,
        totalPagos,
        valorPagos,
      };
    },
  });
}

export function useCreateBoleto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BankSlipCreate) => createBoleto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      showSuccess('Boleto criado com sucesso');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useUpdateBoleto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BankSlipUpdate) => updateBoleto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      showSuccess('Boleto atualizado');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useEmitirBoleto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emitirBoleto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      showSuccess('Boleto emitido');
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useMarcarProntoRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => marcarProntoRemessa(ids),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      showSuccess(`${ids.length} boleto(s) marcado(s) como pronto para remessa`);
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useCancelBoleto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelBoleto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      showSuccess('Boleto cancelado');
    },
    onError: (e: Error) => showError(e.message),
  });
}

// ═══════════════════════════════════════
// REMESSAS
// ═══════════════════════════════════════

export function useRemessas() {
  return useQuery({
    queryKey: [...REMESSA_KEY],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<BankRemittance[]> => {
      const { data, error } = await supabase
        .from('bank_remittances')
        .select('*, bank_accounts(nome, banco_nome)')
        .order('gerado_em', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as BankRemittance[];
    },
  });
}

export function useGerarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bankAccountId, slipIds }: { bankAccountId: string; slipIds: string[] }) => {
      return gerarRemessa(bankAccountId, slipIds);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: BOLETO_KEY });
      qc.invalidateQueries({ queryKey: REMESSA_KEY });
      showSuccess(`Remessa "${result.filename}" gerada com ${result.remittance.total_registros} boleto(s)`);
    },
    onError: (e: Error) => showError(e.message),
  });
}

export function useDownloadRemessa() {
  return useMutation({
    mutationFn: (remittanceId: string) => baixarRemessa(remittanceId),
    onSuccess: () => showSuccess('Arquivo baixado'),
    onError: (e: Error) => showError(e.message),
  });
}

export function useMarcarRemessaEnviada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (remittanceId: string) => marcarRemessaEnviada(remittanceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REMESSA_KEY });
      showSuccess('Remessa marcada como enviada ao banco');
    },
    onError: (e: Error) => showError(e.message),
  });
}
