import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function erroApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { item_id: string; campo: string; valor: unknown };
  const suggested = action.valor_sugerido as { item_id: string; campo: string; valor: unknown };

  const [table, field] = action.campo_alvo.includes('.')
    ? action.campo_alvo.split('.')
    : ['proposta_itens', action.campo_alvo];

  const updateData = { [field ?? suggested.campo]: suggested.valor };

  if (!suggested?.item_id) {
    return { success: false, message: 'Dados insuficientes: item_id obrigatório para correção' };
  }

  const { error } = await ctx.supabase
    .from(table)
    .update(updateData)
    .eq('id', suggested.item_id);

  if (error) return { success: false, message: `Erro ao corrigir: ${error.message}` };

  return {
    success: true,
    message: `Campo "${field ?? suggested.campo}" corrigido: ${String(previous?.valor)} → ${String(suggested.valor)}`,
    rollback: async () => {
      if (previous?.valor != null) {
        await ctx.supabase
          .from(table)
          .update({ [field ?? (previous as any).campo]: previous.valor })
          .eq('id', suggested.item_id);
      }
    },
  };
}
