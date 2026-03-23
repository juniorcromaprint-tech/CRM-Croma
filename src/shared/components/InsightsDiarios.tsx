import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, TrendingUp, Users, FileText, Package, DollarSign,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { brl } from '@/shared/utils/format';

interface InsightsData {
  resumo_executivo: string;
  metricas: {
    leads_hoje: number;
    leads_ontem: number;
    leads_semana: number;
    orcamentos_hoje: number;
    orcamentos_ontem: number;
    valor_orcamentos_semana: number;
    pedidos_hoje: number;
    pedidos_ontem: number;
    faturamento_mes: number;
    contas_vencidas: number;
    alertas_ativos: number;
  };
  alertas_priorizados: Array<{
    id: string;
    tipo: string;
    titulo: string;
    descricao: string;
    severidade: string;
  }>;
  acoes_recomendadas: string[];
}

function DeltaBadge({ atual, anterior }: { atual: number; anterior: number }) {
  const diff = atual - anterior;
  if (diff === 0) return null;
  return (
    <span className={`text-xs font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

export default function InsightsDiarios() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<InsightsData>({
    queryKey: ['insights-diarios'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-insights-diarios');
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 bg-blue-100 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-blue-100 rounded w-2/3" />
            <div className="h-3 bg-blue-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const m = data.metricas;
  const sevColor: Record<string, string> = {
    critica: 'bg-red-100 text-red-700',
    importante: 'bg-amber-100 text-amber-700',
    dica: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 overflow-hidden">
      {/* Header + Summary */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800">Insights do Dia</h3>
                <Badge className="bg-blue-100 text-blue-600 text-[10px] border-0">IA</Badge>
              </div>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                {data.resumo_executivo}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0 h-8 w-8 p-0"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <Users size={13} className="text-blue-500" />
              <span className="text-lg font-bold text-slate-800">{m.leads_hoje}</span>
              <DeltaBadge atual={m.leads_hoje} anterior={m.leads_ontem} />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Leads</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <FileText size={13} className="text-indigo-500" />
              <span className="text-lg font-bold text-slate-800">{m.orcamentos_hoje}</span>
              <DeltaBadge atual={m.orcamentos_hoje} anterior={m.orcamentos_ontem} />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Orçamentos</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <Package size={13} className="text-emerald-500" />
              <span className="text-lg font-bold text-slate-800">{m.pedidos_hoje}</span>
              <DeltaBadge atual={m.pedidos_hoje} anterior={m.pedidos_ontem} />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Pedidos</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{brl(m.valor_orcamentos_semana)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Orç. 7 dias</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center hidden sm:block">
            <p className="text-sm font-bold text-emerald-700">{brl(m.faturamento_mes)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Fat. 30 dias</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2 text-center hidden sm:block">
            {m.contas_vencidas > 0 ? (
              <p className="text-lg font-bold text-red-600">{m.contas_vencidas}</p>
            ) : (
              <p className="text-lg font-bold text-emerald-600">0</p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">Vencidas</p>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      {(data.acoes_recomendadas.length > 0 || data.alertas_priorizados.length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:bg-blue-50/50 transition-colors border-t border-blue-100/50"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar detalhes' : `Ver ${data.acoes_recomendadas.length} ações recomendadas`}
        </button>
      )}

      {/* Expanded: Actions + Alerts */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-blue-100/50">
          {/* Recommended actions */}
          {data.acoes_recomendadas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ações Recomendadas</p>
              <div className="space-y-1.5">
                {data.acoes_recomendadas.map((acao, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2">
                    <TrendingUp size={13} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{acao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active alerts */}
          {data.alertas_priorizados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Alertas Ativos</p>
              <div className="space-y-1.5">
                {data.alertas_priorizados.slice(0, 5).map((alerta) => (
                  <div key={alerta.id} className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{alerta.titulo}</p>
                        <Badge className={`text-[10px] ${sevColor[alerta.severidade] ?? 'bg-slate-100 text-slate-600'}`}>
                          {alerta.severidade}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{alerta.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
