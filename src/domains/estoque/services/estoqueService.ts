// src/domains/estoque/services/estoqueService.ts

import { supabase } from "@/integrations/supabase/client";

export const estoqueService = {
  // === SALDOS ===
  async listarSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
    let q = (supabase as any)
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
      .order("material(nome)");
    if (filtros?.busca) q = q.ilike("material.nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    let result = data ?? [];
    if (filtros?.abaixoMinimo) {
      result = result.filter((s: any) => s.quantidade < (s.material?.estoque_minimo ?? 0));
    }
    return result;
  },

  async alertasEstoqueMinimo() {
    const { data, error } = await (supabase as any)
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
    if (error) throw error;
    return (data ?? []).filter((s: any) =>
      s.material?.estoque_minimo > 0 && s.quantidade < s.material.estoque_minimo
    );
  },

  // === MOVIMENTAÇÕES ===
  async listarMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
    let q = (supabase as any)
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

  async criarMovimentacao(dados: { material_id: string; tipo: string; quantidade: number; observacao?: string }) {
    const { data, error } = await (supabase as any)
      .from("estoque_movimentacoes")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === INVENTÁRIO ===
  async listarInventarios() {
    const { data, error } = await (supabase as any)
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async criarInventario(dados: { observacoes?: string; responsavel_id?: string }) {
    // Cria inventário e preenche itens com saldos atuais
    const { data: inv, error: errInv } = await (supabase as any)
      .from("inventarios")
      .insert(dados)
      .select()
      .single();
    if (errInv) throw errInv;

    // Busca saldos atuais para preencher itens
    const { data: saldos } = await (supabase as any)
      .from("estoque_saldos")
      .select("material_id, quantidade");

    if (saldos?.length > 0) {
      await (supabase as any)
        .from("inventario_itens")
        .insert(saldos.map((s: any) => ({
          inventario_id: inv.id,
          material_id: s.material_id,
          quantidade_sistema: s.quantidade,
        })));
    }
    return inv;
  },

  async buscarInventario(id: string) {
    const { data, error } = await (supabase as any)
      .from("inventarios")
      .select("*, itens:inventario_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarItemInventario(id: string, quantidade_contada: number, justificativa?: string) {
    const { error } = await (supabase as any)
      .from("inventario_itens")
      .update({ quantidade_contada, justificativa })
      .eq("id", id);
    if (error) throw error;
  },

  async finalizarInventario(id: string) {
    const { error } = await (supabase as any)
      .from("inventarios")
      .update({ status: 'finalizado' })
      .eq("id", id);
    if (error) throw error;
  },
};
