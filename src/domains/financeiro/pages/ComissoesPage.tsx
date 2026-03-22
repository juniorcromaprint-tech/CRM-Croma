import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { brl, pct, formatDate } from "@/shared/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Award,
  Percent,
  Search,
  Info,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Comissao {
  id: string;
  vendedor_id: string;
  pedido_id: string;
  conta_receber_id: string | null;
  percentual: number;
  valor_base: number;
  valor_comissao: number;
  status: "gerada" | "aprovada" | "paga" | "cancelada";
  data_pagamento: string | null;
  created_at: string;
  tipo_comissionado: "interno" | "externo" | null;
  absorver_comissao: boolean | null;
  profiles: { full_name: string | null; email: string | null } | null;
  pedidos: {
    numero: string | null;
    valor_total: number | null;
    clientes: { nome_fantasia: string | null } | null;
  } | null;
}

interface MetaVenda {
  id: string;
  vendedor_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  meta_valor: number;
  realizado_valor: number;
  meta_quantidade: number;
  realizado_quantidade: number;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface VendedorSummary {
  vendedor_id: string;
  nome: string;
  totalGerada: number;
  totalPaga: number;
  countGerada: number;
  countPaga: number;
  meta: number;
  realizado: number;
}

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  gerada: {
    label: "Gerada",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
  aprovada: {
    label: "Aprovada",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500",
  },
  paga: {
    label: "Paga",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  cancelada: {
    label: "Cancelada",
    color: "bg-red-50 text-red-600 border-red-200",
    dotColor: "bg-red-500",
  },
};

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-slate-100 rounded animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

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
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">
            {value}
          </p>
          {sub && (
            <p
              className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
          <Icon size={28} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  size = "md",
}: {
  value: number;
  max: number;
  size?: "sm" | "md";
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const overflowPct = max > 0 ? (value / max) * 100 : 0;

  let barColor = "bg-red-500";
  if (overflowPct >= 100) barColor = "bg-emerald-500";
  else if (overflowPct >= 75) barColor = "bg-blue-500";
  else if (overflowPct >= 50) barColor = "bg-amber-500";

  const heightClass = size === "sm" ? "h-2" : "h-3";

  return (
    <div
      className={`w-full ${heightClass} rounded-full bg-slate-100 overflow-hidden`}
    >
      <div
        className={`${heightClass} rounded-full ${barColor} transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useComissoes() {
  return useQuery({
    queryKey: ["financeiro", "comissoes"],
    queryFn: async (): Promise<Comissao[]> => {
      const { data, error } = await supabase
        .from("comissoes")
        .select(
          "*, profiles(full_name, email), pedidos(numero, valor_total, clientes(nome_fantasia))"
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(`Erro ao buscar comissoes: ${error.message}`);
      return (data ?? []) as unknown as Comissao[];
    },
  });
}

function useMetasVendas() {
  return useQuery({
    queryKey: ["financeiro", "metas_vendas"],
    queryFn: async (): Promise<MetaVenda[]> => {
      const { data, error } = await supabase
        .from("metas_vendas")
        .select("*, profiles(full_name)")
        .order("periodo_inicio", { ascending: false });

      if (error)
        throw new Error(`Erro ao buscar metas: ${error.message}`);
      return (data ?? []) as unknown as MetaVenda[];
    },
  });
}

// ─── Tab: Por Vendedor ──────────────────────────────────────────────────────

function TabPorVendedor({
  comissoes,
  metas,
  isLoading,
}: {
  comissoes: Comissao[];
  metas: MetaVenda[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (comissoes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma comissão registrada ainda"
        description="As comissões são geradas automaticamente quando pedidos são pagos. Assim que houver faturamento com vendedor vinculado, as comissões aparecerão aqui."
      />
    );
  }

  // Build summary per vendedor
  const vendedorMap = new Map<string, VendedorSummary>();

  for (const c of comissoes) {
    const id = c.vendedor_id;
    if (!vendedorMap.has(id)) {
      vendedorMap.set(id, {
        vendedor_id: id,
        nome: c.profiles?.full_name || c.profiles?.email || "Vendedor",
        totalGerada: 0,
        totalPaga: 0,
        countGerada: 0,
        countPaga: 0,
        meta: 0,
        realizado: 0,
      });
    }
    const v = vendedorMap.get(id)!;
    const valor = Number(c.valor_comissao) || 0;

    if (c.status === "gerada" || c.status === "aprovada") {
      v.totalGerada += valor;
      v.countGerada += 1;
    }
    if (c.status === "paga") {
      v.totalPaga += valor;
      v.countPaga += 1;
    }
  }

  // Enrich with metas
  for (const m of metas) {
    if (m.vendedor_id && vendedorMap.has(m.vendedor_id)) {
      const v = vendedorMap.get(m.vendedor_id)!;
      v.meta += Number(m.meta_valor) || 0;
      v.realizado += Number(m.realizado_valor) || 0;
    }
  }

  const vendedores = Array.from(vendedorMap.values()).sort(
    (a, b) => b.totalGerada + b.totalPaga - (a.totalGerada + a.totalPaga)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {vendedores.map((v) => {
        const total = v.totalGerada + v.totalPaga;
        const metaPct = v.meta > 0 ? (v.realizado / v.meta) * 100 : 0;
        const initials = v.nome
          .split(/\s+/)
          .filter((w) => w.length > 0)
          .map((w) => w[0].toUpperCase())
          .slice(0, 2)
          .join("");

        return (
          <Card
            key={v.vendedor_id}
            className="border-none shadow-sm rounded-2xl bg-white hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">
                    {initials}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">
                    {v.nome}
                  </p>
                  <p className="text-xs text-slate-400">
                    {v.countGerada + v.countPaga} comiss
                    {v.countGerada + v.countPaga !== 1 ? "ões" : "ão"} no total
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-slate-800">
                    {brl(total)}
                  </p>
                  <p className="text-xs text-slate-400">Total</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider">
                    Geradas
                  </p>
                  <p className="text-sm font-bold text-blue-700 tabular-nums">
                    {brl(v.totalGerada)}
                  </p>
                  <p className="text-xs text-blue-400">
                    {v.countGerada} registro{v.countGerada !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="bg-emerald-50/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">
                    Pagas
                  </p>
                  <p className="text-sm font-bold text-emerald-700 tabular-nums">
                    {brl(v.totalPaga)}
                  </p>
                  <p className="text-xs text-emerald-400">
                    {v.countPaga} registro{v.countPaga !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Meta progress */}
              {v.meta > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Target size={12} />
                      Meta
                    </span>
                    <span className="font-bold text-slate-700">
                      {metaPct.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <ProgressBar value={v.realizado} max={v.meta} size="sm" />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{brl(v.realizado)}</span>
                    <span>{brl(v.meta)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-300 py-1">
                  <Info size={12} />
                  <span>Sem meta definida</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Tab: Detalhamento ──────────────────────────────────────────────────────

function TabDetalhamento({
  comissoes,
  isLoading,
}: {
  comissoes: Comissao[];
  isLoading: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Get unique vendedores
  const vendedores = Array.from(
    new Map(
      comissoes.map((c) => [
        c.vendedor_id,
        c.profiles?.full_name || c.profiles?.email || "Vendedor",
      ])
    )
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Apply filters
  const filtered = comissoes.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (vendedorFilter !== "all" && c.vendedor_id !== vendedorFilter)
      return false;
    if (tipoFilter !== "all") {
      const tipo = c.tipo_comissionado ?? "interno";
      if (tipo !== tipoFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const nome = (c.profiles?.full_name || "").toLowerCase();
      const cliente = (
        c.pedidos?.clientes?.nome_fantasia || ""
      ).toLowerCase();
      const numero = (c.pedidos?.numero || "").toLowerCase();
      if (!nome.includes(q) && !cliente.includes(q) && !numero.includes(q))
        return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {[
                  "Vendedor",
                  "Pedido",
                  "Cliente",
                  "Valor Base",
                  "%",
                  "Comissão",
                  "Status",
                  "Data",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por vendedor, cliente ou pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-slate-200 bg-white shadow-sm h-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl border-slate-200 bg-white shadow-sm h-10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="gerada">Gerada</SelectItem>
            <SelectItem value="aprovada">Aprovada</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-36 rounded-xl border-slate-200 bg-white shadow-sm h-10">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="interno">Interno</SelectItem>
            <SelectItem value="externo">Externo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
          <SelectTrigger className="w-48 rounded-xl border-slate-200 bg-white shadow-sm h-10">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {vendedores.filter(([id]) => id).map(([id, nome]) => (
              <SelectItem key={id} value={id}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhuma comissão encontrada"
          description={
            comissoes.length === 0
              ? "As comissões são geradas automaticamente quando pedidos são pagos. Assim que houver faturamento com vendedor vinculado, os registros aparecerão aqui."
              : "Nenhum resultado para os filtros aplicados. Tente ajustar os filtros de busca."
          }
        />
      ) : (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Vendedor
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Pedido
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Cliente
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Valor Base
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    %
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Comissão
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => {
                  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.gerada;
                  const isPaga = c.status === "paga";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {c.profiles?.full_name || "Vendedor"}
                          </p>
                          {c.absorver_comissao && (
                            <span className="inline-flex w-fit items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                              Absorvida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center hidden md:table-cell">
                        {(c.tipo_comissionado ?? "interno") === "externo" ? (
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Externo
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Interno
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                          {c.pedidos?.numero || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <p className="text-sm text-slate-600 truncate max-w-[160px]">
                          {c.pedidos?.clientes?.nome_fantasia || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-700 tabular-nums">
                        {brl(Number(c.valor_base) || 0)}
                      </td>
                      <td className="px-3 py-4 text-center hidden sm:table-cell">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          {Number(c.percentual).toFixed(1).replace(".", ",")}%
                        </span>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-bold tabular-nums ${
                          isPaga ? "text-emerald-600" : "text-slate-800"
                        }`}
                      >
                        {brl(Number(c.valor_comissao) || 0)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}
                          />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                        {formatDate(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold text-slate-700">
              Total:{" "}
              {brl(
                filtered.reduce(
                  (s, c) => s + (Number(c.valor_comissao) || 0),
                  0
                )
              )}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Metas ─────────────────────────────────────────────────────────────

function TabMetas({
  metas,
  isLoading,
}: {
  metas: MetaVenda[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {["Vendedor", "Periodo", "Meta", "Realizado", "Progresso", "%"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (metas.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhuma meta de vendas configurada"
        description="As metas de vendas serão configuradas pelo administrador. Cada vendedor terá metas mensais de valor e quantidade de pedidos para acompanhamento de desempenho."
      />
    );
  }

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-base">
          Metas de Vendas
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Acompanhamento de metas por vendedor e período
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                Vendedor
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                Periodo
              </th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                Meta
              </th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                Realizado
              </th>
              <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-48 hidden sm:table-cell">
                Progresso
              </th>
              <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {metas.map((m) => {
              const metaVal = Number(m.meta_valor) || 0;
              const realizadoVal = Number(m.realizado_valor) || 0;
              const percentage =
                metaVal > 0 ? (realizadoVal / metaVal) * 100 : 0;

              let pctColor = "text-red-600 bg-red-50";
              if (percentage >= 100)
                pctColor = "text-emerald-700 bg-emerald-50";
              else if (percentage >= 75) pctColor = "text-blue-700 bg-blue-50";
              else if (percentage >= 50)
                pctColor = "text-amber-700 bg-amber-50";

              return (
                <tr
                  key={m.id}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">
                      {m.profiles?.full_name || "Equipe geral"}
                    </p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-slate-500">
                      {formatDate(m.periodo_inicio)} -{" "}
                      {formatDate(m.periodo_fim)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-slate-700 tabular-nums">
                    {brl(metaVal)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-800 tabular-nums">
                    {brl(realizadoVal)}
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <ProgressBar
                      value={realizadoVal}
                      max={metaVal}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${pctColor}`}
                    >
                      {percentage.toFixed(1).replace(".", ",")}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ComissoesPage() {
  const { data: comissoes = [], isLoading: loadingComissoes } = useComissoes();
  const { data: metas = [], isLoading: loadingMetas } = useMetasVendas();

  // Stats
  const totalGerada = comissoes
    .filter((c) => c.status === "gerada" || c.status === "aprovada")
    .reduce((s, c) => s + (Number(c.valor_comissao) || 0), 0);

  const totalPaga = comissoes
    .filter((c) => c.status === "paga")
    .reduce((s, c) => s + (Number(c.valor_comissao) || 0), 0);

  const pendentes = comissoes.filter((c) => c.status === "gerada").length;

  const taxaMedia =
    comissoes.length > 0
      ? comissoes.reduce((s, c) => s + (Number(c.percentual) || 0), 0) /
        comissoes.length
      : 0;

  const isLoading = loadingComissoes || loadingMetas;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Award size={20} className="text-blue-600" />
            </div>
            Comissões
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Gestão de comissões e metas de vendedores
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              label="Comissões Geradas"
              value={brl(totalGerada)}
              icon={DollarSign}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              sub={`${comissoes.filter((c) => c.status === "gerada" || c.status === "aprovada").length} registros`}
            />
            <KpiCard
              label="Comissões Pagas"
              value={brl(totalPaga)}
              icon={CheckCircle2}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              sub={`${comissoes.filter((c) => c.status === "paga").length} registros`}
              subColor="text-emerald-600"
            />
            <KpiCard
              label="Pendente Aprovação"
              value={String(pendentes)}
              icon={Clock}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              sub={
                pendentes > 0
                  ? brl(
                      comissoes
                        .filter((c) => c.status === "gerada")
                        .reduce(
                          (s, c) => s + (Number(c.valor_comissao) || 0),
                          0
                        )
                    )
                  : "Nenhuma pendência"
              }
              subColor={pendentes > 0 ? "text-amber-600" : "text-slate-400"}
            />
            <KpiCard
              label="Taxa Média"
              value={`${taxaMedia.toFixed(1).replace(".", ",")}%`}
              icon={Percent}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
              sub={`${comissoes.length} comiss${comissoes.length !== 1 ? "ões" : "ão"} total`}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vendedores" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "vendedores", label: "Por Vendedor", icon: Users },
            { value: "detalhamento", label: "Detalhamento", icon: DollarSign },
            { value: "metas", label: "Metas", icon: Target },
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

        <TabsContent value="vendedores">
          <TabPorVendedor
            comissoes={comissoes}
            metas={metas}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="detalhamento">
          <TabDetalhamento
            comissoes={comissoes}
            isLoading={loadingComissoes}
          />
        </TabsContent>

        <TabsContent value="metas">
          <TabMetas metas={metas} isLoading={loadingMetas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
