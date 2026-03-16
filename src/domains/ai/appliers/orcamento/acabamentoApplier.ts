import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function acabamentoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as {
    acabamento_id: string; item_id: string; nome: string; preco: number;
  };

  // NOTE: Acabamentos now participate in the Mubisys motor (overhead applied).
  // Do NOT write a stale valor_unitario here — the motor recalculates on next render.
  const { data, error } = await ctx.supabase
    .from('proposta_item_acabamentos')
    .insert({
      proposta_item_id: suggested.item_id,
      acabamento_id: suggested.acabamento_id,
      descricao: suggested.nome,
      custo_unitario: suggested.preco ?? 0,
      custo_total: suggested.preco ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar acabamento: ${error.message}` };

  return {
    success: true,
    message: `Acabamento "${suggested.nome}" adicionado (R$ ${suggested.preco.toFixed(2)})`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_item_acabamentos').delete().eq('id', data.id);
    },
  };
}
