// src/domains/ai/components/ClienteResumo.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, ClienteResumoData } from '../types/ai.types';

interface ClienteResumoProps {
  result: AIResponse;
  onClose: () => void;
}

export default function ClienteResumo({ result, onClose }: ClienteResumoProps) {
  const data = result.structured_data as unknown as ClienteResumoData;

  const riscoColor = {
    baixo: 'text-green-600 bg-green-50',
    medio: 'text-amber-600 bg-amber-50',
    alto: 'text-red-600 bg-red-50',
  }[data?.risco ?? 'baixo'] ?? 'text-slate-600 bg-slate-50';

  return (
    <AIResultPanel result={result} title="Resumo do Cliente" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Ticket Medio</span>
              <p className="text-lg font-bold text-slate-800">{brl(data.ticket_medio)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Total Pedidos</span>
              <p className="text-lg font-bold text-slate-800">{data.total_pedidos}</p>
            </div>
            <div className={`rounded-xl p-3 ${riscoColor}`}>
              <span className="text-xs uppercase tracking-wide opacity-70">Risco</span>
              <p className="text-lg font-bold capitalize">{data.risco}</p>
            </div>
          </div>

          {data.produtos_frequentes?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Produtos Frequentes</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.produtos_frequentes.map((p, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">{p}</span>
                ))}
              </div>
            </div>
          )}

          {data.padrao_compra && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Padrao de Compra</span>
              <p className="text-xs text-slate-700 mt-1">{data.padrao_compra}</p>
            </div>
          )}

          {data.sugestao_abordagem && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-xs text-blue-500 uppercase tracking-wide">Sugestao de Abordagem</span>
              <p className="text-xs text-blue-800 mt-1">{data.sugestao_abordagem}</p>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
