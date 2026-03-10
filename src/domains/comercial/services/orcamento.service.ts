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
  modelo_id?: string;
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

export interface OrcamentoItemCreateDetalhado extends OrcamentoItemCreateInput {
  modelo_id?: string;
  materiais?: Array<{
    material_id?: string | null;
    descricao: string;
    quantidade: number;
    unidade: string;
    custo_unitario: number;
    custo_total: number;
  }>;
  acabamentos?: Array<{
    acabamento_id?: string | null;
    descricao: string;
    quantidade: number;
    custo_unitario: number;
    custo_total: number;
  }>;
}

export interface OrcamentoServicoCreateInput {
  servico_id?: string | null;
  descricao: string;
  horas: number;
  valor_unitario: number;
  valor_total: number;
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

  // ─── Buscar orçamento por ID (com materiais e acabamentos nested) ────────
  async buscarPorId(id: string): Promise<Orcamento & {
    itens: (OrcamentoItem & {
      materiais?: OrcamentoItemMaterial[];
      acabamentos?: OrcamentoItemAcabamento[];
    })[];
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

    const itens = (itensResult.data ?? []) as OrcamentoItem[];

    // Buscar materiais e acabamentos por item (se tabelas existirem)
    const itensComDetalhes = await Promise.all(
      itens.map(async (item) => {
        let materiais: OrcamentoItemMaterial[] = [];
        let acabamentos: OrcamentoItemAcabamento[] = [];

        try {
          const { data } = await supabase
            .from("proposta_item_materiais")
            .select("*")
            .eq("proposta_item_id", item.id);
          materiais = (data ?? []) as OrcamentoItemMaterial[];
        } catch (err) {
          console.warn("proposta_item_materiais não disponível (migration 006 pendente?):", err);
        }

        try {
          const { data } = await supabase
            .from("proposta_item_acabamentos")
            .select("*")
            .eq("proposta_item_id", item.id);
          acabamentos = (data ?? []) as OrcamentoItemAcabamento[];
        } catch (err) {
          console.warn("proposta_item_acabamentos não disponível (migration 006 pendente?):", err);
        }

        return { ...item, materiais, acabamentos };
      }),
    );

    return {
      ...(orcResult.data as unknown as Orcamento),
      itens: itensComDetalhes,
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

  // ─── Adicionar item (simples — sem materiais/acabamentos) ────────────────
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

  // ─── Adicionar item COM materiais e acabamentos ────────────────────────
  async adicionarItemDetalhado(
    propostaId: string,
    item: OrcamentoItemCreateDetalhado,
  ): Promise<OrcamentoItem> {
    const { materiais, acabamentos, ...itemBase } = item;

    // 1. Inserir item principal
    const { data: novoItem, error } = await supabase
      .from("proposta_itens")
      .insert({ ...itemBase, proposta_id: propostaId })
      .select()
      .single();

    if (error) throw error;
    const itemResult = novoItem as OrcamentoItem;

    // 2. Inserir materiais (se existirem e tabela disponível)
    if (materiais && materiais.length > 0) {
      try {
        await supabase.from("proposta_item_materiais").insert(
          materiais.map((m) => ({
            proposta_item_id: itemResult.id,
            material_id: m.material_id ?? null,
            descricao: m.descricao,
            quantidade: m.quantidade,
            unidade: m.unidade,
            custo_unitario: m.custo_unitario,
            custo_total: m.custo_total,
          })),
        );
      } catch {
        // Tabela pode não existir ainda (migration 006 pendente)
        console.warn("[orcamento.service] proposta_item_materiais não disponível");
      }
    }

    // 3. Inserir acabamentos (se existirem e tabela disponível)
    if (acabamentos && acabamentos.length > 0) {
      try {
        await supabase.from("proposta_item_acabamentos").insert(
          acabamentos.map((a) => ({
            proposta_item_id: itemResult.id,
            acabamento_id: a.acabamento_id ?? null,
            descricao: a.descricao,
            quantidade: a.quantidade,
            custo_unitario: a.custo_unitario,
            custo_total: a.custo_total,
          })),
        );
      } catch {
        console.warn("[orcamento.service] proposta_item_acabamentos não disponível");
      }
    }

    return itemResult;
  },

  // ─── Adicionar serviço ao orçamento ────────────────────────────────────
  async adicionarServico(
    propostaId: string,
    servico: OrcamentoServicoCreateInput,
  ): Promise<OrcamentoServico> {
    try {
      const { data, error } = await supabase
        .from("proposta_servicos")
        .insert({ ...servico, proposta_id: propostaId })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoServico;
    } catch {
      // Tabela pode não existir ainda (migration 006 pendente)
      console.warn("[orcamento.service] proposta_servicos não disponível");
      return {
        id: crypto.randomUUID(),
        proposta_id: propostaId,
        ...servico,
      } as OrcamentoServico;
    }
  },

  // ─── Remover serviço ──────────────────────────────────────────────────
  async removerServico(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("proposta_servicos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    } catch {
      console.warn("[orcamento.service] proposta_servicos não disponível");
    }
  },

  // ─── Salvar todos os serviços (replace all) ──────────────────────────
  async salvarServicos(
    propostaId: string,
    servicos: OrcamentoServicoCreateInput[],
  ): Promise<void> {
    try {
      // Remove existentes
      await supabase
        .from("proposta_servicos")
        .delete()
        .eq("proposta_id", propostaId);
      // Insere novos
      if (servicos.length > 0) {
        await supabase.from("proposta_servicos").insert(
          servicos.map((s) => ({ ...s, proposta_id: propostaId })),
        );
      }
    } catch {
      console.warn("[orcamento.service] proposta_servicos não disponível");
    }
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
    // 1. Buscar orçamento original com todos os dados
    const original = await orcamentoService.buscarPorId(id);
    if (!original) throw new Error("Orçamento não encontrado");

    // 2. Criar novo orçamento (cópia do cabeçalho)
    const novaPropostaInput: OrcamentoCreateInput = {
      cliente_id: original.cliente_id,
      vendedor_id: original.vendedor_id,
      titulo: `${original.titulo ?? "Orçamento"} (cópia)`,
      validade_dias: original.validade_dias,
      condicoes_pagamento: original.condicoes_pagamento,
      observacoes: original.observacoes,
    };
    const novaProposta = await orcamentoService.criar(novaPropostaInput);

    // 3. Copiar itens COM materiais e acabamentos
    for (const item of (original.itens ?? [])) {
      await orcamentoService.adicionarItemDetalhado(novaProposta.id, {
        proposta_id: novaProposta.id,
        produto_id: item.produto_id ?? undefined,
        modelo_id: (item as any).modelo_id ?? undefined,
        descricao: item.descricao,
        especificacao: item.especificacao ?? undefined,
        quantidade: item.quantidade ?? 1,
        unidade: item.unidade ?? "un",
        largura_cm: item.largura_cm ?? undefined,
        altura_cm: item.altura_cm ?? undefined,
        area_m2: item.area_m2 ?? undefined,
        custo_mp: item.custo_mp ?? 0,
        custo_mo: item.custo_mo ?? 0,
        custo_fixo: item.custo_fixo ?? 0,
        markup_percentual: item.markup_percentual ?? 40,
        valor_unitario: item.valor_unitario ?? 0,
        valor_total: item.valor_total ?? 0,
        prazo_producao_dias: item.prazo_producao_dias ?? undefined,
        materiais: (item as any).materiais ?? [],
        acabamentos: (item as any).acabamentos ?? [],
      });
    }

    // 4. Copiar serviços se existirem
    if (original.servicos && original.servicos.length > 0) {
      await orcamentoService.salvarServicos(novaProposta.id, original.servicos.map((s) => ({
        servico_id: s.servico_id ?? undefined,
        descricao: s.descricao,
        horas: s.horas ?? 1,
        valor_unitario: s.valor_unitario ?? 0,
        valor_total: s.valor_total ?? 0,
      })));
    }

    await orcamentoService.recalcularTotais(novaProposta.id);
    return novaProposta;
  },

  // ─── Converter para pedido ───────────────────────────────────────────────
  async converterParaPedido(orcamentoId: string, userId?: string): Promise<{ pedido_id: string }> {
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
    const pedidoId = pedido.id;

    // Duplicar itens para o pedido com campos técnicos
    const pedidoItensParaInserir = orc.itens.map((item: any) => ({
      pedido_id: pedidoId,
      proposta_item_id: item.id,
      produto_id: item.produto_id ?? null,
      modelo_id: item.modelo_id ?? null,
      descricao: item.descricao,
      especificacao: item.especificacao ?? null,
      quantidade: item.quantidade ?? 1,
      unidade: item.unidade ?? "un",
      largura_cm: item.largura_cm ?? null,
      altura_cm: item.altura_cm ?? null,
      area_m2: item.area_m2 ?? null,
      valor_unitario: item.valor_unitario ?? 0,
      valor_total: item.valor_total ?? 0,
      custo_mp: item.custo_mp ?? 0,
      custo_mo: item.custo_mo ?? 0,
      custo_fixo: item.custo_fixo ?? 0,
      markup_percentual: item.markup_percentual ?? 40,
      prazo_producao_dias: item.prazo_producao_dias ?? null,
      status: "pendente",
    }));

    if (pedidoItensParaInserir.length > 0) {
      await supabase.from("pedido_itens").insert(pedidoItensParaInserir);
    }

    // Calcular custo_total e margem_real do pedido
    const custoTotal = orc.itens.reduce((s: number, i: any) =>
      s + ((i.custo_mp ?? 0) + (i.custo_mo ?? 0) + (i.custo_fixo ?? 0)), 0);
    const valorTotal = orc.total ?? 0;
    const margemReal = valorTotal > 0 ? ((valorTotal - custoTotal) / valorTotal) * 100 : 0;

    // UPDATE pedido com custo e margem
    await supabase.from("pedidos").update({
      custo_total: custoTotal,
      margem_real: margemReal,
      aprovado_por: userId ?? null,
      aprovado_em: new Date().toISOString(),
    }).eq("id", pedidoId);

    return { pedido_id: pedidoId };
  },
};
