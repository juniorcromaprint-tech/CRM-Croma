import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OSData, OSItem, OSMaterial, OSEtapa, OSCliente } from '../types/ordem-servico';

async function fetchOrdemServico(pedidoId: string): Promise<OSData> {
  // 1. Fetch pedido with cliente
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select(`
      id, numero, status, prioridade, data_prometida, data_conclusao,
      aprovado_em, aprovado_por, observacoes, created_at,
      vendedor:profiles!pedidos_vendedor_id_fkey(full_name),
      cliente:clientes!pedidos_cliente_id_fkey(
        id, razao_social, nome_fantasia, cnpj, cpf_cnpj,
        telefone, email, endereco, numero, complemento,
        bairro, cidade, estado, cep
      )
    `)
    .eq('id', pedidoId)
    .single();

  if (pedidoError || !pedido) throw new Error('Pedido não encontrado');

  // 2. Fetch pedido_itens
  const { data: itens = [] } = await supabase
    .from('pedido_itens')
    .select(`
      id, descricao, especificacao, largura_cm, altura_cm, area_m2,
      quantidade, unidade, arte_url, instrucoes, status,
      modelo:produto_modelos!pedido_itens_modelo_id_fkey(nome),
      produto:produtos!pedido_itens_produto_id_fkey(nome)
    `)
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: true });

  // 3. Fetch OPs for this pedido
  const { data: ops = [] } = await supabase
    .from('ordens_producao')
    .select('id, numero, status, prioridade, pedido_item_id')
    .eq('pedido_id', pedidoId)
    .is('excluido_em', null);

  // 4. Fetch etapas for all OPs
  const opIds = ops.map(op => op.id);
  let allEtapas: OSEtapa[] = [];
  if (opIds.length > 0) {
    const { data: etapas = [] } = await supabase
      .from('producao_etapas')
      .select('id, ordem_producao_id, nome, ordem, status, tempo_estimado_min, tempo_real_min, inicio, fim, responsavel_id, observacoes')
      .in('ordem_producao_id', opIds)
      .order('ordem', { ascending: true });
    allEtapas = etapas as OSEtapa[];
  }

  // 5. Fetch materiais for all OPs
  let allMateriais: (OSMaterial & { ordem_producao_id: string })[] = [];
  if (opIds.length > 0) {
    const { data: materiais = [] } = await supabase
      .from('producao_materiais')
      .select(`
        id, ordem_producao_id, material_id, quantidade_prevista, quantidade_consumida,
        custo_unitario, custo_total,
        material:materiais!producao_materiais_material_id_fkey(nome, unidade)
      `)
      .in('ordem_producao_id', opIds);
    allMateriais = (materiais || []).map((m: any) => ({
      id: m.id,
      ordem_producao_id: m.ordem_producao_id,
      material_id: m.material_id,
      nome: m.material?.nome || 'Material não encontrado',
      unidade: m.material?.unidade || 'un',
      quantidade_prevista: m.quantidade_prevista || 0,
      quantidade_consumida: m.quantidade_consumida || 0,
      custo_unitario: m.custo_unitario || 0,
      custo_total: m.custo_total || 0,
    }));
  }

  // 6. Fetch acabamentos for itens
  const itemIds = itens.map(i => i.id);
  let acabamentosMap: Record<string, string[]> = {};
  if (itemIds.length > 0) {
    const { data: acabamentos = [] } = await supabase
      .from('proposta_item_acabamentos')
      .select('proposta_item_id, acabamento:acabamentos!proposta_item_acabamentos_acabamento_id_fkey(nome)')
      .in('proposta_item_id', itemIds);
    for (const a of acabamentos || []) {
      const key = a.proposta_item_id;
      if (!acabamentosMap[key]) acabamentosMap[key] = [];
      if ((a as any).acabamento?.nome) acabamentosMap[key].push((a as any).acabamento.nome);
    }
  }

  // 7. Build OS items with OP + materiais
  const osItens: OSItem[] = itens.map((item: any) => {
    const op = ops.find(o => o.pedido_item_id === item.id);
    const opMateriais = op ? allMateriais.filter(m => m.ordem_producao_id === op.id) : [];

    return {
      id: item.id,
      descricao: item.descricao || '',
      especificacao: item.especificacao,
      largura_cm: item.largura_cm,
      altura_cm: item.altura_cm,
      area_m2: item.area_m2,
      quantidade: item.quantidade || 1,
      unidade: item.unidade || 'un',
      modelo_nome: item.modelo?.nome || null,
      produto_nome: item.produto?.nome || null,
      arte_url: item.arte_url,
      instrucoes: item.instrucoes,
      status: item.status,
      op_id: op?.id || null,
      op_numero: op?.numero || null,
      op_status: op?.status || null,
      op_prioridade: op?.prioridade ?? null,
      materiais: opMateriais,
      acabamentos: acabamentosMap[item.id] || [],
    };
  });

  // 8. Build consolidated etapas (deduplicated by nome, showing worst status)
  const etapasByNome = new Map<string, OSEtapa>();
  for (const e of allEtapas) {
    const existing = etapasByNome.get(e.nome);
    if (!existing) {
      etapasByNome.set(e.nome, { ...e });
    } else {
      // Keep the "worst" status (most behind)
      const statusOrder = ['concluida', 'em_andamento', 'pendente'];
      if (statusOrder.indexOf(e.status) > statusOrder.indexOf(existing.status)) {
        etapasByNome.set(e.nome, { ...e });
      }
      // Sum times
      if (e.tempo_estimado_min) {
        existing.tempo_estimado_min = (existing.tempo_estimado_min || 0) + e.tempo_estimado_min;
      }
    }
  }

  const clienteRaw = pedido.cliente as any;
  const cliente: OSCliente = {
    id: clienteRaw?.id || '',
    razao_social: clienteRaw?.razao_social || '',
    nome_fantasia: clienteRaw?.nome_fantasia || null,
    cnpj: clienteRaw?.cnpj || null,
    cpf_cnpj: clienteRaw?.cpf_cnpj || null,
    telefone: clienteRaw?.telefone || null,
    email: clienteRaw?.email || null,
    endereco: clienteRaw?.endereco || null,
    numero: clienteRaw?.numero || null,
    complemento: clienteRaw?.complemento || null,
    bairro: clienteRaw?.bairro || null,
    cidade: clienteRaw?.cidade || null,
    estado: clienteRaw?.estado || null,
    cep: clienteRaw?.cep || null,
  };

  return {
    pedido_id: pedido.id,
    numero: pedido.numero ?? '',
    status: pedido.status,
    prioridade: pedido.prioridade ?? '',
    data_prometida: pedido.data_prometida,
    data_conclusao: pedido.data_conclusao,
    aprovado_em: pedido.aprovado_em,
    aprovado_por: pedido.aprovado_por,
    observacoes: pedido.observacoes,
    created_at: pedido.created_at ?? '',
    vendedor_nome: (pedido.vendedor as any)?.full_name || null,
    cliente,
    etapas: Array.from(etapasByNome.values()).sort((a, b) => a.ordem - b.ordem),
    itens: osItens,
  };
}

export function useOrdemServico(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ['ordem-servico', pedidoId],
    queryFn: () => fetchOrdemServico(pedidoId!),
    enabled: !!pedidoId,
    staleTime: 2 * 60 * 1000,
  });
}
