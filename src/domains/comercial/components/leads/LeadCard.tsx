// src/domains/comercial/components/leads/LeadCard.tsx
// Card visual de um lead — substitui linha da tabela densa.

import { Phone, Mail, MessageCircle, Ban, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';
import type { EmailEngajamentoResumo } from '../../hooks/useEmailEngajamento';
import { EmailStatusBadge } from '@/components/ui/email-status-badge';

const SUB_SEGMENTO_AVATAR: Record<string, { bg: string; fg: string; label: string }> = {
  vigilancia_patrimonial: { bg: 'bg-purple-50', fg: 'text-purple-700', label: 'Vigilância' },
  seguranca_eletronica:   { bg: 'bg-orange-50', fg: 'text-orange-700', label: 'Eletrônica' },
  portaria_acesso:        { bg: 'bg-pink-50',   fg: 'text-pink-700',   label: 'Portaria' },
  monitoramento_24h:      { bg: 'bg-amber-50',  fg: 'text-amber-700',  label: 'Monitoramento' },
};

const STATUS_TONE: Record<string, string> = {
  novo:        'bg-slate-100 text-slate-600',
  contatado:   'bg-blue-50 text-blue-700',
  qualificado: 'bg-indigo-50 text-indigo-700',
  proposta:    'bg-purple-50 text-purple-700',
  negociacao:  'bg-amber-50 text-amber-700',
  fechado:     'bg-emerald-50 text-emerald-700',
  perdido:     'bg-red-50 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualif.',
  proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

interface Props {
  lead: LeadDisparo;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  /** Resumo de engajamento de email (último status, opens, clicks) — opcional. */
  emailResumo?: EmailEngajamentoResumo;
}

export function LeadCard({ lead, selected, onToggle, onOpen, emailResumo }: Props) {
  const isBlocked = lead.bloqueado_disparo;
  const inicial = (lead.empresa ?? lead.contato_nome ?? '?')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  const tone = lead.sub_segmento && SUB_SEGMENTO_AVATAR[lead.sub_segmento];
  const avatarBg = tone?.bg ?? 'bg-slate-100';
  const avatarFg = tone?.fg ?? 'text-slate-600';

  // Click no card inteiro = toggle do checkbox.
  // Botao "abrir detalhe" eh separado (botao interno menor).
  const handleCardClick = () => {
    if (!isBlocked) onToggle();
  };

  const baseClasses = [
    'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
    isBlocked
      ? 'bg-slate-50 border-slate-200 opacity-50 cursor-default'
      : selected
        ? 'bg-blue-50/70 border-blue-300 cursor-pointer'
        : 'bg-white border-slate-200 hover:bg-slate-50/70 cursor-pointer',
  ].join(' ');

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={baseClasses} onClick={handleCardClick}>
            {/* Checkbox — controlado pelo card; nao tem onCheckedChange propio */}
            <Checkbox
              checked={selected}
              disabled={isBlocked}
              tabIndex={-1}
              aria-label={`Selecionar ${lead.empresa ?? 'lead'}`}
              className="pointer-events-none"
            />

            {/* Avatar */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${avatarBg} ${avatarFg}`}>
              {isBlocked ? <Ban size={14} /> : inicial}
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-slate-800 truncate">
                  {lead.empresa ?? lead.contato_nome ?? '—'}
                </span>
                {lead.status && lead.status !== 'novo' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${STATUS_TONE[lead.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 flex-wrap">
                {lead.contato_nome && lead.empresa && (
                  <span className="truncate max-w-[140px]">{lead.contato_nome}</span>
                )}
                {lead.cidade && (
                  <>
                    {(lead.contato_nome && lead.empresa) && <span className="text-slate-300">·</span>}
                    <span className="truncate max-w-[120px]">{lead.cidade}</span>
                  </>
                )}
                {tone && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className={`${avatarFg} font-medium`}>{tone.label}</span>
                  </>
                )}
              </div>
            </div>

            {/* Badges direita */}
            <div className="flex items-center gap-1.5 shrink-0">
              {lead.em_conversa_ativa && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700">
                  <MessageCircle size={10} /> Conversa
                </span>
              )}
              {lead.tem_telefone_valido && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700">
                  <Phone size={10} /> WhatsApp
                </span>
              )}
              {lead.tem_email_valido && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700">
                  <Mail size={10} /> Email
                </span>
              )}
              {!lead.tem_telefone_valido && !lead.tem_email_valido && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-red-50 text-red-600">
                  sem contato
                </span>
              )}
              {/* Status do último email enviado (tracking Resend) */}
              {emailResumo && emailResumo.ultimo_status && (
                <EmailStatusBadge
                  status={emailResumo.ultimo_status}
                  qtdOpens={emailResumo.qtd_opens}
                  qtdClicks={emailResumo.qtd_clicks}
                  compact
                  tooltip={`Último email: ${emailResumo.ultimo_em ? new Date(emailResumo.ultimo_em).toLocaleString('pt-BR') : '—'}`}
                />
              )}
              {/* Botao para abrir detalhe — separado do toggle do card */}
              {!isBlocked && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpen(); }}
                  className="p-1 rounded-md text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  aria-label="Abrir detalhe"
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </TooltipTrigger>

        {isBlocked && (
          <TooltipContent side="top">
            Bloqueado para disparos (NAO INCLUIR)
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
