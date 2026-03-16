// ============================================================================
// ADMIN CONFIG PAGE — Croma Print ERP/CRM
// Configurações de Precificação: Custo Operacional, Markup e Sobre
// ============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import {
  DEFAULT_PRICING_CONFIG,
} from "@/shared/services/pricing-engine";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import AIModelsTab from '../components/AIModelsTab';
import { ProgressTracker } from '@/shared/components/ProgressTracker';

import {
  Settings,
  DollarSign,
  BarChart2,
  Info,
  Save,
  Loader2,
  Percent,
  Calculator,
  CheckCircle2,
  Brain,
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

interface RegraPrecificacao {
  id: string;
  categoria: string;
  markup_minimo: number;
  markup_sugerido: number;
  desconto_maximo: number | null;
  taxa_urgencia: number | null;
  ativo: boolean;
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
// ABA 1 — CUSTO OPERACIONAL
// ----------------------------------------------------------------------------

function TabCustoOperacional() {
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

// ----------------------------------------------------------------------------
// ABA 2 — MARKUP POR CATEGORIA
// ----------------------------------------------------------------------------

interface RegraRowProps {
  regra: RegraPrecificacao;
  onSave: (id: string, data: Partial<RegraPrecificacao>) => void;
  isSaving: boolean;
}

function RegraRow({ regra, onSave, isSaving }: RegraRowProps) {
  const [editing, setEditing] = useState(false);
  const [markupMin, setMarkupMin] = useState(String(regra.markup_minimo));
  const [markupSug, setMarkupSug] = useState(String(regra.markup_sugerido));
  const [descontoMax, setDescontoMax] = useState(String(regra.desconto_maximo ?? ""));
  const [taxaUrgencia, setTaxaUrgencia] = useState(String(regra.taxa_urgencia ?? ""));

  function handleSave() {
    onSave(regra.id, {
      markup_minimo: parseFloat(markupMin) || regra.markup_minimo,
      markup_sugerido: parseFloat(markupSug) || regra.markup_sugerido,
      desconto_maximo: descontoMax ? parseFloat(descontoMax) : null,
      taxa_urgencia: taxaUrgencia ? parseFloat(taxaUrgencia) : null,
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
        <td className="px-4 py-3 font-medium text-slate-800">{regra.categoria}</td>
        <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
          {formatPct(regra.markup_minimo)}
        </td>
        <td className="px-4 py-3">
          <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 hover:bg-blue-100">
            {formatPct(regra.markup_sugerido)}
          </Badge>
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono">
          {regra.desconto_maximo != null ? formatPct(regra.desconto_maximo) : "—"}
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono">
          {regra.taxa_urgencia != null ? formatPct(regra.taxa_urgencia) : "—"}
        </td>
        <td className="px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="h-8 text-xs"
          >
            Editar
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-amber-50/40">
      <td className="px-4 py-2 font-medium text-slate-700">{regra.categoria}</td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={markupMin}
          onChange={(e) => setMarkupMin(e.target.value)}
          className="h-8 w-24 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={markupSug}
          onChange={(e) => setMarkupSug(e.target.value)}
          className="h-8 w-24 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={descontoMax}
          onChange={(e) => setDescontoMax(e.target.value)}
          className="h-8 w-24 text-sm"
          placeholder="—"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={taxaUrgencia}
          onChange={(e) => setTaxaUrgencia(e.target.value)}
          className="h-8 w-24 text-sm"
          placeholder="—"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TabMarkupCategoria() {
  const queryClient = useQueryClient();

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["admin-regras-precificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .select("*")
        .order("categoria");
      if (error) throw error;
      return (data || []) as RegraPrecificacao[];
    },
  });

  const updateRegra = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RegraPrecificacao> }) => {
      const { error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-regras-precificacao"] });
      queryClient.invalidateQueries({ queryKey: ["regras_precificacao"] });
      showSuccess("Regra salva!");
    },
    onError: () => showError("Erro ao salvar regra."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando regras...</span>
      </div>
    );
  }

  if (regras.length === 0) {
    return (
      <Card className="rounded-2xl border-none shadow-sm">
        <CardContent className="py-12 text-center text-slate-400">
          <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma regra de markup configurada.</p>
          <p className="text-sm mt-1">
            Execute a migration <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-xs">006_orcamento_module.sql</code> para criar as regras padrão.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-none shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-slate-800 text-base">Markup por Categoria</CardTitle>
        </div>
        <CardDescription>
          Markup mínimo, sugerido, desconto máximo e taxa de urgência por categoria de produto
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Mín.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Sug.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Desc. Máx.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Taxa Urgência</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map((regra) => (
                <RegraRow
                  key={regra.id}
                  regra={regra}
                  onSave={(id, data) => updateRegra.mutate({ id, data })}
                  isSaving={updateRegra.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// ABA 3 — SOBRE O SISTEMA MUBISYS
// ----------------------------------------------------------------------------

function TabSobre() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-slate-800">Sistema de Precificação Mubisys</CardTitle>
          </div>
          <CardDescription>Custeio Direto — 9 Passos para o Preço de Venda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-slate-600">
          <p>
            O motor de precificação da Croma Print utiliza o método de custeio direto Mubisys,
            que calcula o preço de venda em 9 etapas sequenciais partindo dos custos reais
            de matéria-prima e mão de obra.
          </p>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800">Os 9 Passos do Cálculo</h3>
            <ol className="space-y-2.5 list-none">
              {[
                {
                  step: 1,
                  title: "Levantamento de Matéria-Prima (Vmp)",
                  desc: "Somatório do custo de todos os materiais utilizados na produção.",
                  formula: "Vmp = Σ (quantidade × preço unitário)",
                },
                {
                  step: 2,
                  title: "Levantamento de Tempo Produtivo (T)",
                  desc: "Somatório do tempo em minutos de cada etapa de produção.",
                  formula: "T = Σ tempos das etapas (minutos)",
                },
                {
                  step: 3,
                  title: "Percentual de Custos Fixos (P%)",
                  desc: "Percentual que os custos fixos representam em relação ao faturamento.",
                  formula: "P% = ((C – CP) × 100) / F",
                },
                {
                  step: 4,
                  title: "Custo por Minuto (Cm)",
                  desc: "Custo da mão de obra por minuto de produção.",
                  formula: "Cm = (Fp / Qf) / horasMes / 60",
                },
                {
                  step: 5,
                  title: "Percentual de Vendas (Pv)",
                  desc: "Soma de todos os percentuais incidentes sobre a venda.",
                  formula: "Pv = (comissão + impostos + juros) / 100",
                },
                {
                  step: 6,
                  title: "Custo Base (Vb)",
                  desc: "Custo total do produto incluindo matéria-prima, mão de obra e custos fixos rateados.",
                  formula: "Vb = (Vmp + MO) × (1 + P%/100)",
                },
                {
                  step: 7,
                  title: "Valor Antes do Markup (Vam)",
                  desc: "Incorpora os custos de venda ao preço mínimo.",
                  formula: "Vam = Vb / (1 – Pv)",
                },
                {
                  step: 8,
                  title: "Valor do Markup (Vm)",
                  desc: "Parcela de lucro aplicada sobre o valor antes do markup.",
                  formula: "Vm = (Vam × Pm%) / (1 – Pv)",
                },
                {
                  step: 9,
                  title: "Preço Final de Venda (Vv)",
                  desc: "Preço de venda ao cliente, com toda a margem e custos incorporados.",
                  formula: "Vv = Vam + Vm",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-700">{item.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block font-mono">
                      {item.formula}
                    </code>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Legenda das Variáveis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["F", "Faturamento médio mensal"],
                ["C", "Custo operacional total"],
                ["CP", "Custo produtivo (folha da produção)"],
                ["Fp", "Folha de pagamento produtiva"],
                ["Qf", "Quantidade de funcionários produtivos"],
                ["MO", "Mão de obra (T × Cm)"],
                ["Pm%", "Percentual de markup desejado"],
              ].map(([code, desc]) => (
                <div key={code} className="flex items-baseline gap-2 text-xs">
                  <code className="font-mono font-bold text-blue-700 w-8 flex-shrink-0">{code}</code>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Referência de Configuração Padrão (Croma Print)</p>
            <div className="grid grid-cols-2 gap-1 mt-2">
              <span>Faturamento médio:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.faturamentoMedio)}</span>
              <span>Custo operacional:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.custoOperacional)}</span>
              <span>Custo produtivo:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.custoProdutivo)}</span>
              <span>Funcionários produtivos:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.qtdFuncionarios}</span>
              <span>Horas/mês:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.horasMes}h</span>
              <span>Comissão:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualComissao}%</span>
              <span>Impostos:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualImpostos}%</span>
              <span>Juros:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualJuros}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminConfigPage() {
  return (
    <div className="space-y-6 p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Settings className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configurações de Precificação</h1>
          <p className="text-sm text-slate-500">
            Parâmetros que afetam o cálculo automático de preços no orçamento
          </p>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="custo">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1">
          <TabsTrigger
            value="custo"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <DollarSign className="h-4 w-4 mr-1.5" />
            Custo Operacional
          </TabsTrigger>
          <TabsTrigger
            value="markup"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <BarChart2 className="h-4 w-4 mr-1.5" />
            Markup por Categoria
          </TabsTrigger>
          <TabsTrigger
            value="ia"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Brain className="h-4 w-4 mr-1.5" />
            Inteligência Artificial
          </TabsTrigger>
          <TabsTrigger
            value="progresso"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <BarChart2 className="h-4 w-4 mr-1.5" />
            Progresso ERP
          </TabsTrigger>
          <TabsTrigger
            value="sobre"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Info className="h-4 w-4 mr-1.5" />
            Sobre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custo" className="mt-6">
          <TabCustoOperacional />
        </TabsContent>

        <TabsContent value="markup" className="mt-6">
          <TabMarkupCategoria />
        </TabsContent>

        <TabsContent value="ia" className="mt-6">
          <AIModelsTab />
        </TabsContent>

        <TabsContent value="progresso" className="mt-6">
          <ProgressTracker compact={false} />
        </TabsContent>

        <TabsContent value="sobre" className="mt-6">
          <TabSobre />
        </TabsContent>
      </Tabs>
    </div>
  );
}
