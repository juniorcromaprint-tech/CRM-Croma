// src/domains/contabilidade/services/extrato-bancario.service.ts

import { supabase } from '@/integrations/supabase/client';
import { parseOFX, formatOFXDate, type OFXTransaction } from './ofx-parser.service';
import type { ExtratoImportacao, ExtratoItem } from '../types/contabilidade.types';

export async function importarOFX(file: File): Promise<{ importacao: ExtratoImportacao; itens: ExtratoItem[] }> {
  const content = await file.text();
  const result = parseOFX(content);

  // 1. Criar registro de importação
  const { data: importacao, error: impError } = await supabase
    .from('extrato_bancario_importacoes')
    .insert({
      banco: result.bankId || 'Itaú',
      conta: result.acctId,
      arquivo_nome: file.name,
      formato: 'ofx',
      data_inicio: result.dtStart,
      data_fim: result.dtEnd,
      total_registros: result.transactions.length,
      status: 'importado',
    })
    .select()
    .single();

  if (impError) throw impError;

  // 2. Inserir itens
  const itensToInsert = result.transactions.map((trn: OFXTransaction) => ({
    importacao_id: importacao.id,
    data: formatOFXDate(trn.dtposted),
    descricao_original: trn.memo,
    valor: trn.trnamt,
    tipo: trn.trnamt >= 0 ? 'credito' as const : 'debito' as const,
  }));

  const { data: itens, error: itensError } = await supabase
    .from('extrato_bancario_itens')
    .insert(itensToInsert)
    .select();

  if (itensError) throw itensError;

  return { importacao: importacao as ExtratoImportacao, itens: itens as ExtratoItem[] };
}

export async function fetchImportacoes() {
  const { data, error } = await supabase
    .from('extrato_bancario_importacoes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ExtratoImportacao[];
}

export async function fetchExtratoItens(importacaoId: string) {
  const { data, error } = await supabase
    .from('extrato_bancario_itens')
    .select(`
      *,
      conta_plano:plano_contas(codigo, nome)
    `)
    .eq('importacao_id', importacaoId)
    .order('data', { ascending: true });

  if (error) throw error;
  return data as ExtratoItem[];
}

export async function classificarItem(itemId: string, contaPlanoId: string, centroCustoId?: string) {
  const { error } = await supabase
    .from('extrato_bancario_itens')
    .update({
      conta_plano_id: contaPlanoId,
      centro_custo_id: centroCustoId || null,
      classificado_por: 'usuario',
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function ignorarItem(itemId: string) {
  const { error } = await supabase
    .from('extrato_bancario_itens')
    .update({ ignorado: true })
    .eq('id', itemId);

  if (error) throw error;
}

export async function gerarLancamentosFromExtrato(importacaoId: string) {
  // Buscar itens classificados e não ignorados
  const { data: itens, error } = await supabase
    .from('extrato_bancario_itens')
    .select('*')
    .eq('importacao_id', importacaoId)
    .eq('ignorado', false)
    .not('conta_plano_id', 'is', null)
    .is('lancamento_id', null);

  if (error) throw error;
  if (!itens || itens.length === 0) return [];

  // Buscar conta do banco Itaú
  const { data: contaBanco } = await supabase
    .from('plano_contas')
    .select('id')
    .eq('codigo', '1.1.02')
    .single();

  if (!contaBanco) throw new Error('Conta "1.1.02 Banco Itaú" não encontrada no plano de contas');

  // Gerar lançamentos
  const lancamentos = itens.map(item => {
    const isCredito = item.valor >= 0;
    const valorAbs = Math.abs(item.valor);

    return {
      data_lancamento: item.data,
      data_competencia: item.data.substring(0, 7) + '-01', // primeiro dia do mês
      conta_debito_id: isCredito ? contaBanco.id : item.conta_plano_id!,
      conta_credito_id: isCredito ? item.conta_plano_id! : contaBanco.id,
      valor: valorAbs,
      historico: `Extrato: ${item.descricao_original}`,
      origem_tipo: 'extrato' as const,
      origem_id: item.id,
      centro_custo_id: item.centro_custo_id,
    };
  });

  const { data: created, error: createError } = await supabase
    .from('lancamentos_contabeis')
    .insert(lancamentos)
    .select();

  if (createError) throw createError;

  // Atualizar itens com lancamento_id
  for (let i = 0; i < itens.length; i++) {
    if (created[i]) {
      await supabase
        .from('extrato_bancario_itens')
        .update({ lancamento_id: created[i].id })
        .eq('id', itens[i].id);
    }
  }

  // Atualizar status da importação
  await supabase
    .from('extrato_bancario_importacoes')
    .update({ status: 'lancado' })
    .eq('id', importacaoId);

  return created;
}
