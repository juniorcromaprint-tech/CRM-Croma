// src/domains/admin/components/TabCustoOperacional.tsx

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { DEFAULT_PRICING_CONFIG } from "@/shared/services/pricing-engine";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  DollarSign,
  Save,
  Loader2,
  Percent,
  Calculator,
  CheckCircle2,
} from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ConfigPrecificacao {
  id: string;
  faturamento_medio: number;
  custo_operacional: number;
  custo_produtivo: number;
  qtd_funcionarios: number;
  horas_mes: number;
  percentual_comissao: number;
  percentual_impostos: number;
  percentual_juros: number;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export default function TabCustoOperacional() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-config-precificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("config_precificacao")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConfigPrecificacao | null;
    },
  });

  const [faturamentoMedio, setFaturamentoMedio] = useState(
    String(DEFAULT_PRICING_CONFIG.faturamentoMedio)
  );
  const [custoOperacional, setCustoOperacional] = useState(
    String(DEFAULT_PRICING_CONFIG.custoOperacional)
  );
  const [custoProdutivo, setCustoProdutivo] = useState(
    String(DEFAULT_PRICING_CONFIG.custoProdutivo)
  );
  const [qtdFuncionarios, setQtdFuncionarios] = useState(
    String(DEFAULT_PRICING_CONFIG.qtdFuncionarios)
  );
  const [horasMes, setHorasMes] = useState(
    String(DEFAULT_PRICING_CONFIG.horasMes)
  );
  const [percentualComissao, setPercentualComissao] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualComissao)
  );
  const [percentualImpostos, setPercentualImpostos] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualImpostos)
  );
  const [percentualJuros, setPercentualJuros] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualJuros)
  );

  useEffect(() => {
    if (!config) return;
    setFaturamentoMedio(String(config.faturamento_medio));
    setCustoOperacional(String(config.custo_operacional));
    setCustoProdutivo(String(config.custo_produtivo));
    setQtdFuncionarios(String(config.qtd_funcionarios));
    setHorasMes(String(config.horas_mes));
    setPercentualComissao(String(config.percentual_comissao));
    setPercentualImpostos(String(config.percentual_impostos));
    setPercentualJuros(String(config.percentual_juros));
  }, [config]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const values = {
        faturamento_medio: parseFloat(faturamentoMedio) || 0,
        custo_operacional: parseFloat(custoOperacional) || 0,
        custo_produtivo: parseFloat(custoProdutivo) || 0,
        qtd_funcionarios: parseInt(qtdFuncionarios, 10) || 0,
        horas_mes: parseInt(horasMes, 10) || 0,
        percentual_comissao: parseFloat(percentualComissao) || 0,
        percentual_impostos: parseFloat(percentualImpostos) || 0,
        percentual_juros: parseFloat(percentualJuros) || 0,
      };
      if (config?.id) {
        const { error } = await (supabase as unknown as any)
          .from("config_precificacao")
          .update(values)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("config_precificacao")
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-config-precificacao"] });
      queryClient.invalidateQueries({ queryKey: ["config_precificacao"] });
      showSuccess("Configuração salva com sucesso!");
    },
    onError: () => showError("Erro ao salvar configuração."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando configuração...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      {config && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>
            Configuração ativa carregada do banco.
            {config.updated_at && (
              <> Última atualização: {new Date(config.updated_at).toLocaleString("pt-BR")}.</>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Coluna 1 — Valores financeiros */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Valores Financeiros</CardTitle>
            </div>
            <CardDescription>Dados mensais da operação que alimentam o motor Mubisys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Faturamento Médio Mensal (R$)</Label>
              <Input
                type="number"
                step="100"
                value={faturamentoMedio}
                onChange={(e) => setFaturamentoMedio(e.target.value)}
                className="h-11"
                placeholder="110000"
              />
              <p className="text-xs text-slate-400">Média dos últimos 12 meses de faturamento</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Custo Operacional Mensal (R$)</Label>
              <Input
                type="number"
                step="100"
                value={custoOperacional}
                onChange={(e) => setCustoOperacional(e.target.value)}
                className="h-11"
                placeholder="36800"
              />
              <p className="text-xs text-slate-400">Total de custos fixos + variáveis mensais</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Custo Produtivo Mensal — Folha da Produção (R$)</Label>
              <Input
                type="number"
                step="100"
                value={custoProdutivo}
                onChange={(e) => setCustoProdutivo(e.target.value)}
                className="h-11"
                placeholder="23744"
              />
              <p className="text-xs text-slate-400">Folha de pagamento somente dos funcionários produtivos</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Qtd. Funcionários Produtivos</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={qtdFuncionarios}
                  onChange={(e) => setQtdFuncionarios(e.target.value)}
                  className="h-11"
                  placeholder="6"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Horas Mensais por Funcionário</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={horasMes}
                  onChange={(e) => setHorasMes(e.target.value)}
                  className="h-11"
                  placeholder="176"
                />
                <p className="text-xs text-slate-400">Padrão: 22 dias × 8h = 176h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2 — Percentuais sobre vendas */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-slate-800 text-base">Percentuais sobre Vendas</CardTitle>
              </div>
              <CardDescription>Incidências que entram no cálculo de preço de venda</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium text-sm">Comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={percentualComissao}
                    onChange={(e) => setPercentualComissao(e.target.value)}
                    className="h-11"
                    placeholder="5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium text-sm">Impostos (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={percentualImpostos}
                    onChange={(e) => setPercentualImpostos(e.target.value)}
                    className="h-11"
                    placeholder="12"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium text-sm">Juros (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={percentualJuros}
                    onChange={(e) => setPercentualJuros(e.target.value)}
                    className="h-11"
                    placeholder="2"
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" />
                  Resumo Atual
                </p>
                <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <span className="text-slate-500">Faturamento médio:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {formatBRL(parseFloat(faturamentoMedio) || 0)}
                  </span>
                  <span className="text-slate-500">Custo operacional:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {formatBRL(parseFloat(custoOperacional) || 0)}
                  </span>
                  <span className="text-slate-500">Custo produtivo:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {formatBRL(parseFloat(custoProdutivo) || 0)}
                  </span>
                  <span className="text-slate-500">% total sobre vendas:</span>
                  <span className="font-bold text-blue-700 text-right">
                    {formatPct(
                      (parseFloat(percentualComissao) || 0) +
                      (parseFloat(percentualImpostos) || 0) +
                      (parseFloat(percentualJuros) || 0)
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {saveConfig.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configuração
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
