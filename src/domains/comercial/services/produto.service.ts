// ============================================================================
// PRODUTO SERVICE — Croma Print ERP/CRM
// CRUD completo para produtos, modelos, materiais e processos
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface ProdutoCreate {
  nome: string;
  categoria: string;
  unidade_padrao?: string;
  descricao?: string;
  codigo?: string;
}

export interface ModeloCreate {
  produto_id: string;
  nome: string;
  largura_cm?: number;
  altura_cm?: number;
  area_m2?: number;
  markup_padrao?: number;
  margem_minima?: number;
  preco_fixo?: number;
  tempo_producao_min?: number;
}

export interface MaterialModeloInput {
  material_id: string;
  quantidade_por_unidade: number;
  unidade?: string;
}

export interface ProcessoModeloInput {
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number;
}

export const produtoService = {
  // ── PRODUTOS ──────────────────────────────────────────────

  async listar(filtros?: { categoria?: string; ativo?: boolean }) {
    let q = (supabase as unknown as any).from("produtos").select("*").order("nome");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.categoria) q = q.eq("categoria", filtros.categoria);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarCategorias(): Promise<string[]> {
    const { data, error } = await (supabase as unknown as any)
      .from("produtos")
      .select("categoria")
      .order("categoria");
    if (error) throw error;
    const cats = [
      ...new Set((data ?? []).map((r: any) => r.categoria as string)),
    ];
    return cats;
  },

  async criar(dados: ProdutoCreate) {
    const { data, error } = await (supabase as unknown as any)
      .from("produtos")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(
    id: string,
    dados: Partial<ProdutoCreate & { ativo: boolean }>,
  ) {
    const { data, error } = await (supabase as unknown as any)
      .from("produtos")
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async alterarStatus(id: string, ativo: boolean) {
    return this.atualizar(id, { ativo });
  },

  // ── MODELOS ───────────────────────────────────────────────

  async listarModelos(produtoId: string) {
    const { data, error } = await (supabase as unknown as any)
      .from("produto_modelos")
      .select(
        `
        *,
        materiais:modelo_materiais(*, material:materiais(nome, preco_medio, unidade)),
        processos:modelo_processos(*)
      `,
      )
      .eq("produto_id", produtoId)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },

  async criarModelo(dados: ModeloCreate) {
    const { data, error } = await (supabase as unknown as any)
      .from("produto_modelos")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarModelo(
    id: string,
    dados: Partial<ModeloCreate & { ativo: boolean }>,
  ) {
    const { data, error } = await (supabase as unknown as any)
      .from("produto_modelos")
      .update(dados)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluirModelo(id: string) {
    const { error } = await (supabase as unknown as any)
      .from("produto_modelos")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // ── MATERIAIS DO MODELO ───────────────────────────────────

  async salvarMaterialModelo(
    modeloId: string,
    materiais: MaterialModeloInput[],
  ) {
    const { error: delErr } = await (supabase as unknown as any)
      .from("modelo_materiais")
      .delete()
      .eq("modelo_id", modeloId);
    if (delErr) throw delErr;

    if (materiais.length > 0) {
      const { error } = await (supabase as unknown as any)
        .from("modelo_materiais")
        .insert(materiais.map((m) => ({ ...m, modelo_id: modeloId })));
      if (error) throw error;
    }
  },

  // ── PROCESSOS DO MODELO ───────────────────────────────────

  async salvarProcessosModelo(
    modeloId: string,
    processos: ProcessoModeloInput[],
  ) {
    const { error: delErr } = await (supabase as unknown as any)
      .from("modelo_processos")
      .delete()
      .eq("modelo_id", modeloId);
    if (delErr) throw delErr;

    if (processos.length > 0) {
      const { error } = await (supabase as unknown as any)
        .from("modelo_processos")
        .insert(processos.map((p) => ({ ...p, modelo_id: modeloId })));
      if (error) throw error;
    }
  },
};
