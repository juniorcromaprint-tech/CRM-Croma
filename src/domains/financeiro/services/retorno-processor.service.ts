// ─── Retorno Processor ───────────────────────────────────────────────────────
// Croma Print ERP — Processa arquivo de retorno CNAB 400 e baixa boletos
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';
import { parseRetornoFile, RetornoParseado, RetornoDetalhe } from './cnab400-retorno.service';

export interface ProcessamentoResult {
  total: number;
  baixados: number;
  naoEncontrados: string[];
  erros: string[];
}

export async function processarRetorno(fileContent: string): Promise<ProcessamentoResult> {
  const retorno = parseRetornoFile(fileContent);
  const result: ProcessamentoResult = {
    total: retorno.liquidacoes.length,
    baixados: 0,
    naoEncontrados: [],
    erros: [],
  };

  for (const liquidacao of retorno.liquidacoes) {
    try {
      await processarLiquidacao(liquidacao, result);
    } catch (err) {
      result.erros.push(`${liquidacao.nossoNumero}: ${(err as Error).message}`);
    }
  }

  await salvarRetorno(retorno, result);
  return result;
}

async function processarLiquidacao(
  liquidacao: RetornoDetalhe,
  result: ProcessamentoResult
): Promise<void> {
  // Busca boleto pelo nosso_numero — aceita qualquer status ativo (não pago/cancelado)
  const { data: boleto, error: bErr } = await supabase
    .from('bank_slips')
    .select('id, conta_receber_id, status')
    .eq('nosso_numero', liquidacao.nossoNumero)
    .not('status', 'in', '("pago","cancelado")')
    .maybeSingle();

  if (bErr) throw bErr;
  if (!boleto) {
    result.naoEncontrados.push(liquidacao.nossoNumero);
    return;
  }

  const { error: updateErr } = await supabase
    .from('bank_slips')
    .update({
      status: 'pago',
      data_pagamento:
        liquidacao.dataPagamento?.toISOString().split('T')[0] ??
        new Date().toISOString().split('T')[0],
      valor_pago: liquidacao.valorPago,
    })
    .eq('id', boleto.id);

  if (updateErr) throw updateErr;

  if (boleto.conta_receber_id) {
    const { error: contaErr } = await supabase
      .from('contas_receber')
      .update({
        status: 'quitado',
        data_recebimento:
          liquidacao.dataCredito?.toISOString().split('T')[0] ??
          liquidacao.dataPagamento?.toISOString().split('T')[0],
      })
      .eq('id', boleto.conta_receber_id);

    if (contaErr) throw contaErr;
  }

  result.baixados++;
}

async function salvarRetorno(
  retorno: RetornoParseado,
  result: ProcessamentoResult
): Promise<void> {
  // Silently ignore if table doesn't exist yet (migration may not be applied)
  try {
    await supabase.from('retornos_bancarios').insert({
      banco: retorno.header.nomeBanco,
      data_arquivo: new Date().toISOString(),
      total_registros: retorno.detalhes.length,
      total_liquidacoes: result.baixados,
      total_nao_encontrados: result.naoEncontrados.length,
      total_erros: result.erros.length,
      valor_total: retorno.trailer.valorTotal,
    });
  } catch (_) {
    // Non-critical: don't block processing if table doesn't exist yet
  }
}
