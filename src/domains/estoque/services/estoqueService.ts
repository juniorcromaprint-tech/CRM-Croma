// src/domains/estoque/services/estoqueService.ts

import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const estoqueService = {
  // === SALDOS ===
  async listarSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
    let q = db
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
      .order("material(nome)");
    if (filtros?.busca) q = q.ilike("material.nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    let result = data ?? [];
    if (filtros?.abaixoMinimo) {
      result = result.filter((s: any) => s.quantidade_disponivel < (s.material?.estoque_minimo ?? 0));
    }
    return result;
  },

  async alertasEstoqueMinimo() {
    const { data, error } = await db
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
    if (error) throw error;
    return (data ?? []).filter((s: any) =>
      s.material?.estoque_minimo > 0 && s.quantidade_disponivel < s.material.estoque_minimo
    );
  },

  // === MOVIMENTAÇÕES ===
  async listarMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
    let q = db
      .from("estoque_movimentacoes")
      .select("*, material:materiais(nome, unidade)")
      .order("created_at", { ascending: false })
      .limit(filtros?.limit ?? 100);
    if (filtros?.material_id) q = q.eq("material_id", filtros.material_id);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async criarMovimentacao(dados: { material_id: string; tipo: 'entrada' | 'saida'; quantidade: number; observacao?: string; referencia_tipo?: string; referencia_id?: string }) {
    const { data, error } = await db
      .from("estoque_movimentacoes")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === INVENTÁRIO ===
  async listarInventarios() {
    const { data, error } = await db
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async criarInventario(dados: { observacoes?: string; responsavel_id?: string }) {
    // Cria inventário e preenche itens com saldos atuais
    const { data: inv, error: errInv } = await db
      .from("inventarios")
      .insert(dados)
      .select()
      .single();
    if (errInv) throw errInv;

    // Busca saldos atuais para preencher itens
    const { data: saldos } = await db
      .from("estoque_saldos")
      .select("material_id, quantidade_disponivel");

    if (saldos?.length > 0) {
      await db
        .from("inventario_itens")
        .insert(saldos.map((s: any) => ({
          inventario_id: inv.id,
          material_id: s.material_id,
          quantidade_sistema: s.quantidade_disponivel,
        })));
    }
    return inv;
  },

  async buscarInventario(id: string) {
    const { data, error } = await db
      .from("inventarios")
      .select("*, itens:inventario_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarItemInventario(id: string, quantidade_contada: number, justificativa?: string) {
    const { error } = await db
      .from("inventario_itens")
      .update({ quantidade_contada, justificativa })
      .eq("id", id);
    if (error) throw error;
  },

  async finalizarInventario(id: string) {
    const { error } = await db
      .from("inventarios")
      .update({ status: 'finalizado' })
      .eq("id", id);
    if (error) throw error;
  },
};
