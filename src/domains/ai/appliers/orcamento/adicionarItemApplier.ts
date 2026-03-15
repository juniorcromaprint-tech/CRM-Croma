import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function adicionarItemApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as Record<string, unknown>;

  if (action.campo_alvo === 'servicos') {
    const { data, error } = await ctx.supabase
      .from('proposta_servicos')
      .insert({
        proposta_id: ctx.entityId,
        servico_id: suggested.servico_id ?? null,
        nome_servico: suggested.nome as string,
        preco: suggested.valor as number,
      })
      .select()
      .single();

    if (error) return { success: false, message: `Erro ao adicionar serviço: ${error.message}` };

    return {
      success: true,
      message: `Serviço "${suggested.nome}" adicionado (R$ ${(suggested.valor as number).toFixed(2)})`,
      rollback: async () => {
        if (data?.id) await ctx.supabase.from('proposta_servicos').delete().eq('id', data.id);
      },
    };
  }

  const { data, error } = await ctx.supabase
    .from('proposta_itens')
    .insert({
      proposta_id: ctx.entityId,
      descricao: suggested.descricao as string,
      quantidade: (suggested.quantidade as number) ?? 1,
      preco_unitario: suggested.preco as number,
      preco_total: suggested.preco as number,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar item: ${error.message}` };

  return {
    success: true,
    message: `Item "${suggested.descricao}" adicionado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_itens').delete().eq('id', data.id);
    },
  };
}
