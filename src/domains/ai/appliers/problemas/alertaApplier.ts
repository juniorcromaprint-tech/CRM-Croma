import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function alertaApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { titulo: string; mensagem: string; nivel: string };

  const { data, error } = await ctx.supabase
    .from('ai_alertas')
    .insert({
      titulo: suggested.titulo,
      descricao: suggested.mensagem,
      nivel: suggested.nivel ?? 'media',
      entidade_tipo: ctx.entityType,
      entidade_id: ctx.entityId,
      resolvido: false,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao criar alerta: ${error.message}` };

  return {
    success: true,
    message: `Alerta "${suggested.titulo}" criado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('ai_alertas').delete().eq('id', data.id);
    },
  };
}
