import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function checklistApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item: string; pedido_id?: string };

  const { data, error } = await ctx.supabase
    .from('producao_checklist')
    .insert({
      pedido_id: suggested.pedido_id ?? ctx.entityId,
      item: suggested.item,
      concluido: false,
      criado_por: ctx.userId,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao criar checklist: ${error.message}` };

  return {
    success: true,
    message: `Item de checklist "${suggested.item}" criado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('producao_checklist').delete().eq('id', data.id);
    },
  };
}
