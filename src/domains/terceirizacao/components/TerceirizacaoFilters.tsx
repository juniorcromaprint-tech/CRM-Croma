// src/domains/terceirizacao/components/TerceirizacaoFilters.tsx

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TerceirizacaoFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  categoria: string;
  onCategoriaChange: (v: string) => void;
  categorias: string[];
  total: number;
  filtrado: number;
}

export default function TerceirizacaoFilters({
  search,
  onSearchChange,
  categoria,
  onCategoriaChange,
  categorias,
  total,
  filtrado,
}: TerceirizacaoFiltersProps) {
  const temFiltro = search.length > 0 || categoria !== '';

  function limpar() {
    onSearchChange('');
    onCategoriaChange('');
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl border-slate-200"
          />
        </div>

        {/* Categoria */}
        <Select value={categoria || '_all'} onValueChange={(v) => onCategoriaChange(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[200px] rounded-xl border-slate-200">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas as categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Limpar filtros */}
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={limpar}
            className="text-slate-500 hover:text-slate-700 rounded-xl gap-1.5"
          >
            <X size={14} /> Limpar
          </Button>
        )}
      </div>

      {/* Contagem */}
      <p className="text-sm text-slate-500 whitespace-nowrap">
        {temFiltro ? (
          <>
            <span className="font-semibold text-slate-700">{filtrado}</span> de {total} produto{total !== 1 ? 's' : ''}
          </>
        ) : (
          <>
            <span className="font-semibold text-slate-700">{total}</span> produto{total !== 1 ? 's' : ''}
          </>
        )}
      </p>
    </div>
  );
}
