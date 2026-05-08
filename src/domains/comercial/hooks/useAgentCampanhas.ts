// src/domains/comercial/hooks/useAgentCampanhas.ts
// Hooks que operam sobre a tabela MESTRE `agent_campanhas` (nova, criada na migration 139
// e estendida na 140). NÃO mexe na tabela legacy `campanhas` — esse mundo continua em
// `useCampanhas.ts` intocado.
//
// Sessão 2026-05-06 (Cowork) — Entrega 1 frontend Campanhas ↔ Leads.
// Mantido isolado: este arquivo só é importado pelos novos componentes
// CampanhaSelector e QuickCriarCampanhaDialog. Aba Leads não conhece este hook.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export type AgentCampanhaCanal = 'whatsapp' | 'email' | 'misto';
export type AgentCampanhaStatus =
  | 'rascunho'
  | 'ativa'
  | 'pausada'
  | 'concluida'
  | 'cancelada';

export interface AgentCampanhaResumo {
  id: string;
  nome: string;
  canal: AgentCampanhaCanal;
  status: AgentCampanhaStatus;
  total_alvo: number | null;
  data_inicio: string | null;
  data_fim: string | null;
}

const KEY_LISTA = 'agent_campanhas_ativas';

// Canal do disparo (origem) → canais aceitáveis em agent_campanhas.
// 'misto' sempre aceita whatsapp ou email.
function canaisCompativeis(canalDisparo: 'whatsapp' | 'email'): AgentCampanhaCanal[] {
  return canalDisparo === 'whatsapp'
    ? ['whatsapp', 'misto']
    : ['email', 'misto'];
}

export interface UseCampanhasAtivasOptions {
  /** Quando false, query não dispara (lazy). Default: true. */
  enabled?: boolean;
}

/**
 * Lista campanhas elegíveis para vincular a um disparo.
 * Filtra: status IN ('ativa','rascunho') AND canal compatível com o canal do disparo.
 * Retorna [] se houver erro ou tabela vazia (UI segue funcionando com "Sem campanha").
 */
export function useCampanhasAtivas(
  canalDisparo: 'whatsapp' | 'email',
  opts: UseCampanhasAtivasOptions = {},
) {
  const enabled = opts.enabled ?? true;
  const canais = canaisCompativeis(canalDisparo);

  return useQuery({
    queryKey: [KEY_LISTA, canalDisparo],
    queryFn: async (): Promise<AgentCampanhaResumo[]> => {
      const { data, error } = await supabase
        .from('agent_campanhas')
        .select('id, nome, canal, status, total_alvo, data_inicio, data_fim')
        .in('status', ['ativa', 'rascunho'])
        .in('canal', canais)
        .order('status', { ascending: true })  // 'ativa' antes de 'rascunho' alfabeticamente
        .order('nome', { ascending: true });

      if (error) {
        // Não joga toast aqui — o componente segue com lista vazia e default "Sem campanha".
        console.warn('[useCampanhasAtivas] erro lendo agent_campanhas:', error.message);
        return [];
      }
      return (data ?? []) as AgentCampanhaResumo[];
    },
    enabled,
    staleTime: 60_000,
  });
}

export interface CriarCampanhaRapidaInput {
  nome: string;
  canal: AgentCampanhaCanal;
  data_fim?: string | null;
}

/**
 * Cria uma campanha rápida em status='rascunho'. Retorna o id da campanha criada.
 * O usuário pode evoluir para 'ativa' depois pela página /campanhas (Entrega 2/3).
 */
export function useCriarCampanhaRapida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarCampanhaRapidaInput): Promise<AgentCampanhaResumo> => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('agent_campanhas')
        .insert({
          nome: input.nome.trim(),
          canal: input.canal,
          status: 'rascunho',
          data_fim: input.data_fim ?? null,
          criada_por: userData.user?.id ?? null,
        })
        .select('id, nome, canal, status, total_alvo, data_inicio, data_fim')
        .single();

      if (error) throw error;
      return data as AgentCampanhaResumo;
    },
    onSuccess: () => {
      // Invalida todas as variantes do cache (whatsapp, email).
      qc.invalidateQueries({ queryKey: [KEY_LISTA] });
      showSuccess('Campanha criada (rascunho).');
    },
    onError: (e: any) => {
      showError('Falha ao criar campanha: ' + (e?.message ?? 'erro desconhecido'));
    },
  });
}

// ─── Banner de campanha ativa (Entrega 2) ────────────────────────────────────
// Busca a campanha em status='ativa' mais recente e calcula métricas REAIS
// vinculadas (não mais por segmento). Retorna null se não houver campanha
// ativa — nesse caso o banner usa fallback legacy (useCampanhaStatus por segmento).

export interface CampanhaAtivaBannerData {
  campanha: AgentCampanhaResumo;
  totalLeads: number;          // distinct leads vinculados via agent_conversations.campanha_id
  totalEnfileiradas: number;   // mensagens em status='aprovada' aguardando dispatch
  totalEnviadas: number;       // total_enviadas agregado em agent_campanhas
  totalLidas: number;
  totalRespondidas: number;
  totalErros: number;
}

export function useCampanhaAtivaResumo() {
  return useQuery<CampanhaAtivaBannerData | null>({
    queryKey: ['agent_campanha_ativa_resumo'],
    queryFn: async () => {
      // 1. Pegar a campanha ativa mais recente, com agregados já materializados na tabela.
      //    Os contadores total_enviadas / total_lidas / total_respondidas / total_erros são
      //    mantidos pelo trigger fn_atualizar_contadores_campanha em agent_messages.
      const { data: campanha, error } = await supabase
        .from('agent_campanhas')
        .select('id, nome, canal, status, total_alvo, data_inicio, data_fim, total_leads, total_enviadas, total_lidas, total_respondidas, total_erros')
        .eq('status', 'ativa')
        .order('criada_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[useCampanhaAtivaResumo] erro:', error.message);
        return null;
      }
      if (!campanha) return null;

      // 2. totalEnfileiradas calculado em runtime (não há agregado na tabela para "aprovada").
      const { count: enfileiradas } = await supabase
        .from('agent_messages')
        .select('id', { count: 'exact', head: true })
        .eq('campanha_id', (campanha as any).id)
        .eq('status', 'aprovada');

      const c = campanha as any;
      return {
        campanha: {
          id: c.id, nome: c.nome, canal: c.canal, status: c.status,
          total_alvo: c.total_alvo, data_inicio: c.data_inicio, data_fim: c.data_fim,
        } as AgentCampanhaResumo,
        totalLeads:        c.total_leads        ?? 0,
        totalEnfileiradas: enfileiradas         ?? 0,
        totalEnviadas:     c.total_enviadas     ?? 0,
        totalLidas:        c.total_lidas        ?? 0,
        totalRespondidas:  c.total_respondidas  ?? 0,
        totalErros:        c.total_erros        ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

// ─── Banner: lista de TODAS as campanhas ativas (plural) ─────────────────────
// 2026-05-08: substitui o uso de useCampanhaAtivaResumo no banner do header.
// Retorna 1 entry por campanha em status='ativa' com agregados materializados +
// totalEnfileiradas calculado em runtime. Permite empilhar cards (email + whatsapp
// + qualquer outra campanha ativa simultânea) em vez de sobrescrever.

export function useCampanhasAtivasResumo() {
  return useQuery<CampanhaAtivaBannerData[]>({
    queryKey: ['agent_campanhas_ativas_resumo'],
    queryFn: async () => {
      const { data: campanhas, error } = await supabase
        .from('agent_campanhas')
        .select('id, nome, canal, status, total_alvo, data_inicio, data_fim, total_leads, total_enviadas, total_lidas, total_respondidas, total_erros')
        .eq('status', 'ativa')
        .order('canal', { ascending: true })       // email antes de whatsapp (alfabético)
        .order('criada_em', { ascending: false }); // mais recente primeiro dentro do canal

      if (error) {
        console.warn('[useCampanhasAtivasResumo] erro:', error.message);
        return [];
      }
      if (!campanhas || campanhas.length === 0) return [];

      // Buscar enfileiradas (status='aprovada') de todas as campanhas em uma query só
      const ids = campanhas.map((c: any) => c.id);
      const { data: pendentes } = await supabase
        .from('agent_messages')
        .select('campanha_id')
        .in('campanha_id', ids)
        .eq('status', 'aprovada');

      const enfileiradasPorCampanha: Record<string, number> = {};
      for (const p of (pendentes ?? []) as any[]) {
        enfileiradasPorCampanha[p.campanha_id] = (enfileiradasPorCampanha[p.campanha_id] ?? 0) + 1;
      }

      return campanhas.map((c: any) => ({
        campanha: {
          id: c.id, nome: c.nome, canal: c.canal, status: c.status,
          total_alvo: c.total_alvo, data_inicio: c.data_inicio, data_fim: c.data_fim,
        } as AgentCampanhaResumo,
        totalLeads:        c.total_leads        ?? 0,
        totalEnfileiradas: enfileiradasPorCampanha[c.id] ?? 0,
        totalEnviadas:     c.total_enviadas     ?? 0,
        totalLidas:        c.total_lidas        ?? 0,
        totalRespondidas:  c.total_respondidas  ?? 0,
        totalErros:        c.total_erros        ?? 0,
      }));
    },
    staleTime: 60_000,
  });
}

// ─── Listagem completa para CampanhasPage (Entrega 3) ────────────────────────

export interface AgentCampanhaListagem extends AgentCampanhaResumo {
  total_leads: number;
  total_mensagens_criadas: number;
  total_enviadas: number;
  total_lidas: number;
  total_respondidas: number;
  total_erros: number;
  criada_em: string;
}

/** Lista TODAS as campanhas (qualquer status) com agregados — ordem: ativa primeiro, depois mais recente. */
export function useCampanhasListagem() {
  return useQuery<AgentCampanhaListagem[]>({
    queryKey: ['agent_campanhas_listagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_campanhas')
        .select('id, nome, canal, status, total_alvo, data_inicio, data_fim, total_leads, total_mensagens_criadas, total_enviadas, total_lidas, total_respondidas, total_erros, criada_em')
        .order('status', { ascending: true })
        .order('criada_em', { ascending: false });
      if (error) {
        console.warn('[useCampanhasListagem] erro:', error.message);
        return [];
      }
      return (data ?? []) as AgentCampanhaListagem[];
    },
    staleTime: 30_000,
  });
}

/** Atualiza apenas o status de uma campanha (pausar/ativar/concluir/cancelar). */
export function useAtualizarStatusCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AgentCampanhaStatus }) => {
      const { data, error } = await supabase
        .from('agent_campanhas')
        .update({ status })
        .eq('id', id)
        .select('id, status')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent_campanhas_listagem'] });
      qc.invalidateQueries({ queryKey: ['agent_campanhas_ativas'] });
      qc.invalidateQueries({ queryKey: ['agent_campanha_ativa_resumo'] });
      showSuccess('Status atualizado.');
    },
    onError: (e: any) => showError('Falha ao atualizar status: ' + (e?.message ?? 'erro')),
  });
}

/** Atualiza nome, datas, total_alvo de uma campanha. */
export interface AtualizarCampanhaInput {
  id: string;
  nome?: string;
  total_alvo?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}
export function useAtualizarCampanhaMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AtualizarCampanhaInput) => {
      const patch: Record<string, unknown> = {};
      if (input.nome !== undefined)        patch.nome        = input.nome.trim();
      if (input.total_alvo !== undefined)  patch.total_alvo  = input.total_alvo;
      if (input.data_inicio !== undefined) patch.data_inicio = input.data_inicio;
      if (input.data_fim !== undefined)    patch.data_fim    = input.data_fim;
      const { data, error } = await supabase
        .from('agent_campanhas')
        .update(patch)
        .eq('id', input.id)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent_campanhas_listagem'] });
      qc.invalidateQueries({ queryKey: ['agent_campanha_ativa_resumo'] });
      showSuccess('Campanha atualizada.');
    },
    onError: (e: any) => showError('Falha ao salvar: ' + (e?.message ?? 'erro')),
  });
}

/** Lista de leads vinculados a uma campanha (via agent_conversations). */
export interface LeadDeCampanha {
  lead_id: string;
  empresa: string | null;
  contato_nome: string | null;
  cidade: string | null;
  ultima_mensagem_em: string | null;
  conversation_id: string;
}
export function useLeadsDaCampanha(campanhaId: string | null) {
  return useQuery<LeadDeCampanha[]>({
    queryKey: ['agent_campanha_leads', campanhaId],
    queryFn: async () => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('id, lead_id, ultima_mensagem_em, leads!inner(empresa, contato_nome, cidade)')
        .eq('campanha_id', campanhaId)
        .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) {
        console.warn('[useLeadsDaCampanha] erro:', error.message);
        return [];
      }
      return ((data ?? []) as any[]).map((row) => ({
        lead_id: row.lead_id,
        empresa: row.leads?.empresa ?? null,
        contato_nome: row.leads?.contato_nome ?? null,
        cidade: row.leads?.cidade ?? null,
        ultima_mensagem_em: row.ultima_mensagem_em,
        conversation_id: row.id,
      })) as LeadDeCampanha[];
    },
    enabled: !!campanhaId,
    staleTime: 30_000,
  });
}
