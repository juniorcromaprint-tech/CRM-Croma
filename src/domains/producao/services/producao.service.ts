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
    .select('id')
    .eq('pedido_id', pedidoId);

  if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

  const targets =
    itens && itens.length > 0
      ? itens.map((i) => ({ pedidoItemId: i.id as string }))
      : [{ pedidoItemId: null as string | null }];

  for (const { pedidoItemId } of targets) {
    const { data: op, error: opError } = await supabase
      .from('ordens_producao')
      .insert({
        numero: generateOpNumero(),
        pedido_id: pedidoId,
        pedido_item_id: pedidoItemId,
        status: 'aguardando_programacao',
        prioridade: 0,
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
