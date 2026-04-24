// src/domains/comercial/components/TrackingPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Clock, MousePointerClick, Smartphone, Monitor, Tablet, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect } from 'react';

interface Props {
  propostaId: string;
}

interface ViewData {
  id: string;
  session_id: string;
  ip_address: string | null;
  device_type: string;
  browser: string;
  duration_seconds: number;
  max_scroll_depth: number;
  downloaded_pdf: boolean;
  geo_city: string;
  geo_region: string;
  created_at: string;
}

function calcScore(views: ViewData[]): number {
  const totalViews = Math.min(views.length, 10);
  const totalDuration = views.reduce((s, v) => s + (v.duration_seconds || 0), 0);
  const maxScroll = Math.max(...views.map(v => v.max_scroll_depth || 0), 0);
  const hasPdf = views.some(v => v.downloaded_pdf);

  const raw = totalViews * 10 + Math.min(totalDuration, 600) / 6 + maxScroll + (hasPdf ? 20 : 0);
  return Math.min(Math.round(raw / 2.3), 100);
}

function getLabel(score: number): { text: string; color: string } {
  if (score < 25) return { text: 'Frio', color: 'text-blue-500' };
  if (score < 50) return { text: 'Morno', color: 'text-yellow-500' };
  if (score < 75) return { text: 'Quente', color: 'text-orange-500' };
  return { text: 'Muito Quente', color: 'text-red-500' };
}

function getBarColor(score: number): string {
  if (score < 25) return 'bg-blue-500';
  if (score < 50) return 'bg-yellow-500';
  if (score < 75) return 'bg-orange-500';
  return 'bg-red-500';
}

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'mobile') return <Smartphone size={14} />;
  if (type === 'tablet') return <Tablet size={14} />;
  return <Monitor size={14} />;
};

export function TrackingPanel({ propostaId }: Props) {
  const { data: views = [], refetch } = useQuery({
    queryKey: ['proposta-views', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_views')
        .select('*')
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ViewData[];
    },
    enabled: !!propostaId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`views-${propostaId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'proposta_views',
        filter: `proposta_id=eq.${propostaId}`,
      }, () => { refetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [propostaId, refetch]);

  if (views.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h4 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-2">
          <TrendingUp size={16} /> Tracking de Interesse
        </h4>
        <p className="text-sm text-slate-400">Nenhuma visualização ainda.</p>
      </div>
    );
  }

  const score = calcScore(views);
  const label = getLabel(score);
  const totalDuration = views.reduce((s, v) => s + (v.duration_seconds || 0), 0);
  const maxScroll = Math.max(...views.map(v => v.max_scroll_depth || 0));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
        <TrendingUp size={16} /> Tracking de Interesse
      </h4>

      {/* Thermometer */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-sm font-semibold ${label.color}`}>{label.text}</span>
          <span className="text-sm text-slate-500">{score}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <Eye size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{views.length}</p>
          <p className="text-xs text-slate-400">Aberturas</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <Clock size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{Math.round(totalDuration / 60)}min</p>
          <p className="text-xs text-slate-400">Tempo total</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <MousePointerClick size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{maxScroll}%</p>
          <p className="text-xs text-slate-400">Scroll máx</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Visualizações</h5>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {views.slice(0, 10).map(v => (
            <div key={v.id} className="flex items-center gap-2 text-xs text-slate-500">
              <DeviceIcon type={v.device_type} />
              <span>{v.browser}</span>
              {v.geo_city && <span>• {v.geo_city}/{v.geo_region}</span>}
              {v.ip_address && <span className="text-slate-400 font-mono text-[10px]">({v.ip_address})</span>}
              <span className="ml-auto">{formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
