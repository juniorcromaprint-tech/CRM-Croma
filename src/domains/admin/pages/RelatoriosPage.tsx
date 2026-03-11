// ============================================================================
// RELATORIOS PAGE — Croma Print ERP/CRM
// 11 tipos de relatório com exportação CSV, filtro por período
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { exportCsv } from "@/shared/utils/exportCsv";
import { formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  BarChart3,
  TrendingUp,
  Calculator,
  Package,
  FileBarChart,
  BookOpen,
  PieChart,
  FileCheck,
  Users,
  Layers,
  Receipt,
  Loader2,
  LucideIcon,
} from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface RelatorioConfig {
  id: string;
  label: string;
  Icon: LucideIcon;
  description: string;
}

// ----------------------------------------------------------------------------
// ICON MAP
// ----------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Calculator,
  Package,
  BarChart3,
  FileBarChart,
  BookOpen,
  PieChart,
  FileCheck,
  Users,
  Layers,
  Receipt,
};

// ----------------------------------------------------------------------------
// RELATORIOS DEFINITION
// ----------------------------------------------------------------------------

const RELATORIOS: RelatorioConfig[] = [
  {
    id: "vendas",
    label: "Vendas",
    Icon: ICON_MAP.TrendingUp,
    description: "Relatório de vendas por período",
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    Icon: ICON_MAP.Calculator,
    description: "Status e conversão de orçamentos",
  },
  {
    id: "vendas_produto",
    label: "Vendas por Produto",
    Icon: ICON_MAP.Package,
    description: "Volume de vendas por produto",
  },
  {
    id: "previsto_realizado",
    label: "Previsto x Realizado",
    Icon: ICON_MAP.BarChart3,
    description: "Meta vs realizado por vendedor",
  },
  {
    id: "dre",
    label: "DRE",
    Icon: ICON_MAP.FileBarChart,
    description: "Demonstrativo de Resultado do Exercício",
  },
  {
    id: "plano_contas",
    label: "Plano de Contas",
    Icon: ICON_MAP.BookOpen,
    description: "Relatório do plano de contas",
  },
  {
    id: "lucratividade",
    label: "Lucratividade",
    Icon: ICON_MAP.PieChart,
    description: "Margem de lucro por pedido/produto",
  },
  {
    id: "posicao_faturamento",
    label: "Posição de Faturamento",
    Icon: ICON_MAP.FileCheck,
    description: "Status de faturamento dos pedidos",
  },
  {
    id: "abc_clientes",
    label: "Curva ABC — Clientes",
    Icon: ICON_MAP.Users,
    description: "Classificação ABC de clientes por receita",
  },
  {
    id: "abc_produtos",
    label: "Curva ABC — Produtos",
    Icon: ICON_MAP.Layers,
    description: "Classificação ABC de produtos por volume",
  },
  {
    id: "fiscal",
    label: "Relatório Fiscal",
    Icon: ICON_MAP.Receipt,
    description: "NF-e emitidas e tributos",
  },
];

// ----------------------------------------------------------------------------
// DATE HELPERS
// ----------------------------------------------------------------------------

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getToday(): string {
  return toISODate(new Date());
}

// ----------------------------------------------------------------------------
// FETCH FUNCTIONS
// ----------------------------------------------------------------------------

type CsvPayload = { headers: string[]; rows: (string | number | null | undefined)[][] };

async function fetchVendas(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, status, valor_total, created_at, clientes(nome_fantasia)")
    .in("status", ["concluido", "faturado", "entregue"])
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = ["ID", "Número", "Status", "Valor Total (R$)", "Cliente", "Data"];
  const rows = (data ?? []).map((r) => [
    r.id,
    r.numero ?? "",
    r.status ?? "",
    r.valor_total ?? 0,
    (r.clientes as { nome_fantasia?: string } | null)?.nome_fantasia ?? "",
    r.created_at ? formatDate(r.created_at) : "",
  ]);

  return { headers, rows };
}

async function fetchOrcamentos(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("propostas")
    .select("id, numero, status, valor_total, created_at, clientes(nome_fantasia)")
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = ["ID", "Número", "Status", "Valor Total (R$)", "Cliente", "Data"];
  const rows = (data ?? []).map((r) => [
    r.id,
    r.numero ?? "",
    r.status ?? "",
    r.valor_total ?? 0,
    (r.clientes as { nome_fantasia?: string } | null)?.nome_fantasia ?? "",
    r.created_at ? formatDate(r.created_at) : "",
  ]);

  return { headers, rows };
}

async function fetchVendasProduto(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedido_itens")
    .select("id, descricao, quantidade, valor_unitario, valor_total, pedidos(created_at, status)")
    .gte("pedidos.created_at", `${de}T00:00:00`)
    .lte("pedidos.created_at", `${ate}T23:59:59`)
    .order("valor_total", { ascending: false });

  if (error) throw error;

  const headers = ["Item ID", "Descrição", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)", "Status Pedido"];
  const rows = (data ?? []).map((r) => {
    const pedido = r.pedidos as { created_at?: string; status?: string } | null;
    return [
      r.id,
      r.descricao ?? "",
      r.quantidade ?? 0,
      r.valor_unitario ?? 0,
      r.valor_total ?? 0,
      pedido?.status ?? "",
    ];
  });

  return { headers, rows };
}

async function fetchPrevistoRealizado(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, valor_total, status, created_at, profiles(full_name, meta_venda)")
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = ["ID", "Número", "Vendedor", "Valor (R$)", "Status", "Meta Vendedor (R$)", "Data"];
  const rows = (data ?? []).map((r) => {
    const profile = r.profiles as { full_name?: string; meta_venda?: number } | null;
    return [
      r.id,
      r.numero ?? "",
      profile?.full_name ?? "",
      r.valor_total ?? 0,
      r.status ?? "",
      profile?.meta_venda ?? 0,
      r.created_at ? formatDate(r.created_at) : "",
    ];
  });

  return { headers, rows };
}

async function fetchDre(de: string, ate: string): Promise<CsvPayload> {
  // Receitas: contas_receber pagas no período
  const [receber, pagar] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("descricao, valor, data_pagamento, categoria")
      .not("data_pagamento", "is", null)
      .gte("data_pagamento", de)
      .lte("data_pagamento", ate),
    supabase
      .from("contas_pagar")
      .select("descricao, valor, data_pagamento, categoria")
      .not("data_pagamento", "is", null)
      .gte("data_pagamento", de)
      .lte("data_pagamento", ate),
  ]);

  if (receber.error) throw receber.error;
  if (pagar.error) throw pagar.error;

  const headers = ["Tipo", "Descrição", "Categoria", "Valor (R$)", "Data Pagamento"];
  const rows: (string | number | null | undefined)[][] = [
    ...(receber.data ?? []).map((r) => [
      "Receita",
      r.descricao ?? "",
      r.categoria ?? "",
      r.valor ?? 0,
      r.data_pagamento ?? "",
    ]),
    ...(pagar.data ?? []).map((r) => [
      "Despesa",
      r.descricao ?? "",
      r.categoria ?? "",
      r.valor ?? 0,
      r.data_pagamento ?? "",
    ]),
  ];

  return { headers, rows };
}

async function fetchPlanoContas(_de: string, _ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("contas_pagar")
    .select("categoria, valor, status")
    .order("categoria");

  if (error) throw error;

  // Aggregate by category
  const byCategory: Record<string, { total: number; count: number }> = {};
  for (const r of data ?? []) {
    const cat = r.categoria ?? "Sem Categoria";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += Number(r.valor ?? 0);
    byCategory[cat].count += 1;
  }

  const headers = ["Categoria", "Qtd Lançamentos", "Total (R$)"];
  const rows = Object.entries(byCategory).map(([cat, vals]) => [
    cat,
    vals.count,
    vals.total,
  ]);

  return { headers, rows };
}

async function fetchLucratividade(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, valor_total, custo_total, status, created_at, clientes(nome_fantasia)")
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = [
    "ID",
    "Número",
    "Cliente",
    "Valor Total (R$)",
    "Custo Total (R$)",
    "Lucro Bruto (R$)",
    "Margem (%)",
    "Status",
    "Data",
  ];

  const rows = (data ?? []).map((r) => {
    const valor = Number(r.valor_total ?? 0);
    const custo = Number(r.custo_total ?? 0);
    const lucro = valor - custo;
    const margem = valor > 0 ? ((lucro / valor) * 100).toFixed(2) : "0.00";
    return [
      r.id,
      r.numero ?? "",
      (r.clientes as { nome_fantasia?: string } | null)?.nome_fantasia ?? "",
      valor,
      custo,
      lucro,
      margem,
      r.status ?? "",
      r.created_at ? formatDate(r.created_at) : "",
    ];
  });

  return { headers, rows };
}

async function fetchPosicaoFaturamento(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, status, valor_total, created_at, clientes(nome_fantasia)")
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`)
    .order("status")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = ["ID", "Número", "Status", "Valor Total (R$)", "Cliente", "Data"];
  const rows = (data ?? []).map((r) => [
    r.id,
    r.numero ?? "",
    r.status ?? "",
    r.valor_total ?? 0,
    (r.clientes as { nome_fantasia?: string } | null)?.nome_fantasia ?? "",
    r.created_at ? formatDate(r.created_at) : "",
  ]);

  return { headers, rows };
}

async function fetchAbcClientes(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("valor_total, clientes(id, nome_fantasia)")
    .in("status", ["concluido", "faturado", "entregue"])
    .gte("created_at", `${de}T00:00:00`)
    .lte("created_at", `${ate}T23:59:59`);

  if (error) throw error;

  // Aggregate by client
  const byClient: Record<string, { nome: string; total: number; pedidos: number }> = {};
  for (const r of data ?? []) {
    const cliente = r.clientes as { id?: string; nome_fantasia?: string } | null;
    const clienteId = cliente?.id ?? "sem_cliente";
    const nome = cliente?.nome_fantasia ?? "Sem Cliente";
    if (!byClient[clienteId]) byClient[clienteId] = { nome, total: 0, pedidos: 0 };
    byClient[clienteId].total += Number(r.valor_total ?? 0);
    byClient[clienteId].pedidos += 1;
  }

  // Sort descending and add ABC classification
  const sorted = Object.values(byClient).sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((sum, c) => sum + c.total, 0);

  let cumulative = 0;
  const rows = sorted.map((c, idx) => {
    cumulative += c.total;
    const cumulativePct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0;
    const classe = cumulativePct <= 80 ? "A" : cumulativePct <= 95 ? "B" : "C";
    return [
      idx + 1,
      c.nome,
      c.pedidos,
      c.total,
      cumulativePct.toFixed(1),
      classe,
    ];
  });

  const headers = ["Rank", "Cliente", "Nº Pedidos", "Receita Total (R$)", "% Acumulado", "Classe ABC"];
  return { headers, rows };
}

async function fetchAbcProdutos(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("pedido_itens")
    .select("descricao, quantidade, valor_total, pedidos(created_at, status)")
    .gte("pedidos.created_at", `${de}T00:00:00`)
    .lte("pedidos.created_at", `${ate}T23:59:59`);

  if (error) throw error;

  // Aggregate by product description
  const byProduct: Record<string, { total: number; qtd: number }> = {};
  for (const r of data ?? []) {
    const key = r.descricao ?? "Sem Descrição";
    if (!byProduct[key]) byProduct[key] = { total: 0, qtd: 0 };
    byProduct[key].total += Number(r.valor_total ?? 0);
    byProduct[key].qtd += Number(r.quantidade ?? 0);
  }

  const sorted = Object.entries(byProduct).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = sorted.reduce((sum, [, v]) => sum + v.total, 0);

  let cumulative = 0;
  const rows = sorted.map(([desc, vals], idx) => {
    cumulative += vals.total;
    const cumulativePct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0;
    const classe = cumulativePct <= 80 ? "A" : cumulativePct <= 95 ? "B" : "C";
    return [idx + 1, desc, vals.qtd, vals.total, cumulativePct.toFixed(1), classe];
  });

  const headers = ["Rank", "Produto", "Qtd Vendida", "Receita Total (R$)", "% Acumulado", "Classe ABC"];
  return { headers, rows };
}

async function fetchFiscal(de: string, ate: string): Promise<CsvPayload> {
  const { data, error } = await supabase
    .from("fiscal_documentos")
    .select("id, numero, serie, chave_nfe, status, valor_total, data_emissao, clientes(nome_fantasia)")
    .gte("data_emissao", `${de}T00:00:00`)
    .lte("data_emissao", `${ate}T23:59:59`)
    .order("data_emissao", { ascending: false });

  if (error) throw error;

  const headers = [
    "ID",
    "Número NF-e",
    "Série",
    "Chave",
    "Status",
    "Valor Total (R$)",
    "Cliente",
    "Data Emissão",
  ];

  const rows = (data ?? []).map((r) => [
    r.id,
    r.numero ?? "",
    r.serie ?? "",
    r.chave_nfe ?? "",
    r.status ?? "",
    r.valor_total ?? 0,
    (r.clientes as { nome_fantasia?: string } | null)?.nome_fantasia ?? "",
    r.data_emissao ? formatDate(r.data_emissao) : "",
  ]);

  return { headers, rows };
}

// ----------------------------------------------------------------------------
// DISPATCH
// ----------------------------------------------------------------------------

async function gerarRelatorio(
  id: string,
  de: string,
  ate: string,
): Promise<CsvPayload> {
  switch (id) {
    case "vendas":
      return fetchVendas(de, ate);
    case "orcamentos":
      return fetchOrcamentos(de, ate);
    case "vendas_produto":
      return fetchVendasProduto(de, ate);
    case "previsto_realizado":
      return fetchPrevistoRealizado(de, ate);
    case "dre":
      return fetchDre(de, ate);
    case "plano_contas":
      return fetchPlanoContas(de, ate);
    case "lucratividade":
      return fetchLucratividade(de, ate);
    case "posicao_faturamento":
      return fetchPosicaoFaturamento(de, ate);
    case "abc_clientes":
      return fetchAbcClientes(de, ate);
    case "abc_produtos":
      return fetchAbcProdutos(de, ate);
    case "fiscal":
      return fetchFiscal(de, ate);
    default:
      return { headers: ["ID"], rows: [] };
  }
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export default function RelatoriosPage() {
  const [de, setDe] = useState<string>(getFirstDayOfMonth);
  const [ate, setAte] = useState<string>(getToday);
  const [loading, setLoading] = useState<Set<string>>(new Set());

  async function handleGerar(relatorio: RelatorioConfig) {
    if (loading.has(relatorio.id)) return;

    setLoading((prev) => new Set(prev).add(relatorio.id));
    try {
      const { headers, rows } = await gerarRelatorio(relatorio.id, de, ate);
      const filename = `${relatorio.id}_${de}_${ate}`;
      exportCsv(filename, headers, rows);
      showSuccess(`Relatório "${relatorio.label}" gerado!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(relatorio.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Exporte dados do sistema em formato CSV
          </p>
        </div>
      </div>

      {/* Date range selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="de">De</Label>
              <Input
                id="de"
                type="date"
                value={de}
                onChange={(e) => setDe(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ate">Até</Label>
              <Input
                id="ate"
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                className="w-40"
              />
            </div>
            <p className="text-sm text-muted-foreground pb-0.5">
              Período aplicado a todos os relatórios abaixo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Report cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map((rel) => {
          const isLoading = loading.has(rel.id);
          const { Icon } = rel;

          return (
            <Card
              key={rel.id}
              className="flex flex-col transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold leading-snug">
                      {rel.label}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {rel.description}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="mt-auto pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => handleGerar(rel)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Gerando…
                    </>
                  ) : (
                    "Gerar Relatório"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
