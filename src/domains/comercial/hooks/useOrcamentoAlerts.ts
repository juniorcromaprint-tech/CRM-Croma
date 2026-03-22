// src/domains/comercial/hooks/useOrcamentoAlerts.ts

import { useMemo } from "react";
import type { OrcamentoMaterial, OrcamentoAcabamento } from "@/shared/services/orcamento-pricing.service";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";
import type { PricingConfig } from "@/shared/services/pricing-engine";
import { DEFAULT_PRICING_CONFIG } from "@/shared/services/pricing-engine";
import { useEmendaAlert } from "./useEmendaAlert";

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
  precoM2Minimo?: number | null;
  /** Largura do item em cm (para alerta de emenda) */
  larguraCm?: number | null;
  /** Altura do item em cm (para alerta de emenda) */
  alturaCm?: number | null;
}

export function useOrcamentoAlerts({
  materiais,
  acabamentos,
  markup,
  markupMinimo,
  resultado,
  config,
  precoM2Minimo,
  larguraCm,
  alturaCm,
}: UseOrcamentoAlertsParams): OrcamentoAlert[] {
  // Alerta de emenda (async, via query — não bloqueia o useMemo)
  const emenda = useEmendaAlert(larguraCm, alturaCm);

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

    // 6. Preço/m² abaixo do mínimo — BLOQUEANTE
    if (precoM2Minimo && precoM2Minimo > 0 && resultado && resultado.precoM2 != null && resultado.precoM2 < precoM2Minimo) {
      alerts.push({
        id: "preco-m2-abaixo-minimo",
        severity: "error",
        title: "Preço/m² abaixo do mínimo",
        message: `Preço de R$ ${resultado.precoM2.toFixed(2)}/m² está abaixo do mínimo de R$ ${precoM2Minimo.toFixed(2)}/m². Aumente o markup ou o preço unitário.`,
      });
    }

    // 7. Alerta de emenda de impressão
    if (emenda.hasEmenda && emenda.maquinaNome) {
      const areaUtilCm = emenda.areaUtilM != null
        ? ` (área útil: ${(emenda.areaUtilM * 100).toFixed(0)} cm)`
        : "";
      alerts.push({
        id: "emenda-impressao",
        severity: "warning",
        title: "Atenção: emenda na impressão",
        message: `Este item excede a área útil da máquina ${emenda.maquinaNome}${areaUtilCm}. Haverá emenda na impressão — verifique a viabilidade com a produção.`,
      });
    }

    return alerts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    materiais,
    acabamentos,
    markup,
    markupMinimo,
    resultado,
    config,
    precoM2Minimo,
    emenda.hasEmenda,
    emenda.maquinaNome,
    emenda.areaUtilM,
  ]);
}
