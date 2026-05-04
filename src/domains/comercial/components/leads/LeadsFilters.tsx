// src/domains/comercial/components/leads/LeadsFilters.tsx
// Barra leve de filtros + drawer "Mais filtros".
// Filtros principais (segmento/sub-seg) ficam fora daqui no SegmentoPills.
// Aqui ficam: busca livre (debounced) + status + temperatura + regiao + toggles + score + datas.

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
  proposta: 'Proposta', negociacao: 'Negociacao', fechado: 'Fechado', perdido: 'Perdido',
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
    f.excluirBloqueados === false,
  ].filter(Boolean).length;
}

export function LeadsFilters({ filters, onChange, onReset }: Props) {
  const [openSheet, setOpenSheet] = useState(false);
  const [buscaLocal, setBuscaLocal] = useState(filters.busca ?? '');
  const buscaDebounced = useDebouncedValue(buscaLocal, 300);

  useEffect(() => {
    if (buscaDebounced !== (filters.busca ?? '')) {
      onChange({ busca: buscaDebounced || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  useEffect(() => {
    if ((filters.busca ?? '') !== buscaLocal) {
      setBuscaLocal(filters.busca ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.busca]);

  const ativos = countAvancados(filters);

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
            <SheetTitle>Filtros avancados</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-4">
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

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Regiao</Label>
              <Select
                value={filters.regioes?.[0] ?? 'all'}
                onValueChange={v => onChange({ regioes: v !== 'all' ? [v] : undefined })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas as regioes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(REGIAO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Score</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100} placeholder="Min"
                  value={filters.scoreMin ?? ''}
                  onChange={e => onChange({ scoreMin: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-xs"
                />
                <span className="text-slate-400 text-xs">ate</span>
                <Input
                  type="number" min={0} max={100} placeholder="Max"
                  value={filters.scoreMax ?? ''}
                  onChange={e => onChange({ scoreMax: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Cadastrado entre</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.cadastroDe?.slice(0, 10) ?? ''}
                  onChange={e => onChange({ cadastroDe: e.target.value || undefined })}
                  className="h-8 text-xs"
                />
                <span className="text-slate-400 text-xs">e</span>
                <Input
                  type="date"
                  value={filters.cadastroAte?.slice(0, 10) ?? ''}
                  onChange={e => onChange({ cadastroAte: e.target.value || undefined })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <ToggleRow
                label="Tem telefone valido"
                checked={filters.temTelefone === true}
                onChange={v => onChange({ temTelefone: v ? true : null })}
              />
              <ToggleRow
                label="Tem email valido"
                checked={filters.temEmail === true}
                onChange={v => onChange({ temEmail: v ? true : null })}
              />
              <ToggleRow
                label="Em conversa ativa"
                checked={filters.emConversaAtiva === true}
                onChange={v => onChange({ emConversaAtiva: v ? true : null })}
              />
              <ToggleRow
                label="Excluir bloqueados (NAO INCLUIR)"
                checked={filters.excluirBloqueados !== false}
                onChange={v => onChange({ excluirBloqueados: v })}
              />
            </div>
          </div>

          <SheetFooter className="mt-6 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1">
              <X size={13} /> Limpar todos
            </Button>
            <Button size="sm" onClick={() => setOpenSheet(false)} className="bg-blue-600 hover:bg-blue-700">
              Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {ativos > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-9 px-2 text-xs text-slate-500">
          <X size={12} className="mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}

function ToggleRow({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-slate-700 cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-90" />
    </div>
  );
}
