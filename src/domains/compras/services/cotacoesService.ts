// src/domains/compras/services/cotacoesService.ts

import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const cotacoesService = {
  // === SOLICITAÇÕES DE COMPRA ===
  async listarSolicitacoes(filtros?: { status?: string }) {
    let q = db
      .from("solicitacoes_compra")
      .select("*, material:materiais(nome, unidade), solicitante:profiles(full_name)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async criarSolicitacao(dados: Record<string, any>) {
    const { data, error } = await db
      .from("solicitacoes_compra")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarStatusSolicitacao(id: string, status: string) {
    const { data, error } = await db
      .from("solicitacoes_compra")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === COTAÇÕES DE COMPRA ===
  async listarCotacoes(solicitacaoId: string) {
    const { data, error } = await db
      .from("cotacoes_compra")
      .select("*, fornecedor:fornecedores(nome_fantasia, razao_social)")
      .eq("solicitacao_id", solicitacaoId)
      .order("valor_unitario", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async criarCotacao(dados: Record<string, any>) {
    const { data, error } = await db
      .from("cotacoes_compra")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async selecionarCotacao(cotacaoId: string, solicitacaoId: string) {
    // Desmarcar todas as cotações desta solicitação
    await db
      .from("cotacoes_compra")
      .update({ selecionada: false })
      .eq("solicitacao_id", solicitacaoId);
    // Marcar a vencedora
    const { data, error } = await db
      .from("cotacoes_compra")
      .update({ selecionada: true })
      .eq("id", cotacaoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
