// src/domains/terceirizacao/pages/TerceirizacaoPage.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Network, Loader2, AlertCircle } from 'lucide-react';

// Debounce hook sem dependência externa
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
import {
  useTerceirizacaoCatalogo,
  useTerceirizacaoCategorias,
  type TerceirizacaoItem,
} from '@/hooks/useTerceirizacaoCatalogo';
import TerceirizacaoFilters from '../components/TerceirizacaoFilters';
import TerceirizacaoProductCard from '../components/TerceirizacaoProductCard';
import TerceirizacaoDetailDrawer from '../components/TerceirizacaoDetailDrawer';
import TerceirizacaoEmptyState from '../components/TerceirizacaoEmptyState';

// ─── Skeletons ───────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/3 mb-3" />
      <div className="h-5 bg-slate-100 rounded-md w-1/2 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-slate-100 rounded-lg w-16" />
        <div className="h-5 bg-slate-100 rounded-lg w-20" />
      </div>
      <div className="border-t border-slate-50 pt-3 space-y-2">
        <div className="flex justify-between">
          <div className="h-3 bg-slate-100 rounded w-16" />
          <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-slate-100 rounded w-20" />
          <div className="h-4 bg-slate-100 rounded w-24" />
        </div>
      </div>
    </div>
  );
}

// ─── Paginação ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 48;

// ─── Componente principal ────────────────────────────────────────────────────

export default function TerceirizacaoPage() {
  const [searchRaw, setSearchRaw] = useState('');
  const [categoria, setCategoria] = useState('');
  const [selectedItem, setSelectedItem] = useState<TerceirizacaoItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Debounce na busca para não disparar query a cada tecla
  const [search] = useDebounce(searchRaw, 300);

  const { data: items = [], isLoading, isError } = useTerceirizacaoCatalogo({
    categoria: categoria || undefined,
    search: search || undefined,
  });

  const { data: categorias = [] } = useTerceirizacaoCategorias();

  const temFiltro = searchRaw.length > 0 || categoria !== '';

  // Reset página quando filtros mudam
  const handleSearchChange = useCallback((v: string) => {
    setSearchRaw(v);
    setPage(1);
  }, []);

  const handleCategoriaChange = useCallback((v: string) => {
    setCategoria(v);
    setPage(1);
  }, []);

  // Paginação client-side (os dados já vêm filtrados do banco)
  const paginado = useMemo(() => items.slice(0, page * PAGE_SIZE), [items, page]);
  const temMais = items.length > page * PAGE_SIZE;

  function abrirDetalhe(item: TerceirizacaoItem) {
    setSelectedItem(item);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          <Network size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Terceirização</h1>
          <p className="text-sm text-slate-400">Catálogo de produtos disponíveis via parceiros</p>
        </div>
      </div>

      {/* Filtros */}
      <TerceirizacaoFilters
        search={searchRaw}
        onSearchChange={handleSearchChange}
        categoria={categoria}
        onCategoriaChange={handleCategoriaChange}
        categorias={categorias}
        total={items.length}
        filtrado={items.length}
      />

      {/* Estados */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
          <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
          <h3 className="font-semibold text-slate-600">Erro ao carregar catálogo</h3>
          <p className="text-sm text-slate-400 mt-1">
            Verifique a conexão com o banco e tente novamente.
          </p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <TerceirizacaoEmptyState comFiltro={temFiltro} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginado.map((item) => (
              <TerceirizacaoProductCard
                key={item.id}
                item={item}
                onClick={() => abrirDetalhe(item)}
              />
            ))}
          </div>

          {/* Carregar mais */}
          {temMais && (
            <div className="text-center pt-2">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-6 py-2 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                Carregar mais ({items.length - page * PAGE_SIZE} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawer de detalhes */}
      <TerceirizacaoDetailDrawer
        item={selectedItem}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
