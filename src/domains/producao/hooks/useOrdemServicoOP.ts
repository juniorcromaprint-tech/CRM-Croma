import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OSOPData, OSItem, OSMaterial, OSEtapa, OSCliente } from '../types/ordem-servico';

async function fetchOrdemServicoOP(opId: string): Promise<OSOPData> {
  // 1. Fetch OP with pedido + cliente
  const { data: op, error } = await supabase
    .from('ordens_producao')
    .select(`
      id, numero, status, prioridade, pedido_item_id,
      data_inicio, data_conclusao, tempo_estimado_min, tempo_real_min, observacoes,
      pedido:pedidos!ordens_producao_pedido_id_fkey(
        id, numero, status, data_prometida,
        vendedor:profiles!pedidos_vendedor_id_fkey(full_name),
        cliente:clientes!pedidos_cliente_id_fkey(
          id, razao_social, nome_fantasia, cnpj, cpf_cnpj,
          telefone, email, endereco, numero, complemento,
          bairro, cidade, estado, cep
        )
      )
    `)
    .eq('id', opId)
    .single();

  if (error || !op) throw new Error('Ordem de produção não encontrada');

  const pedido = op.pedido as any;
  const clienteRaw = pedido?.cliente;

  // 2. Fetch the item
  let item: any = null;
  if (op.pedido_item_id) {
    const { data } = await supabase
      .from('pedido_itens')
      .select(`
        id, descricao, especificacao, largura_cm, altura_cm, area_m2,
        quantidade, unidade, arte_url, instrucoes, status,
        modelo:produto_modelos!pedido_itens_modelo_id_fkey(nome),
        produto:produtos!pedido_itens_produto_id_fkey(nome)
      `)
      .eq('id', op.pedido_item_id)
      .single();
    item = data;
  }

  // 3. Fetch etapas
  const { data: etapas = [] } = await supabase
    .from('producao_etapas')
    .select('id, nome, ordem, status, tempo_estimado_min, tempo_real_min, inicio, fim, responsavel_id, observacoes')
    .eq('ordem_producao_id', opId)
    .order('ordem', { ascending: true });

  // 4. Fetch materiais
  const { data: materiais = [] } = await supabase
    .from('producao_materiais')
    .select(`
      id, material_id, quantidade_prevista, quantidade_consumida,
      custo_unitario, custo_total,
      material:materiais!producao_materiais_material_id_fkey(nome, unidade)
    `)
    .eq('ordem_producao_id', opId);

  const osMateriais: OSMaterial[] = (materiais || []).map((m: any) => ({
    id: m.id,
    material_id: m.material_id,
    nome: m.material?.nome || 'Material não encontrado',
    unidade: m.material?.unidade || 'un',
    quantidade_prevista: m.quantidade_prevista || 0,
    quantidade_consumida: m.quantidade_consumida || 0,
    custo_unitario: m.custo_unitario || 0,
    custo_total: m.custo_total || 0,
  }));

  // 5. Fetch acabamentos for the item
  let acabamentos: string[] = [];
  if (item?.id) {
    const { data: acab = [] } = await supabase
      .from('proposta_item_acabamentos')
      .select('acabamento:acabamentos!proposta_item_acabamentos_acabamento_id_fkey(nome)')
      .eq('proposta_item_id', item.id);
    acabamentos = (acab || []).map((a: any) => a.acabamento?.nome).filter(Boolean);
  }

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

  const osItem: OSItem = {
    id: item?.id || opId,
    descricao: item?.descricao || op.observacoes || 'Item sem descrição',
    especificacao: item?.especificacao || null,
    largura_cm: item?.largura_cm || null,
    altura_cm: item?.altura_cm || null,
    area_m2: item?.area_m2 || null,
    quantidade: item?.quantidade || 1,
    unidade: item?.unidade || 'un',
    modelo_nome: item?.modelo?.nome || null,
    produto_nome: item?.produto?.nome || null,
    arte_url: item?.arte_url || null,
    instrucoes: item?.instrucoes || null,
    status: item?.status || null,
    op_id: op.id,
    op_numero: op.numero ?? '',
    op_status: op.status,
    op_prioridade: op.prioridade,
    materiais: osMateriais,
    acabamentos,
  };

  return {
    op_id: op.id,
    op_numero: op.numero ?? '',
    op_status: op.status,
    op_prioridade: op.prioridade ?? 0,
    data_inicio: op.data_inicio,
    data_conclusao: op.data_conclusao,
    tempo_estimado_min: op.tempo_estimado_min,
    tempo_real_min: op.tempo_real_min,
    observacoes: op.observacoes,
    pedido_id: pedido?.id || '',
    pedido_numero: pedido?.numero || '',
    pedido_status: pedido?.status || '',
    data_prometida: pedido?.data_prometida || null,
    vendedor_nome: pedido?.vendedor?.full_name || null,
    cliente,
    etapas: etapas as OSEtapa[],
    item: osItem,
  };
}

export function useOrdemServicoOP(opId: string | undefined) {
  return useQuery({
    queryKey: ['ordem-servico-op', opId],
    queryFn: () => fetchOrdemServicoOP(opId!),
    enabled: !!opId,
    staleTime: 2 * 60 * 1000,
  });
}
