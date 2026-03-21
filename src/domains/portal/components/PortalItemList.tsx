// src/domains/portal/components/PortalItemList.tsx
import { brl } from '@/shared/utils/format';
import { Package, ChevronRight } from 'lucide-react';
import type { PortalProposta } from '../services/portal.service';
import { EscalaPrecos } from '@/domains/comercial/components/EscalaPrecos';

interface Props {
  itens: PortalProposta['itens'];
  onItemClick?: (itemId: string) => void;
}

export function PortalItemList({ itens, onItemClick }: Props) {
  if (!itens?.length) return null;

  // Mostrar escala se há mais de um item (incentivo para aumentar volume)
  const mostrarEscala = itens.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-800">Itens da Proposta</h3>
        <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="space-y-3">
        {itens.map((item, index) => (
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
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                        {item.descricao}
                      </p>
                      {item.especificacao && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.especificacao}</p>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
                  </div>

                  {/* Price row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="bg-slate-50 rounded-md px-2 py-1">Qtd: {item.quantidade}</span>
                      <span className="bg-slate-50 rounded-md px-2 py-1">Unit: {brl(item.valor_unitario)}</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{brl(item.valor_total)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela de escala — visível quando há múltiplos itens */}
            {mostrarEscala && item.valor_unitario > 0 && (
              <div className="px-5 pb-4">
                <EscalaPrecos
                  precoUnitarioBase={item.valor_unitario}
                  quantidadeAtual={item.quantidade}
                  titulo="Ver preços por volume"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
