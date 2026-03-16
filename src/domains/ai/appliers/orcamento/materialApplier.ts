import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function materialApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { material_id: string; item_id: string } | null;
  const suggested = action.valor_sugerido as { material_id: string; nome: string; preco: number };

  if (!suggested?.material_id) {
    return { success: false, message: 'Material sugerido não tem ID válido' };
  }

  if (previous?.material_id && previous?.item_id) {
    const { error } = await ctx.supabase
      .from('proposta_item_materiais')
      .update({
        material_id: suggested.material_id,
        descricao: suggested.nome,
        custo_unitario: suggested.preco,
      })
      .eq('material_id', previous.material_id)
      .eq('proposta_item_id', previous.item_id);

    if (error) return { success: false, message: `Erro ao trocar material: ${error.message}` };

    // NOTE: Frontend invalidation via queryClient.invalidateQueries handles motor recalculation.
    // Acabamentos now participate in the Mubisys overhead motor — pricing recomputes on next render.
    return {
      success: true,
      message: `Material trocado para "${suggested.nome}"`,
      rollback: async () => {
        await ctx.supabase
          .from('proposta_item_materiais')
          .update({ material_id: previous.material_id })
          .eq('material_id', suggested.material_id)
          .eq('proposta_item_id', previous.item_id);
      },
    };
  }

  const { data, error } = await ctx.supabase
    .from('proposta_item_materiais')
    .insert({
      proposta_item_id: (suggested as any).item_id,
      material_id: suggested.material_id,
      descricao: suggested.nome,
      custo_unitario: suggested.preco ?? 0,
      quantidade: 1,
      unidade: 'un',
      custo_total: suggested.preco ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar material: ${error.message}` };

  return {
    success: true,
    message: `Material "${suggested.nome}" adicionado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_item_materiais').delete().eq('id', data.id);
    },
  };
}
