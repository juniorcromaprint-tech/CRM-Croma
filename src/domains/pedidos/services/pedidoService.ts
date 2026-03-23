import { supabase } from "@/integrations/supabase/client";
import type { PedidoStatus, PedidoPrioridade } from "@/shared/constants/status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PedidoRow {
  id: string;
  numero: string;
  cliente_id: string;
  status: PedidoStatus;
  prioridade: PedidoPrioridade;
  valor_total: number;
  custo_total: number;
  margem_real: number;
  data_prometida: string | null;
  data_conclusao: string | null;
  observacoes: string | null;
  status_fiscal?: string | null;
  created_at: string;
  excluido_em: string | null;
  clientes: {
    nome_fantasia: string | null;
    razao_social: string;
  } | null;
  pedido_itens: { count: number }[];
}

export interface ClienteOption {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

export interface PedidoCreateInput {
  numero: string;
  cliente_id: string;
  status: PedidoStatus;
  prioridade: PedidoPrioridade;
  data_prometida: string | null;
  observacoes: string | null;
  valor_total: number;
  custo_total: number;
  margem_real: number;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch all non-deleted pedidos with cliente join and item count.
 */
export async function fetchPedidos(): Promise<PedidoRow[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, status_fiscal, clientes(nome_fantasia, razao_social), pedido_itens(count)")
    .is("excluido_em", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PedidoRow[];
}

/**
 * Fetch active clientes for the "select cliente" dropdown.
 */
export async function fetchClientesForSelect(): Promise<ClienteOption[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social")
    .is("excluido_em", null)
    .eq("ativo", true)
    .order("nome_fantasia", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClienteOption[];
}

/**
 * Create a new pedido.
 */
export async function createPedido(input: PedidoCreateInput) {
  const { data, error } = await supabase
    .from("pedidos")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update pedido status (and optionally data_conclusao).
 */
export async function updatePedidoStatus(
  id: string,
  newStatus: PedidoStatus,
): Promise<void> {
  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "concluido") {
    updates.data_conclusao = new Date().toISOString();
  }

  const { error } = await supabase
    .from("pedidos")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Soft-delete a pedido (set excluido_em).
 */
export async function softDeletePedido(
  id: string,
  userId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("pedidos")
    .update({ excluido_em: new Date().toISOString(), excluido_por: userId ?? null })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Check if all production orders for a pedido are finalized.
 */
export async function fetchOrdensProducao(pedidoId: string) {
  const { data, error } = await supabase
    .from("ordens_producao")
    .select("id, status")
    .eq("pedido_id", pedidoId);

  if (error) throw error;
  return data ?? [];
}

/**
 * Check if a pedido has at least one NF-e issued.
 */
export async function hasNFeEmitida(pedidoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("fiscal_documentos")
    .select("id")
    .eq("pedido_id", pedidoId)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Create NPS response record (fire-and-forget).
 */
export async function createNpsResposta(pedidoId: string, clienteId: string): Promise<void> {
  await supabase.from("nps_respostas").insert({
    pedido_id: pedidoId,
    cliente_id: clienteId,
  });
}
