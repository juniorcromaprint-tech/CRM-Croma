import { Loader2, RefreshCw, CheckSquare } from 'lucide-react';
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
    <div className="border-t border-slate-700 bg-slate-900 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{selectedCount} de {totalCount} selecionadas</span>
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1 hover:text-white transition-colors"
          disabled={isApplying}
        >
          <CheckSquare size={12} />
          {selectedCount === totalCount ? 'Desmarcar Todas' : 'Selecionar Todas'}
        </button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReanalyze}
          disabled={isReanalyzing || isApplying}
          className="flex-1 rounded-xl gap-1.5 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          {isReanalyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Re-analisar
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          disabled={selectedCount === 0 || isApplying}
          className="flex-1 rounded-xl gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold"
        >
          {isApplying ? (
            <><Loader2 size={12} className="animate-spin" /> Aplicando...</>
          ) : (
            `Aplicar ${selectedCount} Selecionada${selectedCount !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
