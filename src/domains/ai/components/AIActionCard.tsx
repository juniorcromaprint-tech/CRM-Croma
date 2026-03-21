import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Lightbulb, Zap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AIActionPreview from './AIActionPreview';
import AIStatusBadge from './AIStatusBadge';
import type { AIAction, AIActionStatus, AIActionSeveridade } from '../types/ai.types';

interface AIActionCardProps {
  action: AIAction;
  selected: boolean;
  status: AIActionStatus;
  statusMessage?: string;
  onToggle: (id: string) => void;
}

const SEVERITY_CONFIG: Record<AIActionSeveridade, {
  borderLeft: string; bg: string; Icon: typeof AlertCircle; iconClass: string; label: string;
}> = {
  critica: {
    borderLeft: 'border-l-red-500',
    bg: 'bg-red-50/50',
    Icon: AlertCircle,
    iconClass: 'text-red-500',
    label: 'Critica',
  },
  importante: {
    borderLeft: 'border-l-amber-500',
    bg: 'bg-amber-50/50',
    Icon: AlertTriangle,
    iconClass: 'text-amber-500',
    label: 'Importante',
  },
  dica: {
    borderLeft: 'border-l-blue-500',
    bg: 'bg-blue-50/50',
    Icon: Lightbulb,
    iconClass: 'text-blue-500',
    label: 'Dica',
  },
};

export default function AIActionCard({ action, selected, status, statusMessage, onToggle }: AIActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[action.severidade];
  const isDisabled = status === 'applied' || status === 'applying';

  const statusBg: Record<string, string> = {
    applied: 'bg-emerald-50 border-emerald-200 border-l-emerald-500',
    error: 'bg-red-50 border-red-200 border-l-red-500',
    applying: 'bg-blue-50 border-blue-200 border-l-blue-500',
  };

  const cardClass = statusBg[status]
    ?? `bg-white border-slate-200 ${config.borderLeft} ${selected ? 'ring-2 ring-blue-500/20 border-blue-300' : 'hover:border-slate-300'}`;

  return (
    <div
      className={`rounded-xl border border-l-4 p-4 transition-all duration-200 cursor-pointer shadow-sm ${cardClass}`}
      onClick={() => !isDisabled && onToggle(action.id)}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected || status === 'applied'}
          disabled={isDisabled}
          onCheckedChange={() => onToggle(action.id)}
          className="mt-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <config.Icon size={14} className={`${config.iconClass} shrink-0`} />
            <h4 className="text-sm font-semibold text-slate-800 truncate flex-1">{action.titulo}</h4>
            {status !== 'idle' && <AIStatusBadge status={status} message={statusMessage} />}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{action.descricao}</p>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              <Zap size={10} />
              {action.impacto}
            </span>

            {action.aplicavel && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? 'Ocultar' : 'Detalhes'}
              </button>
            )}
          </div>

          {expanded && (
            <AIActionPreview
              valorAtual={action.valor_atual}
              valorSugerido={action.valor_sugerido}
              tipo={action.tipo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
