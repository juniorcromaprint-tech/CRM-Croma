import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function tarefaApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as {
    titulo: string; descricao?: string; data_limite?: string; responsavel_id?: string;
  };

  const { data, error } = await ctx.supabase
    .from('tarefas_comerciais')
    .insert({
      titulo: suggested.titulo,
      descricao: suggested.descricao ?? '',
      responsavel_id: suggested.responsavel_id ?? ctx.userId,
      data_limite: suggested.data_limite ?? null,
      status: 'pendente',
      entidade_tipo: ctx.entityType,
      entidade_id: ctx.entityId,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao criar tarefa: ${error.message}` };

  return {
    success: true,
    message: `Tarefa "${suggested.titulo}" criada`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('tarefas_comerciais').delete().eq('id', data.id);
    },
  };
}
