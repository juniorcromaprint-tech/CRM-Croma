// src/domains/compras/services/comprasService.ts

import { supabase } from "@/integrations/supabase/client";
import type { PedidoCompraCreate, PedidoCompraItemCreate } from "../types/compras.types";

export const comprasService = {
  // === FORNECEDORES ===
  async listarFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
    let q = (supabase as any).from("fornecedores").select("*").order("nome");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.busca) q = q.ilike("nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async criarFornecedor(dados: Record<string, any>) {
    const { data, error } = await (supabase as any).from("fornecedores").insert(dados).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarFornecedor(id: string, dados: Record<string, any>) {
    const { data, error } = await (supabase as any).from("fornecedores").update(dados).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async excluirFornecedor(id: string) {
    const { error } = await (supabase as any).from("fornecedores").delete().eq("id", id);
    if (error) throw error;
  },

  // === PEDIDOS DE COMPRA ===
  async listarPedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
    let q = (supabase as any)
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(nome)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.fornecedor_id) q = q.eq("fornecedor_id", filtros.fornecedor_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarPedidoCompra(id: string) {
    const { data, error } = await (supabase as any)
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(*), itens:pedido_compra_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarPedidoCompra(pedido: PedidoCompraCreate, itens: Omit<PedidoCompraItemCreate, 'pedido_compra_id'>[]) {
    const { data: pedidoCriado, error: errPedido } = await (supabase as any)
      .from("pedidos_compra")
      .insert(pedido)
      .select()
      .single();
    if (errPedido) throw errPedido;

    if (itens.length > 0) {
      const { error: errItens } = await (supabase as any)
        .from("pedido_compra_itens")
        .insert(itens.map(i => ({ ...i, pedido_compra_id: pedidoCriado.id })));
      if (errItens) throw errItens;
    }
    return pedidoCriado;
  },

  async atualizarStatusPedido(id: string, status: string) {
    const { data, error } = await (supabase as any)
      .from("pedidos_compra")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
