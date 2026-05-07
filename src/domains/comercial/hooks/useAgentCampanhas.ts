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
          created_by: userData.user?.id ?? null,
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
