// ─── Remessa Service ────────────────────────────────────────────────────────
// Croma Print ERP — Gestão de lotes de remessa CNAB 400
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';
import type {
  BankAccount,
  BankRemittance,
  BankSlipWithClient,
} from '../types/boleto.types';
import { generateRemessaFile, downloadRemessaFile } from './cnab400-itau.service';
import { marcarRemetidos } from './boleto.service';

// ─── Gerar Remessa ───────────────────────────────────────────────────────────

export interface GerarRemessaResult {
  remittance: BankRemittance;
  fileContent: string;
  filename: string;
}

/**
 * Gera um lote de remessa CNAB 400:
 * 1. Busca conta bancária
 * 2. Busca e valida boletos (status = pronto_remessa)
 * 3. Gera arquivo CNAB 400
 * 4. Insere bank_remittances + bank_remittance_items
 * 5. Atualiza boletos para status "remetido"
 */
export async function gerarRemessa(
  bankAccountId: string,
  slipIds: string[],
): Promise<GerarRemessaResult> {
  if (slipIds.length === 0) {
    throw new Error('Selecione ao menos um boleto para gerar a remessa.');
  }

  // 1. Busca conta bancária
  const { data: account, error: accError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .single();

  if (accError || !account) {
    throw new Error('Conta bancária não encontrada.');
  }

  // 2. Busca boletos com dados do cliente
  const { data: slips, error: slipError } = await supabase
    .from('bank_slips')
    .select('*, clientes(nome_fantasia, razao_social)')
    .in('id', slipIds)
    .eq('status', 'pronto_remessa');

  if (slipError) throw new Error(`Erro ao buscar boletos: ${slipError.message}`);

  if (!slips || slips.length === 0) {
    throw new Error('Nenhum boleto com status "pronto_remessa" encontrado.');
  }

  if (slips.length !== slipIds.length) {
    const found = slips.length;
    const expected = slipIds.length;
    throw new Error(
      `Apenas ${found} de ${expected} boletos estão prontos para remessa. Verifique os status.`,
    );
  }

  // 3. Determina número sequencial da remessa
  const { data: lastRemessa } = await supabase
    .from('bank_remittances')
    .select('numero_sequencial')
    .eq('bank_account_id', bankAccountId)
    .order('numero_sequencial', { ascending: false })
    .limit(1)
    .single();

  const sequencial = (lastRemessa?.numero_sequencial ?? 0) + 1;

  // 4. Gera arquivo CNAB 400
  const typedAccount = account as unknown as BankAccount;
  const typedSlips = slips as unknown as BankSlipWithClient[];
  const result = generateRemessaFile(typedAccount, typedSlips, sequencial);

  // 5. Obtém user_id atual
  const { data: { user } } = await supabase.auth.getUser();

  // 6. Insere remessa
  const { data: remittance, error: remError } = await supabase
    .from('bank_remittances')
    .insert({
      bank_account_id: bankAccountId,
      numero_sequencial: sequencial,
      arquivo_nome: result.filename,
      total_registros: result.totalRegistros,
      valor_total: result.valorTotal,
      status: 'gerado',
      conteudo_arquivo: result.content,
      gerado_por: user?.id ?? null,
    })
    .select('*')
    .single();

  if (remError) throw new Error(`Erro ao salvar remessa: ${remError.message}`);

  // 7. Insere itens da remessa (um por boleto)
  const items = typedSlips.map((slip, i) => ({
    remittance_id: remittance.id,
    bank_slip_id: slip.id,
    linha_numero: i + 2, // header é linha 1
  }));

  const { error: itemsError } = await supabase
    .from('bank_remittance_items')
    .insert(items);

  if (itemsError) {
    console.error('Erro ao salvar itens da remessa:', itemsError);
  }

  // 8. Atualiza boletos para "remetido"
  await marcarRemetidos(slipIds);

  return {
    remittance: remittance as unknown as BankRemittance,
    fileContent: result.content,
    filename: result.filename,
  };
}

// ─── Download ────────────────────────────────────────────────────────────────

/** Busca conteúdo do arquivo e faz download */
export async function baixarRemessa(remittanceId: string): Promise<void> {
  const { data, error } = await supabase
    .from('bank_remittances')
    .select('conteudo_arquivo, arquivo_nome')
    .eq('id', remittanceId)
    .single();

  if (error || !data?.conteudo_arquivo) {
    throw new Error('Arquivo de remessa não encontrado.');
  }

  downloadRemessaFile(data.conteudo_arquivo, data.arquivo_nome);

  // Marca como baixado se ainda estiver como "gerado"
  await supabase
    .from('bank_remittances')
    .update({ status: 'baixado', updated_at: new Date().toISOString() })
    .eq('id', remittanceId)
    .eq('status', 'gerado');
}

// ─── Transições de Status ────────────────────────────────────────────────────

export async function marcarRemessaEnviada(remittanceId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_remittances')
    .update({
      status: 'enviado',
      enviado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', remittanceId);

  if (error) throw new Error(error.message);
}

export async function marcarRemessaProcessada(remittanceId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_remittances')
    .update({
      status: 'processado',
      processado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', remittanceId);

  if (error) throw new Error(error.message);
}

export async function marcarRemessaErro(
  remittanceId: string,
  descricao: string,
): Promise<void> {
  const { error } = await supabase
    .from('bank_remittances')
    .update({
      status: 'erro',
      erro_descricao: descricao,
      updated_at: new Date().toISOString(),
    })
    .eq('id', remittanceId);

  if (error) throw new Error(error.message);
}
