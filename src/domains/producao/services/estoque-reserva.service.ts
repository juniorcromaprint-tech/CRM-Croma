// ============================================================================
// ESTOQUE RESERVA SERVICE — Croma Print ERP/CRM
// Reserva e liberação de materiais por Ordem de Produção
// Uses movement-based stock tracking (estoque_movimentacoes)
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

export interface MaterialReserva {
  material_id: string;
  quantidade: number;
}

export interface MaterialInsuficiente {
  material_id: string;
  nome: string;
  disponivel: number;
  necessario: number;
  unidade: string;
}

export class EstoqueInsuficienteError extends Error {
  constructor(public readonly materiais: MaterialInsuficiente[]) {
    const nomes = materiais.map((m) => m.nome).join(', ');
    super(`Estoque insuficiente para: ${nomes}`);
    this.name = 'EstoqueInsuficienteError';
  }
}

/**
 * Reserva materiais para uma Ordem de Produção.
 *
 * 1. Verifica saldo disponível via vw_estoque_disponivel para cada material.
 * 2. Se qualquer material estiver insuficiente, lança EstoqueInsuficienteError
 *    com a lista completa de faltantes — nenhuma reserva é criada.
 * 3. Caso contrário, insere registros em estoque_reservas_op e registra
 *    movimentos do tipo 'reserva' em estoque_movimentacoes.
 */
export async function reservarMateriais(
  ordemProducaoId: string,
  materiais: MaterialReserva[],
): Promise<void> {
  if (!materiais.length) return;

  const materialIds = materiais.map((m) => m.material_id);

  // Buscar saldo disponível via view (movement-based tracking)
  const { data: saldos, error: saldosErr } = await (supabase as any)
    .from('vw_estoque_disponivel')
    .select('material_id, nome, unidade, disponivel')
    .in('material_id', materialIds);

  if (saldosErr) throw new Error(`Erro ao consultar estoque: ${saldosErr.message}`);

  const saldoMap: Record<string, { nome: string; disponivel: number; unidade: string }> = {};
  for (const s of saldos ?? []) {
    saldoMap[s.material_id] = {
      nome: s.nome,
      disponivel: Number(s.disponivel),
      unidade: s.unidade,
    };
  }

  // Verificar suficiência
  const faltantes: MaterialInsuficiente[] = [];
  for (const req of materiais) {
    const s = saldoMap[req.material_id];
    if (!s) continue;
    if (s.disponivel < req.quantidade) {
      faltantes.push({
        material_id: req.material_id,
        nome: s.nome,
        disponivel: s.disponivel,
        necessario: req.quantidade,
        unidade: s.unidade,
      });
    }
  }

  if (faltantes.length > 0) {
    throw new EstoqueInsuficienteError(faltantes);
  }

  // Inserir reservas na tabela estoque_reservas_op
  const reservasPayload = materiais.map((m) => ({
    ordem_producao_id: ordemProducaoId,
    material_id: m.material_id,
    quantidade_reservada: m.quantidade,
  }));

  const { error: insertErr } = await (supabase as any)
    .from('estoque_reservas_op')
    .insert(reservasPayload);

  if (insertErr) throw new Error(`Erro ao registrar reservas: ${insertErr.message}`);

  // Registrar movimentos tipo 'reserva' para atualizar saldo na view
  const movimentos = materiais.map((m) => ({
    material_id: m.material_id,
    tipo: 'reserva',
    quantidade: m.quantidade,
    referencia_tipo: 'ordem_producao',
    referencia_id: ordemProducaoId,
    motivo: `Reserva automática para OP`,
  }));

  const { error: movErr } = await (supabase as any)
    .from('estoque_movimentacoes')
    .insert(movimentos);

  if (movErr) throw new Error(`Erro ao registrar movimentos: ${movErr.message}`);
}

/**
 * Libera todas as reservas ativas de uma OP (ex: cancelamento).
 * Registra movimentos de liberação para restaurar o saldo.
 */
export async function liberarReserva(ordemProducaoId: string): Promise<void> {
  const { data: reservas, error: fetchErr } = await (supabase as any)
    .from('estoque_reservas_op')
    .select('id, material_id, quantidade_reservada')
    .eq('ordem_producao_id', ordemProducaoId)
    .is('liberado_em', null);

  if (fetchErr) throw new Error(`Erro ao buscar reservas: ${fetchErr.message}`);
  if (!reservas || reservas.length === 0) return;

  // Marcar reservas como liberadas
  const { error: updateErr } = await (supabase as any)
    .from('estoque_reservas_op')
    .update({ liberado_em: new Date().toISOString() })
    .eq('ordem_producao_id', ordemProducaoId)
    .is('liberado_em', null);

  if (updateErr) throw new Error(`Erro ao liberar reservas: ${updateErr.message}`);

  // Registrar movimentos de liberacao_reserva para restaurar saldo
  const movimentos = reservas.map((r: { material_id: string; quantidade_reservada: number }) => ({
    material_id: r.material_id,
    tipo: 'liberacao_reserva',
    quantidade: r.quantidade_reservada,
    referencia_tipo: 'ordem_producao',
    referencia_id: ordemProducaoId,
    motivo: `Liberação de reserva por cancelamento da OP`,
  }));

  const { error: movErr } = await (supabase as any)
    .from('estoque_movimentacoes')
    .insert(movimentos);

  if (movErr) throw new Error(`Erro ao registrar liberação: ${movErr.message}`);
}
