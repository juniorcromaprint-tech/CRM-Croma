// src/domains/comercial/components/leads/EmailTimeline.tsx
// Timeline visual de mensagens de email enviadas pra um lead, com tracking
// de cada estágio (enviado/entregue/aberto/clicado/bounce/reclamado).
// Usado no LeadDetailPage.

import { Loader2, Mail, MailX } from 'lucide-react';
import { useEmailEngajamentoLead } from '../../hooks/useEmailEngajamento';
import { EmailStatusBadge } from '@/components/ui/email-status-badge';
import { formatDate } from '@/shared/utils/format';

interface Props {
  leadId: string | undefined;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

export function EmailTimeline({ leadId }: Props) {
  const { data: msgs = [], isLoading, isError } = useEmailEngajamentoLead(leadId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-sm">Carregando emails...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        Não foi possível carregar o histórico de emails.
      </div>
    );
  }

  if (msgs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <MailX size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhum email enviado para este lead</h3>
        <p className="text-sm text-slate-400 mt-1">
          O histórico de envios e tracking aparecerá aqui depois do primeiro disparo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msgs.map(msg => {
        const events = [
          { label: 'Enviado',   ts: msg.enviado_em,    icon: '📤' },
          { label: 'Entregue',  ts: msg.entregue_em,   icon: '📬' },
          { label: 'Aberto',    ts: msg.abriu_em,      icon: '📧', extra: msg.qtd_opens > 1 ? `${msg.qtd_opens}×` : '' },
          { label: 'Clicou',    ts: msg.clicou_em,     icon: '🎯', extra: msg.qtd_clicks > 1 ? `${msg.qtd_clicks}×` : '' },
          { label: 'Bounce',    ts: msg.bounced_em,    icon: '⚠️' },
          { label: 'Reclamou',  ts: msg.reclamado_em,  icon: '🚫' },
        ].filter(e => e.ts);

        // Status final pra badge
        const ultimoStatus =
          msg.clicou_em   ? 'clicked' :
          msg.abriu_em    ? 'opened' :
          msg.bounced_em  ? 'bounced' :
          msg.reclamado_em ? 'complained' :
          msg.entregue_em ? 'delivered' :
          msg.enviado_em  ? 'enviada' : null;

        return (
          <div key={msg.message_id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header da mensagem */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Mail size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {msg.assunto || '(sem assunto)'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtDateTime(msg.data_envio)}
                    {msg.campanha && <> · campanha: <span className="text-slate-500">{msg.campanha}</span></>}
                  </p>
                </div>
              </div>
              <EmailStatusBadge
                status={ultimoStatus as any}
                qtdOpens={msg.qtd_opens}
                qtdClicks={msg.qtd_clicks}
              />
            </div>

            {/* Timeline de eventos */}
            <div className="px-4 py-3">
              <ol className="space-y-1.5">
                {events.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-base leading-none">{e.icon}</span>
                    <span className="text-slate-700 font-medium min-w-[80px]">{e.label}</span>
                    {e.extra && <span className="text-emerald-600 text-[10px] font-semibold bg-emerald-50 px-1 py-0.5 rounded">{e.extra}</span>}
                    <span className="text-slate-400 ml-auto">{fmtDateTime(e.ts)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        );
      })}
    </div>
  );
}
