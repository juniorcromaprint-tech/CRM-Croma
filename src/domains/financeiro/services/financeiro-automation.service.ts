import { supabase } from '@/integrations/supabase/client';

/**
 * Gera um registro de Conta a Receber ao concluir um pedido.
 * Chamado automaticamente quando o pedido avança para status "concluido".
 */
export async function gerarContasReceber(pedidoId: string): Promise<void> {
  // Guard de idempotência: evita criar conta a receber duplicada
  const { count } = await supabase
    .from('contas_receber')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId);
  if (count && count > 0) return;

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, cliente_id, valor_total, numero, proposta_id')
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) throw new Error(`Pedido não encontrado: ${error?.message}`);

  // M-05: Buscar condições de pagamento da proposta (em vez de fixo 30 dias)
  let formaPagamento = 'a_definir';
  let diasVencimento = 30;
  if (pedido.proposta_id) {
    const { data: proposta } = await supabase
      .from('propostas')
      .select('forma_pagamento, prazo_dias')
      .eq('id', pedido.proposta_id)
      .single();
    if (proposta?.forma_pagamento) {
      formaPagamento = proposta.forma_pagamento;
      if (proposta.forma_pagamento === 'pix') diasVencimento = 1;
      else if (proposta.forma_pagamento === 'boleto_vista') diasVencimento = 5;
      else if (Array.isArray((proposta as any).prazo_dias) && (proposta as any).prazo_dias.length > 0) {
        diasVencimento = (proposta as any).prazo_dias[0];
      }
    }
  }

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + diasVencimento);

  const { error: crError } = await supabase.from('contas_receber').insert({
    pedido_id: pedido.id,
    cliente_id: pedido.cliente_id,
    valor_original: pedido.valor_total ?? 0,
    valor_pago: 0,
    saldo: pedido.valor_total ?? 0,
    data_vencimento: vencimento.toISOString().split('T')[0],
    status: 'a_vencer',
    forma_pagamento: formaPagamento,
    observacoes: `Pedido ${pedido.numero}`,
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

/**
 * Gera um registro de comissão ao concluir um pedido.
 * Chamado automaticamente quando o pedido avança para status "concluido".
 * Não lança erro — comissão é side-effect e não deve bloquear o fluxo principal.
 */
export async function gerarComissao(pedidoId: string): Promise<void> {
  // Guard de idempotência: evita criar comissão duplicada
  const { count } = await supabase
    .from('comissoes')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId);
  if (count && count > 0) return;

  // Buscar pedido + proposta + vendedor
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, valor_total, proposta_id, vendedor_id, propostas(percentual_comissao)')
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) return; // silencioso — pedido não encontrado

  const vendedorId = (pedido as any).vendedor_id;
  if (!vendedorId) return; // sem vendedor = sem comissão

  const proposta = (pedido as any).propostas;
  const percentual: number = proposta?.percentual_comissao ?? 5; // fallback 5%
  const valorBase: number = (pedido as any).valor_total ?? 0;
  const valorComissao = Math.round(valorBase * (percentual / 100) * 100) / 100;

  if (valorComissao <= 0) return;

  const { error: insErr } = await supabase.from('comissoes' as any).insert({
    pedido_id: pedido.id,
    vendedor_id: vendedorId,
    percentual,
    valor_base: valorBase,
    valor_comissao: valorComissao,
    status: 'gerada',
  });

  if (insErr) console.error('[gerarComissao] Erro:', insErr.message);
  // Não lança erro — comissão é side-effect, não bloqueia o fluxo
}
