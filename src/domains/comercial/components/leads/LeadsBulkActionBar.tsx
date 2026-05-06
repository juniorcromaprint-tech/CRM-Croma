// src/domains/comercial/components/leads/LeadsBulkActionBar.tsx
// Barra sticky de ação em lote — aparece quando há leads selecionados.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.6

import { useState } from 'react';
import { Send, X, CheckSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useExcluirLeadsEmLote } from '../../hooks/useExcluirLead';

interface Props {
  count: number;
  selectedIds: string[];
  onDisparar: () => void;
  onClear: () => void;
  isDisparando?: boolean;
}

export function LeadsBulkActionBar({
  count, selectedIds, onDisparar, onClear, isDisparando,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const excluirEmLote = useExcluirLeadsEmLote();

  if (count === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700">
          <CheckSquare size={16} className="text-blue-400 shrink-0" />
          <span className="text-sm font-medium">
            {count} lead{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}
          </span>

          <div className="w-px h-5 bg-slate-700 mx-1" />

          <Button
            size="sm"
            onClick={onDisparar}
            disabled={isDisparando}
            className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-4 rounded-xl gap-1.5"
          >
            <Send size={13} />
            Disparar abertura
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={excluirEmLote.isPending}
            className="text-red-400 hover:bg-red-500/15 hover:text-red-300 h-8 px-3 rounded-xl gap-1.5"
            title="Excluir leads selecionados"
          >
            <Trash2 size={13} />
            Excluir
          </Button>

          <button
            onClick={onClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Limpar seleção"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Confirmacao de exclusao em lote */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {count} lead{count !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count} lead{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}
              {' '}{count !== 1 ? 'serão removidos' : 'será removido'} da listagem.
              Conversas, propostas e historico permanecem, mas
              {' '}{count !== 1 ? 'eles não aparecerão' : 'ele não aparecerá'}
              {' '}mais nos disparos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirEmLote.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await excluirEmLote.mutateAsync(selectedIds);
                  onClear();
                } finally {
                  setConfirmDelete(false);
                }
              }}
              disabled={excluirEmLote.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {excluirEmLote.isPending ? 'Excluindo...' : `Excluir ${count}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
