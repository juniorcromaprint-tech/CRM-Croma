// src/domains/comercial/components/leads/LeadsFilters.tsx
// Barra de filtros ricos para /leads — usa vw_leads_disparo.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.3

import { X, SlidersHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { LeadsFilterState } from '../../hooks/useLeadsDisparo';

const SUB_SEGMENTO_LABELS: Record<string, string> = {
  vigilancia_patrimonial: 'Vigilância Patrimonial',
  seguranca_eletronica:   'Segurança Eletrônica',
  portaria_acesso:        'Portaria / Acesso',
  monitoramento_24h:      'Monitoramento 24h',
};

const REGIAO_LABELS: Record<string, string> = {
  capital:    'Capital SP',
  grande_sp:  'Grande SP',
  abc:        'ABC Paulista',
  outros:     'Outros',
};

const STATUS_LABELS: Record<string, string> = {
  novo:        'Novo',
  contatado:   'Contatado',
  qualificado: 'Qualificado',
  proposta:    'Proposta',
  negociacao:  'Negociação',
  fechado:     'Fechado',
  perdido:     'Perdido',
};

const TEMPERATURA_LABELS: Record<string, string> = {
  frio:    'Frio',
  morno:   'Morno',
  quente:  'Quente',
};

interface Props {
  filters: LeadsFilterState;
  onChange: (next: Partial<LeadsFilterState>) => void;
  onReset: () => void;
  totalVisible: number;
}

export function LeadsFilters({ filters, onChange, onReset, totalVisible }: Props) {
  const activeCount = [
    (filters.segmentos?.length ?? 0) > 0,
    (filters.subSegmentos?.length ?? 0) > 0,
    (filters.status?.length ?? 0) > 0,
    (filters.temperaturas?.length ?? 0) > 0,
    (filters.regioes?.length ?? 0) > 0,
    filters.temTelefone !== null && filters.temTelefone !== undefined,
    filters.emConversaAtiva !== null && filters.emConversaAtiva !== undefined,
    filters.busca,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
              {activeCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{totalVisible} leads</span>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
              <X size={12} className="mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Busca livre */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar empresa, contato ou telefone..."
          value={filters.busca ?? ''}
          onChange={e => onChange({ busca: e.target.value || undefined })}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Row 1: Segmento + Sub-segmento */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Segmento</Label>
          <Select
            value={filters.segmentos?.[0] ?? 'all'}
            onValueChange={v => onChange({ segmentos: v !== 'all' ? [v] : [] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="seguranca">Segurança</SelectItem>
              <SelectItem value="calcados">Calçados</SelectItem>
              <SelectItem value="varejo">Varejo</SelectItem>
              <SelectItem value="franquia">Franquia</SelectItem>
              <SelectItem value="supermercado">Supermercado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Sub-segmento</Label>
          <Select
            value={filters.subSegmentos?.[0] ?? 'all'}
            onValueChange={v => onChange({ subSegmentos: v !== 'all' ? [v] : [] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(SUB_SEGMENTO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Status + Temperatura */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
          <Select
            value={filters.status?.[0] ?? 'all'}
            onValueChange={v => onChange({ status: v !== 'all' ? [v] : [] })}
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
            onValueChange={v => onChange({ temperaturas: v !== 'all' ? [v] : [] })}
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
      </div>

      {/* Row 3: Região */}
      <div>
        <Label className="text-xs text-slate-500 mb-1 block">Região</Label>
        <Select
          value={filters.regioes?.[0] ?? 'all'}
          onValueChange={v => onChange({ regioes: v !== 'all' ? [v] : [] })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas as regiões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regiões</SelectItem>
            {Object.entries(REGIAO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Tem telefone válido</Label>
          <Switch
            checked={filters.temTelefone === true}
            onCheckedChange={v => onChange({ temTelefone: v ? true : null })}
            className="scale-75"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Em conversa ativa</Label>
          <Switch
            checked={filters.emConversaAtiva === true}
            onCheckedChange={v => onChange({ emConversaAtiva: v ? true : null })}
            className="scale-75"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Excluir bloqueados</Label>
          <Switch
            checked={filters.excluirBloqueados !== false}
            onCheckedChange={v => onChange({ excluirBloqueados: v })}
            className="scale-75"
          />
        </div>
      </div>
    </div>
  );
}
