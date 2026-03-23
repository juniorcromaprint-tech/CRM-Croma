// ============================================================================
// ORÇAMENTO SERVICE
// CRUD completo para propostas + itens + materiais + acabamentos + serviços
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/shared/services/pricing-engine";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import { updateWithLock, OptimisticLockError } from "@/shared/utils/optimistic-lock";

// ─── Helper: buscar config de precificação ativa e gerar snapshot ────────────

async function buildConfigSnapshot(): Promise<Record<string, unknown>> {
  try {
    const { data } = await supabase
      .from("config_precificacao")
      .select("*")
      .eq("ativo", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        faturamento_medio: (data as any).faturamento_medio,
        custo_operacional: (data as any).custo_operacional,
        custo_produtivo: (data as any).custo_produtivo,
        qtd_funcionarios: (data as any).qtd_funcionarios,
        horas_mes: (data as any).horas_mes,
        percentual_comissao: (data as any).percentual_comissao,
        percentual_impostos: (data as any).percentual_impostos,
        percentual_juros: (data as any).percentual_juros,
        snapshot_em: new Date().toISOString(),
      };
    }
  } catch {
    // Fallback intencional: config não disponível, usar defaults sem bloquear
  }
  // Fallback: salva DEFAULT_PRICING_CONFIG como snapshot
  return {
    faturamento_medio: DEFAULT_PRICING_CONFIG.faturamentoMedio,
    custo_operacional: DEFAULT_PRICING_CONFIG.custoOperacional,
    custo_produtivo: DEFAULT_PRICING_CONFIG.custoProdutivo,
    qtd_funcionarios: DEFAULT_PRICING_CONFIG.qtdFuncionarios,
    horas_mes: DEFAULT_PRICING_CONFIG.horasMes,
    percentual_comissao: DEFAULT_PRICING_CONFIG.percentualComissao,
    percentual_impostos: DEFAULT_PRICING_CONFIG.percentualImpostos,
    percentual_juros: DEFAULT_PRICING_CONFIG.percentualJuros,
    snapshot_em: new Date().toISOString(),
  };
}

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
  version: number;
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
  // União de itens (migration 094)
  grupo_uniao: string | null;
  nome_exibicao: string | null;
  item_visivel: boolean;
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
  processos?: Array<{
    etapa: string;
    tempo_minutos: number;
    ordem?: number;
  }>;
}

export interface OrcamentoServicoCreateInput {
  servico_id?: string | null;
  descricao: string;
  horas: number;
  valor_unitario: number;
  valor_total: number;
}

// ─── Status Transition Guards ────────────────────────────────────────────────

const PROPOSTA_VALID_TRANSITIONS: Record<string, string[]> = {
  'rascunho': ['enviada'],
  'enviada': ['em_revisao', 'aprovada', 'recusada', 'expirada'],
  'em_revisao': ['enviada', 'aprovada', 'recusada'],
  'aprovada': [],  // terminal (converts to order)
  'recusada': ['rascunho'],  // can reopen as draft
  'expirada': ['rascunho'],  // can reopen as draft
};

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
      const term = ilikeTerm(filtros.search);
      query = query.or(`numero.ilike.${term},titulo.ilike.${term}`);
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

  // ─── Buscar orçamento por ID (2 queries paralelas com nested select) ──────
  async buscarPorId(id: string): Promise<Orcamento & {
    itens: (OrcamentoItem & {
      materiais?: OrcamentoItemMaterial[];
      acabamentos?: OrcamentoItemAcabamento[];
    })[];
    servicos: OrcamentoServico[];
  }> {
    const [mainResult, servicosResult] = await Promise.all([
      supabase
        .from("propostas")
        .select(`
          *,
          cliente:clientes(razao_social, nome_fantasia, cnpj),
          itens:proposta_itens(
            *,
            materiais:proposta_item_materiais(*),
            acabamentos:proposta_item_acabamentos(*)
          )
        `)
        .eq("id", id)
        .is("excluido_em", null)
        .order("ordem", { referencedTable: "proposta_itens" })
        .single(),
      supabase
        .from("proposta_servicos")
        .select("*")
        .eq("proposta_id", id),
    ]);

    if (mainResult.error) throw mainResult.error;

    const data = mainResult.data as any;
    return {
      ...data,
      itens: (data.itens ?? []).map((item: any) => ({
        ...item,
        materiais: item.materiais ?? [],
        acabamentos: item.acabamentos ?? [],
      })),
      servicos: (servicosResult.data ?? []) as OrcamentoServico[],
    };
  },

  // ─── Criar orçamento ─────────────────────────────────────────────────────
  async criar(input: OrcamentoCreateInput): Promise<Orcamento> {
    // Número gerado automaticamente pelo trigger `trg_proposta_numero` no banco
    // Snapshot dos custos fixos no momento da criação (imutabilidade)
    const configSnapshot = await buildConfigSnapshot();

    const { data, error } = await supabase
      .from("propostas")
      .insert({
        ...input,
        status: "rascunho",
        subtotal: 0,
        desconto_percentual: 0,
        desconto_valor: 0,
        total: 0,
        validade_dias: input.validade_dias ?? 10,
        config_snapshot: configSnapshot,
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
  }>, version?: number): Promise<Orcamento> {
    // C-08: Impede edição de orçamentos em status bloqueado
    // Exceção: a própria mudança de status (aprovação, cancelamento) é permitida
    const estaAlterandoStatus = updates.status !== undefined;
    if (!estaAlterandoStatus) {
      const { data: propostaAtual } = await supabase
        .from("propostas")
        .select("status")
        .eq("id", id)
        .single();

      const statusBloqueados: OrcamentoStatus[] = ["aprovada", "recusada", "expirada"];
      if (statusBloqueados.includes(propostaAtual?.status as OrcamentoStatus)) {
        throw new Error(`Orçamento ${propostaAtual?.status} não pode ser editado`);
      }
    }

    // Validate status transition
    if (estaAlterandoStatus) {
      const { data: propostaAtual, error: fetchError } = await supabase
        .from("propostas")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw new Error(`Erro ao verificar status atual: ${fetchError.message}`);
      }

      const currentStatus = propostaAtual?.status as string;
      const allowed = PROPOSTA_VALID_TRANSITIONS[currentStatus];
      if (allowed && !allowed.includes(updates.status!)) {
        throw new Error(
          `Transição de status inválida: "${currentStatus}" → "${updates.status}". ` +
          `Transições permitidas: ${allowed.length > 0 ? allowed.join(", ") : "nenhuma (status terminal)"}`
        );
      }
    }

    if (version !== undefined) {
      try {
        const data = await updateWithLock<Record<string, unknown>>("propostas", id, updates, version);
        return data as unknown as Orcamento;
      } catch (err) {
        if (err instanceof OptimisticLockError) throw err;
        throw err;
      }
    }

    const { data, error } = await supabase
      .from("propostas")
      .update(updates)
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
    const { materiais, acabamentos, processos, ...itemBase } = item;

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
      } catch (err) {
        throw new Error(`Falha ao salvar materiais do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
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
      } catch (err) {
        throw new Error(`Falha ao salvar acabamentos do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
    }

    // 4. Inserir processos (se existirem e tabela disponível — migration 018)
    if (processos && processos.length > 0) {
      try {
        await supabase.from("proposta_item_processos").insert(
          processos.map((p, idx) => ({
            proposta_item_id: itemResult.id,
            etapa: p.etapa,
            tempo_minutos: p.tempo_minutos,
            ordem: p.ordem ?? idx,
          })),
        );
      } catch (err) {
        throw new Error(`Falha ao salvar processos do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
    }

    return itemResult;
  },

  // ─── Adicionar serviço ao orçamento ────────────────────────────────────
  async adicionarServico(
    propostaId: string,
    servico: OrcamentoServicoCreateInput,
  ): Promise<OrcamentoServico> {
    const { data, error } = await supabase
      .from("proposta_servicos")
      .insert({ ...servico, proposta_id: propostaId })
      .select()
      .single();
    if (error) throw new Error(`Falha ao adicionar serviço: ${error.message}`);
    return data as OrcamentoServico;
  },

  // ─── Remover serviço ──────────────────────────────────────────────────
  async removerServico(id: string): Promise<void> {
    const { error } = await supabase
      .from("proposta_servicos")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Falha ao remover serviço: ${error.message}`);
  },

  // ─── Salvar todos os serviços (replace all) ──────────────────────────
  async salvarServicos(
    propostaId: string,
    servicos: OrcamentoServicoCreateInput[],
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from("proposta_servicos")
      .delete()
      .eq("proposta_id", propostaId);
    if (deleteError) throw new Error(`Falha ao remover serviços existentes: ${deleteError.message}`);

    if (servicos.length > 0) {
      const { error: insertError } = await supabase.from("proposta_servicos").insert(
        servicos.map((s) => ({ ...s, proposta_id: propostaId })),
      );
      if (insertError) throw new Error(`Falha ao salvar serviços: ${insertError.message}`);
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

  // ─── Atualizar item COM materiais, acabamentos e processos ───────────────
  async atualizarItemDetalhado(
    itemId: string,
    propostaId: string,
    item: OrcamentoItemCreateDetalhado,
  ): Promise<OrcamentoItem> {
    const { materiais, acabamentos, processos, ...itemBase } = item;

    // 1. Atualizar item principal
    const { data: updatedItem, error } = await supabase
      .from("proposta_itens")
      .update({ ...itemBase, proposta_id: propostaId })
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    const itemResult = updatedItem as OrcamentoItem;

    // 2. Substituir materiais (DELETE + INSERT)
    try {
      await supabase
        .from("proposta_item_materiais")
        .delete()
        .eq("proposta_item_id", itemId);

      if (materiais && materiais.length > 0) {
        await supabase.from("proposta_item_materiais").insert(
          materiais.map((m) => ({
            proposta_item_id: itemId,
            material_id: m.material_id ?? null,
            descricao: m.descricao,
            quantidade: m.quantidade,
            unidade: m.unidade,
            custo_unitario: m.custo_unitario,
            custo_total: m.custo_total,
          })),
        );
      }
    } catch (err) {
      throw new Error(`Falha ao atualizar materiais do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }

    // 3. Substituir acabamentos (DELETE + INSERT)
    try {
      await supabase
        .from("proposta_item_acabamentos")
        .delete()
        .eq("proposta_item_id", itemId);

      if (acabamentos && acabamentos.length > 0) {
        await supabase.from("proposta_item_acabamentos").insert(
          acabamentos.map((a) => ({
            proposta_item_id: itemId,
            acabamento_id: a.acabamento_id ?? null,
            descricao: a.descricao,
            quantidade: a.quantidade,
            custo_unitario: a.custo_unitario,
            custo_total: a.custo_total,
          })),
        );
      }
    } catch (err) {
      throw new Error(`Falha ao atualizar acabamentos do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }

    // 4. Substituir processos (DELETE + INSERT — migration 018)
    try {
      await supabase
        .from("proposta_item_processos")
        .delete()
        .eq("proposta_item_id", itemId);

      if (processos && processos.length > 0) {
        await supabase.from("proposta_item_processos").insert(
          processos.map((p, idx) => ({
            proposta_item_id: itemId,
            etapa: p.etapa,
            tempo_minutos: p.tempo_minutos,
            ordem: p.ordem ?? idx,
          })),
        );
      }
    } catch (err) {
      throw new Error(`Falha ao atualizar processos do item: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }

    return itemResult;
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
      .update({ subtotal, desconto_valor, total })
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

  // ─── Agrupar itens sob um nome de exibição único ─────────────────────────
  // Todos os itemIds recebem o mesmo grupo_uniao (UUID) e nome_exibicao.
  // Apenas o primeiro item do grupo fica visível; os demais ficam ocultos.
  async agruparItens(itemIds: string[], nomeExibicao: string): Promise<void> {
    if (itemIds.length < 2) {
      throw new Error("Selecione pelo menos 2 itens para agrupar");
    }

    const grupoUniao = crypto.randomUUID();

    // Primeiro item = item de exibição (item_visivel = true)
    const [primeiroId, ...restIds] = itemIds;

    const { error: e1 } = await supabase
      .from("proposta_itens")
      .update({ grupo_uniao: grupoUniao, nome_exibicao: nomeExibicao, item_visivel: true })
      .eq("id", primeiroId);
    if (e1) throw new Error(`Falha ao agrupar item principal: ${e1.message}`);

    if (restIds.length > 0) {
      const { error: e2 } = await supabase
        .from("proposta_itens")
        .update({ grupo_uniao: grupoUniao, nome_exibicao: nomeExibicao, item_visivel: false })
        .in("id", restIds);
      if (e2) throw new Error(`Falha ao agrupar itens secundários: ${e2.message}`);
    }
  },

  // ─── Desagrupar itens (restaura item_visivel e limpa campos de grupo) ─────
  async desagruparItens(grupoUniao: string): Promise<void> {
    const { error } = await supabase
      .from("proposta_itens")
      .update({ grupo_uniao: null, nome_exibicao: null, item_visivel: true })
      .eq("grupo_uniao", grupoUniao);
    if (error) throw new Error(`Falha ao desagrupar itens: ${error.message}`);
  },

  // ─── Converter para pedido ───────────────────────────────────────────────
  async converterParaPedido(orcamentoId: string, userId?: string): Promise<{ pedido_id: string }> {
    // Busca orçamento e valida antes de converter
    const orc = await orcamentoService.buscarPorId(orcamentoId);

    // A-04: Apenas propostas aprovadas podem ser convertidas em pedido
    if (!["aprovada"].includes(orc.status)) {
      throw new Error(
        `Apenas orçamentos aprovados podem ser convertidos em pedido. Status atual: ${orc.status}`
      );
    }

    if (!orc.itens || orc.itens.length === 0) {
      throw new Error("Orçamento precisa de pelo menos 1 item para gerar pedido.");
    }
    if ((orc.total ?? 0) <= 0) {
      throw new Error("Orçamento precisa ter valor maior que R$ 0,00 para gerar pedido.");
    }

    // A-01: Verificar se já existe pedido para este orçamento (anti-duplicação)
    const { data: pedidoExistente } = await supabase
      .from("pedidos")
      .select("id, numero")
      .eq("proposta_id", orcamentoId)
      .neq("status", "cancelado")
      .limit(1);

    if (pedidoExistente && pedidoExistente.length > 0) {
      throw new Error(
        `Já existe o pedido ${pedidoExistente[0].numero} para este orçamento. Cancele-o antes de gerar outro.`
      );
    }

    // Registra aprovado_em/por (status já é "aprovada" — validado acima)
    await supabase
      .from("propostas")
      .update({
        aprovado_em: new Date().toISOString(),
        aprovado_por: userId ?? null,
      })
      .eq("id", orcamentoId);

    // A-01: Numeração atômica via sequence do Postgres (elimina race condition)
    const { data: numData, error: numError } = await supabase.rpc('gerar_numero_pedido');
    if (numError) throw new Error(`Erro ao gerar número do pedido: ${numError.message}`);
    const numeroPedido = numData as string;

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        numero: numeroPedido,
        proposta_id: orcamentoId,
        cliente_id: orc.cliente_id,
        vendedor_id: orc.vendedor_id,
        status: "aprovado",
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
