import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

export interface MaterialForecast {
  material_id: string;
  nome: string;
  unidade: string;
  saldo_atual: number;
  reservado: number;
  disponivel: number;
  estoque_minimo: number;
  consumo_medio_diario: number;
  consumo_previsto_periodo: number;
  dias_cobertura: number;
  sugestao_compra: number;
  urgencia: 'critico' | 'atencao' | 'ok';
  pipeline_demanda: number;
  tendencia: 'crescente' | 'estavel' | 'decrescente';
}

export interface PrevisaoResult {
  materiais: MaterialForecast[];
  resumo: {
    total_analisados: number;
    criticos: number;
    atencao: number;
    ok: number;
    periodo_dias: number;
    valor_compra_sugerido: number;
  };
}

export function usePrevisaoDemanda() {
  return useMutation({
    mutationFn: async (periodo_dias = 30): Promise<PrevisaoResult> => {
      const { data, error } = await supabase.functions.invoke('ai-previsao-estoque', {
        body: { periodo_dias },
      });
      if (error) throw error;
      return data as PrevisaoResult;
    },
    onError: (err) => showError(`Erro na previsão: ${(err as Error).message}`),
  });
}
