import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  CircleDollarSign,
  Receipt,
  CreditCard,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (value: number, total: number) =>
  total === 0 ? "0,0%" : `${((value / total) * 100).toFixed(1).replace(".", ",")}%`;

// ─── DRE Data ────────────────────────────────────────────────────────────────

const DRE_DATA = {
  receita_bruta: 142000,
  impostos: 8520,
  despesa_operacional: 18600,
  despesa_variavel: 48300,
  despesas_fixas: 22000,
  pessoal: 31200,
  financeiro: 4800,
};

function calcDRE(d: typeof DRE_DATA) {
  const receita_liquida = d.receita_bruta - d.impostos;
  const lucro_bruto = receita_liquida - d.despesa_operacional - d.despesa_variavel;
  const lucro_operacional = lucro_bruto - d.despesas_fixas - d.pessoal - d.financeiro;
  const ir_csll = lucro_operacional > 0 ? lucro_operacional * 0.24 : 0;
  const lucro_liquido = lucro_operacional - ir_csll;

  return {
    receita_liquida,
    lucro_bruto,
    lucro_operacional,
    ir_csll,
    lucro_liquido,
  };
}

// ─── Fluxo de Caixa Data ─────────────────────────────────────────────────────

const SALDO_INICIAL = 28500;

const ENTRADAS = [
  { data: "05/03", descricao: "Pagamento Beira Rio", categoria: "Recebimento OS", valor: 18500, ref: "ORC-2026-001" },
  { data: "07/03", descricao: "Pagamento Paquetá", categoria: "Recebimento OS", valor: 27350, ref: "ORC-2026-004" },
  { data: "12/03", descricao: "Pagamento BIG", categoria: "Recebimento OS", valor: 9800, ref: "OS-2026-012" },
  { data: "15/03", descricao: "Pagamento Renner antecipado", categoria: "Recebimento Antecipado", valor: 16400, ref: "ORC-2026-002" },
  { data: "20/03", descricao: "Agência Kreatif", categoria: "Recebimento OS", valor: 12300, ref: "ORC-2026-007" },
];

const SAIDAS = [
  { data: "01/03", descricao: "Aluguel galpão", categoria: "Despesa Fixa", valor: 8500 },
  { data: "01/03", descricao: "Salários", categoria: "Pessoal", valor: 31200 },
  { data: "03/03", descricao: "Fornecedor lonas Graffix", categoria: "Matéria Prima", valor: 12400 },
  { data: "08/03", descricao: "Fornecedor ACM Aluprint", categoria: "Matéria Prima", valor: 9800 },
  { data: "10/03", descricao: "DARF Simples", categoria: "Imposto", valor: 8520 },
  { data: "15/03", descricao: "Energia elétrica", categoria: "Despesa Fixa", valor: 3200 },
  { data: "18/03", descricao: "Fornecedor tinta", categoria: "Matéria Prima", valor: 4600 },
  { data: "22/03", descricao: "Manutenção equipamentos", categoria: "Operacional", valor: 2800 },
];

// ─── Contas a Receber ─────────────────────────────────────────────────────────

type StatusReceber = "em_aberto" | "vencido" | "recebido";

interface ContaReceber {
  id: string;
  cliente: string;
  ref: string;
  valor: number;
  vencimento: string;
  status: StatusReceber;
}

const CONTAS_RECEBER_INITIAL: ContaReceber[] = [
  { id: "cr1", cliente: "Lojas Renner", ref: "ORC-2026-002", valor: 16400, vencimento: "2026-03-28", status: "em_aberto" },
  { id: "cr2", cliente: "Farmácias São João", ref: "ORC-2026-003", valor: 4200, vencimento: "2026-03-20", status: "vencido" },
  { id: "cr3", cliente: "Agência Kreatif", ref: "ORC-2026-007", valor: 12300, vencimento: "2026-04-05", status: "em_aberto" },
  { id: "cr4", cliente: "Calçados Beira Rio", ref: "ORC-2026-001", valor: 18500, vencimento: "2026-03-10", status: "recebido" },
  { id: "cr5", cliente: "Grupo Paquetá", ref: "ORC-2026-004", valor: 27350, vencimento: "2026-03-15", status: "recebido" },
  { id: "cr6", cliente: "Supermercados BIG", ref: "OS-2026-012", valor: 9800, vencimento: "2026-03-08", status: "recebido" },
];

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

type StatusPagar = "a_pagar" | "vencido" | "pago";

interface ContaPagar {
  id: string;
  fornecedor: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: StatusPagar;
}

const CONTAS_PAGAR_INITIAL: ContaPagar[] = [
  { id: "cp1", fornecedor: "Graffix Lonas", categoria: "Matéria Prima", valor: 12400, vencimento: "2026-03-25", status: "pago" },
  { id: "cp2", fornecedor: "Aluprint ACM", categoria: "Matéria Prima", valor: 9800, vencimento: "2026-03-30", status: "a_pagar" },
  { id: "cp3", fornecedor: "Energia CEEE", categoria: "Despesa Fixa", valor: 3200, vencimento: "2026-04-05", status: "a_pagar" },
  { id: "cp4", fornecedor: "DARF Simples", categoria: "Imposto", valor: 8520, vencimento: "2026-03-20", status: "pago" },
  { id: "cp5", fornecedor: "Locação Galpão", categoria: "Despesa Fixa", valor: 8500, vencimento: "2026-04-01", status: "a_pagar" },
  { id: "cp6", fornecedor: "Fornecedor Tinta", categoria: "Matéria Prima", valor: 4600, vencimento: "2026-03-18", status: "pago" },
  { id: "cp7", fornecedor: "Manutenção Equip.", categoria: "Operacional", valor: 2800, vencimento: "2026-03-22", status: "vencido" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
          {sub && <p className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}>{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: DRE ─────────────────────────────────────────────────────────────────

function TabDRE() {
  const d = DRE_DATA;
  const c = calcDRE(d);
  const rb = d.receita_bruta;

  type DRERow =
    | { type: "item"; label: string; value: number; indent?: boolean; color?: string }
    | { type: "total"; label: string; value: number; positive?: boolean }
    | { type: "divider" };

  const rows: DRERow[] = [
    { type: "item", label: "(+) Receita Bruta", value: d.receita_bruta, color: "text-emerald-700" },
    { type: "item", label: "(−) Impostos sobre venda (Simples Nacional 6%)", value: d.impostos, indent: true, color: "text-red-600" },
    { type: "total", label: "(=) RECEITA LÍQUIDA", value: c.receita_liquida, positive: true },
    { type: "divider" },
    { type: "item", label: "(−) Despesa Operacional (custos variáveis diretos)", value: d.despesa_operacional, indent: true, color: "text-red-600" },
    { type: "item", label: "(−) Despesa Variável (MP, comissões, fretes)", value: d.despesa_variavel, indent: true, color: "text-red-600" },
    { type: "total", label: "(=) LUCRO BRUTO", value: c.lucro_bruto, positive: c.lucro_bruto >= 0 },
    { type: "divider" },
    { type: "item", label: "(−) Despesas Fixas (aluguel, contas, serviços)", value: d.despesas_fixas, indent: true, color: "text-red-600" },
    { type: "item", label: "(−) Pessoal (folha + encargos)", value: d.pessoal, indent: true, color: "text-red-600" },
    { type: "item", label: "(−) Financeiro (juros, tarifas bancárias)", value: d.financeiro, indent: true, color: "text-red-600" },
    { type: "total", label: "(=) LUCRO OPERACIONAL", value: c.lucro_operacional, positive: c.lucro_operacional >= 0 },
    { type: "divider" },
    { type: "item", label: "(−) IR 15% + CSLL 9% (sobre lucro positivo)", value: c.ir_csll, indent: true, color: c.ir_csll > 0 ? "text-red-600" : "text-slate-400" },
    { type: "total", label: "(=) LUCRO LÍQUIDO", value: c.lucro_liquido, positive: c.lucro_liquido >= 0 },
  ];

  const margemBruta = (c.lucro_bruto / rb) * 100;
  const margemOperacional = (c.lucro_operacional / rb) * 100;
  const margemLiquida = (c.lucro_liquido / rb) * 100;

  return (
    <div className="space-y-6">
      {/* Summary margin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Margem Bruta"
          value={`${margemBruta.toFixed(1).replace(".", ",")}%`}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={brl(c.lucro_bruto)}
          subColor="text-emerald-600"
        />
        <KpiCard
          label="Margem Operacional"
          value={`${margemOperacional.toFixed(1).replace(".", ",")}%`}
          icon={BarChart3}
          iconBg={margemOperacional >= 0 ? "bg-blue-50" : "bg-red-50"}
          iconColor={margemOperacional >= 0 ? "text-blue-600" : "text-red-600"}
          sub={brl(c.lucro_operacional)}
          subColor={margemOperacional >= 0 ? "text-blue-600" : "text-red-600"}
        />
        <KpiCard
          label="Margem Líquida"
          value={`${margemLiquida.toFixed(1).replace(".", ",")}%`}
          icon={CircleDollarSign}
          iconBg={margemLiquida >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={margemLiquida >= 0 ? "text-emerald-600" : "text-red-600"}
          sub={brl(c.lucro_liquido)}
          subColor={margemLiquida >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {/* DRE Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base">Demonstrativo de Resultado — Março 2026</h3>
          <span className="text-xs text-slate-400 font-medium">Base: Receita Bruta</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Descrição</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Valor (R$)</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">% Receita</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.type === "divider") {
                  return <tr key={idx}><td colSpan={3} className="py-1"><div className="mx-6 border-t border-slate-100" /></td></tr>;
                }
                if (row.type === "total") {
                  const isPositive = row.positive;
                  return (
                    <tr key={idx} className={`${isPositive ? "bg-emerald-50" : "bg-red-50"} font-bold`}>
                      <td className={`px-6 py-3.5 ${isPositive ? "text-emerald-800" : "text-red-800"}`}>
                        {row.label}
                      </td>
                      <td className={`px-6 py-3.5 text-right tabular-nums ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                        {brl(row.value)}
                      </td>
                      <td className={`px-6 py-3.5 text-right ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                        {pct(row.value, rb)}
                      </td>
                    </tr>
                  );
                }
                // item
                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors border-b border-slate-50 last:border-0">
                    <td className={`px-6 py-3 ${row.indent ? "pl-10" : ""} text-slate-700`}>
                      {row.label}
                    </td>
                    <td className={`px-6 py-3 text-right tabular-nums font-medium ${row.color ?? "text-slate-700"}`}>
                      {row.color?.includes("red") ? `(${brl(row.value)})` : brl(row.value)}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-400 text-xs">
                      {pct(row.value, rb)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Fluxo de Caixa ──────────────────────────────────────────────────────

function TabFluxo() {
  const totalEntradas = ENTRADAS.reduce((s, e) => s + e.valor, 0);
  const totalSaidas = SAIDAS.reduce((s, e) => s + e.valor, 0);
  const saldoFinal = SALDO_INICIAL + totalEntradas - totalSaidas;

  // Build unified chronological entries with running balance
  type FluxoItem = {
    data: string;
    descricao: string;
    categoria: string;
    tipo: "entrada" | "saida";
    valor: number;
    ref?: string;
  };

  // Sort all items by date day number
  const allItems: FluxoItem[] = [
    ...ENTRADAS.map((e) => ({ ...e, tipo: "entrada" as const })),
    ...SAIDAS.map((s) => ({ ...s, tipo: "saida" as const })),
  ].sort((a, b) => {
    const dayA = parseInt(a.data.split("/")[0]);
    const dayB = parseInt(b.data.split("/")[0]);
    return dayA - dayB;
  });

  let runningBalance = SALDO_INICIAL;
  const itemsWithBalance = allItems.map((item) => {
    if (item.tipo === "entrada") {
      runningBalance += item.valor;
    } else {
      runningBalance -= item.valor;
    }
    return { ...item, saldo: runningBalance };
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Saldo Inicial"
          value={brl(SALDO_INICIAL)}
          icon={Wallet}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
        />
        <KpiCard
          label="Total Entradas"
          value={brl(totalEntradas)}
          icon={ArrowDownLeft}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={`${ENTRADAS.length} lançamentos`}
          subColor="text-emerald-600"
        />
        <KpiCard
          label="Total Saídas"
          value={brl(totalSaidas)}
          icon={ArrowUpRight}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sub={`${SAIDAS.length} lançamentos`}
          subColor="text-red-500"
        />
        <KpiCard
          label="Saldo Final"
          value={brl(saldoFinal)}
          icon={TrendingUp}
          iconBg={saldoFinal >= 0 ? "bg-blue-50" : "bg-red-50"}
          iconColor={saldoFinal >= 0 ? "text-blue-600" : "text-red-600"}
          subColor={saldoFinal >= 0 ? "text-blue-600" : "text-red-600"}
        />
      </div>

      {/* Two-column summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Entradas */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <h3 className="font-bold text-slate-800 text-sm">Entradas</h3>
            <span className="ml-auto font-bold text-emerald-700 text-sm">{brl(totalEntradas)}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {ENTRADAS.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                <span className="text-xs text-slate-400 font-mono w-10 flex-shrink-0">{e.data}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{e.descricao}</p>
                  <p className="text-xs text-slate-400">{e.categoria} {e.ref && <span className="font-mono">· {e.ref}</span>}</p>
                </div>
                <span className="font-bold text-emerald-600 text-sm tabular-nums flex-shrink-0">
                  +{brl(e.valor)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Saídas */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <h3 className="font-bold text-slate-800 text-sm">Saídas</h3>
            <span className="ml-auto font-bold text-red-600 text-sm">{brl(totalSaidas)}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {SAIDAS.map((s, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                <span className="text-xs text-slate-400 font-mono w-10 flex-shrink-0">{s.data}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{s.descricao}</p>
                  <p className="text-xs text-slate-400">{s.categoria}</p>
                </div>
                <span className="font-bold text-red-500 text-sm tabular-nums flex-shrink-0">
                  -{brl(s.valor)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Extrato cronológico com saldo corrente */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Extrato Cronológico — Março 2026</h3>
          <p className="text-xs text-slate-400 mt-0.5">Saldo inicial: {brl(SALDO_INICIAL)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-16">Data</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {itemsWithBalance.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3 text-xs text-slate-400 font-mono">{item.data}</td>
                  <td className="px-6 py-3 text-slate-700 font-medium">{item.descricao}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{item.categoria}</td>
                  <td className={`px-6 py-3 text-right font-bold tabular-nums ${item.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                    {item.tipo === "entrada" ? "+" : "-"}{brl(item.valor)}
                  </td>
                  <td className={`px-6 py-3 text-right font-semibold tabular-nums ${item.saldo >= 0 ? "text-slate-700" : "text-red-600"}`}>
                    {brl(item.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Contas a Receber ────────────────────────────────────────────────────

const STATUS_RECEBER: Record<StatusReceber, { label: string; badge: string; icon: React.ElementType }> = {
  em_aberto: { label: "Em aberto", badge: "bg-blue-50 text-blue-700 border-blue-100", icon: Clock },
  vencido: { label: "Vencido", badge: "bg-red-50 text-red-600 border-red-100", icon: AlertCircle },
  recebido: { label: "Recebido", badge: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
};

function TabContasReceber() {
  const [filter, setFilter] = useState<"todos" | StatusReceber>("todos");
  const [contas, setContas] = useState<ContaReceber[]>(CONTAS_RECEBER_INITIAL);

  const filtered = filter === "todos" ? contas : contas.filter((c) => c.status === filter);

  const totalAberto = contas.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas.filter((c) => c.status === "vencido").reduce((s, c) => s + c.valor, 0);
  const totalAVencer = contas.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalRecebido = contas.filter((c) => c.status === "recebido").reduce((s, c) => s + c.valor, 0);

  const marcarRecebido = (id: string) => {
    setContas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "recebido" as StatusReceber } : c))
    );
  };

  const filters: Array<{ key: "todos" | StatusReceber; label: string }> = [
    { key: "todos", label: "Todos" },
    { key: "em_aberto", label: "Em aberto" },
    { key: "vencido", label: "Vencido" },
    { key: "recebido", label: "Recebido" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total em Aberto"
          value={brl(totalAberto)}
          icon={Clock}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub={`${contas.filter((c) => c.status === "em_aberto").length} títulos`}
        />
        <KpiCard
          label="Vencido"
          value={brl(totalVencido)}
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sub={`${contas.filter((c) => c.status === "vencido").length} título${contas.filter((c) => c.status === "vencido").length !== 1 ? "s" : ""}`}
          subColor="text-red-500"
        />
        <KpiCard
          label="A Vencer"
          value={brl(totalAVencer)}
          icon={Receipt}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub="próximos 30 dias"
          subColor="text-amber-600"
        />
        <KpiCard
          label="Recebido este mês"
          value={brl(totalRecebido)}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={`${contas.filter((c) => c.status === "recebido").length} títulos`}
          subColor="text-emerald-600"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
              filter === f.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">
              ({f.key === "todos" ? contas.length : contas.filter((c) => c.status === f.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Referência</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Vencimento</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((conta) => {
                const s = STATUS_RECEBER[conta.status];
                const StatusIcon = s.icon;
                return (
                  <tr key={conta.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{conta.cliente}</td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{conta.ref}</span>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-800 tabular-nums">{brl(conta.valor)}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(conta.vencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.badge}`}>
                        <StatusIcon size={11} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {conta.status !== "recebido" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarRecebido(conta.id)}
                          className="h-8 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                        >
                          Marcar recebido
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Contas a Pagar ──────────────────────────────────────────────────────

const STATUS_PAGAR: Record<StatusPagar, { label: string; badge: string; icon: React.ElementType }> = {
  a_pagar: { label: "A pagar", badge: "bg-blue-50 text-blue-700 border-blue-100", icon: Clock },
  vencido: { label: "Vencido", badge: "bg-red-50 text-red-600 border-red-100", icon: AlertCircle },
  pago: { label: "Pago", badge: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
};

function TabContasPagar() {
  const [filter, setFilter] = useState<"todos" | StatusPagar>("todos");
  const [contas, setContas] = useState<ContaPagar[]>(CONTAS_PAGAR_INITIAL);

  const filtered = filter === "todos" ? contas : contas.filter((c) => c.status === filter);

  const totalAPagar = contas.filter((c) => c.status === "a_pagar").reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas.filter((c) => c.status === "vencido").reduce((s, c) => s + c.valor, 0);
  const totalAVencer = contas.filter((c) => c.status === "a_pagar").reduce((s, c) => s + c.valor, 0);
  const totalPago = contas.filter((c) => c.status === "pago").reduce((s, c) => s + c.valor, 0);

  const marcarPago = (id: string) => {
    setContas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "pago" as StatusPagar } : c))
    );
  };

  const filters: Array<{ key: "todos" | StatusPagar; label: string }> = [
    { key: "todos", label: "Todos" },
    { key: "a_pagar", label: "A pagar" },
    { key: "vencido", label: "Vencido" },
    { key: "pago", label: "Pago" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total a Pagar"
          value={brl(totalAPagar)}
          icon={CreditCard}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub={`${contas.filter((c) => c.status === "a_pagar").length} títulos`}
        />
        <KpiCard
          label="Vencido"
          value={brl(totalVencido)}
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sub={`${contas.filter((c) => c.status === "vencido").length} título${contas.filter((c) => c.status === "vencido").length !== 1 ? "s" : ""}`}
          subColor="text-red-500"
        />
        <KpiCard
          label="A Vencer"
          value={brl(totalAVencer)}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub="próximos 30 dias"
          subColor="text-amber-600"
        />
        <KpiCard
          label="Pago este mês"
          value={brl(totalPago)}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={`${contas.filter((c) => c.status === "pago").length} títulos`}
          subColor="text-emerald-600"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
              filter === f.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">
              ({f.key === "todos" ? contas.length : contas.filter((c) => c.status === f.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Fornecedor</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Vencimento</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((conta) => {
                const s = STATUS_PAGAR[conta.status];
                const StatusIcon = s.icon;
                return (
                  <tr key={conta.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{conta.fornecedor}</td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">{conta.categoria}</span>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-800 tabular-nums">{brl(conta.valor)}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(conta.vencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.badge}`}>
                        <StatusIcon size={11} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {conta.status !== "pago" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarPago(conta.id)}
                          className="h-8 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                        >
                          Marcar pago
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: "2026-03", label: "Março 2026" },
  { value: "2026-02", label: "Fevereiro 2026" },
  { value: "2026-01", label: "Janeiro 2026" },
  { value: "2025-12", label: "Dezembro 2025" },
  { value: "2025-11", label: "Novembro 2025" },
];

export default function Financeiro() {
  const [selectedMonth, setSelectedMonth] = useState("2026-03");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-blue-600" />
            </div>
            Financeiro
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Gestão financeira — DRE, fluxo de caixa e contas
            <span className="ml-2 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-medium">
              DEMO
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44 rounded-xl border-slate-200 bg-white shadow-sm h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dre" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "dre", label: "DRE", icon: BarChart3 },
            { value: "fluxo", label: "Fluxo de Caixa", icon: TrendingUp },
            { value: "receber", label: "A Receber", icon: ArrowDownLeft },
            { value: "pagar", label: "A Pagar", icon: ArrowUpRight },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
            >
              <Icon size={16} className="hidden sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dre">
          <TabDRE />
        </TabsContent>

        <TabsContent value="fluxo">
          <TabFluxo />
        </TabsContent>

        <TabsContent value="receber">
          <TabContasReceber />
        </TabsContent>

        <TabsContent value="pagar">
          <TabContasPagar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
