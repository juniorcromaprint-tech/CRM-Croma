import { supabase } from '@/integrations/supabase/client';

/**
 * Gera um registro de Conta a Receber ao concluir um pedido.
 * Chamado automaticamente quando o pedido avança para status "concluido".
 */
export async function gerarContasReceber(pedidoId: string): Promise<void> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, cliente_id, valor_total, numero')
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) throw new Error(`Pedido não encontrado: ${error?.message}`);

  // Vencimento padrão: 30 dias a partir de hoje
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 30);

  const { error: crError } = await supabase.from('contas_receber').insert({
    pedido_id: pedido.id,
    cliente_id: pedido.cliente_id,
    valor_original: pedido.valor_total ?? 0,
    valor_pago: 0,
    saldo: pedido.valor_total ?? 0,
    data_vencimento: vencimento.toISOString().split('T')[0],
    status: 'pendente',
    forma_pagamento: 'a_definir',
    descricao: `Pedido ${pedido.numero}`,
  });

  if (crError) throw new Error(`Erro ao gerar conta a receber: ${crError.message}`);
}
