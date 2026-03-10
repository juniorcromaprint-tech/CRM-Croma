// ============================================================================
// ADMIN PRECIFICACAO PAGE — Croma Print ERP/CRM
// Configuração dos Parâmetros de Custeio Direto Mubisys
// ============================================================================

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import {
  calcCustoPorMinuto,
  calcPercentualFixo,
  calcPercentualVendas,
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/shared/services/pricing-engine";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Settings2,
  Calculator,
  Percent,
  DollarSign,
  Save,
  Edit2,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
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

interface RegrasPrecificacao {
  id: string;
  categoria: string;
  markup_minimo: number;
  markup_sugerido: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

// ----------------------------------------------------------------------------
// NOVO FORM REGRA (inline)
// ----------------------------------------------------------------------------

interface NovaRegraFormProps {
  onSave: (values: Omit<RegrasPrecificacao, "id" | "created_at">) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function NovaRegraForm({ onSave, onCancel, isSaving }: NovaRegraFormProps) {
  const [categoria, setCategoria] = useState("");
  const [markupMinimo, setMarkupMinimo] = useState("");
  const [markupSugerido, setMarkupSugerido] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  function handleSubmit() {
    if (!categoria.trim()) {
      showError("Informe a categoria.");
      return;
    }
    const min = parseFloat(markupMinimo);
    const sug = parseFloat(markupSugerido);
    if (isNaN(min) || isNaN(sug)) {
      showError("Informe markups válidos.");
      return;
    }
    onSave({
      categoria: categoria.trim(),
      markup_minimo: min,
      markup_sugerido: sug,
      descricao: descricao.trim() || null,
      ativo,
    });
  }

  return (
    <tr className="bg-blue-50/50">
      <td className="px-4 py-2">
        <Input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Ex: Fachadas ACM"
          className="h-9"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={markupMinimo}
          onChange={(e) => setMarkupMinimo(e.target.value)}
          placeholder="30"
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={markupSugerido}
          onChange={(e) => setMarkupSugerido(e.target.value)}
          placeholder="50"
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-2">
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// EDIT ROW (inline)
// ----------------------------------------------------------------------------

interface EditRegraRowProps {
  regra: RegrasPrecificacao;
  onSave: (values: Partial<RegrasPrecificacao> & { id: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditRegraRow({ regra, onSave, onCancel, isSaving }: EditRegraRowProps) {
  const [categoria, setCategoria] = useState(regra.categoria);
  const [markupMinimo, setMarkupMinimo] = useState(String(regra.markup_minimo));
  const [markupSugerido, setMarkupSugerido] = useState(String(regra.markup_sugerido));
  const [descricao, setDescricao] = useState(regra.descricao ?? "");
  const [ativo, setAtivo] = useState(regra.ativo);

  function handleSubmit() {
    onSave({
      id: regra.id,
      categoria: categoria.trim(),
      markup_minimo: parseFloat(markupMinimo) || regra.markup_minimo,
      markup_sugerido: parseFloat(markupSugerido) || regra.markup_sugerido,
      descricao: descricao.trim() || null,
      ativo,
    });
  }

  return (
    <tr className="bg-amber-50/40">
      <td className="px-4 py-2">
        <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-9" />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={markupMinimo}
          onChange={(e) => setMarkupMinimo(e.target.value)}
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={markupSugerido}
          onChange={(e) => setMarkupSugerido(e.target.value)}
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-2">
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export function AdminPrecificacaoPage() {
  const queryClient = useQueryClient();

  // --------------------------------------------------------------------------
  // FETCH CONFIG
  // --------------------------------------------------------------------------

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["config-precificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("config_precificacao")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConfigPrecificacao | null;
    },
  });

  // --------------------------------------------------------------------------
  // FETCH REGRAS
  // --------------------------------------------------------------------------

  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ["regras-precificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .select("*")
        .order("categoria");
      if (error) throw error;
      return (data || []) as RegrasPrecificacao[];
    },
  });

  // --------------------------------------------------------------------------
  // FORM STATE — Parâmetros Gerais
  // --------------------------------------------------------------------------

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
  const [horasMes, setHorasMes] = useState(String(DEFAULT_PRICING_CONFIG.horasMes));
  const [percentualComissao, setPercentualComissao] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualComissao)
  );
  const [percentualImpostos, setPercentualImpostos] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualImpostos)
  );
  const [percentualJuros, setPercentualJuros] = useState(
    String(DEFAULT_PRICING_CONFIG.percentualJuros)
  );

  // Sync form when config loads
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

  // --------------------------------------------------------------------------
  // PREVIEW — live calculations
  // --------------------------------------------------------------------------

  const previewConfig = useMemo<PricingConfig>(() => ({
    faturamentoMedio: parseFloat(faturamentoMedio) || 0,
    custoOperacional: parseFloat(custoOperacional) || 0,
    custoProdutivo: parseFloat(custoProdutivo) || 0,
    qtdFuncionarios: parseInt(qtdFuncionarios, 10) || 0,
    horasMes: parseInt(horasMes, 10) || 0,
    percentualComissao: parseFloat(percentualComissao) || 0,
    percentualImpostos: parseFloat(percentualImpostos) || 0,
    percentualJuros: parseFloat(percentualJuros) || 0,
  }), [
    faturamentoMedio,
    custoOperacional,
    custoProdutivo,
    qtdFuncionarios,
    horasMes,
    percentualComissao,
    percentualImpostos,
    percentualJuros,
  ]);

  const custoPorMinuto = useMemo(() => calcCustoPorMinuto(previewConfig), [previewConfig]);
  const percentualFixo = useMemo(() => calcPercentualFixo(previewConfig), [previewConfig]);
  const percentualVendas = useMemo(() => calcPercentualVendas(previewConfig), [previewConfig]);

  // --------------------------------------------------------------------------
  // MUTATION — salvar config
  // --------------------------------------------------------------------------

  const saveConfigMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["config-precificacao"] });
      showSuccess("Parâmetros salvos com sucesso!");
    },
    onError: () => showError("Erro ao salvar parâmetros."),
  });

  // --------------------------------------------------------------------------
  // MUTATION — atualizar regra
  // --------------------------------------------------------------------------

  const updateRegraMutation = useMutation({
    mutationFn: async ({ id, ...values }: Partial<RegrasPrecificacao> & { id: string }) => {
      const { error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-precificacao"] });
      setEditingId(null);
      showSuccess("Regra atualizada!");
    },
    onError: () => showError("Erro ao atualizar regra."),
  });

  // --------------------------------------------------------------------------
  // MUTATION — inserir nova regra
  // --------------------------------------------------------------------------

  const insertRegraMutation = useMutation({
    mutationFn: async (values: Omit<RegrasPrecificacao, "id" | "created_at">) => {
      const { error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-precificacao"] });
      setAddingNew(false);
      showSuccess("Regra adicionada!");
    },
    onError: () => showError("Erro ao adicionar regra."),
  });

  // --------------------------------------------------------------------------
  // MUTATION — excluir regra (soft: set ativo=false e arquiva)
  // Para remover completamente usamos delete
  // --------------------------------------------------------------------------

  const deleteRegraMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-precificacao"] });
      showSuccess("Regra removida.");
    },
    onError: () => showError("Erro ao remover regra."),
  });

  // --------------------------------------------------------------------------
  // LOCAL STATE — tabela regras
  // --------------------------------------------------------------------------

  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Settings2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuração de Precificação</h1>
          <p className="text-sm text-slate-500">
            Defina os parâmetros do custeio direto Mubisys
          </p>
        </div>
      </div>

      <Separator />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ------------------------------------------------------------------ */}
        {/* SECTION 1: Parâmetros Gerais */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-slate-800">Parâmetros Gerais</CardTitle>
              </div>
              <CardDescription>
                Dados financeiros e operacionais que alimentam o motor de precificação
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {loadingConfig ? (
                <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Carregando configurações...</span>
                </div>
              ) : (
                <>
                  {/* Faturamento Médio */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium">
                      Faturamento Médio Mensal (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={faturamentoMedio}
                      onChange={(e) => setFaturamentoMedio(e.target.value)}
                      className="h-11"
                      placeholder="110000"
                    />
                  </div>

                  {/* Custo Operacional */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium">
                      Custo Operacional Mensal — Custos Fixos/Variáveis (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={custoOperacional}
                      onChange={(e) => setCustoOperacional(e.target.value)}
                      className="h-11"
                      placeholder="36800"
                    />
                  </div>

                  {/* Custo Produtivo */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium">
                      Custo Produtivo Mensal — Folha Produtiva (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={custoProdutivo}
                      onChange={(e) => setCustoProdutivo(e.target.value)}
                      className="h-11"
                      placeholder="23744"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Qtd Funcionários */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium">
                        Qtd. Funcionários Produtivos
                      </Label>
                      <Input
                        type="number"
                        step="1"
                        value={qtdFuncionarios}
                        onChange={(e) => setQtdFuncionarios(e.target.value)}
                        className="h-11"
                        placeholder="6"
                      />
                    </div>

                    {/* Horas Mês */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium">
                        Horas Mensais por Funcionário
                      </Label>
                      <Input
                        type="number"
                        step="1"
                        value={horasMes}
                        onChange={(e) => setHorasMes(e.target.value)}
                        className="h-11"
                        placeholder="176"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Percent className="h-4 w-4 text-blue-500" />
                    Percentuais Sobre Vendas
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Comissão */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-xs">Comissão (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={percentualComissao}
                        onChange={(e) => setPercentualComissao(e.target.value)}
                        className="h-11"
                        placeholder="5"
                      />
                    </div>

                    {/* Impostos */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-xs">Impostos (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={percentualImpostos}
                        onChange={(e) => setPercentualImpostos(e.target.value)}
                        className="h-11"
                        placeholder="12"
                      />
                    </div>

                    {/* Juros */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-xs">Juros (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={percentualJuros}
                        onChange={(e) => setPercentualJuros(e.target.value)}
                        className="h-11"
                        placeholder="2"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => saveConfigMutation.mutate()}
                    disabled={saveConfigMutation.isPending}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white mt-2"
                  >
                    {saveConfigMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Parâmetros
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Preview card — live calculations */}
          <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-blue-50 to-slate-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-slate-800 text-base">Preview — Cálculos Mubisys</CardTitle>
              </div>
              <CardDescription>Valores calculados em tempo real com base nos parâmetros acima</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Cm */}
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                    Custo por Minuto (Cm)
                  </div>
                  <div className="font-mono tabular-nums text-lg font-bold text-blue-700">
                    {formatBRL(custoPorMinuto)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Cm = (Fp / Qf) / horasMes / 60
                  </div>
                </div>

                {/* P% */}
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                    Custos Fixos (P%)
                  </div>
                  <div className="font-mono tabular-nums text-lg font-bold text-blue-700">
                    {formatPct(percentualFixo)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    P = ((C - CP) × 100) / F
                  </div>
                </div>

                {/* Pv */}
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                    % Vendas (Pv)
                  </div>
                  <div className="font-mono tabular-nums text-lg font-bold text-blue-700">
                    {formatPct(percentualVendas * 100)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Pv = (comissão + impostos + juros) / 100
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="mt-4 flex items-center gap-2">
                {previewConfig.faturamentoMedio > 0 && previewConfig.custoProdutivo > 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-700">
                      Configuração válida — motor pronto para calcular preços
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-700">
                      Preencha faturamento e custo produtivo para ativar o motor
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 2: Markups por Categoria */}
        {/* ------------------------------------------------------------------ */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-slate-800">Markups por Categoria</CardTitle>
                  <CardDescription>
                    Configure markup mínimo e sugerido por tipo de produto/serviço
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setAddingNew(true);
                  setEditingId(null);
                }}
                disabled={addingNew}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova Regra
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingRegras ? (
              <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Carregando regras...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Mín.</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Sug.</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Ativo</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Nova regra row */}
                    {addingNew && (
                      <NovaRegraForm
                        onSave={(values) => insertRegraMutation.mutate(values)}
                        onCancel={() => setAddingNew(false)}
                        isSaving={insertRegraMutation.isPending}
                      />
                    )}

                    {regras.length === 0 && !addingNew ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Nenhuma regra de markup configurada. Clique em "Nova Regra" para adicionar.
                        </td>
                      </tr>
                    ) : (
                      regras.map((regra) =>
                        editingId === regra.id ? (
                          <EditRegraRow
                            key={regra.id}
                            regra={regra}
                            onSave={(values) => updateRegraMutation.mutate(values)}
                            onCancel={() => setEditingId(null)}
                            isSaving={updateRegraMutation.isPending}
                          />
                        ) : (
                          <tr
                            key={regra.id}
                            className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{regra.categoria}</div>
                              {regra.descricao && (
                                <div className="text-xs text-slate-400 mt-0.5">{regra.descricao}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono tabular-nums text-slate-700">
                                {formatPct(regra.markup_minimo)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className="font-mono tabular-nums bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                {formatPct(regra.markup_sugerido)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Switch
                                checked={regra.ativo}
                                onCheckedChange={(checked) =>
                                  updateRegraMutation.mutate({ id: regra.id, ativo: checked })
                                }
                                disabled={updateRegraMutation.isPending}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingId(regra.id);
                                    setAddingNew(false);
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Editar"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteRegraMutation.mutate(regra.id)}
                                  disabled={deleteRegraMutation.isPending}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:border-red-300"
                                  title="Remover"
                                >
                                  {deleteRegraMutation.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminPrecificacaoPage;
