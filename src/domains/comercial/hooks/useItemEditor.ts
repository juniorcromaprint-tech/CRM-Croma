import React, { useState, useCallback, useMemo } from "react";
import { useOrcamentoPricing, useRegrasPrecificacao } from "./useOrcamentoPricing";
import { useOrcamentoAlerts } from "./useOrcamentoAlerts";
import { useFaixasQuantidade, calcDescontoVolume } from "./useFaixasQuantidade";
import { calcMarkupParaPreco, calcAreaM2 } from "@/shared/services/orcamento-pricing.service";
import type { PricingConfig } from "@/shared/services/pricing-engine";
import type {
  OrcamentoMaterial,
  OrcamentoAcabamento,
  OrcamentoProcesso,
  OrcamentoItemInput,
} from "@/shared/services/orcamento-pricing.service";
import type { Produto, ProdutoModelo } from "./useProdutosModelos";

export interface ItemEditorState {
  produto_id: string | null;
  modelo_id: string | null;
  descricao: string;
  especificacao: string;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  materiais: OrcamentoMaterial[];
  acabamentos: OrcamentoAcabamento[];
  processos: OrcamentoProcesso[];
  markup_percentual: number;
  categoria: string | null;
}

const DEFAULT_ITEM: ItemEditorState = {
  produto_id: null,
  modelo_id: null,
  descricao: "",
  especificacao: "",
  quantidade: 1,
  largura_cm: null,
  altura_cm: null,
  materiais: [],
  acabamentos: [],
  processos: [],
  markup_percentual: 40,
  categoria: null,
};

export type OverrideSource = 'markup' | 'preco' | 'm2';

export function useItemEditor() {
  const [newItem, setNewItem] = useState<ItemEditorState>(DEFAULT_ITEM);
  const [currentStep, setCurrentStep] = useState(1);
  const [overrideSource, setOverrideSource] = useState<OverrideSource>('markup');
  const [precoOverrideValue, setPrecoOverrideValue] = useState<number | null>(null);
  const [precoM2OverrideValue, setPrecoM2OverrideValue] = useState<number | null>(null);
  const [volumeApplied, setVolumeApplied] = useState(false);

  // Pricing
  const pricingInput: OrcamentoItemInput | null = useMemo(() => {
    if (!newItem.descricao && !newItem.produto_id) return null;
    return {
      descricao: newItem.descricao || "Item",
      quantidade: newItem.quantidade,
      largura_cm: newItem.largura_cm,
      altura_cm: newItem.altura_cm,
      materiais: newItem.materiais,
      acabamentos: newItem.acabamentos,
      processos: newItem.processos,
      markup_percentual: newItem.markup_percentual,
    };
  }, [newItem]);

  const { resultado: pricingResult, markupSugerido, validacaoMarkup, config, isDefaultConfig, regras, aproveitamentoPadrao } =
    useOrcamentoPricing(pricingInput, newItem.categoria);

  // Volume discount
  const regraCategoria = useMemo(() => {
    const ativas = (regras as any[]).filter((r: any) => r.ativo !== false);
    return ativas.find((r: any) => r.categoria === newItem.categoria) ?? ativas.find((r: any) => r.categoria === 'geral');
  }, [regras, newItem.categoria]);

  const { data: faixas = [] } = useFaixasQuantidade(regraCategoria?.id);
  const volumeDiscount = useMemo(
    () => calcDescontoVolume(newItem.quantidade, faixas),
    [newItem.quantidade, faixas],
  );

  // Auto-apply volume discount to markup when quantity changes
  // Only when user hasn't manually overridden the price
  React.useEffect(() => {
    if (overrideSource !== 'markup') return;
    if (!volumeDiscount.desconto || volumeDiscount.desconto === 0) {
      if (volumeApplied) {
        setVolumeApplied(false);
      }
      return;
    }
    // Apply discount to the modelo's markupSugerido, not the already-discounted value
    const modeloMarkup = markupSugerido ?? newItem.markup_percentual;
    const adjustedMarkup = Math.max(0, modeloMarkup - volumeDiscount.desconto);
    setNewItem((s) => ({ ...s, markup_percentual: Math.round(adjustedMarkup * 100) / 100 }));
    setVolumeApplied(true);
  }, [volumeDiscount.desconto, overrideSource, markupSugerido]);

  // Preço/m² mínimo da regra da categoria
  const precoM2Minimo = useMemo(() => {
    return (regraCategoria as any)?.preco_m2_minimo ?? null;
  }, [regraCategoria]);

  // Alerts
  const alerts = useOrcamentoAlerts({
    materiais: newItem.materiais,
    acabamentos: newItem.acabamentos,
    markup: newItem.markup_percentual,
    markupMinimo: validacaoMarkup.markup_minimo,
    resultado: pricingResult,
    config,
    precoM2Minimo,
  });

  // Has blocking alerts (severity === "error" that should block save)
  const hasBlockingAlert = useMemo(
    () => alerts.some(a => a.id === "preco-m2-abaixo-minimo"),
    [alerts],
  );

  // Is price overridden by user?
  const isPrecoOverride = overrideSource !== 'markup';

  // Handlers
  const handleProdutoChange = useCallback((produto: Produto | null) => {
    setNewItem((s) => ({
      ...s,
      produto_id: produto?.id ?? null,
      categoria: produto?.categoria ?? null,
      descricao: produto?.nome ?? s.descricao,
    }));
  }, []);

  const handleModeloChange = useCallback((modelo: ProdutoModelo | null) => {
    if (!modelo) {
      setNewItem((s) => ({ ...s, modelo_id: null }));
      return;
    }

    const materiaisFromModelo: OrcamentoMaterial[] = (modelo.materiais ?? []).map((m) => {
      const precoMedio = Number(m.material?.preco_medio) || 0;
      return {
        material_id: m.material_id,
        descricao: m.material?.nome ?? `Material ${m.material_id}`,
        quantidade: Number(m.quantidade_por_unidade) || 0,
        unidade: m.unidade ?? "un",
        custo_unitario: precoMedio,
        aproveitamento: Number(m.material?.aproveitamento) || 100,
      };
    });

    const processosFromModelo: OrcamentoProcesso[] = (modelo.processos ?? []).map((p) => ({
      etapa: p.etapa,
      tempo_minutos: Number(p.tempo_por_unidade_min) || 0,
      tempo_setup_min: Number((p as any).tempo_setup_min) || 0,
    }));

    setNewItem((s) => ({
      ...s,
      modelo_id: modelo.id,
      descricao: s.descricao || modelo.nome,
      especificacao: modelo.descritivo_nf ?? modelo.nome,
      largura_cm: modelo.largura_cm ?? s.largura_cm,
      altura_cm: modelo.altura_cm ?? s.altura_cm,
      markup_percentual: modelo.markup_padrao ?? s.markup_percentual,
      materiais: materiaisFromModelo,
      processos: processosFromModelo,
    }));
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
    setVolumeApplied(false);
  }, []);

  const handleMateriaisChange = useCallback((materiais: OrcamentoMaterial[]) => {
    setNewItem((s) => ({ ...s, materiais }));
  }, []);

  const handleAcabamentosChange = useCallback((acabamentos: OrcamentoAcabamento[]) => {
    setNewItem((s) => ({ ...s, acabamentos }));
  }, []);

  // Markup change (user types markup %)
  const handleMarkupChange = useCallback((markup: number) => {
    setNewItem((s) => ({ ...s, markup_percentual: markup }));
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
  }, []);

  // Price override (user types unit price)
  const handlePrecoOverride = useCallback((preco: number) => {
    setPrecoOverrideValue(preco);
    setOverrideSource('preco');
    if (!pricingInput) return;
    const result = calcMarkupParaPreco(preco, 'unitario', pricingInput, config, aproveitamentoPadrao);
    if (result.valido || result.markup_percentual < 0) {
      setNewItem((s) => ({ ...s, markup_percentual: Math.round(result.markup_percentual * 100) / 100 }));
    }
    // Update m2 value
    const area = calcAreaM2(newItem.largura_cm, newItem.altura_cm);
    if (area && area > 0) {
      setPrecoM2OverrideValue(Math.round((preco / area) * 100) / 100);
    }
  }, [pricingInput, config, aproveitamentoPadrao, newItem.largura_cm, newItem.altura_cm]);

  // Price/m2 override (user types price per m2)
  const handlePrecoM2Override = useCallback((precoM2: number) => {
    setPrecoM2OverrideValue(precoM2);
    setOverrideSource('m2');
    if (!pricingInput) return;
    const result = calcMarkupParaPreco(precoM2, 'm2', pricingInput, config, aproveitamentoPadrao);
    if (result.valido || result.markup_percentual < 0) {
      setNewItem((s) => ({ ...s, markup_percentual: Math.round(result.markup_percentual * 100) / 100 }));
    }
    // Update unit price value
    const area = calcAreaM2(newItem.largura_cm, newItem.altura_cm);
    if (area && area > 0) {
      setPrecoOverrideValue(Math.round(precoM2 * area * 100) / 100);
    }
  }, [pricingInput, config, aproveitamentoPadrao, newItem.largura_cm, newItem.altura_cm]);

  // Navigation
  const nextStep = useCallback(() => setCurrentStep((s) => Math.min(s + 1, 3)), []);
  const prevStep = useCallback(() => setCurrentStep((s) => Math.max(s - 1, 1)), []);

  const reset = useCallback(() => {
    setNewItem(DEFAULT_ITEM);
    setCurrentStep(1);
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
    setVolumeApplied(false);
  }, []);

  return {
    // State
    newItem,
    setNewItem,
    currentStep,
    overrideSource,
    isPrecoOverride,
    precoOverrideValue,
    precoM2OverrideValue,

    // Pricing
    pricingInput,
    pricingResult,
    config,
    isDefaultConfig,
    markupSugerido,
    validacaoMarkup,
    alerts,
    hasBlockingAlert,
    volumeDiscount,

    // Handlers
    handleProdutoChange,
    handleModeloChange,
    handleMateriaisChange,
    handleAcabamentosChange,
    handleMarkupChange,
    handlePrecoOverride,
    handlePrecoM2Override,

    // Navigation
    nextStep,
    prevStep,
    reset,
  };
}
