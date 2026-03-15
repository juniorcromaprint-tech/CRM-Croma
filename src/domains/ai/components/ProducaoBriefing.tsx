// src/domains/ai/components/ProducaoBriefing.tsx

import AIResultPanel from './AIResultPanel';
import { CheckCircle, XCircle } from 'lucide-react';
import type { AIResponse, BriefingProducaoData } from '../types/ai.types';

interface ProducaoBriefingProps {
  result: AIResponse;
  onClose: () => void;
}

export default function ProducaoBriefing({ result, onClose }: ProducaoBriefingProps) {
  const data = result.structured_data as unknown as BriefingProducaoData;

  return (
    <AIResultPanel result={result} title="Briefing de Producao" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          {/* Prazo */}
          {data.prazo_producao && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-[10px] text-blue-500 uppercase tracking-wide">Prazo Estimado</span>
              <p className="text-sm font-semibold text-blue-800 mt-1">{data.prazo_producao}</p>
            </div>
          )}

          {/* Itens do briefing */}
          {data.itens_briefing?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Itens ({data.itens_briefing.length})</span>
              <div className="mt-1 space-y-2">
                {data.itens_briefing.map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-semibold text-slate-800">{item.produto}</p>
                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                      <span>Medidas: {item.medidas}</span>
                      <span>Qtd: {item.quantidade}</span>
                      <span>Material: {item.material}</span>
                      <span>Acabamento: {item.acabamento}</span>
                    </div>
                    {item.observacoes && <p className="text-slate-500 italic">{item.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiais necessarios */}
          {data.materiais_necessarios?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Materiais Necessarios</span>
              <div className="mt-1 space-y-1">
                {data.materiais_necessarios.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-700">{m.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{m.quantidade} {m.unidade}</span>
                      {m.disponivel_estoque ? (
                        <CheckCircle size={12} className="text-green-500" />
                      ) : (
                        <XCircle size={12} className="text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendencias */}
          {data.pendencias?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <span className="text-[10px] text-amber-500 uppercase tracking-wide">Pendencias</span>
              <ul className="mt-1 space-y-0.5">
                {data.pendencias.map((p, i) => (
                  <li key={i} className="text-xs text-amber-700">- {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Observacoes criticas */}
          {data.observacoes_criticas?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3">
              <span className="text-[10px] text-red-500 uppercase tracking-wide">Observacoes Criticas</span>
              <ul className="mt-1 space-y-0.5">
                {data.observacoes_criticas.map((o, i) => (
                  <li key={i} className="text-xs text-red-700">- {o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
