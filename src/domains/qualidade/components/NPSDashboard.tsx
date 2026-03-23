import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SmilePlus, Frown, Meh, Smile, TrendingUp, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/shared/utils/format';

interface NpsResposta {
  id: string;
  nota: number;
  comentario: string | null;
  respondido_em: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
  clientes: { nome_fantasia: string | null; contato_nome: string | null } | null;
  pedidos: { numero: string | null } | null;
}

function useNpsRespostas() {
  return useQuery<NpsResposta[]>({
    queryKey: ['nps-respostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_respostas')
        .select(`
          id, nota, comentario, respondido_em, created_at, metadata,
          clientes(nome_fantasia, contato_nome),
          pedidos(numero)
        `)
        .not('respondido_em', 'is', null)
        .order('respondido_em', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as NpsResposta[];
    },
    staleTime: 60_000,
  });
}

function NpsScoreGauge({ score }: { score: number }) {
  const color = score >= 50 ? 'text-emerald-600' : score >= 0 ? 'text-amber-600' : 'text-red-600';
  const bg = score >= 50 ? 'bg-emerald-50 border-emerald-200' : score >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`rounded-2xl border p-6 text-center ${bg}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">NPS Score</p>
      <p className={`text-5xl font-bold tabular-nums ${color}`}>{score}</p>
      <p className="text-xs text-slate-400 mt-1">
        {score >= 70 ? 'Excelente' : score >= 50 ? 'Bom' : score >= 0 ? 'Regular' : 'Crítico'}
      </p>
    </div>
  );
}

export default function NPSDashboard() {
  const { data: respostas = [], isLoading } = useNpsRespostas();

  const stats = useMemo(() => {
    if (respostas.length === 0) return null;

    const promotores = respostas.filter(r => r.nota >= 9).length;
    const neutros = respostas.filter(r => r.nota >= 7 && r.nota < 9).length;
    const detratores = respostas.filter(r => r.nota < 7).length;
    const total = respostas.length;
    const score = Math.round(((promotores - detratores) / total) * 100);
    const media = Math.round(respostas.reduce((s, r) => s + r.nota, 0) / total * 10) / 10;

    // Sentiment breakdown from AI analysis
    const sentimentos = { positivo: 0, neutro: 0, negativo: 0 };
    const temas: Record<string, number> = {};

    for (const r of respostas) {
      const analise = (r.metadata as any)?.analise;
      if (analise?.sentimento) {
        sentimentos[analise.sentimento as keyof typeof sentimentos]++;
      }
      for (const tema of analise?.temas ?? []) {
        temas[tema] = (temas[tema] ?? 0) + 1;
      }
    }

    const topTemas = Object.entries(temas).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { promotores, neutros, detratores, total, score, media, sentimentos, topTemas };
  }, [respostas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Carregando NPS...
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <SmilePlus size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhuma resposta NPS</h3>
        <p className="text-sm text-slate-400 mt-1">As pesquisas são enviadas automaticamente quando pedidos são concluídos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NpsScoreGauge score={stats.score} />

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Smile size={18} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">Promotores (9-10)</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.promotores}</p>
          <p className="text-xs text-slate-400 mt-1">{Math.round((stats.promotores / stats.total) * 100)}%</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Meh size={18} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Neutros (7-8)</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.neutros}</p>
          <p className="text-xs text-slate-400 mt-1">{Math.round((stats.neutros / stats.total) * 100)}%</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Frown size={18} className="text-red-500" />
            <span className="text-xs font-medium text-slate-500">Detratores (0-6)</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.detratores}</p>
          <p className="text-xs text-slate-400 mt-1">{Math.round((stats.detratores / stats.total) * 100)}%</p>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Distribuição</h3>
          <span className="text-xs text-slate-400">Média: {stats.media}/10 · {stats.total} respostas</span>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
          {stats.promotores > 0 && (
            <div className="bg-emerald-400 transition-all" style={{ width: `${(stats.promotores / stats.total) * 100}%` }} />
          )}
          {stats.neutros > 0 && (
            <div className="bg-amber-400 transition-all" style={{ width: `${(stats.neutros / stats.total) * 100}%` }} />
          )}
          {stats.detratores > 0 && (
            <div className="bg-red-400 transition-all" style={{ width: `${(stats.detratores / stats.total) * 100}%` }} />
          )}
        </div>

        {/* Top temas from AI analysis */}
        {stats.topTemas.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Temas mais mencionados</p>
            <div className="flex flex-wrap gap-2">
              {stats.topTemas.map(([tema, count]) => (
                <span key={tema} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                  {tema} <span className="text-slate-400">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent comments */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <MessageSquare size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Últimos Comentários</h3>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {respostas.filter(r => r.comentario).slice(0, 20).map((r) => {
            const analise = (r.metadata as any)?.analise;
            const sentColor = analise?.sentimento === 'positivo' ? 'bg-emerald-100 text-emerald-700'
              : analise?.sentimento === 'negativo' ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-600';

            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      r.nota >= 9 ? 'bg-emerald-100 text-emerald-700'
                      : r.nota >= 7 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {r.nota}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {r.clientes?.contato_nome ?? r.clientes?.nome_fantasia ?? '—'}
                    </span>
                    {r.pedidos?.numero && (
                      <span className="text-xs text-slate-400">Pedido #{r.pedidos.numero}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {analise?.sentimento && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sentColor}`}>
                        {analise.sentimento}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{r.respondido_em ? formatDate(r.respondido_em) : ''}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 pl-9">{r.comentario}</p>
              </div>
            );
          })}
          {respostas.filter(r => r.comentario).length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Nenhum comentário recebido ainda</div>
          )}
        </div>
      </div>
    </div>
  );
}
