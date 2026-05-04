// src/domains/comercial/hooks/useDispararAbertura.ts
// Mutation que chama RPC fn_disparar_abertura_em_massa.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md secao 6.8

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface DispararParams {
  leadIds: string[];
  templateId: string;
  modo: 'imediato' | 'agendado';
  autoAprovar?: boolean;
}

export interface DisparoResultRow {
  lead_id: string;
  conversation_id: string | null;
  message_id: string | null;
  status: 'criado' | 'bloqueado' | 'pulado' | 'duplicado';
  motivo: string | null;
}

export function useDispararAbertura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DispararParams): Promise<DisparoResultRow[]> => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('fn_disparar_abertura_em_massa', {
        p_lead_ids:     params.leadIds,
        p_template_id:  params.templateId,
        p_user_id:      userData.user?.id ?? null,
        p_auto_aprovar: params.autoAprovar ?? true,
        p_modo:         params.modo,
      });

      if (error) throw error;
      return (data ?? []) as DisparoResultRow[];
    },

    onSuccess: (data) => {
      const criados   = data.filter(d => d.status === 'criado').length;
      const bloqueados = data.filter(d => d.status === 'bloqueado').length;
      const pulados   = data.filter(d => d.status === 'pulado').length;
      const dups      = data.filter(d => d.status === 'duplicado').length;

      const msg = [
        `${criados} disparo${criados !== 1 ? 's' : ''} enfileirado${criados !== 1 ? 's' : ''}.`,
        bloqueados ? `${bloqueados} bloqueado${bloqueados !== 1 ? 's' : ''}.` : '',
        pulados    ? `${pulados} sem telefone.` : '',
        dups       ? `${dups} ja em conversa.` : '',
      ].filter(Boolean).join(' ');

      showSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
    },

    onError: (e: any) => showError('Falha no disparo: ' + (e.message || 'Erro desconhecido')),
  });
}

// Templates disponiveis para disparo (canal=whatsapp, etapa=abertura, ativo=true)
export function useTemplatesAbertura(segmento?: string) {
  return useQuery({
    queryKey: ['templates-abertura', segmento],
    queryFn: async () => {
      let q = supabase
        .from('agent_templates')
        .select('id, nome, etapa, segmento, sub_segmento, meta_template_name, conteudo, variaveis, vezes_usado, taxa_resposta, template_language')
        .eq('canal', 'whatsapp')
        .eq('etapa', 'abertura')
        .eq('ativo', true);

      if (segmento) q = q.eq('segmento', segmento);

      const { data, error } = await q.order('nome');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });
}
