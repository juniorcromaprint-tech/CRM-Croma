/**
 * CatalogoProdutosPage.tsx
 * Página de catálogo de produtos — layout master-detail com 3 painéis:
 *   1. Sidebar de categorias (TreeView hierárquico)
 *   2. Lista de produtos filtrados
 *   3. Detalhe do produto selecionado (composição BOM + precificação)
 */

import { useState, useEffect } from 'react';
import { Package, Search, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TreeView } from '@/shared/components/TreeView';
import type { TreeNode } from '@/shared/components/TreeView';
import { PricingBreakdown } from '@/shared/components/PricingBreakdown';
import { ComposicaoEditor } from '../components/ComposicaoEditor';
import { useCategorias, useProdutos, useModelosByProduto } from '../hooks/useCatalogo';
import { useCalcPrecoBOM } from '../hooks/usePrecificacao';
import type { CategoriaProduto, Produto, ProdutoModelo } from '../types/catalogo.types';
import type { PrecificacaoBreakdown } from '../types/precificacao.types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoriasToTree(cats: CategoriaProduto[]): TreeNode[] {
  return cats.map((c) => ({
    id: c.id,
    label: c.nome,
    children: c.children ? categoriasToTree(c.children) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// PrecificacaoPanel — calcula e exibe o breakdown de preço de um modelo
// ---------------------------------------------------------------------------

interface PrecificacaoPanelProps {
  modeloId: string;
  modelo: ProdutoModelo;
}

function PrecificacaoPanel({ modeloId, modelo }: PrecificacaoPanelProps) {
  const calcPreco = useCalcPrecoBOM();
  const [breakdown, setBreakdown] = useState<PrecificacaoBreakdown | null>(null);
  const [markupUsado, setMarkupUsado] = useState<number | null>(null);
  const [regraCategoria, setRegraCategoria] = useState<string | null>(null);

  function calcular() {
    calcPreco.mutate(
      { modelo_id: modeloId, quantidade: 1 },
      {
        onSuccess: (result) => {
          setBreakdown(result.breakdown);
          setMarkupUsado(result.markup_usado);
          setRegraCategoria(result.regra_categoria);
        },
      },
    );
  }

  useEffect(() => {
    calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId]);

  if (calcPreco.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-slate-500">Calculando precificação...</p>
      </div>
    );
  }

  if (calcPreco.isError) {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center">
        <p className="text-sm font-medium text-red-700 mb-1">Erro ao calcular</p>
        <p className="text-xs text-red-500 mb-4">
          {(calcPreco.error as Error)?.message ?? 'Erro desconhecido'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={calcular}
          className="rounded-xl border-red-300 text-red-700 hover:bg-red-100"
        >
          <RefreshCw size={14} className="mr-1.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metadados da regra aplicada */}
      <div className="flex items-center gap-3 flex-wrap">
        {regraCategoria && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Regra aplicada:</span>
            <Badge variant="secondary" className="capitalize">
              {regraCategoria}
            </Badge>
          </div>
        )}
        {markupUsado !== null && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Markup usado:</span>
            <Badge variant="outline">{(markupUsado * 100).toFixed(1)}%</Badge>
          </div>
        )}
        {modelo.area_m2 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Área:</span>
            <span>{modelo.area_m2} m²</span>
          </div>
        )}
      </div>

      <PricingBreakdown breakdown={breakdown} />

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={calcular}
          disabled={calcPreco.isPending}
          className="rounded-xl"
        >
          {calcPreco.isPending ? (
            <Loader2 size={14} className="animate-spin mr-1.5" />
          ) : (
            <RefreshCw size={14} className="mr-1.5" />
          )}
          Recalcular
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetalhePanel — painel direito: info do produto + selector de modelos + tabs
// ---------------------------------------------------------------------------

interface DetalhePanelProps {
  produto: Produto;
  categoriaNome: string | null;
}

function DetalhePanel({ produto, categoriaNome }: DetalhePanelProps) {
  const { data: modelos = [], isLoading: loadingModelos } = useModelosByProduto(produto.id);
  const [selectedModeloId, setSelectedModeloId] = useState<string>('');

  // Seleciona o primeiro modelo automaticamente quando os dados chegam
  useEffect(() => {
    if (modelos.length > 0 && !selectedModeloId) {
      setSelectedModeloId(modelos[0].id);
    }
    if (modelos.length > 0 && !modelos.find((m) => m.id === selectedModeloId)) {
      setSelectedModeloId(modelos[0].id);
    }
  }, [modelos, selectedModeloId]);

  const selectedModelo = modelos.find((m) => m.id === selectedModeloId) ?? null;

  return (
    <div className="space-y-4">
      {/* Header do produto */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Package size={20} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-800 text-lg leading-tight">{produto.nome}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {produto.codigo}
            </Badge>
            {categoriaNome && (
              <Badge variant="outline" className="text-xs">
                {categoriaNome}
              </Badge>
            )}
            {!produto.ativo && (
              <Badge variant="destructive" className="text-xs">
                Inativo
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Selector de modelos */}
      {loadingModelos ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={16} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-400">Carregando modelos...</span>
        </div>
      ) : modelos.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-sm text-slate-400">Nenhum modelo cadastrado para este produto</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {modelos.map((m: ProdutoModelo) => (
            <button
              key={m.id}
              onClick={() => setSelectedModeloId(m.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                m.id === selectedModeloId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600',
              )}
            >
              {m.nome}
              {m.area_m2 && (
                <span
                  className={cn(
                    'ml-1.5 text-xs',
                    m.id === selectedModeloId ? 'text-blue-200' : 'text-slate-400',
                  )}
                >
                  {m.area_m2} m²
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tabs de detalhe */}
      {selectedModelo ? (
        <Tabs defaultValue="composicao" className="w-full">
          <TabsList className="rounded-xl">
            <TabsTrigger value="composicao" className="rounded-lg">
              Composição BOM
            </TabsTrigger>
            <TabsTrigger value="precificacao" className="rounded-lg">
              Precificação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="composicao" className="mt-4">
            <ComposicaoEditor modeloId={selectedModelo.id} />
          </TabsContent>

          <TabsContent value="precificacao" className="mt-4">
            <PrecificacaoPanel
              key={selectedModelo.id}
              modeloId={selectedModelo.id}
              modelo={selectedModelo}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogoProdutosPage — componente raiz
// ---------------------------------------------------------------------------

export default function CatalogoProdutosPage() {
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  const { data: categorias, isLoading: loadingCats } = useCategorias();
  const { data: produtos = [], isLoading: loadingProdutos } = useProdutos({
    categoriaId: selectedCategoriaId ?? undefined,
    search: searchQuery || undefined,
  });

  const treeNodes: TreeNode[] = categorias?.tree ? categoriasToTree(categorias.tree) : [];

  // Encontra o nome da categoria selecionada para exibir no detalhe
  const categoriaNome = selectedProduto?.categoria_id
    ? (categorias?.flat.find((c) => c.id === selectedProduto.categoria_id)?.nome ?? null)
    : (selectedProduto?.categoria ?? null);

  // Quando filtros mudam, limpa seleção de produto se não está mais na lista
  useEffect(() => {
    if (selectedProduto && produtos.length > 0) {
      const ainda = produtos.find((p) => p.id === selectedProduto.id);
      if (!ainda) setSelectedProduto(null);
    }
  }, [produtos, selectedProduto]);

  return (
    <div className="p-4 h-full">
      {/* Título da página */}
      <div className="flex items-center gap-2 mb-4">
        <Package size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-slate-800">Catálogo de Produtos</h1>
      </div>

      {/* Layout 3 painéis */}
      <div className="flex gap-4 h-[calc(100vh-120px)]">
        {/* ================================================================
            Painel 1 — Sidebar Categorias
        ================================================================ */}
        <div className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200 p-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Package size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Categorias</span>
          </div>

          {/* Botão "Todos" */}
          <button
            onClick={() => setSelectedCategoriaId(null)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors',
              selectedCategoriaId === null
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <ChevronRight size={14} className="text-slate-400" />
            Todos os produtos
          </button>

          {loadingCats ? (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : treeNodes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Nenhuma categoria</p>
          ) : (
            <TreeView
              nodes={treeNodes}
              selectedId={selectedCategoriaId ?? undefined}
              onSelect={(node) => setSelectedCategoriaId(node.id)}
              defaultExpandAll
            />
          )}
        </div>

        {/* ================================================================
            Painel 2 — Lista de Produtos
        ================================================================ */}
        <div className="w-60 shrink-0 bg-white rounded-2xl border border-slate-200 overflow-y-auto">
          {/* Input de busca */}
          <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm rounded-xl"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="p-2">
            {loadingProdutos ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : produtos.length === 0 ? (
              <div className="py-8 text-center">
                <Package size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Nenhum produto encontrado</p>
              </div>
            ) : (
              produtos.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => setSelectedProduto(produto)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors',
                    selectedProduto?.id === produto.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50 border border-transparent',
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      selectedProduto?.id === produto.id ? 'text-blue-700' : 'text-slate-700',
                    )}
                  >
                    {produto.nome}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {produto.categoria ?? '—'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ================================================================
            Painel 3 — Detalhe do Produto
        ================================================================ */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-y-auto p-4">
          {!selectedProduto ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-600">Selecione um produto</h3>
              <p className="text-sm text-slate-400 mt-1">
                Escolha um produto na lista para ver a composição e precificação
              </p>
            </div>
          ) : (
            <DetalhePanel produto={selectedProduto} categoriaNome={categoriaNome} />
          )}
        </div>
      </div>
    </div>
  );
}
