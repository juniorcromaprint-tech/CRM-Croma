import { supabase } from '@/integrations/supabase/client';

const ETAPA_NOMES = ['criacao', 'impressao', 'acabamento', 'conferencia', 'expedicao'] as const;

async function generateOpNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const { data: ultimo } = await supabase
    .from('ordens_producao')
    .select('numero')
    .like('numero', `OP-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1);

  let seq = 1;
  if (ultimo && ultimo.length > 0) {
    const match = ultimo[0].numero.match(/OP-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }
  return `OP-${year}-${String(seq).padStart(4, '0')}`;
}

export async function criarOrdemProducao(pedidoId: string): Promise<void> {
  // Guard de idempotência: evita criar OPs duplicadas
  const { count } = await supabase
    .from('ordens_producao')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId);
  if (count && count > 0) return;

  const { data: itens, error: itensError } = await supabase
    .from('pedido_itens')
    .select('id, custo_mp, custo_mo, valor_total, quantidade, modelo_id')
    .eq('pedido_id', pedidoId);

  if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

  const targets =
    itens && itens.length > 0
      ? itens.map((i) => ({
          pedidoItemId: i.id as string,
          custo_mp: Number(i.custo_mp) || 0,
          custo_mo: Number(i.custo_mo) || 0,
          quantidade: Number(i.quantidade) || 1,
          modelo_id: (i as any).modelo_id as string | null,
        }))
      : [{ pedidoItemId: null as string | null, custo_mp: 0, custo_mo: 0, quantidade: 1, modelo_id: null }];

  for (const { pedidoItemId, custo_mp, custo_mo, quantidade, modelo_id } of targets) {
    const { data: op, error: opError } = await supabase
      .from('ordens_producao')
      .insert({
        numero: await generateOpNumero(),
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

    // Popular producao_materiais a partir da BOM (modelo_materiais)
    if (modelo_id) {
      const { data: bom } = await supabase
        .from('modelo_materiais')
        .select('material_id, quantidade_por_unidade, unidade, material:materiais(preco_medio)')
        .eq('modelo_id', modelo_id);

      if (bom && bom.length > 0) {
        const materiaisOp = bom.map((b) => ({
          ordem_producao_id: op.id,
          material_id: b.material_id,
          quantidade_prevista: Number(b.quantidade_por_unidade) * quantidade,
          custo_unitario: Number((b.material as any)?.preco_medio) || 0,
          custo_total:
            Number(b.quantidade_por_unidade) * quantidade * (Number((b.material as any)?.preco_medio) || 0),
        }));
        // Falha silenciosa — não bloquear criação da OP
        await supabase.from('producao_materiais').insert(materiaisOp);
      }
    }
  }
}

/**
 * Atualiza custos reais da OP ao concluir e desconta materiais do estoque.
 * O custo real é definido como igual ao estimado quando a OP finaliza.
 * Materiais ainda não baixados (movimentacao_id IS NULL) geram movimentações
 * de saída em estoque_movimentacoes e decrementam estoque_saldos.
 */
export async function finalizarCustosOP(opId: string): Promise<void> {
  // 1. Atualizar custos reais (lógica original)
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

  // 2. Buscar materiais da OP ainda não baixados
  const { data: materiais } = await supabase
    .from('producao_materiais')
    .select('id, material_id, quantidade_prevista, custo_unitario')
    .eq('ordem_producao_id', opId)
    .is('movimentacao_id', null);

  if (!materiais || materiais.length === 0) return;

  // 3. Criar movimentação de saída e atualizar saldo por material
  for (const mat of materiais) {
    const qtd = Number(mat.quantidade_prevista) || 0;
    if (qtd <= 0) continue;

    // Inserir movimentação de saída
    const { data: mov } = await supabase
      .from('estoque_movimentacoes')
      .insert({
        material_id: mat.material_id,
        tipo: 'saida',
        quantidade: qtd,
        referencia_tipo: 'ordem_producao',
        referencia_id: opId,
        motivo: 'Consumo em produção — OP finalizada',
      })
      .select('id')
      .single();

    if (!mov) continue;

    // Vincular movimentação ao producao_materiais
    await supabase
      .from('producao_materiais')
      .update({ movimentacao_id: mov.id, quantidade_consumida: qtd })
      .eq('id', mat.id);

    // Decrementar saldo — buscar saldo atual e calcular novo valor
    const { data: saldo } = await supabase
      .from('estoque_saldos')
      .select('quantidade_disponivel')
      .eq('material_id', mat.material_id)
      .single();

    const novoSaldo = Math.max(0, (Number(saldo?.quantidade_disponivel) || 0) - qtd);
    await supabase
      .from('estoque_saldos')
      .upsert(
        {
          material_id: mat.material_id,
          quantidade_disponivel: novoSaldo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'material_id' }
      );
  }

  // A-14: Verificar se todas as OPs do pedido estão concluídas e atualizar status
  await atualizarStatusPedidoSeTodasOpsConcluidas(opId);
}

/**
 * Verifica se todas as OPs de um pedido estão concluídas.
 * Se sim, atualiza o status do pedido para 'produzido'.
 */
async function atualizarStatusPedidoSeTodasOpsConcluidas(opId: string): Promise<void> {
  // Buscar pedido_id desta OP
  const { data: op } = await supabase
    .from('ordens_producao')
    .select('pedido_id')
    .eq('id', opId)
    .single();

  if (!op?.pedido_id) return;

  // Contar OPs não-concluídas deste pedido
  const { count } = await supabase
    .from('ordens_producao')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', op.pedido_id)
    .not('status', 'in', '("finalizado","cancelada")');

  // Se todas concluídas (count === 0), atualizar pedido
  if (count === 0) {
    await supabase
      .from('pedidos')
      .update({ status: 'produzido' })
      .eq('id', op.pedido_id)
      .in('status', ['em_producao', 'aprovado']);
  }
}
