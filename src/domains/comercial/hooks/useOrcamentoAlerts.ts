// src/domains/comercial/hooks/useOrcamentoAlerts.ts

import { useMemo } from "react";
import type { OrcamentoMaterial, OrcamentoAcabamento } from "@/shared/services/orcamento-pricing.service";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";
import type { PricingConfig } from "@/shared/services/pricing-engine";
import { DEFAULT_PRICING_CONFIG } from "@/shared/services/pricing-engine";

export type AlertSeverity = "error" | "warning" | "info";

export interface OrcamentoAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

interface UseOrcamentoAlertsParams {
  materiais: OrcamentoMaterial[];
  acabamentos: OrcamentoAcabamento[];
  markup: number;
  markupMinimo: number;
  resultado: OrcamentoItemPricingResult | null;
  config: PricingConfig;
}

export function useOrcamentoAlerts({
  materiais,
  acabamentos,
  markup,
  markupMinimo,
  resultado,
  config,
}: UseOrcamentoAlertsParams): OrcamentoAlert[] {
  return useMemo(() => {
    const alerts: OrcamentoAlert[] = [];

    // 1. Config usando defaults (não foi configurada)
    const isDefaultConfig =
      config.faturamentoMedio === DEFAULT_PRICING_CONFIG.faturamentoMedio &&
      config.custoOperacional === DEFAULT_PRICING_CONFIG.custoOperacional;

    if (isDefaultConfig) {
      alerts.push({
        id: "config-default",
        severity: "info",
        title: "Configuração padrão ativa",
        message: "Os parâmetros de custo estão com valores padrão. Configure os dados reais da empresa.",
        action: { label: "Configurar", href: "/admin/config" },
      });
    }

    // 2. Sem materiais
    if (materiais.length === 0) {
      alerts.push({
        id: "sem-materiais",
        severity: "warning",
        title: "Sem materiais",
        message: "Nenhum material adicionado. O custo de matéria-prima será R$ 0,00.",
      });
    } else {
      // 3. Materiais sem preço
      const semPreco = materiais.filter(m => !m.custo_unitario || m.custo_unitario === 0);
      if (semPreco.length > 0) {
        alerts.push({
          id: "material-sem-preco",
          severity: "error",
          title: `${semPreco.length} material(is) sem preço`,
          message: `${semPreco.map(m => m.descricao).join(", ")} — custo calculado incorretamente.`,
          action: { label: "Corrigir preços", href: "/admin/produtos" },
        });
      }
    }

    // 4. Markup abaixo do mínimo
    if (markup < markupMinimo) {
      alerts.push({
        id: "markup-baixo",
        severity: "warning",
        title: "Markup abaixo do mínimo",
        message: `Markup ${markup}% abaixo do mínimo recomendado de ${markupMinimo}%. Verifique a rentabilidade com seu gestor.`,
      });
    }

    // 5. Margem muito baixa (< 15%)
    if (resultado && resultado.margemBruta < 15 && resultado.precoUnitario > 0) {
      alerts.push({
        id: "margem-baixa",
        severity: "warning",
        title: "Margem bruta baixa",
        message: `Margem de ${resultado.margemBruta.toFixed(1)}% pode não cobrir custos fixos e comissões.`,
      });
    }

    return alerts;
  }, [materiais, acabamentos, markup, markupMinimo, resultado, config]);
}
