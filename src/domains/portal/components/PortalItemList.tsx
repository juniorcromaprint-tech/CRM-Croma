// src/domains/portal/components/PortalItemList.tsx
import { brl } from '@/shared/utils/format';
import { Package, ChevronRight, Layers, Ruler, Check, X, Loader2 } from 'lucide-react';
import type { PortalProposta } from '../services/portal.service';
import { PortalItemImagem } from './PortalItemImagem';
import { useAprovacaoParcial, type AprovacaoState } from '../hooks/useAprovacaoParcial';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalItem {
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  largura_cm?: number | null;
  altura_cm?: number | null;
  area_m2?: number | null;
  // União de itens (migration 094) — may be absent on older records
  grupo_uniao?: string | null;
  nome_exibicao?: string | null;
  item_visivel?: boolean | null;
  // FASE 2-B
  imagem_url?: string | null;
  aprovado?: boolean | null;
}

interface Props {
  itens: PortalProposta['itens'];
  onItemClick?: (itemId: string) => void;
  /** Quando preenchido, ativa modo "aprovacao parcial" (checkboxes por linha). */
  token?: string;
  /** Bloqueia interacao quando a proposta ja foi convertida/aprovada definitivamente. */
  readOnly?: boolean;
  /** Callback opcional para o pai reagir a mudanca de status agregado. */
  onStatusChange?: (novoStatus: string) => void;
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

interface DisplayItem {
  // ID of the "display" item within the group (or the item itself when ungrouped)
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  largura_cm?: number | null;
  altura_cm?: number | null;
  area_m2?: number | null;
  imagem_url?: string | null;
  isGroup: boolean;
  // When grouped: the summed total of ALL items in the group
  grupoTotal?: number;
  grupoNome?: string;
  grupoItemCount?: number;
}

function buildDisplayItems(itens: PortalItem[]): DisplayItem[] {
  const display: DisplayItem[] = [];
  const visitedGroups = new Set<string>();

  for (const item of itens) {
    // Items with item_visivel === false are completely hidden (only shown as part of their group)
    if (item.item_visivel === false) continue;

    if (item.grupo_uniao) {
      // Already processed this group — skip
      if (visitedGroups.has(item.grupo_uniao)) continue;
      visitedGroups.add(item.grupo_uniao);

      // Sum total of ALL items in this group (including hidden ones)
      const grupoItens = itens.filter((i) => i.grupo_uniao === item.grupo_uniao);
      const grupoTotal = grupoItens.reduce((sum, i) => sum + i.valor_total, 0);

      display.push({
        id: item.id,
        descricao: item.nome_exibicao ?? item.descricao,
        especificacao: item.especificacao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        imagem_url: item.imagem_url ?? null,
        isGroup: true,
        grupoTotal,
        grupoNome: item.nome_exibicao ?? undefined,
        grupoItemCount: grupoItens.length,
      });
    } else {
      // Regular ungrouped item
      display.push({
        id: item.id,
        descricao: item.descricao,
        especificacao: item.especificacao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        largura_cm: item.largura_cm,
        altura_cm: item.altura_cm,
        area_m2: item.area_m2,
        imagem_url: item.imagem_url ?? null,
        isGroup: false,
      });
    }
  }

  return display;
}

// ─── Helpers de aprovacao por linha ──────────────────────────────────────────

function estadoCls(estado: AprovacaoState): string {
  if (estado === true) return 'border-emerald-300 bg-emerald-50/50';
  if (estado === false) return 'border-rose-300 bg-rose-50/50 opacity-70';
  return 'border-slate-200';
}

interface AprovBtnProps {
  ativo: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  variant: 'aprovar' | 'recusar';
  label: string;
}

function AprovBtn({ ativo, disabled, loading, onClick, variant, label }: AprovBtnProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border';
  const cores =
    variant === 'aprovar'
      ? ativo
        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
        : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
      : ativo
        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
        : 'bg-white text-rose-700 border-rose-200 hover:border-rose-400 hover:bg-rose-50';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && !loading) onClick();
      }}
      disabled={disabled || loading}
      aria-pressed={ativo}
      className={`${base} ${cores} ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : variant === 'aprovar' ? (
        <Check size={13} />
      ) : (
        <X size={13} />
      )}
      {label}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortalItemList({
  itens,
  onItemClick,
  token,
  readOnly = false,
  onStatusChange,
}: Props) {
  if (!itens?.length) return null;

  const displayItems = buildDisplayItems(itens as PortalItem[]);

  // Hook so e usado se houver token (modo "aprovacao parcial" ligado).
  // Quando nao tem token, a coluna de aprovacao some — vira so leitura visual.
  const aprovacao = useAprovacaoParcial({
    token: token ?? '',
    itensIniciais: token ? (itens as PortalItem[]) : [],
    onStatusChange: onStatusChange
      ? (novoStatus) => onStatusChange(novoStatus)
      : undefined,
  });

  const modoAprovacao = Boolean(token) && !readOnly;

  if (!displayItems.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Package size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-800">Itens da Proposta</h3>
        <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
          {displayItems.length} {displayItems.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {modoAprovacao && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-emerald-700">{aprovacao.resumo.aprovados}</span>
            {' aprovados · '}
            <span className="font-semibold text-rose-700">{aprovacao.resumo.recusados}</span>
            {' recusados · '}
            <span className="font-semibold text-slate-700">{aprovacao.resumo.pendentes}</span>
            {' pendentes'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => aprovacao.aprovarTodos()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
            >
              <Check size={13} /> Aprovar todos
            </button>
            <button
              type="button"
              onClick={() => aprovacao.recusarTodos()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <X size={13} /> Recusar todos
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {displayItems.map((item, index) => {
          const estado = modoAprovacao
            ? (aprovacao.estados.get(item.id) ?? null)
            : null;
          const carregando = modoAprovacao && aprovacao.loading.has(item.id);

          return (
            <div
              key={item.id}
              className={`group bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all duration-200 ${
                modoAprovacao
                  ? estadoCls(estado)
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => onItemClick?.(item.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Number badge */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      item.isGroup
                        ? 'bg-violet-50 text-violet-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {item.isGroup ? <Layers size={16} /> : index + 1}
                  </div>

                  {/* Imagem do item (FASE 2-B) — segunda coluna, igual Mubisys */}
                  <div className="flex-shrink-0">
                    <PortalItemImagem
                      imagemUrl={item.imagem_url ?? null}
                      alt={item.descricao}
                      sizeMode="thumb"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {item.descricao}
                        </p>
                        {item.isGroup && item.grupoItemCount && item.grupoItemCount > 1 && (
                          <p className="text-xs text-violet-500 mt-0.5 flex items-center gap-1">
                            <Layers size={11} />
                            {item.grupoItemCount} componentes incluídos
                          </p>
                        )}
                        {!item.isGroup && item.especificacao && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.especificacao}</p>
                        )}
                        {!item.isGroup && item.largura_cm && item.altura_cm && (
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Ruler size={11} />
                            {(item.largura_cm / 100).toFixed(2)} x {(item.altura_cm / 100).toFixed(2)}m
                            {item.area_m2 && ` (${item.area_m2.toFixed(2)} m²)`}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      {item.isGroup ? (
                        // Grouped items: show total of the whole group, no unit price
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="bg-violet-50 text-violet-600 rounded-md px-2 py-1 font-medium">
                            Conjunto completo
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="bg-slate-50 rounded-md px-2 py-1">Qtd: {item.quantidade}</span>
                          <span className="bg-slate-50 rounded-md px-2 py-1">Unit: {brl(item.valor_unitario)}</span>
                        </div>
                      )}
                      <p className="text-lg font-bold text-slate-900">
                        {brl(item.isGroup && item.grupoTotal != null ? item.grupoTotal : item.valor_total)}
                      </p>
                    </div>

                    {/* Linha de aprovacao parcial (FASE 2-B) */}
                    {modoAprovacao && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-slate-200">
                        <AprovBtn
                          variant="aprovar"
                          ativo={estado === true}
                          loading={carregando && estado !== true}
                          onClick={() => aprovacao.setItem(item.id, true)}
                          label={estado === true ? 'Aprovado' : 'Aprovar'}
                        />
                        <AprovBtn
                          variant="recusar"
                          ativo={estado === false}
                          loading={carregando && estado !== false}
                          onClick={() => aprovacao.setItem(item.id, false)}
                          label={estado === false ? 'Recusado' : 'Recusar'}
                        />
                        {estado === null && (
                          <span className="ml-auto text-xs text-slate-400 italic">aguardando decisao</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
