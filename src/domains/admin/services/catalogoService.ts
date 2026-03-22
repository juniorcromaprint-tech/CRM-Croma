/**
 * catalogoService.ts
 * CRUD e consultas para o catálogo de produtos — produtos, modelos, BOM (materiais + processos).
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CategoriaProduto,
  Produto,
  ProdutoModelo,
  ModeloMaterial,
  ModeloProcesso,
  ProdutoCustoCompleto,
  MaterialSemPreco,
  CreateProdutoDto,
  UpdateProdutoDto,
  CreateModeloDto,
  UpsertModeloMaterialDto,
  UpsertModeloProcessoDto,
} from '../types/catalogo.types';

// Suppress TS until generated types are regenerated
const db = supabase as unknown as any;

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

/**
 * Busca todas as categorias de produto ordenadas por `ordem`.
 */
export async function fetchCategorias(): Promise<CategoriaProduto[]> {
  const { data, error } = await db
    .from('categorias_produto')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) throw error;
  return data as CategoriaProduto[];
}

/**
 * Converte lista flat de categorias em árvore hierárquica com `children`.
 * Nós órfãos (parent_id não encontrado) vão para a raiz.
 */
export function buildCategoriaTree(flat: CategoriaProduto[]): CategoriaProduto[] {
  const map = new Map<string, CategoriaProduto>();
  const roots: CategoriaProduto[] = [];

  // Cria cópias com children vazio
  for (const cat of flat) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of map.values()) {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children!.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

/**
 * Lista produtos com filtros opcionais.
 */
export async function fetchProdutos(options?: {
  categoriaId?: string;
  search?: string;
  ativo?: boolean;
}): Promise<Produto[]> {
  let query = db
    .from('produtos')
    .select('*')
    .order('nome', { ascending: true });

  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }
  if (options?.categoriaId) {
    query = query.eq('categoria_id', options.categoriaId);
  }
  if (options?.search) {
    query = query.ilike('nome', `%${options.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Produto[];
}

/**
 * Busca um produto por ID, incluindo seus modelos.
 */
export async function fetchProdutoById(id: string): Promise<Produto | null> {
  const { data, error } = await db
    .from('produtos')
    .select('*, produto_modelos(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Produto | null;
}

/**
 * Cria um novo produto.
 */
export async function createProduto(dto: CreateProdutoDto): Promise<Produto> {
  const { data, error } = await db
    .from('produtos')
    .insert(dto)
    .select()
    .single();
  if (error) throw error;
  return data as Produto;
}

/**
 * Atualiza um produto existente.
 */
export async function updateProduto({ id, ...dto }: UpdateProdutoDto & { id: string }): Promise<Produto> {
  const { data, error } = await db
    .from('produtos')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Produto;
}

/**
 * Ativa ou desativa um produto.
 */
export async function toggleProdutoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await db
    .from('produtos')
    .update({ ativo })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Exclui um produto e seus modelos (CASCADE).
 * Verifica se está vinculado a propostas/pedidos antes de deletar.
 * Se estiver vinculado, lança erro orientando a desativar.
 */
export async function deleteProduto(id: string): Promise<void> {
  // 1. Verificar se tem propostas/pedidos vinculados
  const { count: propostaCount } = await db
    .from('proposta_itens')
    .select('id', { count: 'exact', head: true })
    .eq('produto_id', id);

  const { count: pedidoCount } = await db
    .from('pedido_itens')
    .select('id', { count: 'exact', head: true })
    .eq('produto_id', id);

  if ((propostaCount ?? 0) > 0 || (pedidoCount ?? 0) > 0) {
    throw new Error(
      `Produto vinculado a ${propostaCount ?? 0} proposta(s) e ${pedidoCount ?? 0} pedido(s). Desative o produto em vez de excluir.`
    );
  }

  // 2. Deletar (CASCADE remove modelos, modelo_materiais, modelo_processos)
  const { error } = await db
    .from('produtos')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

/**
 * Lista os modelos de um produto.
 */
export async function fetchModelosByProduto(produtoId: string): Promise<ProdutoModelo[]> {
  const { data, error } = await db
    .from('produto_modelos')
    .select('*')
    .eq('produto_id', produtoId)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data as ProdutoModelo[];
}

/**
 * Busca um modelo com seu BOM completo (materiais e processos).
 * Colunas reais: modelo_materiais(quantidade_por_unidade, percentual_desperdicio, custo_unitario)
 *                modelo_processos(tempo_por_unidade_min, tempo_setup_min)
 */
export async function fetchModeloComBOM(modeloId: string): Promise<ProdutoModelo | null> {
  const { data, error } = await db
    .from('produto_modelos')
    .select(`
      *,
      modelo_materiais (
        id,
        modelo_id,
        material_id,
        quantidade_por_unidade,
        unidade,
        created_at,
        tipo,
        percentual_desperdicio,
        custo_unitario,
        unidade_medida,
        materiais (
          id,
          codigo,
          nome,
          categoria,
          unidade,
          preco_medio,
          ativo
        )
      ),
      modelo_processos (
        id,
        modelo_id,
        etapa,
        tempo_por_unidade_min,
        ordem,
        created_at,
        centro_custo_id,
        tipo_processo,
        tempo_setup_min,
        custo_unitario,
        unidade_medida
      )
    `)
    .eq('id', modeloId)
    .maybeSingle();
  if (error) throw error;
  return data as ProdutoModelo | null;
}

/**
 * Cria um novo modelo de produto.
 */
export async function createModelo(dto: CreateModeloDto): Promise<ProdutoModelo> {
  const { data, error } = await db
    .from('produto_modelos')
    .insert(dto)
    .select()
    .single();
  if (error) throw error;
  return data as ProdutoModelo;
}

/**
 * Atualiza um modelo de produto.
 */
export async function updateModelo(id: string, dto: Partial<CreateModeloDto>): Promise<ProdutoModelo> {
  const { data, error } = await db
    .from('produto_modelos')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProdutoModelo;
}

// ---------------------------------------------------------------------------
// BOM — Materiais
// ---------------------------------------------------------------------------

/**
 * Upsert de material no BOM de um modelo.
 * Usa (modelo_id, material_id) como chave de conflito.
 */
export async function upsertModeloMaterial(dto: UpsertModeloMaterialDto): Promise<ModeloMaterial> {
  const payload = {
    modelo_id: dto.modelo_id,
    material_id: dto.material_id,
    quantidade_por_unidade: dto.quantidade_por_unidade,
    unidade: dto.unidade ?? null,
    tipo: dto.tipo ?? null,
    percentual_desperdicio: dto.percentual_desperdicio ?? null,
    custo_unitario: dto.custo_unitario ?? null,
    unidade_medida: dto.unidade_medida ?? null,
  };

  const { data, error } = await db
    .from('modelo_materiais')
    .upsert(payload, { onConflict: 'modelo_id,material_id' })
    .select()
    .single();
  if (error) throw error;
  return data as ModeloMaterial;
}

/**
 * Remove um material do BOM pelo seu ID.
 */
export async function removeModeloMaterial(id: string): Promise<void> {
  const { error } = await db
    .from('modelo_materiais')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// BOM — Processos
// ---------------------------------------------------------------------------

/**
 * Upsert de processo produtivo no BOM de um modelo.
 * Se `id` for informado, faz update; caso contrário, insert.
 */
export async function upsertModeloProcesso(
  dto: UpsertModeloProcessoDto & { id?: string },
): Promise<ModeloProcesso> {
  const payload = {
    modelo_id: dto.modelo_id,
    etapa: dto.etapa,
    tempo_por_unidade_min: dto.tempo_por_unidade_min,
    ordem: dto.ordem ?? null,
    centro_custo_id: dto.centro_custo_id ?? null,
    tipo_processo: dto.tipo_processo ?? null,
    tempo_setup_min: dto.tempo_setup_min ?? null,
    custo_unitario: dto.custo_unitario ?? null,
    unidade_medida: dto.unidade_medida ?? null,
  };

  if (dto.id) {
    const { data, error } = await db
      .from('modelo_processos')
      .update(payload)
      .eq('id', dto.id)
      .select()
      .single();
    if (error) throw error;
    return data as ModeloProcesso;
  }

  const { data, error } = await db
    .from('modelo_processos')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ModeloProcesso;
}

/**
 * Remove um processo produtivo do BOM pelo seu ID.
 */
export async function removeModeloProcesso(id: string): Promise<void> {
  const { error } = await db
    .from('modelo_processos')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Views de custeio
// ---------------------------------------------------------------------------

/**
 * Consulta a view `v_produto_custo_completo`.
 * Se `modeloId` for informado, filtra por modelo.
 */
export async function fetchCustoCompleto(modeloId?: string): Promise<ProdutoCustoCompleto[]> {
  let query = db
    .from('v_produto_custo_completo')
    .select('*')
    .order('produto_nome', { ascending: true });

  if (modeloId) {
    query = query.eq('modelo_id', modeloId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ProdutoCustoCompleto[];
}

/**
 * Consulta a view `v_material_sem_preco` — materiais sem preço que afetam o custeio.
 */
export async function fetchMateriaisSemPreco(): Promise<MaterialSemPreco[]> {
  const { data, error } = await db
    .from('v_material_sem_preco')
    .select('*')
    .order('qtd_modelos_afetados', { ascending: false });
  if (error) throw error;
  return data as MaterialSemPreco[];
}
