import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 1000 * 60 * 2; // 2 min

// ─── Comercial ───────────────────────────────────────────────────────────────

export function useDashComercial() {
  return useQuery({
    queryKey: ["dash", "comercial_v2"],
    queryFn: async () => {
      const [clientesRes, leadsRes, propostasRes] = await Promise.all([
        supabase.from("clientes").select("id, ativo, classificacao, created_at").eq("ativo", true),
        supabase.from("leads").select("id, status, valor_estimado, created_at"),
        supabase.from("propostas").select("id, status, total, created_at").is("excluido_em", null),
      ]);

      const leads = leadsRes.data ?? [];
      const propostas = propostasRes.data ?? [];
      const clientes = clientesRes.data ?? [];

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const leadsAtivos = leads.filter((l) => !["convertido", "perdido", "descartado"].includes(l.status));
      const pipeline = leadsAtivos.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);

      const propostasPendentes = propostas.filter((p) =>
        ["rascunho", "enviada", "em_revisao"].includes(p.status)
      ).length;
      const propostasAprovadas = propostas.filter((p) => p.status === "aprovada").length;
      const valorPropostas = propostas.filter((p) => ["enviada", "em_revisao", "aprovada"].includes(p.status))
        .reduce((s, p) => s + (Number(p.total) || 0), 0);

      const novosClientes30d = clientes.filter((c) => c.created_at >= thirtyDaysAgo).length;

      return {
        totalClientes: clientes.length,
        novosClientes30d,
        leadsAtivos: leadsAtivos.length,
        pipeline,
        totalPropostas: propostas.length,
        propostasPendentes,
        propostasAprovadas,
        valorPropostas,
      };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Pedidos ─────────────────────────────────────────────────────────────────

export function useDashPedidos() {
  return useQuery({
    queryKey: ["dash", "pedidos_v2"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, status, valor_total, data_prometida, created_at")
        .is("excluido_em", null);

      const all = data ?? [];
      const now = new Date().toISOString().split("T")[0];
      const byStatus: Record<string, number> = {};
      let valorTotal = 0;
      let atrasados = 0;

      for (const p of all) {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        // A-06: pedidos cancelados não contam no valor total do dashboard
        if (p.status !== "cancelado") {
          valorTotal += Number(p.valor_total) || 0;
        }
        if (p.data_prometida && p.data_prometida < now && !["concluido", "cancelado"].includes(p.status)) {
          atrasados++;
        }
      }

      const ativos = all.filter((p) => !["concluido", "cancelado"].includes(p.status)).length;

      return { total: all.length, byStatus, valorTotal, atrasados, ativos };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Produção ─────────────────────────────────────────────────────────────────

export function useDashProducao() {
  return useQuery({
    queryKey: ["dash", "producao_v2"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];

      // 1 única query busca status + prazo_interno — substituindo 8 COUNT separadas
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("status, prazo_interno")
        .is("excluido_em", null);

      if (error) throw error;

      const all = data ?? [];

      let aguardando = 0;
      let emFila = 0;
      let emProducao = 0;
      let emConferencia = 0;
      let liberadas = 0;
      let retrabalho = 0;
      let atrasadas = 0;
      let total = 0;

      const encerrados = new Set(["finalizado"]);
      const naoEncerradosAtrasados = new Set(["liberado", "finalizado"]);

      for (const op of all) {
        const status = op.status as string;

        if (!encerrados.has(status)) total++;

        if (status === "aguardando_programacao") aguardando++;
        else if (status === "em_fila") emFila++;
        else if (status === "em_producao" || status === "em_acabamento") emProducao++;
        else if (status === "em_conferencia") emConferencia++;
        else if (status === "liberado") liberadas++;
        else if (status === "retrabalho") retrabalho++;

        if (
          op.prazo_interno &&
          op.prazo_interno < hoje &&
          !naoEncerradosAtrasados.has(status)
        ) {
          atrasadas++;
        }
      }

      return {
        total,
        aguardando,
        emFila,
        emProducao,
        emConferencia,
        liberadas,
        retrabalho,
        atrasadas,
      };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

export function useDashFinanceiro() {
  return useQuery({
    queryKey: ["dash", "financeiro_v2"],
    queryFn: async () => {
      const [crRes, cpRes] = await Promise.all([
        supabase.from("contas_receber").select("valor_original, valor_pago, status, data_vencimento"),
        supabase.from("contas_pagar").select("valor_original, valor_pago, status, data_vencimento"),
      ]);

      const cr = crRes.data ?? [];
      const cp = cpRes.data ?? [];
      const now = new Date().toISOString().split("T")[0];

      const calcSaldo = (items: typeof cr) =>
        items.filter((r) => !["pago", "cancelado"].includes(r.status))
          .reduce((s, r) => s + (Number(r.valor_original) || 0) - (Number(r.valor_pago) || 0), 0);

      const totalReceber = calcSaldo(cr);
      const totalPagar = calcSaldo(cp);
      const vencidos = cr
        .filter((r) => r.data_vencimento < now && !["pago", "cancelado"].includes(r.status))
        .reduce((s, r) => s + (Number(r.valor_original) || 0) - (Number(r.valor_pago) || 0), 0);
      const recebido = cr.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0);

      return { totalReceber, totalPagar, vencidos, recebido, saldo: totalReceber - totalPagar };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Instalações ─────────────────────────────────────────────────────────────

export function useDashInstalacoes() {
  return useQuery({
    queryKey: ["dash", "instalacoes_v2"],
    queryFn: async () => {
      const { data } = await supabase.from("ordens_instalacao").select("id, status, data_agendada");
      const all = data ?? [];
      const hoje = new Date().toISOString().split("T")[0];
      return {
        total: all.length,
        agendadasHoje: all.filter((o) => o.data_agendada === hoje && o.status === "agendada").length,
        aguardando: all.filter((o) => o.status === "aguardando_agendamento").length,
        emExecucao: all.filter((o) => o.status === "em_execucao").length,
        concluidas: all.filter((o) => o.status === "concluida").length,
      };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Estoque ─────────────────────────────────────────────────────────────────

export function useDashEstoque() {
  return useQuery({
    queryKey: ["dash", "estoque_v2"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_saldos")
        .select("quantidade_disponivel, quantidade_reservada, materiais(nome, estoque_minimo)");
      const all = (data ?? []) as Array<{
        quantidade_disponivel: number;
        quantidade_reservada: number;
        materiais: { nome: string; estoque_minimo: number } | null;
      }>;
      const criticos = all.filter((s) => {
        const min = Number(s.materiais?.estoque_minimo) || 0;
        return min > 0 && Number(s.quantidade_disponivel) < min;
      }).length;
      return { total: all.length, criticos };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

// ─── Qualidade ────────────────────────────────────────────────────────────────

export function useDashQualidade() {
  return useQuery({
    queryKey: ["dash", "qualidade_v2"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ocorrencias")
        .select("id, status, severidade, tipo, custo_total, created_at")
        .is("excluido_em", null);
      const all = data ?? [];
      return {
        total: all.length,
        abertas: all.filter((o) => ["aberta", "em_analise", "em_tratativa"].includes(o.status)).length,
        criticas: all.filter((o) => o.severidade === "critica" && o.status !== "encerrada").length,
        retrabalhos: all.filter((o) => o.tipo === "retrabalho").length,
        custoTotal: all.reduce((s, o) => s + (Number(o.custo_total) || 0), 0),
      };
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}
