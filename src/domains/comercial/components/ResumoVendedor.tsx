// src/domains/comercial/components/ResumoVendedor.tsx

import React from "react";
import { TrendingUp, Package, Wrench } from "lucide-react";
import { brl } from "@/shared/utils/format";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";

interface ResumoVendedorProps {
  resultado: OrcamentoItemPricingResult;
  quantidade: number;
  markup: number;
  markupSugerido: number;
  markupMinimo: number;
}

export default function ResumoVendedor({
  resultado,
  quantidade,
  markup,
  markupSugerido,
  markupMinimo,
}: ResumoVendedorProps) {
  const margemOk = resultado.margemBruta >= markupMinimo / 2;
  const margemBoa = resultado.margemBruta >= 25;

  return (
    <div className="space-y-3">
      {/* Preço principal */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
        <p className="text-xs font-medium text-blue-200 mb-1">Preço de Venda</p>
        <p className="text-3xl font-bold tabular-nums">{brl(resultado.precoUnitario)}</p>
        <p className="text-sm text-blue-200 mt-0.5">por unidade</p>
        {quantidade > 1 && (
          <div className="mt-3 pt-3 border-t border-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200">{quantidade} unidades</span>
              <span className="text-lg font-bold tabular-nums">{brl(resultado.precoTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown de custos */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Composição do Custo</p>

        {/* Material */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Package size={12} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Custo de Material</span>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">{brl(resultado.custoMP + resultado.custosAcabamentos)}</span>
            </div>
            {resultado.custoMP + resultado.custosAcabamentos === 0 && (
              <p className="text-[10px] text-amber-600 mt-0.5">⚠️ Sem materiais cadastrados</p>
            )}
          </div>
        </div>

        {/* Produção */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
            <Wrench size={12} className="text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Custo de Produção</span>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">{brl(resultado.custoMO)}</span>
            </div>
          </div>
        </div>

        {/* Total custo */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Custo Total</span>
            <span className="text-xs font-bold text-slate-800 tabular-nums">{brl(resultado.custoTotal)}</span>
          </div>
        </div>
      </div>

      {/* Margem */}
      <div className={`rounded-xl p-3 flex items-center gap-3 ${
        margemBoa ? "bg-emerald-50 border border-emerald-200" :
        margemOk  ? "bg-amber-50 border border-amber-200"   :
                    "bg-red-50 border border-red-200"
      }`}>
        <TrendingUp size={16} className={margemBoa ? "text-emerald-600" : margemOk ? "text-amber-600" : "text-red-600"} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${margemBoa ? "text-emerald-700" : margemOk ? "text-amber-700" : "text-red-700"}`}>
              Margem Bruta
            </span>
            <span className={`text-sm font-bold tabular-nums ${margemBoa ? "text-emerald-700" : margemOk ? "text-amber-700" : "text-red-700"}`}>
              {resultado.margemBruta.toFixed(1)}%
            </span>
          </div>
          {!margemBoa && (
            <p className="text-[10px] mt-0.5 text-slate-500">
              Markup sugerido: {markupSugerido}% · Mínimo: {markupMinimo}%
            </p>
          )}
        </div>
      </div>

      {/* Preço por m² se disponível */}
      {resultado.precoM2 && (
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
          <span className="text-xs text-slate-500">Preço por m²</span>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{brl(resultado.precoM2)}/m²</span>
        </div>
      )}
    </div>
  );
}
