import { Loader2, RefreshCw, CheckSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIApplyBarProps {
  selectedCount: number;
  totalCount: number;
  isApplying: boolean;
  onApply: () => void;
  onSelectAll: () => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
}

export default function AIApplyBar({
  selectedCount,
  totalCount,
  isApplying,
  onApply,
  onSelectAll,
  onReanalyze,
  isReanalyzing,
}: AIApplyBarProps) {
  return (
    <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          <span className="text-slate-800 font-semibold">{selectedCount}</span> de {totalCount} selecionadas
        </span>
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
          disabled={isApplying}
        >
          <CheckSquare size={12} />
          {selectedCount === totalCount ? 'Desmarcar' : 'Selecionar Todas'}
        </button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReanalyze}
          disabled={isReanalyzing || isApplying}
          className="flex-1 rounded-xl gap-1.5 h-10 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
        >
          {isReanalyzing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Re-analisar
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          disabled={selectedCount === 0 || isApplying}
          className="flex-1 rounded-xl gap-1.5 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-40"
        >
          {isApplying ? (
            <><Loader2 size={13} className="animate-spin" /> Aplicando...</>
          ) : (
            <><Zap size={13} /> Aplicar ({selectedCount})</>
          )}
        </Button>
      </div>
    </div>
  );
}
