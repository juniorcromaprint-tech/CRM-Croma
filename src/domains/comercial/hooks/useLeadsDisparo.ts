// src/domains/comercial/hooks/useLeadsDisparo.ts
// Hook de query para vw_leads_disparo com filtros ricos.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.2

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadsFilterState {
  segmentos?: string[];
  subSegmentos?: string[];
  origens?: string[];
  status?: string[];
  temperaturas?: string[];
  estados?: string[];
  regioes?: string[];
  temTelefone?: boolean | null;       // true | false | null (qualquer)
  temEmail?: boolean | null;
  emConversaAtiva?: boolean | null;
  scoreMin?: number;
  scoreMax?: number;
  vendedorId?: string | null;
  cadastroDe?: string;                // ISO date string
  cadastroAte?: string;
  excluirBloqueados?: boolean;        // default true
  busca?: string;
}

export type LeadDisparo = {
  id: string;
  empresa: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  email: string | null;
  telefone: string | null;
  segmento: string | null;
  status: string | null;
  temperatura: string | null;
  score: number | null;
  valor_estimado: number | null;
  observacoes: string | null;
  cargo: string | null;
  vendedor_id: string | null;
  created_at: string;
  updated_at: string;
  origem_id: string | null;
  origem_nome: string | null;
  sub_segmento: string | null;
  cidade: string | null;
  estado: string | null;
  regiao: string | null;
  tem_telefone_valido: boolean;
  tem_email_valido: boolean;
  bloqueado_disparo: boolean;
  em_conversa_ativa: boolean;
  ultima_conversa_em: string | null;
};

export function useLeadsDisparo(filters: LeadsFilterState) {
  return useQuery({
    queryKey: ['leads-disparo', filters],
    queryFn: async (): Promise<LeadDisparo[]> => {
      let q = supabase.from('vw_leads_disparo').select('*');

      if (filters.segmentos?.length)    q = q.in('segmento', filters.segmentos);
      if (filters.subSegmentos?.length) q = q.in('sub_segmento', filters.subSegmentos);
      if (filters.origens?.length)      q = q.in('origem_nome', filters.origens);
      if (filters.status?.length)       q = q.in('status', filters.status);
      if (filters.temperaturas?.length) q = q.in('temperatura', filters.temperaturas);
      if (filters.estados?.length)      q = q.in('estado', filters.estados);
      if (filters.regioes?.length)      q = q.in('regiao', filters.regioes);

      if (filters.temTelefone === true)  q = q.eq('tem_telefone_valido', true);
      if (filters.temTelefone === false) q = q.eq('tem_telefone_valido', false);
      if (filters.temEmail === true)     q = q.eq('tem_email_valido', true);
      if (filters.temEmail === false)    q = q.eq('tem_email_valido', false);

      if (filters.emConversaAtiva === true)  q = q.eq('em_conversa_ativa', true);
      if (filters.emConversaAtiva === false) q = q.eq('em_conversa_ativa', false);

      if (filters.scoreMin != null) q = q.gte('score', filters.scoreMin);
      if (filters.scoreMax != null) q = q.lte('score', filters.scoreMax);
      if (filters.vendedorId)       q = q.eq('vendedor_id', filters.vendedorId);
      if (filters.cadastroDe)       q = q.gte('created_at', filters.cadastroDe);
      if (filters.cadastroAte)      q = q.lte('created_at', filters.cadastroAte);

      // Excluir bloqueados por padrão (leads marcados como NAO INCLUIR)
      if (filters.excluirBloqueados !== false) q = q.eq('bloqueado_disparo', false);

      if (filters.busca) {
        const b = filters.busca.trim();
        q = q.or(
          `empresa.ilike.%${b}%,contato_nome.ilike.%${b}%,contato_telefone.ilike.%${b}%`
        );
      }

      q = q.order('created_at', { ascending: false }).limit(1000);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadDisparo[];
    },
    staleTime: 30_000,
  });
}

// Helper: buscar valores únicos para os dropdowns de filtro
export function useLeadsDisparoMeta() {
  return useQuery({
    queryKey: ['leads-disparo-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_leads_disparo')
        .select('segmento, sub_segmento, origem_nome, status, temperatura, estado, regiao, cidade');
      if (error) throw error;
      const rows = data ?? [];
      const uniq = <T>(arr: (T | null)[]): T[] =>
        [...new Set(arr.filter((x): x is T => x !== null && x !== ''))] as T[];
      return {
        segmentos:    uniq(rows.map(r => r.segmento)),
        subSegmentos: uniq(rows.map(r => r.sub_segmento)),
        origens:      uniq(rows.map(r => r.origem_nome)),
        status:       uniq(rows.map(r => r.status)),
        temperaturas: uniq(rows.map(r => r.temperatura)),
        estados:      uniq(rows.map(r => r.estado)),
        regioes:      uniq(rows.map(r => r.regiao)),
        cidades:      uniq(rows.map(r => r.cidade)),
      };
    },
    staleTime: 5 * 60_000,
  });
}
