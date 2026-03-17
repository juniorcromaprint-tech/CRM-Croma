import { supabase } from '@/integrations/supabase/client';
import type {
  SetorProducao, PCPOpAtiva, PCPCapacidadeSetor, PCPKpis, RoutingRule
} from '../types/pcp.types';

export async function listarSetores(): Promise<SetorProducao[]> {
  const { data, error } = await supabase
    .from('setores_producao')
    .select('*')
    .eq('ativo', true)
    .order('ordem');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listarOpsAtivas(): Promise<PCPOpAtiva[]> {
  const { data, error } = await supabase
    .from('v_pcp_ops_ativas')
    .select('*')
    .order('prioridade', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PCPOpAtiva[];
}

export async function listarCapacidadeSetores(): Promise<PCPCapacidadeSetor[]> {
  const { data, error } = await supabase
    .from('v_pcp_capacidade_setor')
    .select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as PCPCapacidadeSetor[];
}

export async function calcularKpis(): Promise<PCPKpis> {
  const [ops, cap] = await Promise.all([
    listarOpsAtivas(),
    listarCapacidadeSetores(),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);

  // Contar concluídas hoje via query direta
  const { count: concluidasHoje } = await supabase
    .from('ordens_producao')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'finalizado')
    .gte('data_conclusao', hoje + 'T00:00:00Z');

  return {
    total_ops_ativas: ops.length,
    ops_atrasadas: ops.filter(o => o.atrasada).length,
    ops_em_producao: ops.filter(o => o.status === 'em_producao').length,
    concluidas_hoje: concluidasHoje ?? 0,
    capacidade_media_pct:
      cap.length > 0
        ? Math.round(cap.reduce((acc, s) => acc + Number(s.utilizacao_pct), 0) / cap.length)
        : 0,
  };
}

export async function moverOpParaSetor(
  opId: string,
  setorId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('ordens_producao')
    .update({ setor_atual_id: setorId, updated_at: new Date().toISOString() })
    .eq('id', opId);
  if (error) throw new Error(error.message);
}

export async function atualizarStatusOp(opId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('ordens_producao')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', opId);
  if (error) throw new Error(error.message);
}

export async function listarRoutingRules(): Promise<RoutingRule[]> {
  const { data, error } = await supabase
    .from('routing_rules')
    .select('*')
    .eq('ativo', true)
    .order('prioridade', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
