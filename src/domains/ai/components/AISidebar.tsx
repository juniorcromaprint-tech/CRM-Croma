import { useState, useCallback } from 'react';
import { X, Sparkles, Bot } from 'lucide-react';
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
  title = 'Análise do Orçamento',
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

  const appliedCount = [...actionStatuses.values()].filter((s) => s === 'applied').length;
  const errorCount = [...actionStatuses.values()].filter((s) => s === 'error').length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        data-testid="ai-sidebar"
        className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 shrink-0 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-white">Croma AI</h2>
                <p className="text-xs text-blue-100">{title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {isLoading ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Bot size={16} className="animate-pulse text-blue-600" />
                <span>Analisando orçamento...</span>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-white rounded-xl h-24 border border-slate-200" />
                </div>
              ))}
            </div>
          ) : response ? (
            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-700 leading-relaxed">{response.summary}</p>
              </div>

              {/* KPIs */}
              <AIKPIBar kpis={response.kpis} />

              {/* Results summary if actions were applied */}
              {(appliedCount > 0 || errorCount > 0) && (
                <div className="flex gap-2 text-xs">
                  {appliedCount > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
                      {appliedCount} aplicada{appliedCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-medium">
                      {errorCount} erro{errorCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sugestões ({response.actions.length})
                </h3>
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
          <div className="px-5 py-2 border-t border-slate-100 flex justify-between text-xs text-slate-400">
            <span>{response.model_used}</span>
            <span>{response.tokens_used.toLocaleString()} tokens</span>
          </div>
        )}
      </div>
    </>
  );
}
