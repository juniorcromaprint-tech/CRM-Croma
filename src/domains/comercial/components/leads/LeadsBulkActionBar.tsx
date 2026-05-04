// src/domains/comercial/components/leads/LeadsBulkActionBar.tsx
// Barra sticky de ação em lote — aparece quando há leads selecionados.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.6

import { Send, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  onDisparar: () => void;
  onClear: () => void;
  isDisparando?: boolean;
}

export function LeadsBulkActionBar({ count, onDisparar, onClear, isDisparando }: Props) {
  if (count === 0) return null;

  return (
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

        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Limpar seleção"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
