// src/domains/ai/components/AIResultPanel.tsx

import { AlertTriangle, CheckCircle, Info, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AIResponse, AIRisk, AISuggestion } from '../types/ai.types';

interface AIResultPanelProps {
  result: AIResponse;
  title: string;
  onClose?: () => void;
  children?: React.ReactNode;
}

const CONFIDENCE_STYLES = {
  alta: 'bg-green-100 text-green-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-red-100 text-red-700',
};

const SEVERITY_CONFIG = {
  alta: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle, iconClass: 'text-red-500' },
  media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  baixa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info, iconClass: 'text-blue-500' },
};

/** @deprecated Use AISidebar instead */
export default function AIResultPanel({ result, title, onClose, children }: AIResultPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    risks: true,
    suggestions: true,
    actions: true,
  });

  const toggleSection = (section: string) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <span>Croma AI</span>
          <span className="text-blue-200">|</span>
          <span className="font-normal">{title}</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_STYLES[result.confidence]}`}>
            {result.confidence}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white text-sm">
              Fechar
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Summary */}
        <p className="text-sm text-slate-700">{result.summary}</p>

        {/* Risks */}
        {result.risks.length > 0 && (
          <CollapsibleSection
            title={`Riscos (${result.risks.length})`}
            expanded={expandedSections.risks}
            onToggle={() => toggleSection('risks')}
          >
            <div className="space-y-2">
              {result.risks.map((risk, i) => (
                <RiskItem key={i} risk={risk} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <CollapsibleSection
            title={`Sugestoes (${result.suggestions.length})`}
            expanded={expandedSections.suggestions}
            onToggle={() => toggleSection('suggestions')}
          >
            <div className="space-y-2">
              {result.suggestions.map((s, i) => (
                <SuggestionItem key={i} suggestion={s} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Required Actions */}
        {result.required_actions.length > 0 && (
          <CollapsibleSection
            title={`Acoes Obrigatorias (${result.required_actions.length})`}
            expanded={expandedSections.actions}
            onToggle={() => toggleSection('actions')}
          >
            <ul className="space-y-1">
              {result.required_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle size={12} className="text-blue-500 mt-0.5 shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Custom content (structured_data rendered by parent) */}
        {children}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>Modelo: {result.model_used}</span>
        <span>{result.tokens_used} tokens</span>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 w-full"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {title}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

function RiskItem({ risk }: { risk: AIRisk }) {
  const style = SEVERITY_CONFIG[risk.level];
  return (
    <div className={`flex items-start gap-2 ${style.bg} border ${style.border} rounded-xl p-3 text-xs ${style.text}`}>
      <style.Icon size={14} className={`${style.iconClass} shrink-0 mt-0.5`} />
      <div>
        <span className="font-semibold">{risk.description}</span>
        {risk.action && <span className="block mt-0.5 opacity-80">{risk.action}</span>}
      </div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: AISuggestion }) {
  const priorityColor = {
    alta: 'text-red-600 bg-red-50',
    media: 'text-amber-600 bg-amber-50',
    baixa: 'text-blue-600 bg-blue-50',
  }[suggestion.priority];

  return (
    <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${priorityColor}`}>
        {suggestion.priority}
      </span>
      <div>
        <span>{suggestion.text}</span>
        {suggestion.impact && <span className="block mt-0.5 text-slate-400">{suggestion.impact}</span>}
      </div>
    </div>
  );
}
