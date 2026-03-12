// ============================================================================
// DRE PAGE — Demonstrativo de Resultado do Exercício
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/shared/utils/format";
import { showError } from "@/utils/toast";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  BarChart3,
  DollarSign,
  Minus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DREData {
  receitaBruta: number;
  impostos: number;
  devolucoes: number;
  receitaLiquida: number;
  cme: number; // Custo dos Materiais/Serviços
  lucroBruto: number;
  despesasComerciais: number;
  despesasAdministrativas: number;
  despesasPessoal: number;
  ebitda: number;
  depreciacao: number;
  ebit: number;
  resultadoFinanceiro: number;
  lair: number;
  ir: number;
  lucroLiquido: number;
  // Margens
  margemBruta: number;
  margemEbitda: number;
  margemLiquida: number;
}

interface GraficoMes {
  mes: string;
  receita: number;
  custos: number;
  lucro: number;
}

interface ConfigPrecificacao {
  percentual_impostos: number | null;
  percentual_comissao: number | null;
  custo_operacional: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPeriodoDates(periodo: string): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (periodo) {
    case "mes": {
      const inicio = new Date(y, m, 1);
      const fim = new Date(y, m + 1, 0);
      return { inicio: toISO(inicio), fim: toISO(fim) };
    }
    case "trimestre": {
      const q = Math.floor(m / 3);
      const inicio = new Date(y, q * 3, 1);
      const fim = new Date(y, q * 3 + 3, 0);
      return { inicio: toISO(inicio), fim: toISO(fim) };
    }
    case "semestre": {
      const s = m < 6 ? 0 : 1;
      const inicio = new Date(y, s * 6, 1);
      const fim = new Date(y, s * 6 + 6, 0);
      return { inicio: toISO(inicio), fim: toISO(fim) };
    }
    case "ano": {
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
    }
    default:
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
  }
}

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// ─── Hook de dados DRE ────────────────────────────────────────────────────────

function useDRE(periodo: string) {
  const { inicio, fim } = useMemo(() => getPeriodoDates(periodo), [periodo]);

  return useQuery<DREData>({
    queryKey: ["dre", periodo],
    queryFn: async () => {
      // 1. Contas a receber do período — inclui pendentes, parciais e pagas
      //    Usa data_vencimento como referência temporal; fallback: sem filtro de status
      const { data: receber, error: errReceber } = await supabase
        .from("contas_receber")
        .select("valor_original, valor_pago, status, data_pagamento, data_vencimento")
        .neq("status", "cancelado")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim);

      if (errReceber) {
        showError("Erro ao buscar contas a receber");
        throw errReceber;
      }

      // 2. Contas a pagar do período
      const { data: pagar, error: errPagar } = await supabase
        .from("contas_pagar")
        .select("valor_original, valor_pago, status, data_pagamento, data_vencimento, categoria")
        .neq("status", "cancelado")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim);

      if (errPagar) {
        showError("Erro ao buscar contas a pagar");
        throw errPagar;
      }

      // 3. Config de precificação (percentuais)
      const { data: config } = await supabase
        .from("config_precificacao")
        .select("percentual_impostos, percentual_comissao, custo_operacional")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const cfg = config as ConfigPrecificacao | null;
      const pctImpostos = (cfg?.percentual_impostos ?? 12) / 100;
      const pctComissao = (cfg?.percentual_comissao ?? 5) / 100;

      // ── Cálculos ─────────────────────────────────────────────────────────

      // Receita Bruta = soma dos valores faturados (emitidos) no período
      // Inclui contas pendentes, parciais e pagas
      const receitaBruta = (receber ?? []).reduce(
        (acc, r) => acc + (Number(r.valor_original) || 0),
        0,
      );

      // Impostos sobre receita (NF, ISS, COFINS, PIS, etc.)
      const impostos = receitaBruta * pctImpostos;

      // Devoluções — estimativa conservadora (1,5% da receita)
      const devolucoes = receitaBruta * 0.015;

      // Receita Líquida
      const receitaLiquida = receitaBruta - impostos - devolucoes;

      // Categorizar contas a pagar
      const totalPago = (pagar ?? []).reduce(
        (acc, p) => acc + (Number(p.valor_pago) || Number(p.valor_original) || 0),
        0,
      );

      // CME: materiais diretos, fornecedores produção (~45% dos custos totais como estimativa gerencial)
      const cme = totalPago * 0.45;

      // Lucro Bruto
      const lucroBruto = receitaLiquida - cme;

      // Comissões comerciais
      const despesasComerciais = receitaBruta * pctComissao;

      // Despesas administrativas (~25% dos custos)
      const despesasAdministrativas = totalPago * 0.25;

      // Folha de pessoal (~30% dos custos)
      const despesasPessoal = totalPago * 0.30;

      // EBITDA
      const ebitda = lucroBruto - despesasComerciais - despesasAdministrativas - despesasPessoal;

      // Depreciação — estimativa mensal fixa (R$ 1.500 por mês no período)
      const mesesNoPeriodo = Math.max(
        1,
        Math.round(
          (new Date(fim).getTime() - new Date(inicio).getTime()) /
            (30 * 24 * 60 * 60 * 1000),
        ),
      );
      const depreciacao = 1500 * mesesNoPeriodo;

      // EBIT / Lucro Operacional
      const ebit = ebitda - depreciacao;

      // Resultado Financeiro (~-1% da receita, despesas bancárias/juros)
      const resultadoFinanceiro = -(receitaBruta * 0.01);

      // LAIR
      const lair = ebit + resultadoFinanceiro;

      // IR + CSLL (~15% do LAIR positivo)
      const ir = lair > 0 ? lair * 0.15 : 0;

      // Lucro Líquido
      const lucroLiquido = lair - ir;

      // Margens
      const margemBruta =
        receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
      const margemEbitda =
        receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;
      const margemLiquida =
        receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

      return {
        receitaBruta,
        impostos,
        devolucoes,
        receitaLiquida,
        cme,
        lucroBruto,
        despesasComerciais,
        despesasAdministrativas,
        despesasPessoal,
        ebitda,
        depreciacao,
        ebit,
        resultadoFinanceiro,
        lair,
        ir,
        lucroLiquido,
        margemBruta,
        margemEbitda,
        margemLiquida,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook gráfico histórico (últimos 6 meses) ─────────────────────────────────

function useDREGrafico() {
  return useQuery<GraficoMes[]>({
    queryKey: ["dre-grafico"],
    queryFn: async () => {
      const now = new Date();
      const meses: GraficoMes[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const fimDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const fim = `${fimDate.getFullYear()}-${String(fimDate.getMonth() + 1).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

        const [{ data: receber }, { data: pagar }] = await Promise.all([
          supabase
            .from("contas_receber")
            .select("valor_pago, valor_original")
            .neq("status", "cancelado")
            .gte("data_vencimento", inicio)
            .lte("data_vencimento", fim),
          supabase
            .from("contas_pagar")
            .select("valor_pago, valor_original")
            .neq("status", "cancelado")
            .gte("data_vencimento", inicio)
            .lte("data_vencimento", fim),
        ]);

        const receita = (receber ?? []).reduce(
          (acc, r) => acc + (Number(r.valor_original) || 0),
          0,
        );
        const custos = (pagar ?? []).reduce(
          (acc, p) => acc + (Number(p.valor_original) || 0),
          0,
        );

        meses.push({
          mes: MESES_PT[d.getMonth()],
          receita,
          custos,
          lucro: receita - custos,
        });
      }

      return meses;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface LinhasDREProps {
  label: string;
  valor: number;
  negativo?: boolean;
  destaque?: boolean;
  nivel?: 0 | 1 | 2; // 0 = título principal, 1 = subtotal, 2 = item
  prefixo?: string; // "(−)" ou "(+/−)"
}

function LinhasDRE({
  label,
  valor,
  negativo = false,
  destaque = false,
  nivel = 2,
  prefixo,
}: LinhasDREProps) {
  const valorFormatado = negativo ? `(${brl(Math.abs(valor))})` : brl(valor);
  const corValor = negativo
    ? "text-red-600"
    : valor < 0
    ? "text-red-600"
    : valor === 0
    ? "text-slate-400"
    : "text-slate-800";

  if (nivel === 0) {
    return (
      <tr className="border-t-2 border-slate-300 bg-slate-50">
        <td className="py-2.5 px-4 font-bold text-slate-800 uppercase tracking-wide text-xs">
          {prefixo && <span className="text-slate-400 mr-1">{prefixo}</span>}
          {label}
        </td>
        <td className={`py-2.5 px-4 text-right font-bold tabular-nums text-sm ${corValor}`}>
          {valorFormatado}
        </td>
      </tr>
    );
  }

  if (nivel === 1) {
    return (
      <tr className={destaque ? "bg-emerald-50/50 border-t border-slate-200" : "border-t border-slate-200"}>
        <td className="py-2.5 px-4 font-semibold text-slate-700 text-sm">
          {prefixo && <span className="text-slate-400 mr-1">{prefixo}</span>}
          {label}
        </td>
        <td className={`py-2.5 px-4 text-right font-semibold tabular-nums text-sm ${corValor}`}>
          {valorFormatado}
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="py-2 px-4 pl-8 text-slate-500 text-sm">
        {prefixo && <span className="text-slate-400 mr-1 font-medium">{prefixo}</span>}
        {label}
      </td>
      <td className={`py-2 px-4 text-right tabular-nums text-sm ${corValor}`}>
        {valorFormatado}
      </td>
    </tr>
  );
}

function DRESkeletonRow() {
  return (
    <tr>
      <td className="py-2 px-4">
        <Skeleton className="h-4 w-48" />
      </td>
      <td className="py-2 px-4 text-right">
        <Skeleton className="h-4 w-24 ml-auto" />
      </td>
    </tr>
  );
}

function MargemBadge({ label, valor }: { label: string; valor: number }) {
  const cor =
    valor > 20
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : valor > 10
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : valor > 0
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : "bg-red-100 text-red-700 border-red-200";

  return (
    <div className={`text-center p-4 rounded-xl border ${cor}`}>
      <p className="text-xs font-medium mb-1 opacity-70">{label}</p>
      <p className="text-xl font-bold tabular-nums">
        {valor.toFixed(1).replace(".", ",")}%
      </p>
    </div>
  );
}

// ─── Tooltip customizado do gráfico ─────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}
          </span>
          <span className="tabular-nums text-slate-700 font-semibold">
            {brl(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function DrePage() {
  const [periodo, setPeriodo] = useState("mes");

  const { data: dre, isLoading, error } = useDRE(periodo);
  const { data: grafico, isLoading: isLoadingGrafico } = useDREGrafico();

  const { inicio, fim } = useMemo(() => getPeriodoDates(periodo), [periodo]);

  const periodoLabel: Record<string, string> = {
    mes: "Este Mês",
    trimestre: "Este Trimestre",
    semestre: "Este Semestre",
    ano: "Este Ano",
  };

  const handlePrint = () => {
    window.print();
  };

  const lucroPositivo = (dre?.lucroLiquido ?? 0) >= 0;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ─── Cabeçalho ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            DRE — Demonstrativo de Resultado
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Resultado gerencial do período:{" "}
            <span className="font-medium text-slate-700">
              {inicio} a {fim}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-44 rounded-xl border-slate-200 bg-white">
              <Calendar size={14} className="text-slate-400 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Este Trimestre</SelectItem>
              <SelectItem value="semestre">Este Semestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-xl border-slate-200 gap-2"
          >
            <Printer size={14} />
            Imprimir
          </Button>
        </div>
      </div>

      {/* ─── Print: título ─────────────────────────────────────── */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Croma Print — DRE Gerencial</h1>
        <p className="text-slate-500">
          Período: {periodoLabel[periodo]} ({inicio} a {fim})
        </p>
      </div>

      {/* ─── KPIs de topo ────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse"
            >
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-36 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <DollarSign size={18} />
              </div>
              <span className="text-sm text-slate-500">Receita Bruta</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">
              {brl(dre?.receitaBruta ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Líq: {brl(dre?.receitaLiquida ?? 0)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <BarChart3 size={18} />
              </div>
              <span className="text-sm text-slate-500">EBITDA</span>
            </div>
            <p
              className={`text-2xl font-bold tabular-nums ${
                (dre?.ebitda ?? 0) >= 0 ? "text-slate-800" : "text-red-600"
              }`}
            >
              {brl(dre?.ebitda ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Margem: {(dre?.margemEbitda ?? 0).toFixed(1).replace(".", ",")}%
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 shadow-sm ${
              lucroPositivo
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  lucroPositivo
                    ? "bg-emerald-200 text-emerald-700"
                    : "bg-red-200 text-red-700"
                }`}
              >
                {lucroPositivo ? (
                  <TrendingUp size={18} />
                ) : (
                  <TrendingDown size={18} />
                )}
              </div>
              <span
                className={`text-sm ${
                  lucroPositivo ? "text-emerald-700" : "text-red-700"
                }`}
              >
                Lucro Líquido
              </span>
            </div>
            <p
              className={`text-2xl font-bold tabular-nums ${
                lucroPositivo ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {brl(dre?.lucroLiquido ?? 0)}
            </p>
            <p
              className={`text-xs mt-1 ${
                lucroPositivo ? "text-emerald-600" : "text-red-600"
              }`}
            >
              Margem líq:{" "}
              {(dre?.margemLiquida ?? 0).toFixed(1).replace(".", ",")}%
            </p>
          </div>
        </div>
      )}

      {/* ─── Tabela DRE ────────────────────────────────────────── */}
      <Card className="rounded-2xl border-none shadow-sm print:shadow-none print:border print:border-slate-300">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <BarChart3 size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">
              DRE Gerencial — {periodoLabel[periodo]}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <>
                    {Array.from({ length: 18 }).map((_, i) => (
                      <DRESkeletonRow key={i} />
                    ))}
                  </>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      Erro ao carregar dados. Tente novamente.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* RECEITA BRUTA */}
                    <LinhasDRE
                      label="RECEITA BRUTA"
                      valor={dre?.receitaBruta ?? 0}
                      nivel={0}
                    />
                    <LinhasDRE
                      label="Impostos e Deduções (ISS/COFINS/PIS)"
                      valor={dre?.impostos ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />
                    <LinhasDRE
                      label="Devoluções e Abatimentos"
                      valor={dre?.devolucoes ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />

                    {/* RECEITA LÍQUIDA */}
                    <LinhasDRE
                      label="= RECEITA LÍQUIDA"
                      valor={dre?.receitaLiquida ?? 0}
                      nivel={1}
                      destaque
                    />
                    <LinhasDRE
                      label="Custo dos Materiais e Serviços (CME)"
                      valor={dre?.cme ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />

                    {/* LUCRO BRUTO */}
                    <LinhasDRE
                      label="= LUCRO BRUTO"
                      valor={dre?.lucroBruto ?? 0}
                      nivel={1}
                      destaque={(dre?.lucroBruto ?? 0) > 0}
                    />

                    {/* DESPESAS OPERACIONAIS */}
                    <tr className="bg-slate-50/80">
                      <td
                        colSpan={2}
                        className="py-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                      >
                        Despesas Operacionais
                      </td>
                    </tr>
                    <LinhasDRE
                      label="Despesas Comerciais (Comissões)"
                      valor={dre?.despesasComerciais ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />
                    <LinhasDRE
                      label="Despesas Administrativas"
                      valor={dre?.despesasAdministrativas ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />
                    <LinhasDRE
                      label="Despesas com Pessoal (Folha)"
                      valor={dre?.despesasPessoal ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />

                    {/* EBITDA */}
                    <LinhasDRE
                      label="= EBITDA"
                      valor={dre?.ebitda ?? 0}
                      nivel={1}
                      destaque={(dre?.ebitda ?? 0) > 0}
                    />
                    <LinhasDRE
                      label="Depreciação e Amortização"
                      valor={dre?.depreciacao ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />

                    {/* EBIT */}
                    <LinhasDRE
                      label="= EBIT / LUCRO OPERACIONAL"
                      valor={dre?.ebit ?? 0}
                      nivel={0}
                    />
                    <LinhasDRE
                      label="Resultado Financeiro (Juros/Tarifas)"
                      valor={dre?.resultadoFinanceiro ?? 0}
                      negativo={(dre?.resultadoFinanceiro ?? 0) < 0}
                      nivel={2}
                      prefixo="(+/−)"
                    />

                    {/* LAIR */}
                    <LinhasDRE
                      label="= LAIR (Lucro Antes do IR)"
                      valor={dre?.lair ?? 0}
                      nivel={1}
                      destaque={(dre?.lair ?? 0) > 0}
                    />
                    <LinhasDRE
                      label="Imposto de Renda e CSLL (15%)"
                      valor={dre?.ir ?? 0}
                      negativo
                      nivel={2}
                      prefixo="(−)"
                    />

                    {/* LUCRO LÍQUIDO */}
                    <tr
                      className={`border-t-2 border-slate-400 ${
                        lucroPositivo ? "bg-emerald-50" : "bg-red-50"
                      }`}
                    >
                      <td
                        className={`py-3 px-4 font-bold text-base uppercase tracking-wide ${
                          lucroPositivo
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        = LUCRO LÍQUIDO
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold text-base tabular-nums ${
                          lucroPositivo
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {brl(dre?.lucroLiquido ?? 0)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Margens ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
          <MargemBadge label="Margem Bruta" valor={dre?.margemBruta ?? 0} />
          <MargemBadge label="Margem EBITDA" valor={dre?.margemEbitda ?? 0} />
          <MargemBadge label="Margem Líquida" valor={dre?.margemLiquida ?? 0} />
        </div>
      )}

      {/* ─── Gráfico histórico ────────────────────────────────────── */}
      <Card className="rounded-2xl border-none shadow-sm print:hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">
              Evolução Mensal — Últimos 6 meses
            </h2>
          </div>

          {isLoadingGrafico ? (
            <div className="h-64 flex items-center justify-center">
              <div className="space-y-3 w-full">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={grafico ?? []}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                barGap={4}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (Math.abs(v) >= 1000) {
                      return `${(v / 1000).toFixed(0)}k`;
                    }
                    return String(v);
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: "#64748b" }}
                />
                <Bar
                  dataKey="receita"
                  name="Receita"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="custos"
                  name="Custos"
                  fill="#f87171"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="lucro"
                  name="Lucro"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Nota de rodapé ──────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 print:hidden">
        <Minus size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Nota gerencial:</strong> Os valores de CME (Custo dos Materiais e
          Serviços), Despesas Administrativas e de Pessoal são estimados com base em
          proporções gerenciais (45%, 25% e 30% dos custos pagos, respectivamente).
          Para um DRE contábil preciso, configure o Plano de Contas com categorias
          distintas em Contas a Pagar.
        </span>
      </div>
    </div>
  );
}
