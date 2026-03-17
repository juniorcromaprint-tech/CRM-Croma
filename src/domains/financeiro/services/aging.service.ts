import { supabase } from '@/integrations/supabase/client';
import type { AgingComCliente, AgingResumo } from '../types/motor-financeiro.types';

/**
 * Queries v_aging_receber view and joins with clientes for display names.
 */
export async function listarAgingPorCliente(): Promise<AgingComCliente[]> {
  const { data, error } = await (supabase
    .from('v_aging_receber' as any)
    .select('*'));

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    cliente_id: string;
    a_vencer: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_mais: number;
    total_aberto: number;
    maior_atraso: number;
  }>;

  if (rows.length === 0) return [];

  const clienteIds = rows.map((r) => r.cliente_id);

  const { data: clientes, error: cliError } = await supabase
    .from('clientes')
    .select('id, nome_fantasia, razao_social')
    .in('id', clienteIds);

  if (cliError) throw cliError;

  const clienteMap = new Map(
    (clientes ?? []).map((c) => [c.id, c])
  );

  return rows.map((row) => {
    const cliente = clienteMap.get(row.cliente_id);
    return {
      ...row,
      nome_fantasia: cliente?.nome_fantasia ?? 'Desconhecido',
      razao_social: cliente?.razao_social ?? null,
    };
  });
}

/**
 * Pure function: sums all aging buckets into a single summary.
 */
export function calcularResumoAging(items: AgingComCliente[]): AgingResumo {
  const resumo: AgingResumo = {
    a_vencer: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_mais: 0,
    total: 0,
  };

  for (const item of items) {
    resumo.a_vencer += item.a_vencer;
    resumo.d1_30 += item.d1_30;
    resumo.d31_60 += item.d31_60;
    resumo.d61_90 += item.d61_90;
    resumo.d90_mais += item.d90_mais;
    resumo.total += item.total_aberto;
  }

  return resumo;
}
