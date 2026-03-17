// src/domains/estoque/services/reservaService.ts

import { supabase } from "@/integrations/supabase/client";
import type { EstoqueReserva } from "../types/estoque.types";

const db = supabase as any;

export const reservaService = {
  async listarReservasPorOP(ordemProducaoId: string): Promise<EstoqueReserva[]> {
    const { data, error } = await db
      .from("estoque_reservas")
      .select("*, material:materiais(nome, unidade), ordem_producao:ordens_producao(numero)")
      .eq("ordem_producao_id", ordemProducaoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listarReservasAtivas(): Promise<EstoqueReserva[]> {
    const { data, error } = await db
      .from("estoque_reservas")
      .select("*, material:materiais(nome, unidade), ordem_producao:ordens_producao(numero)")
      .eq("status", "ativa")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async liberarReserva(reservaId: string): Promise<void> {
    const { data: reserva, error: errFetch } = await db
      .from("estoque_reservas")
      .select("material_id, quantidade, ordem_producao_id")
      .eq("id", reservaId)
      .single();
    if (errFetch) throw errFetch;

    await db.from("estoque_movimentacoes").insert({
      material_id: reserva.material_id,
      tipo: "liberacao_reserva",
      quantidade: reserva.quantidade,
      referencia_tipo: "reserva",
      referencia_id: reservaId,
      motivo: "Liberação manual de reserva",
    });

    const { error } = await db
      .from("estoque_reservas")
      .update({ status: "liberada", liberada_em: new Date().toISOString() })
      .eq("id", reservaId);
    if (error) throw error;
  },

  async criarReservaManual(dados: {
    material_id: string;
    ordem_producao_id?: string;
    quantidade: number;
    observacao?: string;
  }): Promise<EstoqueReserva> {
    await db.from("estoque_movimentacoes").insert({
      material_id: dados.material_id,
      tipo: "reserva",
      quantidade: dados.quantidade,
      referencia_tipo: dados.ordem_producao_id ? "ordem_producao" : undefined,
      referencia_id: dados.ordem_producao_id ?? undefined,
      motivo: dados.observacao ?? "Reserva manual",
    });

    const { data, error } = await db
      .from("estoque_reservas")
      .insert({
        material_id: dados.material_id,
        ordem_producao_id: dados.ordem_producao_id ?? null,
        quantidade: dados.quantidade,
        observacao: dados.observacao ?? null,
        status: "ativa",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
