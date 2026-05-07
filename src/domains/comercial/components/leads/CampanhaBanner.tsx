// src/domains/comercial/components/leads/CampanhaBanner.tsx
// Banner do topo da tela /leads — mostra status agregado da campanha em andamento.
//
// v2 (2026-05-06 Entrega 2): lógica DUAL.
//   - Se houver campanha em status='ativa' em agent_campanhas → mostra ela com
//     métricas REAIS (totalLeads, totalDisparados, totalEnfileiradas vindo de
//     agent_conversations.campanha_id e agent_messages.campanha_id).
//   - Se NÃO houver → fallback para o cálculo legacy por segmento (preserva UX
//     atual antes de migrar todos os disparos para campanhas reais).
//
// Métricas operacionais (dia da rampa, enviadas hoje, janelas BRT) continuam
// vindo do hook useCampanhaStatus que lê dados globais do dia.

import { Megaphone, TrendingUp, Clock, Send } from 'lucide-react';
import { useCampanhaStatus } from '../../hooks/useLeadsDisparo';
import { useCampanhaAtivaResumo } from '../../hooks/useAgentCampanhas';

interface Props {
  /** Usado APENAS no fallback legacy quando não há campanha ativa em agent_campanhas. */
  segmento?: string;
  /** Override do título — só usado no fallback. Quando há campanha real, usa o nome dela. */
  titulo?: string;
  className?: string;
}

export function CampanhaBanner({
  segmento = 'seguranca',
  titulo = 'Envelopamento de poste para segurança',
  className = '',
}: Props) {
  // Fonte 1 (preferida): campanha ativa real em agent_campanhas
  const { data: ativa, isLoading: loadingAtiva } = useCampanhaAtivaResumo();
  // Fonte 2 (fallback + métricas operacionais sempre): cálculo legacy por segmento
  const { data: status, isLoading: loadingStatus } = useCampanhaStatus(segmento);

  const isLoading = loadingAtiva || loadingStatus;

  if (isLoading || !status) {
    return (
      <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 animate-pulse ${className}`}>
        <div className="h-4 bg-blue-100 rounded w-1/3 mb-2" />
        <div className="h-3 bg-blue-100 rounded w-2/3" />
      </div>
    );
  }

  // Decide a fonte de verdade do nome e dos números primários
  const usandoCampanhaReal = !!ativa;
  const tituloExibido    = usandoCampanhaReal ? ativa!.campanha.nome : titulo;
  const totalLeads       = usandoCampanhaReal ? ativa!.totalLeads        : status.totalLeads;
  const totalDisparados  = usandoCampanhaReal ? ativa!.totalDisparados   : status.totalDisparados;
  const totalEnfileiradas= usandoCampanhaReal ? ativa!.totalEnfileiradas : status.totalEnfileiradas;

  const pctConcluido = totalLeads > 0
    ? Math.round((totalDisparados / totalLeads) * 100)
    : 0;

  return (
    <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 ${className}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="bg-blue-100 text-blue-700 rounded-xl p-2 shrink-0">
            <Megaphone size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
              {usandoCampanhaReal ? `Campanha ativa · ${ativa!.campanha.canal}` : 'Campanha em andamento'}
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
              {tituloExibido}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span>
                <strong className="text-slate-700">{totalLeads}</strong> leads totais
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-700">{totalDisparados}</strong> já disparados
                <span className="text-slate-400 ml-1">({pctConcluido}%)</span>
              </span>
              {totalEnfileiradas > 0 && (
                <>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-700">{totalEnfileiradas}</strong> na fila
                  </span>
                </>
              )}
              {usandoCampanhaReal && ativa!.campanha.total_alvo != null && ativa!.campanha.total_alvo > 0 && (
                <>
                  <span>·</span>
                  <span>
                    meta <strong className="text-slate-700">{ativa!.campanha.total_alvo}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Stat
            icon={<TrendingUp size={11} />}
            label="Dia da rampa"
            value={status.diaDaRampa != null ? `${status.diaDaRampa}/8` : '—'}
          />
          <Stat
            icon={<Send size={11} />}
            label="Enviadas hoje"
            value={`${status.enviadasHoje}/${status.limiteDiarioAtual}`}
          />
          <Stat
            icon={<Clock size={11} />}
            label="Janelas BRT"
            value={formatJanelas(status.janelas)}
          />
        </div>
      </div>

      {/* Barra de progresso geral */}
      {totalLeads > 0 && (
        <div className="mt-3 h-1 bg-blue-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${pctConcluido}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Formata janelas BRT para o banner: [['09:00','12:00'],['14:00','17:00']] → "9–12 / 14–17"
function formatJanelas(janelas: [string, string][]): string {
  if (!janelas || janelas.length === 0) return '—';
  return janelas
    .map(([s, e]) => {
      const sh = parseInt(s.split(':')[0], 10);
      const eh = parseInt(e.split(':')[0], 10);
      return `${sh}–${eh}`;
    })
    .join(' / ');
}

function Stat({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/60 border border-blue-100 rounded-xl px-3 py-1.5 text-center min-w-[78px]">
      <div className="text-[10px] text-blue-600 flex items-center justify-center gap-1 uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="text-xs font-semibold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
