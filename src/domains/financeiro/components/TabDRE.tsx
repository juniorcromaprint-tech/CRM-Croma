// ============================================================================
// TAB: DRE (Demonstrativo de Resultado)
// ============================================================================

import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { brl } from "@/shared/utils/format";

import { Card } from "@/components/ui/card";

import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileText,
  CircleDollarSign,
} from "lucide-react";

import { KpiCard, KpiSkeleton, TableSkeleton } from "./FinanceiroShared";
import {
  type ContaReceber,
  type ContaPagar,
  getMonthKey,
  getMonthLabel,
  getLast6Months,
} from "../types/financeiro";

export default function TabDRE() {
  // Fetch both contas to calculate DRE client-side
  const { data: receber = [], isLoading: loadingCR } = useQuery({
    queryKey: ["financeiro", "contas_receber"],
    queryFn: async (): Promise<ContaReceber[]> => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select(
          "*, clientes(nome_fantasia, razao_social), pedidos(numero)"
        )
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ContaReceber[];
    },
  });

  const { data: pagar = [], isLoading: loadingCP } = useQuery({
    queryKey: ["financeiro", "contas_pagar"],
    queryFn: async (): Promise<ContaPagar[]> => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*, fornecedores(nome_fantasia, razao_social)")
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ContaPagar[];
    },
  });

  const isLoading = loadingCR || loadingCP;
  const months = useMemo(() => getLast6Months(), []);

  // Overall summary (pago only)
  const summary = useMemo(() => {
    const receita = receber
      .filter((c) => c.status === "pago")
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    const custoCategories = ["material", "servico"];
    const custos = pagar
      .filter(
        (c) =>
          c.status === "pago" &&
          c.categoria &&
          custoCategories.includes(c.categoria)
      )
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    const despesas = pagar
      .filter(
        (c) =>
          c.status === "pago" &&
          (!c.categoria || !custoCategories.includes(c.categoria))
      )
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    return {
      receita,
      custos,
      despesas,
      resultado: receita - custos - despesas,
    };
  }, [receber, pagar]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const custoCategories = ["material", "servico"];

    return months.map((monthKey) => {
      const receitas = receber
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      const custos = pagar
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey &&
            c.categoria &&
            custoCategories.includes(c.categoria)
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      const despesas = pagar
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey &&
            (!c.categoria || !custoCategories.includes(c.categoria))
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      return {
        month: monthKey,
        label: getMonthLabel(monthKey),
        receitas,
        custos,
        despesas,
        resultado: receitas - custos - despesas,
      };
    });
  }, [receber, pagar, months]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Bruta"
          value={brl(summary.receita)}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub="total recebido"
          subColor="text-emerald-600"
        />
        <KpiCard
          label="(-) Custos"
          value={brl(summary.custos)}
          icon={FileText}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          sub="material + servico"
          subColor="text-orange-600"
        />
        <KpiCard
          label="(-) Despesas"
          value={brl(summary.despesas)}
          icon={TrendingDown}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sub="demais categorias"
          subColor="text-red-500"
        />
        <KpiCard
          label="= Resultado Líquido"
          value={brl(summary.resultado)}
          icon={CircleDollarSign}
          iconBg={summary.resultado >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={
            summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"
          }
          sub={
            summary.receita > 0
              ? `Margem: ${((summary.resultado / summary.receita) * 100).toFixed(1).replace(".", ",")}%`
              : undefined
          }
          subColor={
            summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"
          }
        />
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            DRE Mensal — Últimos 6 Meses
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Base: contas pagas (baixadas)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Mes
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Receitas
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Custos
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Despesas
                </th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyData.map((row) => {
                const hasData =
                  row.receitas > 0 || row.custos > 0 || row.despesas > 0;
                return (
                  <tr
                    key={row.month}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {row.label}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-emerald-600 font-medium">
                      {hasData ? brl(row.receitas) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-red-500 font-medium">
                      {row.custos > 0 ? `(${brl(row.custos)})` : "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-red-500 font-medium">
                      {row.despesas > 0 ? `(${brl(row.despesas)})` : "—"}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono tabular-nums font-bold ${
                        !hasData
                          ? "text-slate-300"
                          : row.resultado >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {hasData ? brl(row.resultado) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                className={`font-bold ${
                  summary.resultado >= 0 ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <td
                  className={`px-6 py-4 ${summary.resultado >= 0 ? "text-emerald-800" : "text-red-800"}`}
                >
                  TOTAL
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-emerald-700">
                  {brl(summary.receita)}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-red-600">
                  {summary.custos > 0 ? `(${brl(summary.custos)})` : "—"}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-red-600">
                  {summary.despesas > 0 ? `(${brl(summary.despesas)})` : "—"}
                </td>
                <td
                  className={`px-6 py-4 text-right font-mono tabular-nums ${
                    summary.resultado >= 0
                      ? "text-emerald-700"
                      : "text-red-600"
                  }`}
                >
                  {brl(summary.resultado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
