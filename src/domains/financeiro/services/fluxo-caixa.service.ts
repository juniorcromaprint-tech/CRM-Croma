import { supabase } from '@/integrations/supabase/client';
import type { FluxoCaixaDia, FluxoCaixaAcumulado } from '../types/motor-financeiro.types';

/**
 * Queries the v_fluxo_caixa_projetado view and returns accumulated cash flow.
 */
export async function listarFluxoCaixaProjetado(dias = 90): Promise<FluxoCaixaAcumulado[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteISO = limite.toISOString().split('T')[0];

  const { data, error } = await (supabase
    .from('v_fluxo_caixa_projetado' as any)
    .select('data, valor, tipo')
    .lte('data', limiteISO)
    .order('data', { ascending: true }));

  if (error) throw error;

  return calcularAcumulado((data ?? []) as FluxoCaixaDia[]);
}

/**
 * Pure function: groups items by day and calculates running saldo_acumulado.
 */
export function calcularAcumulado(items: FluxoCaixaDia[]): FluxoCaixaAcumulado[] {
  const byDay = new Map<string, { entradas: number; saidas: number }>();

  for (const item of items) {
    const existing = byDay.get(item.data) ?? { entradas: 0, saidas: 0 };
    if (item.tipo === 'entrada') {
      existing.entradas += item.valor;
    } else {
      existing.saidas += item.valor;
    }
    byDay.set(item.data, existing);
  }

  const result: FluxoCaixaAcumulado[] = [];
  let acumulado = 0;

  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [data, { entradas, saidas }] of sortedDays) {
    const saldoDia = entradas - saidas;
    acumulado += saldoDia;
    result.push({
      data,
      entradas,
      saidas,
      saldo_dia: saldoDia,
      saldo_acumulado: acumulado,
    });
  }

  return result;
}

/**
 * Returns realized balance: sum of CR paid minus CP paid.
 */
export async function saldoRealizado(): Promise<number> {
  const { data: crData, error: crError } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago');

  if (crError) throw crError;

  const { data: cpData, error: cpError } = await supabase
    .from('contas_pagar')
    .select('valor_pago')
    .eq('status', 'pago');

  if (cpError) throw cpError;

  const totalCR = (crData ?? []).reduce((sum, r) => sum + (r.valor_pago ?? 0), 0);
  const totalCP = (cpData ?? []).reduce((sum, r) => sum + (r.valor_pago ?? 0), 0);

  return totalCR - totalCP;
}
