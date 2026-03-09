import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadStatus } from './useLeads';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PipelineStage {
  status: LeadStatus;
  count: number;
  valor_total: number;
}

export interface PipelineData {
  stages: PipelineStage[];
  totalLeads: number;
  totalValor: number;
}

// ─── Ordem das etapas no pipeline ───────────────────────────────────────────

const PIPELINE_STAGE_ORDER: LeadStatus[] = [
  'novo',
  'contatado',
  'qualificado',
  'proposta_enviada',
  'negociando',
  'convertido',
  'perdido',
];

// ─── Query Keys ─────────────────────────────────────────────────────────────

const PIPELINE_KEY = ['comercial', 'pipeline'] as const;

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Dados agregados do pipeline comercial para visualização Kanban.
 * Retorna leads agrupados por status com contagens e valores totais por etapa.
 */
export function usePipelineData() {
  return useQuery({
    queryKey: PIPELINE_KEY,
    queryFn: async (): Promise<PipelineData> => {
      const { data, error } = await supabase
        .from('leads')
        .select('status, valor_estimado');

      if (error) {
        throw new Error(`Erro ao buscar dados do pipeline: ${error.message}`);
      }

      const leads = (data ?? []) as { status: LeadStatus; valor_estimado: number | null }[];

      // Inicializar todas as etapas com contagem zero
      const stageMap = new Map<LeadStatus, { count: number; valor_total: number }>();
      for (const status of PIPELINE_STAGE_ORDER) {
        stageMap.set(status, { count: 0, valor_total: 0 });
      }

      // Agregar leads em cada etapa
      let totalLeads = 0;
      let totalValor = 0;

      for (const lead of leads) {
        const stage = stageMap.get(lead.status);
        if (stage) {
          stage.count += 1;
          stage.valor_total += lead.valor_estimado ?? 0;
        } else {
          // Status desconhecido - criar etapa dinâmica
          stageMap.set(lead.status, {
            count: 1,
            valor_total: lead.valor_estimado ?? 0,
          });
        }
        totalLeads += 1;
        totalValor += lead.valor_estimado ?? 0;
      }

      // Montar array na ordem correta do pipeline
      const stages: PipelineStage[] = PIPELINE_STAGE_ORDER.map((status) => ({
        status,
        count: stageMap.get(status)?.count ?? 0,
        valor_total: stageMap.get(status)?.valor_total ?? 0,
      }));

      // Adicionar etapas de status desconhecidos (caso existam no banco)
      for (const [status, stats] of stageMap.entries()) {
        if (!PIPELINE_STAGE_ORDER.includes(status)) {
          stages.push({
            status,
            count: stats.count,
            valor_total: stats.valor_total,
          });
        }
      }

      return {
        stages,
        totalLeads,
        totalValor,
      };
    },
  });
}
