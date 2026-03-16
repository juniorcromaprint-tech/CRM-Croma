// src/domains/comercial/components/ItemStep3Revisao.tsx

import React, { useRef } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AlertasOrcamento from "./AlertasOrcamento";
import ResumoVendedor from "./ResumoVendedor";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";
import type { OrcamentoAlert } from "../hooks/useOrcamentoAlerts";
import type { OverrideSource } from "../hooks/useItemEditor";
import type { FaixaQuantidade } from "../hooks/useFaixasQuantidade";

interface ItemStep3RevisaoProps {
  markup: number;
  markupSugerido: number;
  markupMinimo: number;
  validacaoMarkup: { valido: boolean; aviso: string | null };
  pricingResult: OrcamentoItemPricingResult | null;
  quantidade: number;
  alerts: OrcamentoAlert[];
  overrideSource: OverrideSource;
  isPrecoOverride: boolean;
  precoOverrideValue: number | null;
  precoM2OverrideValue: number | null;
  hasArea: boolean;
  isDefaultConfig: boolean;
  volumeDiscount: { desconto: number; faixaAplicada: FaixaQuantidade | null };
  onMarkupChange: (markup: number) => void;
  onPrecoOverride: (preco: number) => void;
  onPrecoM2Override: (precoM2: number) => void;
  onMarkupSugeridoClick: () => void;
}

export default function ItemStep3Revisao({
  markup,
  markupSugerido,
  markupMinimo,
  validacaoMarkup,
  pricingResult,
  quantidade,
  alerts,
  overrideSource,
  isPrecoOverride,
  precoOverrideValue,
  precoM2OverrideValue,
  hasArea,
  isDefaultConfig,
  volumeDiscount,
  onMarkupChange,
  onPrecoOverride,
  onPrecoM2Override,
  onMarkupSugeridoClick,
}: ItemStep3RevisaoProps) {
  const debouncePrecoRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceM2Ref = useRef<ReturnType<typeof setTimeout>>();

  // Controlled input state — synced from parent when pricingResult or overrideSource changes
  const [precoInputValue, setPrecoInputValue] = React.useState<string>('');
  const [precoM2InputValue, setPrecoM2InputValue] = React.useState<string>('');

  React.useEffect(() => {
    if (overrideSource === 'preco') {
      setPrecoInputValue(precoOverrideValue != null ? String(precoOverrideValue) : '');
    } else {
      setPrecoInputValue(pricingResult?.precoUnitario?.toFixed(2) ?? '');
    }
  }, [pricingResult?.precoUnitario, overrideSource, precoOverrideValue]);

  React.useEffect(() => {
    if (overrideSource === 'm2') {
      setPrecoM2InputValue(precoM2OverrideValue != null ? String(precoM2OverrideValue) : '');
    } else {
      setPrecoM2InputValue(pricingResult?.precoM2?.toFixed(2) ?? '');
    }
  }, [pricingResult?.precoM2, overrideSource, precoM2OverrideValue]);

  const handlePrecoBlur = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) onPrecoOverride(num);
  };

  const handlePrecoM2Blur = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) onPrecoM2Override(num);
  };

  return (
    <div className="space-y-5">
      {/* Default config warning */}
      {isDefaultConfig && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          Configure os parametros de precificacao em Admin &gt; Configuracoes antes de criar orcamentos.
        </div>
      )}

      {/* Volume discount badge */}
      {volumeDiscount.desconto > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
          <DollarSign size={14} />
          Desconto por volume: -{volumeDiscount.desconto}% no markup (qtd {quantidade}{" "}
          &ge; {volumeDiscount.faixaAplicada?.quantidade_minima})
        </div>
      )}

      {/* Markup field */}
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Label className="text-xs">Markup (%)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={markup}
            onChange={(e) => onMarkupChange(Number(e.target.value))}
            className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === "markup" ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
          />
        </div>
        {markupSugerido !== markup && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 text-xs"
            onClick={onMarkupSugeridoClick}
          >
            Sugerido: {markupSugerido}%
          </Button>
        )}
      </div>

      {/* Price override section */}
      <div className="space-y-3">
        <Separator />
        <p className="text-xs font-medium text-slate-500">Ou defina o preco diretamente</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preco Unitario (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={precoInputValue}
              onBlur={(e) => handlePrecoBlur(e.target.value)}
              onChange={(e) => {
                setPrecoInputValue(e.target.value);
                clearTimeout(debouncePrecoRef.current);
                const val = e.target.value;
                debouncePrecoRef.current = setTimeout(() => {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num > 0) onPrecoOverride(num);
                }, 300);
              }}
              className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === "preco" ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
            />
          </div>
          {hasArea && (
            <div>
              <Label className="text-xs">Preco/m² (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={precoM2InputValue}
                onBlur={(e) => handlePrecoM2Blur(e.target.value)}
                onChange={(e) => {
                  setPrecoM2InputValue(e.target.value);
                  clearTimeout(debounceM2Ref.current);
                  const val = e.target.value;
                  debounceM2Ref.current = setTimeout(() => {
                    const num = parseFloat(val);
                    if (!isNaN(num) && num > 0) onPrecoM2Override(num);
                  }, 300);
                }}
                className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === "m2" ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
              />
            </div>
          )}
        </div>
        {isPrecoOverride && (
          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
            Preço ajustado manualmente
          </Badge>
        )}
      </div>

      {/* Markup validations */}
      {!validacaoMarkup.valido && validacaoMarkup.aviso && (
        <div className="flex items-center gap-2 text-amber-600 text-xs">
          <AlertTriangle size={14} />
          {validacaoMarkup.aviso}
        </div>
      )}
      {validacaoMarkup.valido && markup < 30 && (
        <p className="text-xs text-amber-600">
          Markup abaixo de 30% — verifique a rentabilidade
        </p>
      )}
      {markup < 0 && (
        <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
          <AlertTriangle size={14} />
          Preco abaixo do custo! Margem negativa.
        </div>
      )}

      {/* Alerts */}
      <AlertasOrcamento alerts={alerts} />

      {/* Seller summary */}
      {pricingResult && (
        <ResumoVendedor
          resultado={pricingResult}
          quantidade={quantidade}
          markup={markup}
          markupSugerido={markupSugerido}
          markupMinimo={markupMinimo}
          isPrecoOverride={isPrecoOverride}
        />
      )}
    </div>
  );
}
