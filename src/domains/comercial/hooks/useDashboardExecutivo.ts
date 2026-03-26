import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 1000 * 60 * 5; // 5 min

// ─── Faturamento do mês corrente ──────────────────────────────────────────────

export function useFaturamentoMes() {
  return useQuery({
    queryKey: ["exec", "faturamento_mes"],
    queryFn: async () => {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data } = await supabase
        .from("pedidos")
        .select("valor_total, status")
        .is("excluido_em", null)
        .gte("created_at", inicioMes);

      const pedidos = data ?? [];
      const faturados = pedidos.filter((p) => p.status === "faturado");
      const faturamento = faturados.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
      const ticketMedio = faturados.length > 0 ? faturamento / faturados.length : 0;

      return { faturamento, ticketMedio, pedidosFaturados: faturados.length };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Taxa de conversão do mês ─────────────────────────────────────────────────

export function useTaxaConversaoMes() {
  return useQuery({
    queryKey: ["exec", "conversao_mes"],
    queryFn: async () => {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [propostasRes, pedidosRes] = await Promise.all([
        supabase
          .from("propostas")
          .select("id, status")
          .is("excluido_em", null)
          .gte("created_at", inicioMes),
        supabase
          .from("pedidos")
          .select("id, status")
          .is("excluido_em", null)
          .gte("created_at", inicioMes),
      ]);

      const propostas = propostasRes.data ?? [];
      const pedidos = pedidosRes.data ?? [];
      const aprovadas = propostas.filter((p) => p.status === "aprovada").length;
      const taxa = propostas.length > 0 ? Math.round((aprovadas / propostas.length) * 100) : 0;

      return {
        totalPropostas: propostas.length,
        aprovadas,
        taxa,
        totalPedidos: pedidos.filter((p) => p.status !== "cancelado").length,
      };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Evolução mensal (últimos 6 meses) ───────────────────────────────────────

export function useEvolucaoMensal() {
  return useQuery({
    queryKey: ["exec", "evolucao_mensal"],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [pedidosRes, propostasRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select("status, valor_total, created_at")
          .is("excluido_em", null)
          .gte("created_at", sixMonthsAgo.toISOString()),
        supabase
          .from("propostas")
          .select("status, created_at")
          .is("excluido_em", null)
          .gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      const pedidos = pedidosRes.data ?? [];
      const propostas = propostasRes.data ?? [];

      // Constrói buckets mensais
      const months: {
        month: string;
        label: string;
        faturamento: number;
        numeroPedidos: number;
        numeroPropostas: number;
        conversao: number;
      }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({
          month: monthKey,
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          faturamento: 0,
          numeroPedidos: 0,
          numeroPropostas: 0,
          conversao: 0,
        });
      }

      for (const p of pedidos) {
        const monthKey = (p.created_at as string).substring(0, 7);
        const bucket = months.find((m) => m.month === monthKey);
        if (!bucket) continue;
        if (p.status !== "cancelado") bucket.numeroPedidos++;
        if (p.status === "faturado") bucket.faturamento += Number(p.valor_total) || 0;
      }

      for (const p of propostas) {
        const monthKey = (p.created_at as string).substring(0, 7);
        const bucket = months.find((m) => m.month === monthKey);
        if (!bucket) continue;
        bucket.numeroPropostas++;
      }

      return months.map((m) => ({
        ...m,
        conversao: m.numeroPropostas > 0 ? Math.round((m.numeroPedidos / m.numeroPropostas) * 100) : 0,
        faturamentoK: Math.round(m.faturamento / 1000),
      }));
    },
    staleTime: STALE,
  });
}

// ─── Top 5 clientes por faturamento (últimos 6 meses) ────────────────────────

export function useTopClientes() {
  return useQuery({
    queryKey: ["exec", "top_clientes"],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const { data } = await supabase
        .from("pedidos")
        .select("valor_total, cliente_id, clientes(id, nome_razao_social)")
        .eq("status", "faturado")
        .is("excluido_em", null)
        .gte("created_at", sixMonthsAgo);

      const all = (data ?? []) as Array<{
        valor_total: number;
        cliente_id: string;
        clientes: { id: string; nome_razao_social: string } | null;
      }>;

      const map = new Map<string, { nome: string; total: number; pedidos: number }>();

      for (const p of all) {
        if (!p.clientes) continue;
        const existing = map.get(p.cliente_id) ?? {
          nome: p.clientes.nome_razao_social,
          total: 0,
          pedidos: 0,
        };
        existing.total += Number(p.valor_total) || 0;
        existing.pedidos++;
        map.set(p.cliente_id, existing);
      }

      return Array.from(map.entries())
        .map(([id, d]) => ({ id, ...d }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
    staleTime: STALE,
  });
}
