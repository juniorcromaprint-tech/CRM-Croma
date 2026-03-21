import { supabase } from '@/integrations/supabase/client';
import type {
  SetorProducao, PCPOpAtiva, PCPCapacidadeSetor, PCPKpis, RoutingRule,
  MaquinaOPAgendada, MaquinaUtilizacao,
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

export async function listarOpsAgendadasMaquina(): Promise<MaquinaOPAgendada[]> {
  const { data, error } = await supabase
    .from('ordens_producao')
    .select(`
      id,
      numero,
      status,
      data_inicio_prevista,
      data_fim_prevista,
      prazo_interno,
      maquina_id,
      maquinas ( nome, tipo ),
      pedidos ( numero, clientes ( nome_fantasia, razao_social ) )
    `)
    .not('maquina_id', 'is', null)
    .not('data_inicio_prevista', 'is', null)
    .not('status', 'in', '("finalizado","cancelada")')
    .order('data_inicio_prevista', { ascending: true });

  if (error) throw new Error(error.message);

  const hoje = new Date().toISOString().slice(0, 10);

  return (data ?? []).map((row: any) => ({
    op_id: row.id,
    op_numero: row.numero,
    pedido_numero: row.pedidos?.numero ?? '---',
    cliente_nome:
      row.pedidos?.clientes?.nome_fantasia ??
      row.pedidos?.clientes?.razao_social ??
      '---',
    status: row.status,
    data_inicio_prevista: row.data_inicio_prevista,
    data_fim_prevista: row.data_fim_prevista,
    maquina_id: row.maquina_id,
    maquina_nome: row.maquinas?.nome ?? 'Máquina',
    maquina_tipo: row.maquinas?.tipo ?? '',
    atrasada:
      !!row.prazo_interno && row.prazo_interno.slice(0, 10) < hoje,
  }));
}

export async function listarUtilizacaoMaquinas(): Promise<MaquinaUtilizacao[]> {
  const { data: maquinas, error: errM } = await supabase
    .from('maquinas')
    .select('id, nome, tipo')
    .eq('ativo', true)
    .order('nome');

  if (errM) throw new Error(errM.message);
  if (!maquinas || maquinas.length === 0) return [];

  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  const hojeFim = new Date();
  hojeFim.setHours(23, 59, 59, 999);

  const { data: ops } = await supabase
    .from('ordens_producao')
    .select('maquina_id')
    .not('maquina_id', 'is', null)
    .not('status', 'in', '("finalizado","cancelada")')
    .gte('data_inicio_prevista', hojeInicio.toISOString())
    .lte('data_inicio_prevista', hojeFim.toISOString());

  const countByMaquina: Record<string, number> = {};
  for (const op of ops ?? []) {
    if (op.maquina_id) {
      countByMaquina[op.maquina_id] = (countByMaquina[op.maquina_id] ?? 0) + 1;
    }
  }

  return maquinas.map((m) => ({
    id: m.id,
    nome: m.nome,
    tipo: m.tipo,
    ops_hoje: countByMaquina[m.id] ?? 0,
  }));
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
