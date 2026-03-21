import React from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { brl } from "@/shared/utils/format";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";

interface PricingCalculatorProps {
  resultado: OrcamentoItemPricingResult | null;
  quantidade?: number;
}

export default function PricingCalculator({ resultado, quantidade = 1 }: PricingCalculatorProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!resultado) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400">
        Preencha os dados do item para ver o cálculo de preço
      </div>
    );
  }

  // custoMP already includes acabamentos (both go through the motor together)
  const custoMateriaisPuros = resultado.custoMP - resultado.custosAcabamentos;

  const rows = [
    { label: "Materiais", value: custoMateriaisPuros, color: "text-slate-600" },
    ...(resultado.custosAcabamentos > 0
      ? [{ label: "Acabamentos", value: resultado.custosAcabamentos, color: "text-slate-600" }]
      : []),
    { label: "Custo de Produção", value: resultado.custoMO, color: "text-slate-600" },
    ...(resultado.custoMaquinas > 0
      ? [{ label: "Máquinas", value: resultado.custoMaquinas, color: "text-slate-600" }]
      : []),
    { label: "Custo de Produção Total", value: resultado.custoTotal, color: "text-slate-800 font-semibold" },
    { label: "Preço Unitário", value: resultado.precoUnitario, color: "text-blue-700 font-bold" },
    { label: "Preço Total", value: resultado.precoTotal, color: "text-blue-700 font-bold" },
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-blue-800">Precificação</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-blue-800 tabular-nums">{brl(resultado.precoUnitario)}/un</span>
          {resultado.precoM2 && (
            <span className="text-xs text-blue-600 tabular-nums">({brl(resultado.precoM2)}/m²)</span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-blue-500 hover:text-blue-700 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Breakdown — collapsible */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-blue-200 pt-3">
          <div className="space-y-1.5">
            {rows.map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`text-xs tabular-nums ${color}`}>{brl(value)}</span>
              </div>
            ))}
          </div>

          {/* Margem */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Margem bruta</span>
              <span className={`text-xs font-bold tabular-nums ${resultado.margemBruta >= 25 ? "text-emerald-600" : "text-red-600"}`}>
                {resultado.margemBruta.toFixed(1)}%
              </span>
            </div>
            {resultado.areaM2 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">Área</span>
                <span className="text-xs text-slate-600 tabular-nums">{resultado.areaM2.toFixed(4)} m²</span>
              </div>
            )}
          </div>

          {/* Percentage breakdown */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs font-medium text-slate-600 mb-2">Composição do preço</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-blue-400 transition-all" style={{ width: `${resultado.detalhes.percMP}%` }} title={`MP: ${resultado.detalhes.percMP.toFixed(1)}%`} />
              <div className="bg-orange-400 transition-all" style={{ width: `${resultado.detalhes.percMO}%` }} title={`MO: ${resultado.detalhes.percMO.toFixed(1)}%`} />
              {resultado.detalhes.percMaquinas > 0 && (
                <div className="bg-purple-400 transition-all" style={{ width: `${resultado.detalhes.percMaquinas}%` }} title={`Máquinas: ${resultado.detalhes.percMaquinas.toFixed(1)}%`} />
              )}
              <div className="bg-slate-300 transition-all" style={{ width: `${resultado.detalhes.percFixo}%` }} title={`Fixo: ${resultado.detalhes.percFixo.toFixed(1)}%`} />
              <div className="bg-emerald-400 transition-all" style={{ width: `${resultado.detalhes.percMargem}%` }} title={`Margem: ${resultado.detalhes.percMargem.toFixed(1)}%`} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              {[
                { color: "bg-blue-400", label: "MP", pct: resultado.detalhes.percMP },
                { color: "bg-orange-400", label: "MO", pct: resultado.detalhes.percMO },
                ...(resultado.detalhes.percMaquinas > 0
                  ? [{ color: "bg-purple-400", label: "Máquinas", pct: resultado.detalhes.percMaquinas }]
                  : []),
                { color: "bg-slate-300", label: "Fixo", pct: resultado.detalhes.percFixo },
                { color: "bg-emerald-400", label: "Margem", pct: resultado.detalhes.percMargem },
              ].map(({ color, label, pct }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-xs text-slate-500">{label} {pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
