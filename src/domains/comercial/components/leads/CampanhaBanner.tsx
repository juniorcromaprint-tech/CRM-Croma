// src/domains/comercial/components/leads/CampanhaBanner.tsx
// Banner do topo da tela /leads — mostra status agregado das campanhas em andamento.
//
// v3 (2026-05-08): empilha TODAS as campanhas ativas em vez de sobrescrever.
//   - Antes: useCampanhaAtivaResumo() pegava só a mais recente → email sobrescrevia WhatsApp.
//   - Agora: useCampanhasAtivasResumo() retorna todas; renderiza 1 card por campanha.
//   - Métricas operacionais (rampa, enviadas hoje, janelas BRT) aparecem só no PRIMEIRO card
//     pra não poluir e porque são globais do dia, não por campanha.
//   - Fallback legacy (sem nenhuma campanha em agent_campanhas) preservado.
//
// v2 (2026-05-06): lógica DUAL (campanha real vs fallback por segmento).

import { Megaphone, TrendingUp, Clock, Send, MessageCircle, Mail, Sparkles } from 'lucide-react';
import { useCampanhaStatus, useEmailStatus, type CampanhaStatus, type EmailStatus } from '../../hooks/useLeadsDisparo';
import { useCampanhasAtivasResumo, CampanhaAtivaBannerData } from '../../hooks/useAgentCampanhas';

interface Props {
  /** Usado APENAS no fallback legacy quando não há nenhuma campanha em agent_campanhas. */
  segmento?: string;
  /** Override do título — só usado no fallback. */
  titulo?: string;
  className?: string;
}

export function CampanhaBanner({
  segmento = 'seguranca',
  titulo = 'Envelopamento de poste para segurança',
  className = '',
}: Props) {
  // Fonte 1 (preferida): TODAS as campanhas ativas
  const { data: ativas, isLoading: loadingAtivas } = useCampanhasAtivasResumo();
  // Fonte 2 (fallback + métricas operacionais WhatsApp): cálculo legacy por segmento
  const { data: status, isLoading: loadingStatus } = useCampanhaStatus(segmento);
  // Fonte 3 (métricas operacionais Email): status de email global do dia
  const { data: emailStatus, isLoading: loadingEmail } = useEmailStatus();

  const isLoading = loadingAtivas || loadingStatus || loadingEmail;

  if (isLoading || !status) {
    return (
      <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 animate-pulse ${className}`}>
        <div className="h-4 bg-blue-100 rounded w-1/3 mb-2" />
        <div className="h-3 bg-blue-100 rounded w-2/3" />
      </div>
    );
  }

  // Se há campanhas em agent_campanhas, renderiza um card por campanha (empilhado).
  // Cada card recebe métricas globais do SEU canal (WA tem rampa, Email não).
  if (ativas && ativas.length > 0) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {ativas.map((c) => (
          <CampanhaCard
            key={c.campanha.id}
            data={c}
            statusWhatsApp={status}
            statusEmail={emailStatus}
          />
        ))}
      </div>
    );
  }

  // Fallback: nenhuma campanha em agent_campanhas → legacy por segmento
  return (
    <CampanhaCardLegacy
      titulo={titulo}
      status={status}
      className={className}
    />
  );
}

// ─── Card de uma campanha real (agent_campanhas) ────────────────────────────
function CampanhaCard({
  data,
  statusWhatsApp,
  statusEmail,
}: {
  data: CampanhaAtivaBannerData;
  statusWhatsApp: CampanhaStatus | undefined;
  statusEmail: EmailStatus | undefined;
}) {
  const { campanha, totalLeads, totalEnfileiradas, totalEnviadas, totalRespondidas } = data;

  const taxaResposta = totalEnviadas > 0
    ? Math.round((totalRespondidas / totalEnviadas) * 100)
    : 0;
  const meta = campanha.total_alvo ?? null;
  const progressoLeads = (meta && meta > 0)
    ? Math.round((totalLeads / meta) * 100)
    : (totalLeads > 0 ? 100 : 0);

  // Cores e ícone por canal
  const canalConfig = getCanalConfig(campanha.canal);

  return (
    <div className={`${canalConfig.bg} ${canalConfig.border} border rounded-2xl px-5 py-4`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`${canalConfig.iconBg} ${canalConfig.iconText} rounded-xl p-2 shrink-0`}>
            {canalConfig.icon}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-medium ${canalConfig.label} uppercase tracking-wide flex items-center gap-1.5`}>
              <span>Campanha ativa</span>
              <span className={`${canalConfig.badgeBg} ${canalConfig.badgeText} px-1.5 py-0.5 rounded text-[10px] font-semibold`}>
                {canalConfig.canalLabel}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
              {campanha.nome}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span>
                <strong className="text-slate-700">{totalLeads}</strong>
                {meta && meta > 0 ? (
                  <> / <strong className="text-slate-700">{meta}</strong> leads</>
                ) : (
                  <> leads totais</>
                )}
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-700">{totalEnviadas}</strong> enviadas
              </span>
              {totalRespondidas > 0 && (
                <>
                  <span>·</span>
                  <span>
                    <strong className="text-emerald-700">{totalRespondidas}</strong> respostas
                    <span className="text-emerald-600 ml-1">({taxaResposta}%)</span>
                  </span>
                </>
              )}
              {totalEnfileiradas > 0 && (
                <>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-700">{totalEnfileiradas}</strong> na fila
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Métricas globais por CANAL — cada card mostra as métricas DELE. */}
        {/* WhatsApp: rampa + enviadas hoje (WA) + janelas */}
        {campanha.canal === 'whatsapp' && statusWhatsApp && (
          <div className="flex items-center gap-2 shrink-0">
            <Stat
              icon={<TrendingUp size={11} />}
              label="Dia da rampa"
              value={statusWhatsApp.diaDaRampa != null ? `${statusWhatsApp.diaDaRampa}/8` : '—'}
              tone={canalConfig.tone}
            />
            <Stat
              icon={<Send size={11} />}
              label="Enviadas hoje"
              value={`${statusWhatsApp.enviadasHoje}/${statusWhatsApp.limiteDiarioAtual}`}
              tone={canalConfig.tone}
            />
            <Stat
              icon={<Clock size={11} />}
              label="Janelas BRT"
              value={formatJanelas(statusWhatsApp.janelas)}
              tone={canalConfig.tone}
            />
          </div>
        )}
        {/* Email: enviadas hoje (email) + janelas. SEM rampa (Resend não precisa). */}
        {campanha.canal === 'email' && statusEmail && (
          <div className="flex items-center gap-2 shrink-0">
            <Stat
              icon={<Send size={11} />}
              label="Emails hoje"
              value={`${statusEmail.enviadasHoje}/${statusEmail.limiteDiarioAtual}`}
              tone={canalConfig.tone}
            />
            <Stat
              icon={<Clock size={11} />}
              label="Janelas BRT"
              value={formatJanelas(statusEmail.janelas)}
              tone={canalConfig.tone}
            />
          </div>
        )}
        {/* Misto: agrega ambos */}
        {campanha.canal === 'misto' && statusWhatsApp && statusEmail && (
          <div className="flex items-center gap-2 shrink-0">
            <Stat
              icon={<MessageCircle size={11} />}
              label="WA hoje"
              value={`${statusWhatsApp.enviadasHoje}/${statusWhatsApp.limiteDiarioAtual}`}
              tone={canalConfig.tone}
            />
            <Stat
              icon={<Mail size={11} />}
              label="Email hoje"
              value={`${statusEmail.enviadasHoje}/${statusEmail.limiteDiarioAtual}`}
              tone={canalConfig.tone}
            />
            <Stat
              icon={<Clock size={11} />}
              label="Janelas BRT"
              value={formatJanelas(statusWhatsApp.janelas)}
              tone={canalConfig.tone}
            />
          </div>
        )}
      </div>

      {/* Barra de progresso de leads (vs meta quando definida) */}
      {totalLeads > 0 && (
        <div className={`mt-3 h-1 ${canalConfig.progressBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${canalConfig.progressFill} transition-all`}
            style={{ width: `${Math.min(progressoLeads, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Card legacy (sem campanha real, fallback por segmento) ──────────────────
function CampanhaCardLegacy({
  titulo,
  status,
  className,
}: {
  titulo: string;
  status: NonNullable<ReturnType<typeof useCampanhaStatus>['data']>;
  className: string;
}) {
  return (
    <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 ${className}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="bg-blue-100 text-blue-700 rounded-xl p-2 shrink-0">
            <Megaphone size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
              Campanha em andamento
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
              {titulo}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span>
                <strong className="text-slate-700">{status.totalLeads}</strong> leads totais
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-700">{status.totalDisparados}</strong> enviadas
              </span>
              {status.totalEnfileiradas > 0 && (
                <>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-700">{status.totalEnfileiradas}</strong> na fila
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Stat icon={<TrendingUp size={11} />} label="Dia da rampa"
                value={status.diaDaRampa != null ? `${status.diaDaRampa}/8` : '—'} tone="blue" />
          <Stat icon={<Send size={11} />} label="Enviadas hoje"
                value={`${status.enviadasHoje}/${status.limiteDiarioAtual}`} tone="blue" />
          <Stat icon={<Clock size={11} />} label="Janelas BRT"
                value={formatJanelas(status.janelas)} tone="blue" />
        </div>
      </div>
    </div>
  );
}

// ─── Configuração visual por canal ──────────────────────────────────────────
type CanalTone = 'blue' | 'emerald' | 'violet';

function getCanalConfig(canal: string): {
  tone: CanalTone;
  bg: string; border: string;
  iconBg: string; iconText: string;
  label: string;
  badgeBg: string; badgeText: string; canalLabel: string;
  icon: JSX.Element;
  progressBg: string; progressFill: string;
} {
  if (canal === 'whatsapp') {
    return {
      tone: 'emerald',
      bg: 'bg-emerald-50', border: 'border-emerald-100',
      iconBg: 'bg-emerald-100', iconText: 'text-emerald-700',
      label: 'text-emerald-700',
      badgeBg: 'bg-emerald-200', badgeText: 'text-emerald-800',
      canalLabel: 'WhatsApp',
      icon: <MessageCircle size={18} />,
      progressBg: 'bg-emerald-100', progressFill: 'bg-emerald-500',
    };
  }
  if (canal === 'email') {
    return {
      tone: 'blue',
      bg: 'bg-blue-50', border: 'border-blue-100',
      iconBg: 'bg-blue-100', iconText: 'text-blue-700',
      label: 'text-blue-700',
      badgeBg: 'bg-blue-200', badgeText: 'text-blue-800',
      canalLabel: 'Email',
      icon: <Mail size={18} />,
      progressBg: 'bg-blue-100', progressFill: 'bg-blue-500',
    };
  }
  // misto ou desconhecido
  return {
    tone: 'violet',
    bg: 'bg-violet-50', border: 'border-violet-100',
    iconBg: 'bg-violet-100', iconText: 'text-violet-700',
    label: 'text-violet-700',
    badgeBg: 'bg-violet-200', badgeText: 'text-violet-800',
    canalLabel: canal === 'misto' ? 'Misto' : canal,
    icon: <Sparkles size={18} />,
    progressBg: 'bg-violet-100', progressFill: 'bg-violet-500',
  };
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
  icon, label, value, tone = 'blue',
}: { icon: React.ReactNode; label: string; value: string; tone?: CanalTone }) {
  const toneClasses: Record<CanalTone, { border: string; text: string }> = {
    blue:    { border: 'border-blue-100',    text: 'text-blue-600' },
    emerald: { border: 'border-emerald-100', text: 'text-emerald-600' },
    violet:  { border: 'border-violet-100',  text: 'text-violet-600' },
  };
  const t = toneClasses[tone];
  return (
    <div className={`bg-white/60 border ${t.border} rounded-xl px-3 py-1.5 text-center min-w-[78px]`}>
      <div className={`text-[10px] ${t.text} flex items-center justify-center gap-1 uppercase tracking-wide`}>
        {icon} {label}
      </div>
      <div className="text-xs font-semibold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
