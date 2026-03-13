import { supabase } from '@/integrations/supabase/client';

const ETAPA_NOMES = ['criacao', 'impressao', 'acabamento', 'conferencia', 'expedicao'] as const;

function generateOpNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `OP-${year}-${seq}`;
}

export async function criarOrdemProducao(pedidoId: string): Promise<void> {
  const { data: itens, error: itensError } = await supabase
    .from('pedido_itens')
    .select('id, custo_mp, custo_mo, valor_total, quantidade')
    .eq('pedido_id', pedidoId);

  if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

  const targets =
    itens && itens.length > 0
      ? itens.map((i) => ({
          pedidoItemId: i.id as string,
          custo_mp: Number(i.custo_mp) || 0,
          custo_mo: Number(i.custo_mo) || 0,
        }))
      : [{ pedidoItemId: null as string | null, custo_mp: 0, custo_mo: 0 }];

  for (const { pedidoItemId, custo_mp, custo_mo } of targets) {
    const { data: op, error: opError } = await supabase
      .from('ordens_producao')
      .insert({
        numero: generateOpNumero(),
        pedido_id: pedidoId,
        pedido_item_id: pedidoItemId,
        status: 'aguardando_programacao',
        prioridade: 0,
        custo_mp_estimado: custo_mp,
        custo_mo_estimado: custo_mo,
      })
      .select('id')
      .single();

    if (opError) throw new Error(`Erro ao criar OP: ${opError.message}`);

    const etapas = ETAPA_NOMES.map((nome, idx) => ({
      ordem_producao_id: op.id,
      nome,
      ordem: idx,
      status: 'pendente',
    }));

    const { error: etapaError } = await supabase.from('producao_etapas').insert(etapas);
    if (etapaError) throw new Error(`Erro ao criar etapas: ${etapaError.message}`);
  }
}

/**
 * Atualiza custos reais da OP ao concluir.
 * Como não temos sistema de apontamento detalhado de custos,
 * o custo real é definido como igual ao estimado quando a OP finaliza.
 */
export async function finalizarCustosOP(opId: string): Promise<void> {
  const { data: op } = await supabase
    .from('ordens_producao')
    .select('custo_mp_estimado, custo_mo_estimado')
    .eq('id', opId)
    .single();

  if (op) {
    await supabase
      .from('ordens_producao')
      .update({
        custo_mp_real: op.custo_mp_estimado ?? 0,
        custo_mo_real: op.custo_mo_estimado ?? 0,
        data_conclusao: new Date().toISOString(),
      })
      .eq('id', opId);
  }
}
