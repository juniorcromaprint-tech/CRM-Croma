import { supabase } from '@/integrations/supabase/client';
import type { DREReal } from '../types/motor-financeiro.types';

/**
 * Calculates a simplified DRE (Demonstração do Resultado do Exercício)
 * using real data from contas_receber, pedido_itens, and contas_pagar.
 */
export async function calcularDRE(dataInicio: string, dataFim: string): Promise<DREReal> {
  // 1. Receita bruta: sum of valor_pago from CR paid in the period
  const { data: crData, error: crError } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim);

  if (crError) throw crError;

  const receitaBruta = (crData ?? []).reduce((sum, r) => sum + (r.valor_pago ?? 0), 0);

  // 2. CME: sum of custo_total from pedido_itens for pedidos concluded in the period
  const { data: pedidosData, error: pedidosError } = await supabase
    .from('pedidos')
    .select('id')
    .eq('status', 'concluido')
    .gte('updated_at', dataInicio)
    .lte('updated_at', dataFim);

  if (pedidosError) throw pedidosError;

  let cme = 0;
  const pedidoIds = (pedidosData ?? []).map((p) => p.id);

  if (pedidoIds.length > 0) {
    const { data: itensData, error: itensError } = await supabase
      .from('pedido_itens')
      .select('custo_total')
      .in('pedido_id', pedidoIds);

    if (itensError) throw itensError;

    cme = (itensData ?? []).reduce((sum, i) => sum + (i.custo_total ?? 0), 0);
  }

  // 3. Despesas: sum of valor_pago from CP paid by category
  const { data: cpData, error: cpError } = await supabase
    .from('contas_pagar')
    .select('valor_pago, categoria')
    .eq('status', 'pago')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim);

  if (cpError) throw cpError;

  let despesasComerciais = 0;
  let despesasAdministrativas = 0;
  let despesasPessoal = 0;

  for (const cp of cpData ?? []) {
    const valor = cp.valor_pago ?? 0;
    const cat = (cp.categoria ?? '').toLowerCase();

    if (cat.includes('comercial') || cat.includes('vendas') || cat.includes('marketing')) {
      despesasComerciais += valor;
    } else if (cat.includes('pessoal') || cat.includes('salario') || cat.includes('folha')) {
      despesasPessoal += valor;
    } else {
      despesasAdministrativas += valor;
    }
  }

  // 4. Calculate derived values
  const deducoes = 0; // No tax deductions tracked yet
  const receitaLiquida = receitaBruta - deducoes;
  const lucroBruto = receitaLiquida - cme;
  const totalDespesas = despesasComerciais + despesasAdministrativas + despesasPessoal;
  const ebitda = lucroBruto - totalDespesas;

  const margemBrutaPct = receitaLiquida > 0
    ? (lucroBruto / receitaLiquida) * 100
    : 0;

  const margemEbitdaPct = receitaLiquida > 0
    ? (ebitda / receitaLiquida) * 100
    : 0;

  return {
    periodo: `${dataInicio} a ${dataFim}`,
    receita_bruta: receitaBruta,
    deducoes,
    receita_liquida: receitaLiquida,
    cme,
    lucro_bruto: lucroBruto,
    despesas_comerciais: despesasComerciais,
    despesas_administrativas: despesasAdministrativas,
    despesas_pessoal: despesasPessoal,
    ebitda,
    margem_bruta_pct: Math.round(margemBrutaPct * 100) / 100,
    margem_ebitda_pct: Math.round(margemEbitdaPct * 100) / 100,
  };
}
