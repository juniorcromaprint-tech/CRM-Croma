// src/domains/compras/services/comprasService.ts

import { supabase } from "@/integrations/supabase/client";
import type { PedidoCompraCreate, PedidoCompraItemCreate } from "../types/compras.types";

const db = supabase as any;

export const comprasService = {
  // === FORNECEDORES ===
  async listarFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
    let q = db.from("fornecedores").select("*").order("nome_fantasia");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.busca) q = q.ilike("nome_fantasia", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarFornecedoresAtivos() {
    const { data, error } = await db
      .from("fornecedores")
      .select("id, nome_fantasia, razao_social")
      .eq("ativo", true)
      .order("nome_fantasia");
    if (error) throw error;
    return data ?? [];
  },

  async criarFornecedor(dados: Record<string, any>) {
    const { data, error } = await db.from("fornecedores").insert(dados).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarFornecedor(id: string, dados: Record<string, any>) {
    const { data, error } = await db.from("fornecedores").update(dados).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async excluirFornecedor(id: string) {
    const { error } = await db.from("fornecedores").delete().eq("id", id);
    if (error) throw error;
  },

  // === MATERIAIS ===
  async listarMateriaisSelect() {
    const { data, error } = await db
      .from("materiais")
      .select("id, nome, unidade, preco_medio")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },

  // === PEDIDOS DE COMPRA ===
  async listarPedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
    let q = db
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(nome_fantasia)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.fornecedor_id) q = q.eq("fornecedor_id", filtros.fornecedor_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarPedidoCompra(id: string) {
    const { data, error } = await db
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(*), itens:pedido_compra_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarPedidoCompra(pedido: PedidoCompraCreate, itens: Omit<PedidoCompraItemCreate, 'pedido_compra_id'>[]) {
    const pedidoComStatus = { ...pedido, status: pedido.status ?? 'rascunho' };
    const { data: pedidoCriado, error: errPedido } = await db
      .from("pedidos_compra")
      .insert(pedidoComStatus)
      .select()
      .single();
    if (errPedido) throw errPedido;

    if (itens.length > 0) {
      const { error: errItens } = await db
        .from("pedido_compra_itens")
        .insert(itens.map(i => ({ ...i, pedido_compra_id: pedidoCriado.id })));
      if (errItens) throw errItens;
    }
    return pedidoCriado;
  },

  async atualizarStatusPedido(id: string, status: string) {
    const { data, error } = await db
      .from("pedidos_compra")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarPedidoCompra(id: string, dados: Record<string, any>) {
    // Normalize data_entrega → previsao_entrega if caller used old field name
    if ('data_entrega' in dados) {
      dados = { ...dados, previsao_entrega: dados.data_entrega };
      delete dados.data_entrega;
    }
    const { data, error } = await db
      .from("pedidos_compra")
      .update(dados)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
