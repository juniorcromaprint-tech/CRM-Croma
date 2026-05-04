// src/domains/comercial/components/leads/LeadsFilters.tsx
// Barra leve de filtros + drawer "Mais filtros".
// Filtros principais (segmento/sub-seg) ficam fora daqui no SegmentoPills.
// Aqui ficam: busca livre (debounced) + status + temperatura + região + toggles + score + datas.
// Fonte: redesign UX 2026-05-04L.

import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from '@/components/ui/sheet';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import type { LeadsFilterState } from '../../hooks/useLeadsDisparo';

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado',
  proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

const TEMPERATURA_LABELS: Record<string, string> = {
  frio: 'Frio', morno: 'Morno', quente: 'Quente',
};

const REGIAO_LABELS: Record<string, string> = {
  capital: 'Capital SP',
  grande_sp: 'Grande SP',
  abc: 'ABC Paulista',
  outros: 'Outros',
};

interface Props {
  filters: LeadsFilterState;
  onChange: (next: Partial<LeadsFilterState>) => void;
  onReset: () => void;
}

// ─── Conta filtros avançados ativos (para badge no botão) ────────────────────

function countAvancados(f: LeadsFilterState) {
  return [
    (f.status?.length ?? 0) > 0,
    (f.temperaturas?.length ?? 0) > 0,
    (f.regioes?.length ?? 0) > 0,
    (f.cidades?.length ?? 0) > 0,
    f.temTelefone === true || f.temTelefone === false,
    f.temEmail === true || f.temEmail === false,
    f.emConversaAtiva === true || f.emConversaAtiva === false,
    f.scoreMin != null || f.scoreMax != null,
    Boolean(f.cadastroDe || f.cadastroAte),
    Boolean(f.vendedorId),
    f.excluirBloqueados === false, // toggle off é considerado "ajustado"
  ].filter(Boolean).length;
}

// ─── Componente principal ────────────────────────────────────────────────────

export function LeadsFilters({ filters, onChange, onReset }: Props) {
  const [openSheet, setOpenSheet] = useState(false);
  const [buscaLocal, setBuscaLocal] = useState(filters.busca ?? '');
  const buscaDebounced = useDebouncedValue(buscaLocal, 300);

  // Sincroniza debounce → onChange (evitando loop com filters.busca remoto)
  useEffect(() => {
    if (buscaDebounced !== (filters.busca ?? '')) {
      onChange({ busca: buscaDebounced || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  // Sincroniza filtro externo (ex: clicar "Limpar todos") → estado local
  useEffect(() => {
    if ((filters.busca ?? '') !== buscaLocal) {
      setBuscaLocal(filters.busca ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.busca]);

  const ativos = countAvancados(filters);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Busca livre */}
      <div className="relative flex-1 min-w-[220px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar empresa, contato ou telefone..."
          value={buscaLocal}
          onChange={e => setBuscaLocal(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
        {buscaLocal && (
          <button
            onClick={() => setBuscaLocal('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Botão "Mais filtros" */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
            <SlidersHorizontal size={13} />
            Mais filtros
            {ativos > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {ativos}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros avançados</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            {/* Status */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
              <Select
                value={filters.status?.[0] ?? 'all'}
                onValueChange={v => onChange({ status: v !== 'all' ? [v] : undefined })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperatura */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Temperatura</Label>
              <Select
                value={filters.temperaturas?.[0] ?? 'all'}
                onValueChange={v => onChange({ temperaturas: v !== 'all' ? [v] : undefined })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(TEMPERATURA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Região */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Região</Label>
              <Select
                value={filters.regioes?.[0] ?? 'all'}
                onValueChange={v => onChange({ regioes: v !== 'all' ? [v] : undefined })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas as regiões" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(REGIAO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Score range */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Score</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100} placeholder="Mín"
                  value={filters.scoreMin ?? ''}
                  onChange={e => onChange({ scoreMin: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-xs"
                />
                <span className="text-slate-400 text-xs">até</span>
                <Input
                  type="number" min={0} max={100} placeholder="Máx"
                  value={filters.scoreMax ?? ''}
                  onChange={e => onChange({ scoreMax: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Data de cadastro */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Cadastrado entre</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.cadastroDe?.slice(0, 10) ?? ''}