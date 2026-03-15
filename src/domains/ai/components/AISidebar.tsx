import { useState, useCallback } from 'react';
import { X, Sparkles } from 'lucide-react';
import AIActionCard from './AIActionCard';
import AIKPIBar from './AIKPIBar';
import AIApplyBar from './AIApplyBar';
import type { AIActionableResponse, AIActionStatus, ApplierResult } from '../types/ai.types';

interface AISidebarProps {
  isOpen: boolean;
  response: AIActionableResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onApply: (actionIds: string[]) => Promise<Map<string, ApplierResult>>;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  title?: string;
}

export default function AISidebar({
  isOpen,
  response,
  isLoading,
  onClose,
  onApply,
  onReanalyze,
  isReanalyzing,
  title = 'Análise',
}: AISidebarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionStatuses, setActionStatuses] = useState<Map<string, AIActionStatus>>(new Map());
  const [statusMessages, setStatusMessages] = useState<Map<string, string>>(new Map());
  const [isApplying, setIsApplying] = useState(false);

  const applicableActions = response?.actions.filter((a) => a.aplicavel) ?? [];
  const totalApplicable = applicableActions.length;

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === totalApplicable) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applicableActions.map((a) => a.id)));
    }
  }, [selectedIds.size, totalApplicable, applicableActions]);

  const handleApply = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setIsApplying(true);

    const newStatuses = new Map(actionStatuses);
    ids.forEach((id) => newStatuses.set(id, 'applying'));
    setActionStatuses(new Map(newStatuses));

    try {
      const results = await onApply(ids);

      const finalStatuses = new Map(actionStatuses);
      const finalMessages = new Map(statusMessages);

      results.forEach((result, id) => {
        finalStatuses.set(id, result.success ? 'applied' : 'error');
        finalMessages.set(id, result.message);
      });

      setActionStatuses(finalStatuses);
      setStatusMessages(finalMessages);
      setSelectedIds(new Set());
    } finally {
      setIsApplying(false);
    }
  }, [selectedIds, actionStatuses, statusMessages, onApply]);

  const handleReanalyze = useCallback(() => {
    setSelectedIds(new Set());
    setActionStatuses(new Map());
    setStatusMessages(new Map());
    onReanalyze();
  }, [onReanalyze]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="ai-sidebar"
      className="fixed right-0 top-0 h-full w-[380px] bg-slate-900 text-white shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <span className="font-bold text-sm">Croma AI</span>
          <span className="text-slate-500">|</span>
          <span className="text-sm text-slate-300">{title}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-800 rounded-xl h-20" />
            ))}
          </div>
        ) : response ? (
          <div className="p-4 space-y-4">
            <p className="text-xs text-slate-400">{response.summary}</p>
            <AIKPIBar kpis={response.kpis} />
            <div className="space-y-2">
              {response.actions.map((action) => (
                <AIActionCard
                  key={action.id}
                  action={action}
                  selected={selectedIds.has(action.id)}
                  status={actionStatuses.get(action.id) ?? 'idle'}
                  statusMessage={statusMessages.get(action.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {response && totalApplicable > 0 && (
        <AIApplyBar
          selectedCount={selectedIds.size}
          totalCount={totalApplicable}
          isApplying={isApplying}
          onApply={handleApply}
          onSelectAll={handleSelectAll}
          onReanalyze={handleReanalyze}
          isReanalyzing={isReanalyzing}
        />
      )}

      {response && (
        <div className="px-4 py-1.5 border-t border-slate-800 flex justify-between text-[9px] text-slate-500">
          <span>{response.model_used}</span>
          <span>{response.tokens_used} tokens</span>
        </div>
      )}
    </div>
  );
}
