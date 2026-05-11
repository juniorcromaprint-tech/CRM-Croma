// src/domains/comercial/components/leads/SegmentoSalvoLoader.tsx
// Botão pra carregar um segmento salvo (lista de lead.ids) na cesta.
// UX #8 da sessão 2026-05-11.

import { useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLeadSegments, useDeleteLeadSegment } from '../../hooks/useLeadSegments';
import type { useLeadsSelection } from '../../hooks/useLeadsSelection';

interface Props {
  selection: ReturnType<typeof useLeadsSelection>;
}

export function SegmentoSalvoLoader({ selection }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { data: segments = [], isLoading } = useLeadSegments();
  const deleteSegment = useDeleteLeadSegment();

  const handleLoad = (ids: string[]) => {
    selection.selectMany(ids);
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSegment.mutateAsync(id);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark size={14} />
            Segmentos
            {segments.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {segments.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[420px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookmarkCheck size={16} className="text-blue-600" />
              Segmentos salvos
            </SheetTitle>
            <p className="text-xs text-slate-500">
              Listas reutilizáveis de leads. Útil pra follow-up — ex: WhatsApp depois nos mesmos que receberam email.
            </p>
          </SheetHeader>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                <Loader2 size={14} className="animate-spin" /> Carregando...
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bookmark size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">Nenhum segmento salvo ainda</p>
                <p className="text-xs text-slate-400 mt-1">
                  Após o próximo disparo, use "Salvar lista como segmento" no passo Resultado.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[70vh]">
                <ul className="space-y-2">
                  {segments.map(s => (
                    <li key={s.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-slate-800 truncate">{s.nome}</h4>
                          {s.descricao && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{s.descricao}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Users size={11} /> {s.total_leads ?? s.lead_ids.length} leads
                            </span>
                            <span>{new Date(s.criado_em).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setConfirmDeleteId(s.id)}
                          className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir segmento"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleLoad(s.lead_ids)}
                          className="bg-blue-600 hover:bg-blue-700 h-7 text-[11px] gap-1 flex-1"
                        >
                          <BookmarkCheck size={11} />
                          Carregar na cesta
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              ⚠ Excluir segmento permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-slate-700">
                  O segmento será removido. Os leads em si <strong>não</strong> são afetados.
                </p>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSegment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (confirmDeleteId) await handleDelete(confirmDeleteId);
              }}
              disabled={deleteSegment.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteSegment.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
