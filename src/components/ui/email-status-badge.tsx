// src/components/ui/email-status-badge.tsx
// Badge único reutilizável para mostrar o status de tracking de email do lead.
// Cores + ícones consistentes (Outlook-style). Tooltip com timestamp opcional.

import { Mail, Send, Inbox, MailOpen, MousePointerClick, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type EmailStatus =
  | 'enviada'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'erro'
  | null
  | undefined;

interface Props {
  status: EmailStatus;
  /** Quantidade de opens (mostra badge + count se >1). */
  qtdOpens?: number;
  /** Quantidade de clicks. */
  qtdClicks?: number;
  /** Tooltip com data legível. */
  tooltip?: string;
  /** Tamanho compacto pra cards de lista. */
  compact?: boolean;
}

const CONFIG: Record<string, { label: string; cls: string; Icon: any }> = {
  enviada:    { label: 'Enviado',   cls: 'bg-slate-100 text-slate-600',     Icon: Send },
  delivered:  { label: 'Entregue',  cls: 'bg-blue-50 text-blue-700',         Icon: Inbox },
  opened:     { label: 'Aberto',    cls: 'bg-emerald-50 text-emerald-700',   Icon: MailOpen },
  clicked:    { label: 'Clicou',    cls: 'bg-emerald-100 text-emerald-800',  Icon: MousePointerClick },
  bounced:    { label: 'Bounce',    cls: 'bg-red-50 text-red-700',           Icon: AlertTriangle },
  complained: { label: 'Reclamou',  cls: 'bg-purple-50 text-purple-700',     Icon: ShieldAlert },
  erro:       { label: 'Erro',      cls: 'bg-amber-50 text-amber-700',       Icon: AlertTriangle },
  none:       { label: 'Sem email', cls: 'bg-slate-50 text-slate-400',       Icon: Mail },
};

export function EmailStatusBadge({ status, qtdOpens, qtdClicks, tooltip, compact = false }: Props) {
  const key = status ?? 'none';
  const cfg = CONFIG[key] ?? CONFIG.none;
  const { label, cls, Icon } = cfg;

  // Mostra contador se > 1 (ex: "Aberto 3×")
  let displayLabel = label;
  if (status === 'opened' && qtdOpens && qtdOpens > 1) {
    displayLabel = `${label} ${qtdOpens}×`;
  } else if (status === 'clicked' && qtdClicks && qtdClicks > 1) {
    displayLabel = `${label} ${qtdClicks}×`;
  }

  const sizeCls = compact
    ? 'text-[10px] px-1.5 py-0.5 gap-1 rounded-md'
    : 'text-xs px-2 py-1 gap-1.5 rounded-lg';
  const iconSize = compact ? 10 : 12;

  const badge = (
    <span className={`inline-flex items-center font-medium ${sizeCls} ${cls}`}>
      <Icon size={iconSize} />
      {displayLabel}
    </span>
  );

  if (!tooltip) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
