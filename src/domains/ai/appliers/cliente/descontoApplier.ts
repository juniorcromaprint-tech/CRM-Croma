import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function descontoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { desconto: number } | null;
  const suggested = action.valor_sugerido as { desconto: number };

  const { error } = await ctx.supabase
    .from('propostas')
    .update({ desconto: suggested.desconto })
    .eq('id', ctx.entityId)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao aplicar desconto: ${error.message}` };

  return {
    success: true,
    message: `Desconto de ${suggested.desconto}% aplicado`,
    rollback: async () => {
      if (previous?.desconto != null) {
        await ctx.supabase
          .from('propostas')
          .update({ desconto: previous.desconto })
          .eq('id', ctx.entityId);
      }
    },
  };
}
