// src/domains/comercial/components/leads/LeadsTable.tsx
// Tabela de leads com checkbox de seleção múltipla para disparos.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.4

import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, Ban, ChevronRight, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';
import type { useLeadsSelection } from '../../hooks/useLeadsSelection';

// ─── Status badge config ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  novo:        'bg-slate-100 text-slate-600',
  contatado:   'bg-blue-50 text-blue-700',
  qualificado: 'bg-indigo-50 text-indigo-700',
  proposta:    'bg-purple-50 text-purple-700',
  negociacao:  'bg-amber-50 text-amber-700',
  fechado:     'bg-emerald-50 text-emerald-700',
  perdido:     'bg-red-50 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado',
  proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

const SUB_SEG_LABEL: Record<string, string> = {
  vigilancia_patrimonial: 'Vigilância',
  seguranca_eletronica:   'Eletrônica',
  portaria_acesso:        'Portaria',
  monitoramento_24h:      'Monitoramento',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `${d}d atrás`;
  if (d < 30) return `${Math.floor(d / 7)}sem atrás`;
  if (d < 365) return `${Math.floor(d / 30)}m atrás`;
  return `${Math.floor(d / 365)}a atrás`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  leads: LeadDisparo[];
  isLoading: boolean;
  selection: ReturnType<typeof useLeadsSelection>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadsTable({ leads, isLoading, selection }: Props) {
  const navigate = useNavigate();
  const allIds = leads.map(l => l.id);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <MessageCircle size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhum lead encontrado</h3>
        <p className="text-sm text-slate-400 mt-1">Ajuste os filtros ou importe novos leads</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {/* Checkbox selectAll */}
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={selection.isAllSelected(allIds)}
                    data-state={selection.isPartialSelected(allIds) ? 'indeterminate' : undefined}
                    onCheckedChange={() => selection.toggleAll(allIds)}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Empresa</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Contato</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Telefone</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Segmento</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Últ. contato</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Score</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Cidade</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Conversa</th>
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const isBlocked  = lead.bloqueado_disparo;
                const isSelected = selection.has(lead.id);

                return (
                  <Tooltip key={lead.id}>
                    <TooltipTrigger asChild>
                      <tr
                        className={[
                          'border-b border-slate-50 last:border-0 transition-colors group',
                          isBlocked  ? 'opacity-50 cursor-default' : 'hover:bg-blue-50/40 cursor-pointer',
                          isSelected && !isBlocked ? 'bg-blue-50' : '',
                        ].join(' ')}
                        onClick={() => {
                          if (!isBlocked) navigate(`/leads/${lead.id}`);
                        }}
                      >
                        {/* Checkbox */}
                        <td
                          className="w-10 px-3 py-3"
                          onClick={e => {
                            e.stopPropagation();
                            if (!isBlocked) selection.toggle(lead.id);
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isBlocked}
                            onCheckedChange={() => {
                              if (!isBlocked) selection.toggle(lead.id);
                            }}
                            aria-label={`Selecionar ${lead.empresa}`}
                          />
                        </td>

                        {/* Empresa */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isBlocked && (
                              <Ban size={12} className="text-slate-400 shrink-0" aria-hidden />
                            )}
                            <span className="font-medium text-slate-800 truncate max-w-[180px]">
                              {lead.empresa ?? '—'}
                            </span>
                          </div>
                        </td>

                        {/* Contato */}
                        <td className="px-4 py-3 text-slate-600 truncate max-w-[140px]">
                          {lead.contato_nome ?? '—'}
                        </td>

                        {/* Telefone */}
                        <td className="px-4 py-3">
                          {lead.contato_telefone ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${lead.tem_telefone_valido ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              <Phone size={10} />
                              {lead.contato_telefone}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">sem telefone</span>
                          )}
                        </td>

                        {/* Segmento + sub-segmento */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {lead.segmento && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {lead.segmento}
                              </Badge>
                            )}
                            {lead.sub_segmento && (
                              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">
                                {SUB_SEG_LABEL[lead.sub_segmento] ?? lead.sub_segmento}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {lead.status ? (
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {STATUS_LABEL[lead.status] ?? lead.status}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Última conversa */}
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {formatRelative(lead.ultima_conversa_em)}
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3 text-center">
                          {lead.score != null ? (
                            <span className={`text-xs font-semibold ${lead.score >= 70 ? 'text-emerald-600' : lead.score >= 40 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {lead.score}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Cidade */}
                        <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[100px]">
                          {lead.cidade ?? '—'}
                        </td>

                        {/* Em conversa ativa */}
                        <td className="px-4 py-3 text-center">
                          {lead.em_conversa_ativa ? (
                            <span title="Em conversa ativa">
                              <MessageCircle size={14} className="text-blue-500 mx-auto" />
                            </span>
                          ) : (
                            <span className="text-slate-200">·</span>
                          )}
                        </td>

                        {/* Chevron */}
                        <td className="w-8 px-2 py-3">
                          {!isBlocked && (
                            <ChevronRight size={15} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                          )}
                        </td>
                      </tr>
                    </TooltipTrigger>
                    {isBlocked && (
                      <TooltipContent side="top">
                        Bloqueado para disparos (NAO INCLUIR)
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
