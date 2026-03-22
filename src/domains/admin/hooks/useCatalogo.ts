/**
 * useCatalogo.ts
 * TanStack Query v5 hooks para o catálogo de produtos.
 * Encapsula queries e mutations do catalogoService com invalidação automática e toasts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import {
  fetchCategorias,
  buildCategoriaTree,
  fetchProdutos,
  fetchProdutoById,
  fetchModelosByProduto,
  fetchModeloComBOM,
  fetchCustoCompleto,
  fetchMateriaisSemPreco,
  createProduto,
  updateProduto,
  toggleProdutoAtivo,
  deleteProduto,
  createModelo,
  updateModelo,
  upsertModeloMaterial,
  removeModeloMaterial,
  upsertModeloProcesso,
  removeModeloProcesso,
} from '../services/catalogoService';
import type {
  CreateProdutoDto,
  UpdateProdutoDto,
  CreateModeloDto,
  UpsertModeloMaterialDto,
  UpsertModeloProcessoDto,
} from '../types/catalogo.types';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const CATALOGO_KEYS = {
  categorias: () => ['catalogo', 'categorias'] as const,
  produtos: (filters?: object) => ['catalogo', 'produtos', filters] as const,
  produto: (id: string) => ['catalogo', 'produto', id] as const,
  modelos: (produtoId: string) => ['catalogo', 'modelos', produtoId] as const,
  modeloBOM: (modeloId: string) => ['catalogo', 'modelo-bom', modeloId] as const,
  custoCompleto: () => ['catalogo', 'custo-completo'] as const,
  materiaisSemPreco: () => ['catalogo', 'materiais-sem-preco'] as const,
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Busca todas as categorias e retorna tanto a lista flat quanto a árvore hierárquica.
 */
export function useCategorias() {
  return useQuery({
    queryKey: CATALOGO_KEYS.categorias(),
    staleTime: 5 * 60 * 1000,
    queryFn: fetchCategorias,
    select: (flat) => ({
      flat,
      tree: buildCategoriaTree(flat),
    }),
  });
}

/**
 * Lista produtos com filtros opcionais.
 */
export function useProdutos(filters?: { categoriaId?: string; search?: string; ativo?: boolean }) {
  return useQuery({
    queryKey: CATALOGO_KEYS.produtos(filters),
    staleTime: 2 * 60 * 1000,
    queryFn: () =>
      fetchProdutos(
        filters
          ? {
              categoriaId: filters.categoriaId,
              search: filters.search,
              ativo: filters.ativo,
            }
          : undefined,
      ),
  });
}

/**
 * Busca um produto por ID incluindo seus modelos.
 */
export function useProduto(id: string) {
  return useQuery({
    queryKey: CATALOGO_KEYS.produto(id),
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchProdutoById(id),
    enabled: !!id,
  });
}

/**
 * Lista os modelos de um produto.
 */
export function useModelosByProduto(produtoId: string) {
  return useQuery({
    queryKey: CATALOGO_KEYS.modelos(produtoId),
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchModelosByProduto(produtoId),
    enabled: !!produtoId,
  });
}

/**
 * Busca um modelo com seu BOM completo (materiais e processos).
 */
export function useModeloBOM(modeloId: string) {
  return useQuery({
    queryKey: CATALOGO_KEYS.modeloBOM(modeloId),
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchModeloComBOM(modeloId),
    enabled: !!modeloId,
  });
}

/**
 * Consulta a view v_produto_custo_completo.
 */
export function useCustoCompleto() {
  return useQuery({
    queryKey: CATALOGO_KEYS.custoCompleto(),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchCustoCompleto(),
  });
}

/**
 * Consulta a view v_material_sem_preco — materiais sem preço que afetam o custeio.
 */
export function useMateriaisSemPreco() {
  return useQuery({
    queryKey: CATALOGO_KEYS.materiaisSemPreco(),
    staleTime: 5 * 60 * 1000,
    queryFn: fetchMateriaisSemPreco,
  });
}

// ---------------------------------------------------------------------------
// Mutations — Produtos
// ---------------------------------------------------------------------------

/**
 * Cria um novo produto e invalida a listagem.
 */
export function useCreateProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProdutoDto) => createProduto(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'produtos'] });
      showSuccess('Produto criado!');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza um produto existente e invalida listagem e detalhe.
 */
export function useUpdateProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: UpdateProdutoDto & { id: string }) =>
      updateProduto({ id, ...dto }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'produtos'] });
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.produto(data.id) });
      showSuccess('Produto atualizado!');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Ativa ou desativa um produto e invalida a listagem.
 */
export function useToggleProdutoAtivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => toggleProdutoAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'produtos'] });
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Exclui um produto permanentemente.
 * Verifica vínculos com propostas/pedidos antes de deletar.
 */
export function useDeleteProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'produtos'] });
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.custoCompleto() });
      showSuccess('Produto excluído permanentemente!');
    },
    onError: (error: Error) => showError(error.message),
  });
}

// ---------------------------------------------------------------------------
// Mutations — Modelos
// ---------------------------------------------------------------------------

/**
 * Cria um novo modelo de produto e invalida os modelos do produto pai.
 */
export function useCreateModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateModeloDto) => createModelo(dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.modelos(data.produto_id) });
      showSuccess('Modelo criado!');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza um modelo de produto e invalida todo o catálogo.
 */
export function useUpdateModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<CreateModeloDto> & { id: string }) =>
      updateModelo(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo'] });
      showSuccess('Modelo atualizado!');
    },
    onError: (error: Error) => showError(error.message),
  });
}

// ---------------------------------------------------------------------------
// Mutations — BOM Materiais
// ---------------------------------------------------------------------------

/**
 * Upsert de material no BOM de um modelo.
 * Invalida o BOM do modelo e a view de custo completo.
 */
export function useUpsertModeloMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertModeloMaterialDto) => upsertModeloMaterial(dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.modeloBOM(data.modelo_id) });
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.custoCompleto() });
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Remove um material do BOM pelo seu ID.
 * Invalida o BOM do modelo (via modeloId) e a view de custo completo.
 */
export function useRemoveModeloMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, modeloId }: { id: string; modeloId: string }) =>
      removeModeloMaterial(id).then(() => modeloId),
    onSuccess: (modeloId) => {
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.modeloBOM(modeloId) });
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.custoCompleto() });
    },
    onError: (error: Error) => showError(error.message),
  });
}

// ---------------------------------------------------------------------------
// Mutations — BOM Processos
// ---------------------------------------------------------------------------

/**
 * Upsert de processo produtivo no BOM de um modelo.
 * Invalida o BOM do modelo.
 */
export function useUpsertModeloProcesso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertModeloProcessoDto & { id?: string }) => upsertModeloProcesso(dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.modeloBOM(data.modelo_id) });
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Remove um processo produtivo do BOM pelo seu ID.
 * Invalida o BOM do modelo (via modeloId).
 */
export function useRemoveModeloProcesso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, modeloId }: { id: string; modeloId: string }) =>
      removeModeloProcesso(id).then(() => modeloId),
    onSuccess: (modeloId) => {
      queryClient.invalidateQueries({ queryKey: CATALOGO_KEYS.modeloBOM(modeloId) });
    },
    onError: (error: Error) => showError(error.message),
  });
}
