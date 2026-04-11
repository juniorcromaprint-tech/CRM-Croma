// src/domains/portal/components/PortalItemList.tsx
import { brl } from '@/shared/utils/format';
import { Package, ChevronRight, Layers, Ruler } from 'lucide-react';
import type { PortalProposta } from '../services/portal.service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalItem {
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  // União de itens (migration 094) — may be absent on older records
  grupo_uniao?: string | null;
  nome_exibicao?: string | null;
  item_visivel?: boolean | null;
}

interface Props {
  itens: PortalProposta['itens'];
  onItemClick?: (itemId: string) => void;
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
        isGroup: false,
      });
    }
  }

  return display;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortalItemList({ itens, onItemClick }: Props) {
  if (!itens?.length) return null;

  const displayItems = buildDisplayItems(itens as PortalItem[]);

  if (!displayItems.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-800">Itens da Proposta</h3>
        <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
          {displayItems.length} {displayItems.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="space-y-3">
        {displayItems.map((item, index) => (
          <div
            key={item.id}
            className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all duration-200"
          >
            <div
              className="p-5 cursor-pointer"
              onClick={() => onItemClick?.(item.id)}
            >
              <div className="flex items-start gap-4">
                {/* Number badge */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  item.isGroup
                    ? 'bg-violet-50 text-violet-600'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {item.isGroup ? <Layers size={16} /> : index + 1}
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
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
