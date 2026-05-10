// src/domains/comercial/components/leads/LeadsCardList.tsx
// Lista de cards de leads com paginação shadcn + select-all visíveis na página.
// Substitui LeadsTable na nova UX.
// Fonte: redesign UX 2026-05-04L.

import { useNavigate } from 'react-router-dom';
import { Loader2, Inbox, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationPrevious, PaginationNext,
} from '@/components/ui/pagination';
import { LeadCard } from './LeadCard';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';
import type { useLeadsSelection } from '../../hooks/useLeadsSelection';
import { useEmailEngajamentoLeads } from '../../hooks/useEmailEngajamento';

interface Props {
  leads: LeadDisparo[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (next: number) => void;
  isLoading: boolean;
  selection: ReturnType<typeof useLeadsSelection>;
}

export function LeadsCardList({
  leads, totalCount, page, pageSize, onPageChange, isLoading, selection,
}: Props) {
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const fromIdx = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx   = Math.min(page * pageSize, totalCount);

  // IDs elegíveis na página (não bloqueados)
  const elegiveisPagina = leads.filter(l => !l.bloqueado_disparo).map(l => l.id);
  const todosSelecionados =
    elegiveisPagina.length > 0 && elegiveisPagina.every(id => selection.has(id));

  const handleSelectAllPagina = () => {
    if (todosSelecionados) {
      // Remove só os da página
      elegiveisPagina.forEach(id => {
        if (selection.has(id)) selection.toggle(id);
      });
    } else {
      selection.selectMany(elegiveisPagina);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center min-h-[300px]">
        <Loader2 size={22} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Inbox size={36} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhum lead nesse filtro</h3>
        <p className="text-sm text-slate-400 mt-1">Ajuste os filtros ou importe novos leads</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar — select all + contagem */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <button
          type="button"
          onClick={handleSelectAllPagina}
          className="inline-flex items-center gap-1.5 hover:text-slate-700 transition-colors"
        >
          {todosSelecionados
            ? <CheckSquare size={14} className="text-blue-500" />
            : <Square size={14} />}
          {todosSelecionados ? 'Desmarcar página' : `Selecionar ${elegiveisPagina.length} desta página`}
        </button>
        <span>
          Mostrando <strong className="text-slate-700">{fromIdx}–{toIdx}</strong> de{' '}
          <strong className="text-slate-700">{totalCount}</strong>
        </span>
      </div>

      {/* Lista de cards — busca engajamento de email em batch (1 query pra página inteira) */}
      <LeadsCardsRender
        leads={leads}
        selection={selection}
        onOpen={(id) => navigate(`/leads/${id}`)}
      />


      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }}
                aria-disabled={page === 1}
                className={page === 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
              />
            </PaginationItem>

            {/* Indicador compacto: página atual / total + jumps rápidos */}
            <PaginationItem>
              <span className="px-3 text-sm text-slate-500">
                Página <strong className="text-slate-700">{page}</strong> de{' '}
                <strong className="text-slate-700">{totalPages}</strong>
              </span>
            </PaginationItem>

            {totalPages > 5 && (
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => onPageChange(totalPages)}
                  disabled={page === totalPages}
                >
                  → última
                </Button>
              </PaginationItem>
            )}

            <PaginationItem>
              <PaginationNext
                onClick={(e) => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
                aria-disabled={page === totalPages}
                className={page === totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

// Render interno isolado — fetch de engajamento em batch (1 query/página)
function LeadsCardsRender({
  leads,
  selection,
  onOpen,
}: {
  leads: LeadDisparo[];
  selection: ReturnType<typeof useLeadsSelection>;
  onOpen: (id: string) => void;
}) {
  const leadIds = leads.map(l => l.id);
  const { data: engajamentoMap } = useEmailEngajamentoLeads(leadIds);

  return (
    <div className="space-y-1.5">
      {leads.map(lead => (
        <LeadCard
          key={lead.id}
          lead={lead}
          selected={selection.has(lead.id)}
          onToggle={() => selection.toggle(lead.id)}
          onOpen={() => onOpen(lead.id)}
          emailResumo={engajamentoMap?.get(lead.id)}
        />
      ))}
    </div>
  );
}
