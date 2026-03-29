import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ilikeTerm } from '@/shared/utils/searchUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'novo'
  | 'contatado'
  | 'qualificado'
  | 'proposta_enviada'
  | 'negociando'
  | 'convertido'
  | 'perdido';

export type LeadTemperatura = 'frio' | 'morno' | 'quente';

export interface Lead {
  id: string;
  empresa: string;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  segmento: string | null;
  origem_id: string | null;
  vendedor_id: string | null;
  status: LeadStatus;
  temperatura: LeadTemperatura;
  valor_estimado: number | null;
  proximo_contato: string | null;
  observacoes: string | null;
  cargo: string | null;
  score: number | null;
  motivo_descarte: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadCreate {
  empresa: string;
  contato_nome?: string | null;
  contato_email?: string | null;
  contato_telefone?: string | null;
  segmento?: string | null;
  origem_id?: string | null;
  vendedor_id?: string | null;
  status?: LeadStatus;
  temperatura?: LeadTemperatura;
  valor_estimado?: number | null;
  proximo_contato?: string | null;
  observacoes?: string | null;
}

export interface LeadUpdate extends Partial<LeadCreate> {
  id: string;
}

export interface LeadFilters {
  status?: LeadStatus | LeadStatus[];
  temperatura?: LeadTemperatura | LeadTemperatura[];
  search?: string;
  vendedor_id?: string;
}

export interface LeadStageStats {
  status: LeadStatus;
  count: number;
  valor_total: number;
}

export interface LeadTemperaturaStats {
  temperatura: LeadTemperatura;
  count: number;
}

export interface LeadStats {
  byStatus: LeadStageStats[];
  byTemperatura: LeadTemperaturaStats[];
  total: number;
  valorTotal: number;
}

// ─── Status Transition Guards ────────────────────────────────────────────────

const LEAD_VALID_TRANSITIONS: Record<string, string[]> = {
  'novo': ['contatado', 'qualificado', 'convertido', 'perdido'],
  'contatado': ['qualificado', 'proposta_enviada', 'convertido', 'perdido'],
  'qualificado': ['proposta_enviada', 'negociando', 'convertido', 'perdido'],
  'proposta_enviada': ['negociando', 'convertido', 'perdido'],
  'negociando': ['convertido', 'perdido'],
  'convertido': [],  // terminal
  'perdido': ['novo'],  // can reopen
};

// ─── Query Keys ─────────────────────────────────────────────────────────────

const LEADS_KEY = ['comercial', 'leads'] as const;

function leadsQueryKey(filters?: LeadFilters) {
  return filters ? [...LEADS_KEY, 'list', filters] : [...LEADS_KEY, 'list'];
}

function leadQueryKey(id: string) {
  return [...LEADS_KEY, 'detail', id];
}

const LEADS_STATS_KEY = [...LEADS_KEY, 'stats'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista leads com filtros opcionais por status, temperatura e busca textual.
 */
export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: leadsQueryKey(filters),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Lead[]> => {
      let query = supabase
        .from('leads')
        .select('id, empresa, contato_nome, contato_email, contato_telefone, segmento, origem_id, vendedor_id, status, temperatura, valor_estimado, proximo_contato, observacoes, cargo, score, motivo_descarte, telefone, email, created_at, updated_at')
        .order('created_at', { ascending: false });

      // Filtro por status
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Filtro por temperatura
      if (filters?.temperatura) {
        if (Array.isArray(filters.temperatura)) {
          query = query.in('temperatura', filters.temperatura);
        } else {
          query = query.eq('temperatura', filters.temperatura);
        }
      }

      // Filtro por vendedor
      if (filters?.vendedor_id) {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      // Busca textual (empresa, contato_nome, contato_email)
      if (filters?.search && filters.search.trim().length > 0) {
        const term = ilikeTerm(filters.search);
        query = query.or(
          `empresa.ilike.${term},contato_nome.ilike.${term},contato_email.ilike.${term}`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar leads: ${error.message}`);
      }

      return (data ?? []) as Lead[];
    },
  });
}

/**
 * Busca um lead individual pelo ID.
 */
export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: leadQueryKey(id ?? ''),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Lead | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('leads')
        .select('id, empresa, contato_nome, contato_email, contato_telefone, segmento, origem_id, vendedor_id, status, temperatura, valor_estimado, proximo_contato, observacoes, cargo, score, motivo_descarte, telefone, email, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar lead: ${error.message}`);
      }

      return data as Lead;
    },
    enabled: !!id,
  });
}

/**
 * Cria um novo lead.
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LeadCreate): Promise<Lead> => {
      const { data, error } = await supabase
        .from('leads')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar lead: ${error.message}`);
      }

      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_KEY });
      showSuccess('Lead criado com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Atualiza um lead existente.
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: LeadUpdate): Promise<Lead> => {
      // Validate status transition if status is being changed
      if (payload.status) {
        const { data: current, error: fetchError } = await supabase
          .from('leads')
          .select('status')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw new Error(`Erro ao verificar status atual: ${fetchError.message}`);
        }

        const currentStatus = current?.status as string;
        const allowed = LEAD_VALID_TRANSITIONS[currentStatus];
        if (allowed && !allowed.includes(payload.status)) {
          throw new Error(
            `Transição de status inválida: "${currentStatus}" → "${payload.status}". ` +
            `Transições permitidas: ${allowed.length > 0 ? allowed.join(', ') : 'nenhuma (status terminal)'}`
          );
        }
      }

      const { data, error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar lead: ${error.message}`);
      }

      return data as Lead;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: LEADS_KEY });
      queryClient.setQueryData(leadQueryKey(data.id), data);
      showSuccess('Lead atualizado com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Estatísticas agregadas dos leads: contagem por status, por temperatura e totais.
 */
export function useLeadStats() {
  return useQuery({
    queryKey: LEADS_STATS_KEY,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<LeadStats> => {
      const { data, error } = await supabase
        .from('leads')
        .select('status, temperatura, valor_estimado');

      if (error) {
        throw new Error(`Erro ao buscar estatísticas de leads: ${error.message}`);
      }

      const leads = (data ?? []) as Pick<Lead, 'status' | 'temperatura' | 'valor_estimado'>[];

      // Agregar por status
      const statusMap = new Map<LeadStatus, { count: number; valor_total: number }>();
      const temperaturaMap = new Map<LeadTemperatura, number>();
      let valorTotal = 0;

      for (const lead of leads) {
        // Status aggregation
        const current = statusMap.get(lead.status) ?? { count: 0, valor_total: 0 };
        current.count += 1;
        current.valor_total += lead.valor_estimado ?? 0;
        statusMap.set(lead.status, current);

        // Temperatura aggregation
        temperaturaMap.set(lead.temperatura, (temperaturaMap.get(lead.temperatura) ?? 0) + 1);

        // Total value
        valorTotal += lead.valor_estimado ?? 0;
      }

      const byStatus: LeadStageStats[] = Array.from(statusMap.entries()).map(
        ([status, stats]) => ({
          status,
          count: stats.count,
          valor_total: stats.valor_total,
        })
      );

      const byTemperatura: LeadTemperaturaStats[] = Array.from(temperaturaMap.entries()).map(
        ([temperatura, count]) => ({
          temperatura,
          count,
        })
      );

      return {
        byStatus,
        byTemperatura,
        total: leads.length,
        valorTotal,
      };
    },
  });
}
