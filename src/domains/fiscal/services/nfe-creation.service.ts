import { supabase } from '@/integrations/supabase/client';

/**
 * Cria um documento fiscal (NF-e rascunho) a partir de um pedido.
 * O documento fica em status 'rascunho' aguardando configuração fiscal completa.
 */
export async function criarNFeFromPedido(pedidoId: string): Promise<string> {
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, cliente_id, valor_total')
    .eq('id', pedidoId)
    .single();

  if (pedidoError || !pedido) {
    throw new Error(`Pedido não encontrado: ${pedidoError?.message}`);
  }

  const { data, error } = await supabase
    .from('fiscal_documentos')
    .insert({
      pedido_id: pedido.id,
      cliente_id: pedido.cliente_id,
      tipo_documento: 'nfe',
      provider: 'manual',
      status: 'rascunho',
      valor_total: pedido.valor_total ?? 0,
      valor_produtos: pedido.valor_total ?? 0,
      natureza_operacao: 'Venda de mercadorias',
      finalidade_emissao: 'Normal',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Erro ao criar NF-e: ${error.message}`);
  return data.id;
}
