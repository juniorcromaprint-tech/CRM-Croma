// ============================================================================
// ORÇAMENTO SERVICE
// CRUD completo para propostas + itens + materiais + acabamentos + serviços
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OrcamentoStatus =
  | "rascunho"
  | "enviada"
  | "em_revisao"
  | "aprovada"
  | "recusada"
  | "expirada";

export interface Orcamento {
  id: string;
  numero: string;
  cliente_id: string;
  oportunidade_id: string | null;
  vendedor_id: string | null;
  status: OrcamentoStatus;
  titulo: string;
  validade_dias: number;
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  total: number;
  condicoes_pagamento: string | null;
  observacoes: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  cliente_nome_snapshot: string | null;
  cliente_cnpj_snapshot: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  cliente?: { razao_social: string; nome_fantasia: string | null };
  vendedor?: { first_name: string | null; last_name: string | null };
  _itens_count?: number;
}

export interface OrcamentoItem {
  id: string;
  proposta_id: string;
  produto_id: string | null;
  descricao: string;
  especificacao: string | null;
  quantidade: number;
  unidade: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  custo_mp: number;
  custo_mo: number;
  custo_fixo: number;
  markup_percentual: number;
  valor_unitario: number;
  valor_total: number;
  prazo_producao_dias: number | null;
  ordem: number;
}

export interface OrcamentoItemMaterial {
  id: string;
  proposta_item_id: string;
  material_id: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
}

export interface OrcamentoItemAcabamento {
  id: string;
  proposta_item_id: string;
  acabamento_id: string | null;
  descricao: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
}

export interface OrcamentoServico {
  id: string;
  proposta_id: string;
  servico_id: string | null;
  descricao: string;
  horas: number;
  valor_unitario: number;
  valor_total: number;
}

export interface OrcamentoFiltros {
  status?: OrcamentoStatus | OrcamentoStatus[];
  cliente_id?: string;
  vendedor_id?: string;
  search?: string;
  data_inicio?: string;
  data_fim?: string;
}

export interface OrcamentoCreateInput {
  cliente_id: string;
  oportunidade_id?: string | null;
  vendedor_id?: string | null;
  titulo: string;
  validade_dias?: number;
  condicoes_pagamento?: string | null;
  observacoes?: string | null;
}

export interface OrcamentoItemCreateInput {
  produto_id?: string | null;
  descricao: string;
  especificacao?: string | null;
  quantidade: number;
  unidade?: string;
  largura_cm?: number | null;
  altura_cm?: number | null;
  area_m2?: number | null;
  custo_mp?: number;
  custo_mo?: number;
  custo_fixo?: number;
  markup_percentual: number;
  valor_unitario: number;
  valor_total: number;
  prazo_producao_dias?: number | null;
  ordem?: number;
}

// ─── Service Functions ───────────────────────────────────────────────────────

export const orcamentoService = {
  // ─── Listar orçamentos ──────────────────────────────────────────────────
  async listar(filtros?: OrcamentoFiltros): Promise<Orcamento[]> {
    let query = supabase
      .from("propostas")
      .select(`
        *,
        cliente:clientes(razao_social, nome_fantasia)
      `)
      .is("excluido_em", null)
      .order("created_at", { ascending: false });

    if (filtros?.status) {
      const statuses = Array.isArray(filtros.status) ? filtros.status : [filtros.status];
      query = query.in("status", statuses);
    }
    if (filtros?.cliente_id) {
      query = query.eq("cliente_id", filtros.cliente_id);
    }
    if (filtros?.vendedor_id) {
      query = query.eq("vendedor_id", filtros.vendedor_id);
    }
    if (filtros?.search) {
      query = query.or(`numero.ilike.%${filtros.search}%,titulo.ilike.%${filtros.search}%`);
    }
    if (filtros?.data_inicio) {
      query = query.gte("created_at", filtros.data_inicio);
    }
    if (filtros?.data_fim) {
      query = query.lte("created_at", filtros.data_fim);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Orcamento[];
  },

  // ─── Buscar orçamento por ID ─────────────────────────────────────────────
  async buscarPorId(id: string): Promise<Orcamento & {
    itens: OrcamentoItem[];
    servicos: OrcamentoServico[];
  }> {
    const [orcResult, itensResult, servicosResult] = await Promise.all([
      supabase
        .from("propostas")
        .select(`*, cliente:clientes(razao_social, nome_fantasia, cnpj)`)
        .eq("id", id)
        .is("excluido_em", null)
        .single(),
      supabase
        .from("proposta_itens")
        .select("*")
        .eq("proposta_id", id)
        .order("ordem"),
      supabase
        .from("proposta_servicos")
        .select("*")
        .eq("proposta_id", id),
    ]);

    if (orcResult.error) throw orcResult.error;

    return {
      ...(orcResult.data as unknown as Orcamento),
      itens: (itensResult.data ?? []) as OrcamentoItem[],
      servicos: (servicosResult.data ?? []) as OrcamentoServico[],
    };
  },

  // ─── Criar orçamento ─────────────────────────────────────────────────────
  async criar(input: OrcamentoCreateInput): Promise<Orcamento> {
    // Gera número sequencial: PROP-YYYY-###
    const ano = new Date().getFullYear();
    const { count } = await supabase
      .from("propostas")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${ano}-01-01`);

    const numero = `PROP-${ano}-${String((count ?? 0) + 1).padStart(3, "0")}`;

    const { data, error } = await supabase
      .from("propostas")
      .insert({
        ...input,
        numero,
        status: "rascunho",
        subtotal: 0,
        desconto_percentual: 0,
        desconto_valor: 0,
        total: 0,
        validade_dias: input.validade_dias ?? 10,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Orcamento;
  },

  // ─── Atualizar orçamento ─────────────────────────────────────────────────
  async atualizar(id: string, updates: Partial<OrcamentoCreateInput & {
    status?: OrcamentoStatus;
    subtotal?: number;
    desconto_percentual?: number;
    desconto_valor?: number;
    total?: number;
    aprovado_por?: string;
    aprovado_em?: string;
  }>): Promise<Orcamento> {
    const { data, error } = await supabase
      .from("propostas")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Orcamento;
  },

  // ─── Excluir orçamento (soft delete) ────────────────────────────────────
  async excluir(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from("propostas")
      .update({
        excluido_em: new Date().toISOString(),
        excluido_por: userId ?? null,
      })
      .eq("id", id);

    if (error) throw error;
  },

  // ─── Adicionar item ──────────────────────────────────────────────────────
  async adicionarItem(
    propostaId: string,
    item: OrcamentoItemCreateInput,
  ): Promise<OrcamentoItem> {
    const { data, error } = await supabase
      .from("proposta_itens")
      .insert({ ...item, proposta_id: propostaId })
      .select()
      .single();

    if (error) throw error;
    return data as OrcamentoItem;
  },

  // ─── Atualizar item ──────────────────────────────────────────────────────
  async atualizarItem(id: string, updates: Partial<OrcamentoItemCreateInput>): Promise<OrcamentoItem> {
    const { data, error } = await supabase
      .from("proposta_itens")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as OrcamentoItem;
  },

  // ─── Remover item ────────────────────────────────────────────────────────
  async removerItem(id: string): Promise<void> {
    const { error } = await supabase
      .from("proposta_itens")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // ─── Recalcular totais da proposta ───────────────────────────────────────
  async recalcularTotais(propostaId: string): Promise<void> {
    const [itensResult, servicosResult, orcResult] = await Promise.all([
      supabase.from("proposta_itens").select("valor_total").eq("proposta_id", propostaId),
      supabase.from("proposta_servicos").select("valor_total").eq("proposta_id", propostaId),
      supabase.from("propostas").select("desconto_percentual").eq("id", propostaId).single(),
    ]);

    const subtotalItens = (itensResult.data ?? []).reduce((sum, i) => sum + (i.valor_total ?? 0), 0);
    const subtotalServicos = (servicosResult.data ?? []).reduce((sum, s) => sum + (s.valor_total ?? 0), 0);
    const subtotal = subtotalItens + subtotalServicos;
    const desconto_percentual = orcResult.data?.desconto_percentual ?? 0;
    const desconto_valor = subtotal * (desconto_percentual / 100);
    const total = subtotal - desconto_valor;

    await supabase
      .from("propostas")
      .update({ subtotal, desconto_valor, total, updated_at: new Date().toISOString() })
      .eq("id", propostaId);
  },

  // ─── Duplicar orçamento ──────────────────────────────────────────────────
  async duplicar(id: string): Promise<Orcamento> {
    const original = await orcamentoService.buscarPorId(id);
    const { itens, servicos, ...orcData } = original;

    const novo = await orcamentoService.criar({
      cliente_id: orcData.cliente_id,
      oportunidade_id: orcData.oportunidade_id,
      vendedor_id: orcData.vendedor_id,
      titulo: `${orcData.titulo} (cópia)`,
      validade_dias: orcData.validade_dias,
      condicoes_pagamento: orcData.condicoes_pagamento,
      observacoes: orcData.observacoes,
    });

    // Duplicar itens
    for (const item of itens) {
      const { id: _id, proposta_id: _pid, ...itemData } = item;
      await orcamentoService.adicionarItem(novo.id, itemData);
    }

    return novo;
  },

  // ─── Converter para pedido ───────────────────────────────────────────────
  async converterParaPedido(orcamentoId: string): Promise<{ pedido_id: string }> {
    // Atualiza status para aprovada
    await orcamentoService.atualizar(orcamentoId, {
      status: "aprovada",
      aprovado_em: new Date().toISOString(),
    });

    // Cria pedido (simplificado - a lógica completa seria via Edge Function)
    const orc = await orcamentoService.buscarPorId(orcamentoId);
    const ano = new Date().getFullYear();
    const { count } = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${ano}-01-01`);

    const numeroPedido = `PED-${ano}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        numero: numeroPedido,
        proposta_id: orcamentoId,
        cliente_id: orc.cliente_id,
        vendedor_id: orc.vendedor_id,
        status: "aguardando_aprovacao",
        valor_total: orc.total,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Duplicar itens para o pedido
    for (const item of orc.itens) {
      await supabase.from("pedido_itens").insert({
        pedido_id: pedido.id,
        proposta_item_id: item.id,
        produto_id: item.produto_id,
        descricao: item.descricao,
        especificacao: item.especificacao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        status: "pendente",
      });
    }

    return { pedido_id: pedido.id };
  },
};
