// src/domains/contabilidade/services/lancamento.service.ts

import { supabase } from '@/integrations/supabase/client';
import type { LancamentoContabil, OrigemTipo } from '../types/contabilidade.types';

interface CreateLancamentoInput {
  data_lancamento: string;
  data_competencia: string;
  conta_debito_id: string;
  conta_credito_id: string;
  valor: number;
  historico: string;
  origem_tipo: OrigemTipo;
  origem_id?: string;
  centro_custo_id?: string;
}

export async function createLancamento(input: CreateLancamentoInput) {
  const { data, error } = await supabase
    .from('lancamentos_contabeis')
    .insert({
      data_lancamento: input.data_lancamento,
      data_competencia: input.data_competencia,
      conta_debito_id: input.conta_debito_id,
      conta_credito_id: input.conta_credito_id,
      valor: input.valor,
      historico: input.historico,
      origem_tipo: input.origem_tipo,
      origem_id: input.origem_id || null,
      centro_custo_id: input.centro_custo_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createLancamentosBatch(inputs: CreateLancamentoInput[]) {
  const { data, error } = await supabase
    .from('lancamentos_contabeis')
    .insert(inputs.map(i => ({
      data_lancamento: i.data_lancamento,
      data_competencia: i.data_competencia,
      conta_debito_id: i.conta_debito_id,
      conta_credito_id: i.conta_credito_id,
      valor: i.valor,
      historico: i.historico,
      origem_tipo: i.origem_tipo,
      origem_id: i.origem_id || null,
      centro_custo_id: i.centro_custo_id || null,
    })))
    .select();

  if (error) throw error;
  return data;
}

export async function fetchLancamentos(filters: {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  origemTipo?: OrigemTipo;
  page?: number;
  pageSize?: number;
}) {
  const { dataInicio, dataFim, contaId, origemTipo, page = 1, pageSize = 50 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('lancamentos_contabeis')
    .select(`
      *,
      conta_debito:plano_contas!lancamentos_contabeis_conta_debito_id_fkey(codigo, nome),
      conta_credito:plano_contas!lancamentos_contabeis_conta_credito_id_fkey(codigo, nome),
      centro_custo:centros_custo(codigo, nome)
    `, { count: 'exact' })
    .order('data_lancamento', { ascending: false })
    .range(from, to);

  if (dataInicio) query = query.gte('data_competencia', dataInicio);
  if (dataFim) query = query.lte('data_competencia', dataFim);
  if (contaId) query = query.or(`conta_debito_id.eq.${contaId},conta_credito_id.eq.${contaId}`);
  if (origemTipo) query = query.eq('origem_tipo', origemTipo);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as LancamentoContabil[], count: count || 0 };
}

// Buscar contas analíticas do plano para selects
export async function fetchContasAnaliticas() {
  const { data, error } = await supabase
    .from('plano_contas')
    .select('id, codigo, nome, tipo')
    .eq('natureza', 'analitica')
    .eq('ativo', true)
    .order('codigo');

  if (error) throw error;
  return data;
}

// Buscar balancete (via view v_balancete)
export async function fetchBalancete(dataInicio?: string, dataFim?: string) {
  let query = supabase
    .from('v_balancete')
    .select('*')
    .order('codigo');

  if (dataInicio) query = query.gte('data_competencia', dataInicio);
  if (dataFim) query = query.lte('data_competencia', dataFim);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Buscar razão de uma conta específica
export async function fetchRazaoConta(contaId: string, dataInicio?: string, dataFim?: string) {
  let query = supabase
    .from('lancamentos_contabeis')
    .select(`
      id,
      data_lancamento,
      historico,
      valor,
      conta_debito_id,
      conta_credito_id
    `)
    .or(`conta_debito_id.eq.${contaId},conta_credito_id.eq.${contaId}`)
    .order('data_lancamento', { ascending: true });

  if (dataInicio) query = query.gte('data_competencia', dataInicio);
  if (dataFim) query = query.lte('data_competencia', dataFim);

  const { data, error } = await query;
  if (error) throw error;

  // Calcular saldo acumulado
  let saldo = 0;
  return (data || []).map(l => {
    const debito = l.conta_debito_id === contaId ? l.valor : 0;
    const credito = l.conta_credito_id === contaId ? l.valor : 0;
    saldo += debito - credito;
    return {
      id: l.id,
      data_lancamento: l.data_lancamento,
      historico: l.historico,
      debito,
      credito,
      saldo_acumulado: saldo,
    };
  });
}
