// src/domains/ai/components/OrcamentoAnalise.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, OrcamentoAnaliseData } from '../types/ai.types';

interface OrcamentoAnaliseProps {
  result: AIResponse;
  onClose: () => void;
}

/** @deprecated Use AISidebar instead */
export default function OrcamentoAnalise({ result, onClose }: OrcamentoAnaliseProps) {
  const data = result.structured_data as unknown as OrcamentoAnaliseData;

  return (
    <AIResultPanel result={result} title="Análise do Orçamento" onClose={onClose}>
      {data && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {data.margem_estimada != null && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Margem Estimada</span>
              <p className={`text-lg font-bold ${data.margem_estimada < 30 ? 'text-red-600' : 'text-green-600'}`}>
                {data.margem_estimada.toFixed(1)}%
              </p>
            </div>
          )}
          {data.preco_sugerido != null && data.preco_sugerido > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Preço Sugerido</span>
              <p className="text-lg font-bold text-slate-800">{brl(data.preco_sugerido)}</p>
            </div>
          )}
          {data.comparativo_historico && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide">vs Historico</span>
              <p className="text-sm font-semibold text-slate-700 mt-1">{data.comparativo_historico}</p>
            </div>
          )}
          {data.itens_faltantes?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <span className="text-xs text-amber-500 uppercase tracking-wide">Itens Faltantes</span>
              <ul className="mt-1 space-y-0.5">
                {data.itens_faltantes.map((item, i) => (
                  <li key={i} className="text-xs text-amber-700">- {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
