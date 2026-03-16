import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  calcOrcamentoItem,
  sugerirMarkup,
  validarMarkup,
  type OrcamentoItemInput,
  type OrcamentoItemPricingResult,
  type RegraPrecificacao,
} from "@/shared/services/orcamento-pricing.service";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/shared/services/pricing-engine";

// ─── Hook para buscar regras de precificação ─────────────────────────────────

export function useRegrasPrecificacao() {
  return useQuery({
    queryKey: ["regras_precificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regras_precificacao")
        .select("*")
        .eq("ativo", true)
        .order("categoria");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10, // 10 min cache
  });
}

// ─── Hook para buscar configuração de precificação ──────────────────────────

export function useConfigPrecificacao(): { config: PricingConfig; isDefault: boolean } {
  const { data } = useQuery({
    queryKey: ["config_precificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_precificacao")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  return useMemo(() => {
    if (!data) return { config: DEFAULT_PRICING_CONFIG, isDefault: true };
    return {
      config: {
        faturamentoMedio: (data as Record<string, unknown>).faturamento_medio as number ?? DEFAULT_PRICING_CONFIG.faturamentoMedio,
        custoOperacional: (data as Record<string, unknown>).custo_operacional as number ?? DEFAULT_PRICING_CONFIG.custoOperacional,
        custoProdutivo: (data as Record<string, unknown>).custo_produtivo as number ?? DEFAULT_PRICING_CONFIG.custoProdutivo,
        qtdFuncionarios: (data as Record<string, unknown>).qtd_funcionarios as number ?? DEFAULT_PRICING_CONFIG.qtdFuncionarios,
        horasMes: (data as Record<string, unknown>).horas_mes as number ?? DEFAULT_PRICING_CONFIG.horasMes,
        percentualComissao: (data as Record<string, unknown>).percentual_comissao as number ?? DEFAULT_PRICING_CONFIG.percentualComissao,
        percentualImpostos: (data as Record<string, unknown>).percentual_impostos as number ?? DEFAULT_PRICING_CONFIG.percentualImpostos,
        percentualJuros: (data as Record<string, unknown>).percentual_juros as number ?? DEFAULT_PRICING_CONFIG.percentualJuros,
      },
      isDefault: false,
    };
  }, [data]);
}

// ─── Hook principal de precificação de item ──────────────────────────────────

export function useOrcamentoPricing(
  item: OrcamentoItemInput | null,
  categoria?: string | null,
) {
  const { config, isDefault: isDefaultConfig } = useConfigPrecificacao();
  const { data: regras = [] } = useRegrasPrecificacao();

  const resultado = useMemo((): OrcamentoItemPricingResult | null => {
    if (!item) return null;
    try {
      return calcOrcamentoItem(item, config);
    } catch {
      return null;
    }
  }, [item, config]);

  const markupSugerido = useMemo(
    () => sugerirMarkup(categoria, regras as RegraPrecificacao[]),
    [categoria, regras],
  );

  const validacaoMarkup = useMemo(
    () =>
      item
        ? validarMarkup(item.markup_percentual, categoria, regras as RegraPrecificacao[])
        : { valido: true, markup_minimo: 25, aviso: null },
    [item, categoria, regras],
  );

  return {
    resultado,
    config,
    isDefaultConfig,
    regras,
    markupSugerido,
    validacaoMarkup,
  };
}
