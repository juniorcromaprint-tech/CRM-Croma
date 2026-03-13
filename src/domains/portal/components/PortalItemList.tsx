// src/domains/portal/components/PortalItemList.tsx
import { brl } from '@/shared/utils/format';
import type { PortalProposta } from '../services/portal.service';

interface Props {
  itens: PortalProposta['itens'];
  onItemClick?: (itemId: string) => void;
}

export function PortalItemList({ itens, onItemClick }: Props) {
  if (!itens?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Itens da Proposta</h3>
      {itens.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-2xl border border-slate-200 p-4 cursor-pointer hover:border-blue-300 transition-colors"
          onClick={() => onItemClick?.(item.id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-slate-800">{item.descricao}</p>
              {item.especificacao && (
                <p className="text-sm text-slate-500 mt-0.5">{item.especificacao}</p>
              )}
            </div>
            <p className="font-semibold text-slate-900 whitespace-nowrap ml-4">{brl(item.valor_total)}</p>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>Qtd: {item.quantidade}</span>
            <span>Unit: {brl(item.valor_unitario)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
