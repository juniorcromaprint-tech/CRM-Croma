// ============================================================================
// ESCALA DE PREÇOS — Tabela de precificação por faixa de quantidade
// Exibe descontos progressivos para diferentes volumes de compra
// ============================================================================

import { ChevronDown, ChevronUp, TrendingDown, Star } from 'lucide-react';
import { useState } from 'react';
import { brl } from '@/shared/utils/format';

interface Faixa {
  label: string;
  min: number;
  max: number | null; // null = sem limite superior
  desconto: number; // percentual, ex: 5 = 5%
}

const FAIXAS: Faixa[] = [
  { label: '1 – 9 un', min: 1, max: 9, desconto: 0 },
  { label: '10 – 49 un', min: 10, max: 49, desconto: 5 },
  { label: '50 – 99 un', min: 50, max: 99, desconto: 10 },
  { label: '100+ un', min: 100, max: null, desconto: 15 },
];

interface EscalaPrecosProps {
  precoUnitarioBase: number;
  quantidadeAtual: number;
  /** Título opcional da seção */
  titulo?: string;
}

function getFaixaAtual(quantidade: number): Faixa {
  return FAIXAS.find(
    (f) => quantidade >= f.min && (f.max === null || quantidade <= f.max)
  ) ?? FAIXAS[0];
}

export function EscalaPrecos({
  precoUnitarioBase,
  quantidadeAtual,
  titulo = 'Precificação por Escala',
}: EscalaPrecosProps) {
  const [expanded, setExpanded] = useState(false);
  const faixaAtual = getFaixaAtual(quantidadeAtual);

  if (precoUnitarioBase <= 0) return null;

  return (
    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl overflow-hidden">
      {/* Header — sempre visível */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingDown size={15} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">{titulo}</span>
          {faixaAtual.desconto > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
              -{faixaAtual.desconto}% faixa atual
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={15} className="text-emerald-500" />
        ) : (
          <ChevronDown size={15} className="text-emerald-500" />
        )}
      </button>

      {/* Tabela — expansível */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-emerald-200 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">
                <th className="text-left pb-2">Faixa</th>
                <th className="text-right pb-2">Desconto</th>
                <th className="text-right pb-2">Preço Unit.</th>
                <th className="text-right pb-2 hidden sm:table-cell">Total (faixa)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {FAIXAS.map((faixa) => {
                const isAtual =
                  faixa.min === faixaAtual.min && faixa.max === faixaAtual.max;
                const precoComDesconto =
                  precoUnitarioBase * (1 - faixa.desconto / 100);
                // total para exibição: usa quantidade atual se for faixa atual, senão usa o mínimo da faixa
                const qtdRef = isAtual ? quantidadeAtual : faixa.min;
                const totalRef = precoComDesconto * qtdRef;

                return (
                  <tr
                    key={faixa.label}
                    className={`transition-colors ${
                      isAtual
                        ? 'bg-emerald-100/70'
                        : 'hover:bg-emerald-50/50'
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        {isAtual && (
                          <Star size={11} className="text-emerald-600 fill-emerald-600 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            isAtual
                              ? 'font-semibold text-emerald-800'
                              : 'text-slate-600'
                          }`}
                        >
                          {faixa.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      {faixa.desconto > 0 ? (
                        <span
                          className={`text-sm font-medium ${
                            isAtual ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          -{faixa.desconto}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span
                        className={`text-sm ${
                          isAtual
                            ? 'font-bold text-emerald-800'
                            : 'text-slate-600'
                        }`}
                      >
                        {brl(precoComDesconto)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums hidden sm:table-cell">
                      <span className="text-xs text-slate-400">
                        {isAtual
                          ? `${brl(totalRef)} (${quantidadeAtual} un)`
                          : `${brl(totalRef)} (${faixa.min} un)`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-[11px] text-emerald-600/70 leading-snug">
            * Preços com desconto progressivo por volume. Válido por pedido.
          </p>
        </div>
      )}
    </div>
  );
}
