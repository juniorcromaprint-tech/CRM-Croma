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

/**
 * Gera parcelas detalhadas em parcelas_receber com base nas condições de pagamento da proposta.
 * Chamado após gerarContasReceber quando o pedido avança para "concluido".
 */
export async function gerarParcelas(pedidoId: string): Promise<void> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, valor_total, proposta_id, propostas(forma_pagamento, parcelas_count, prazo_dias, entrada_percentual)')
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) throw new Error('Pedido não encontrado');

  const proposta = (pedido as any).propostas;
  if (!proposta?.forma_pagamento) return;

  const { data: conta } = await supabase
    .from('contas_receber')
    .select('id')
    .eq('pedido_id', pedidoId)
    .single();

  if (!conta) return;

  const valorTotal: number = pedido.valor_total ?? 0;
  const forma: string = proposta.forma_pagamento;
  const parcelas: { conta_receber_id: string; numero: number; valor: number; data_vencimento: string; status: string }[] = [];

  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const hoje = new Date();

  if (forma === 'pix' || forma === 'boleto_vista') {
    parcelas.push({ conta_receber_id: conta.id, numero: 1, valor: valorTotal, data_vencimento: addDays(hoje, 1), status: 'pendente' });
  } else if (forma === 'boleto_parcelado' || forma === 'cartao') {
    const n: number = proposta.parcelas_count ?? 2;
    const valorParcela = Math.round((valorTotal / n) * 100) / 100;
    for (let i = 0; i < n; i++) {
      parcelas.push({ conta_receber_id: conta.id, numero: i + 1, valor: valorParcela, data_vencimento: addDays(hoje, 30 * (i + 1)), status: 'pendente' });
    }
  } else if (forma === 'entrada_parcelas') {
    const entradaPct: number = proposta.entrada_percentual ?? 30;
    const entrada = Math.round(valorTotal * (entradaPct / 100) * 100) / 100;
    const restante = valorTotal - entrada;
    const n: number = proposta.parcelas_count ?? 2;
    const valorParcela = Math.round((restante / n) * 100) / 100;
    parcelas.push({ conta_receber_id: conta.id, numero: 1, valor: entrada, data_vencimento: addDays(hoje, 1), status: 'pendente' });
    for (let i = 0; i < n; i++) {
      parcelas.push({ conta_receber_id: conta.id, numero: i + 2, valor: valorParcela, data_vencimento: addDays(hoje, 30 * (i + 1)), status: 'pendente' });
    }
  } else if (forma === 'prazo_ddl') {
    const dias: number[] = proposta.prazo_dias ?? [30];
    const valorParcela = Math.round((valorTotal / dias.length) * 100) / 100;
    dias.forEach((d: number, i: number) => {
      parcelas.push({ conta_receber_id: conta.id, numero: i + 1, valor: valorParcela, data_vencimento: addDays(hoje, d), status: 'pendente' });
    });
  }

  if (parcelas.length === 0) return;

  const { error: pErr } = await supabase.from('parcelas_receber' as any).insert(parcelas);
  if (pErr) throw new Error(`Erro ao gerar parcelas: ${pErr.message}`);
}
