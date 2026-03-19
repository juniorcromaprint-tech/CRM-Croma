import { supabase } from '@/integrations/supabase/client';

/**
 * Cria um documento fiscal (NF-e rascunho) a partir de um pedido.
 * Também cria os itens da NF-e e aplica CSOSN 102 (Simples Nacional — tributada sem crédito).
 *
 * NCM é lido de produto_modelos.ncm (migration 028). Se não preenchido,
 * fica null e pode ser editado manualmente no documento fiscal.
 */
export async function criarNFeFromPedido(pedidoId: string): Promise<string> {
  // 1. Buscar pedido
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, cliente_id, valor_total')
    .eq('id', pedidoId)
    .single();

  if (pedidoError || !pedido) {
    throw new Error(`Pedido não encontrado: ${pedidoError?.message}`);
  }

  // 2. Criar documento fiscal
  const { data, error } = await supabase
    .from('fiscal_documentos')
    .insert({
      pedido_id: pedido.id,
      cliente_id: pedido.cliente_id,
      tipo_documento: 'nfe',
      provider: 'manual',
      status: 'rascunho',
      valor_total: pedido.valor_total ?? 0,
      valor_produtos: pedido.valor_total ?? 0,
      natureza_operacao: 'Venda de mercadorias',
      finalidade_emissao: 'Normal',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Erro ao criar NF-e: ${error.message}`);
  const docId = data.id;

  // 3. Buscar itens do pedido com nome e NCM do modelo (migration 028 adicionou ncm)
  const { data: itens } = await supabase
    .from('pedido_itens')
    .select(`
      id, descricao, quantidade, valor_unitario, valor_total, unidade,
      modelo:produto_modelos(ncm, nome)
    `)
    .eq('pedido_id', pedidoId);

  if (itens && itens.length > 0) {
    const fiscalItens = itens.map((item, idx) => ({
      fiscal_documento_id: docId,
      pedido_item_id: item.id,
      item_numero: idx + 1,
      descricao: item.descricao ?? (item.modelo as any)?.nome ?? 'Item',
      ncm: (item.modelo as any)?.ncm ?? null,
      cfop: '5102',
      unidade: item.unidade ?? 'UN',
      quantidade: Number(item.quantidade) || 1,
      valor_unitario: Number(item.valor_unitario) || 0,
      valor_bruto: Number(item.valor_total) || 0,
      valor_total: Number(item.valor_total) || 0,
      // Simples Nacional — CSOSN 102 (tributada sem crédito de ICMS)
      cst_ou_csosn: '102',
      origem_mercadoria: '0',
      aliquota_icms: 0,
      base_calculo_icms: 0,
      valor_icms: 0,
      aliquota_ipi: 0,
      base_calculo_ipi: 0,
      valor_ipi: 0,
      aliquota_pis: 0,
      base_calculo_pis: 0,
      valor_pis: 0,
      aliquota_cofins: 0,
      base_calculo_cofins: 0,
      valor_cofins: 0,
    }));

    const { error: itensError } = await supabase.from('fiscal_documentos_itens').insert(fiscalItens);
    if (itensError) {
      await supabase.from('fiscal_documentos').delete().eq('id', docId);
      throw new Error(`Erro ao inserir itens fiscais: ${itensError.message}`);
    }
  }

  return docId;
}
