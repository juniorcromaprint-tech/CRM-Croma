// src/domains/ai/components/ComposicaoSugestao.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, ComposicaoProdutoData } from '../types/ai.types';

interface ComposicaoSugestaoProps {
  result: AIResponse;
  onClose: () => void;
  onApply?: (data: ComposicaoProdutoData) => void;
}

export default function ComposicaoSugestao({ result, onClose, onApply }: ComposicaoSugestaoProps) {
  const data = result.structured_data as unknown as ComposicaoProdutoData;

  return (
    <AIResultPanel result={result} title="Composicao Sugerida" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          {/* Modelo sugerido */}
          {data.modelo_sugerido?.nome && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-xs text-blue-500 uppercase tracking-wide">Modelo Base</span>
              <p className="text-sm font-semibold text-blue-800 mt-1">
                {data.modelo_sugerido.nome}
                {data.modelo_sugerido.categoria && (
                  <span className="ml-2 text-xs font-normal text-blue-500">({data.modelo_sugerido.categoria})</span>
                )}
              </p>
            </div>
          )}

          {/* Materiais */}
          {data.materiais?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Materiais ({data.materiais.length})</span>
              <div className="mt-1 space-y-1">
                {data.materiais.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-700">{m.nome}</span>
                    <span className="text-slate-500">
                      {m.quantidade_estimada} {m.unidade} | {brl(m.preco_unitario)}/{m.unidade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acabamentos */}
          {data.acabamentos?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Acabamentos ({data.acabamentos.length})</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.acabamentos.map((a, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded-lg text-xs ${a.obrigatorio ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {a.nome} {a.obrigatorio && '*'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custo estimado */}
          {data.custo_estimado > 0 && (
            <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-green-700">Custo Estimado de Materiais</span>
              <span className="font-bold text-green-800">{brl(data.custo_estimado)}</span>
            </div>
          )}

          {/* Apply button */}
          {onApply && (
            <button
              onClick={() => onApply(data)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
            >
              Aplicar Composicao ao Orcamento
            </button>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
