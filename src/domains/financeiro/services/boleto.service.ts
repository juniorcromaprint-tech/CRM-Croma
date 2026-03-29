// ─── Boleto Service ─────────────────────────────────────────────────────────
// Croma Print ERP — CRUD + lifecycle de boletos
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';
import type {
  BankSlip,
  BankSlipCreate,
  BankSlipUpdate,
  BoletoStatus,
} from '../types/boleto.types';

// ─── Nosso Número ────────────────────────────────────────────────────────────

/** Gera próximo nosso_numero atomicamente via RPC */
export async function gerarNossoNumero(bankAccountId: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_nosso_numero', {
    p_bank_account_id: bankAccountId,
  });
  if (error) throw new Error(`Erro ao gerar nosso número: ${error.message}`);
  return data as string;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createBoleto(payload: BankSlipCreate): Promise<BankSlip> {
  // Verificar duplicidade: não permitir novo boleto se já existe um ativo para a mesma conta a receber
  if (payload.conta_receber_id) {
    const { data: boletosExistentes } = await supabase
      .from('bank_slips')
      .select('id, status')
      .eq('conta_receber_id', payload.conta_receber_id)
      .in('status', ['rascunho', 'emitido', 'pronto_remessa', 'remetido', 'registrado']);

    if (boletosExistentes && boletosExistentes.length > 0) {
      throw new Error(
        'Já existe um boleto ativo para esta cobrança. Cancele o anterior antes de gerar um novo.'
      );
    }
  }

  // Gera nosso_numero automaticamente
  const nossoNumero = await gerarNossoNumero(payload.bank_account_id);

  const { data, error } = await supabase
    .from('bank_slips')
    .insert({
      ...payload,
      nosso_numero: nossoNumero,
      status: 'rascunho' as BoletoStatus,
      data_emissao: new Date().toISOString().split('T')[0],
    })
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar boleto: ${error.message}`);
  return data as BankSlip;
}

export async function updateBoleto(payload: BankSlipUpdate): Promise<BankSlip> {
  const { id, ...rest } = payload;
  const { data, error } = await supabase
    .from('bank_slips')
    .update(rest)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao atualizar boleto: ${error.message}`);
  return data as BankSlip;
}

// ─── Transições de Status ────────────────────────────────────────────────────

async function transitionStatus(
  id: string,
  from: BoletoStatus | BoletoStatus[],
  to: BoletoStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  // Verifica status atual
  const { data: current, error: fetchError } = await supabase
    .from('bank_slips')
    .select('status')
    .eq('id', id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const allowed = Array.isArray(from) ? from : [from];
  if (!allowed.includes(current.status as BoletoStatus)) {
    throw new Error(
      `Boleto está com status "${current.status}". Esperado: ${allowed.join(' ou ')}.`,
    );
  }

  const { data: updated, error } = await supabase
    .from('bank_slips')
    .update({ status: to, ...extra })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  if (!updated) throw new Error('Falha ao atualizar status do boleto — verifique suas permissões.');
}

/** rascunho → emitido */
export async function emitirBoleto(id: string): Promise<void> {
  await transitionStatus(id, 'rascunho', 'emitido');
}

/** emitido → pronto_remessa (batch) */
export async function marcarProntoRemessa(ids: string[]): Promise<void> {
  // Valida que todos estão emitidos
  const { data, error } = await supabase
    .from('bank_slips')
    .select('id, status')
    .in('id', ids);

  if (error) throw new Error(error.message);

  const invalidos = (data ?? []).filter((s) => s.status !== 'emitido');
  if (invalidos.length > 0) {
    throw new Error(
      `${invalidos.length} boleto(s) não estão com status "emitido". Verifique antes de marcar.`,
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('bank_slips')
    .update({ status: 'pronto_remessa' })
    .in('id', ids)
    .select('id');

  if (updateError) throw new Error(updateError.message);
}

/** Cancelar boleto (qualquer status exceto pago/remetido/registrado) */
export async function cancelBoleto(id: string): Promise<void> {
  await transitionStatus(
    id,
    ['rascunho', 'emitido', 'pronto_remessa'],
    'cancelado',
  );
}

/** Marca boletos como remetidos (chamado pelo remessa.service) */
export async function marcarRemetidos(
  ids: string[],
): Promise<void> {
  const { data: updated, error } = await supabase
    .from('bank_slips')
    .update({ status: 'remetido' })
    .in('id', ids)
    .select('id');

  if (error) throw new Error(error.message);
}
