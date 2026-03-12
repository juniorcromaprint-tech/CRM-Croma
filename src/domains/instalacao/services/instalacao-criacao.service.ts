import { supabase } from '@/integrations/supabase/client';

function generateOsNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `OS-${year}-${seq}`;
}

/**
 * Cria uma Ordem de Serviço de Instalação a partir de uma Ordem de Produção liberada.
 * Chamado automaticamente quando todas as etapas de produção são concluídas.
 */
export async function criarOrdemInstalacao(opId: string): Promise<void> {
  // Fetch OP with pedido and cliente info
  const { data: op, error: opError } = await supabase
    .from('ordens_producao')
    .select('pedido_id, pedido_item_id')
    .eq('id', opId)
    .single();

  if (opError || !op) throw new Error(`OP não encontrada: ${opError?.message}`);

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, cliente_id')
    .eq('id', op.pedido_id)
    .single();

  if (pedidoError || !pedido) throw new Error(`Pedido não encontrado: ${pedidoError?.message}`);

  const { error: osError } = await supabase.from('ordens_instalacao').insert({
    numero: generateOsNumero(),
    pedido_id: pedido.id,
    pedido_item_id: op.pedido_item_id ?? null,
    cliente_id: pedido.cliente_id,
    status: 'aguardando_agendamento',
  });

  if (osError) throw new Error(`Erro ao criar OS: ${osError.message}`);
}
