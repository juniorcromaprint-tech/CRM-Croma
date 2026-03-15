import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
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
  bg: string; border: string; Icon: typeof AlertCircle; iconClass: string;
}> = {
  critica: { bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: AlertCircle, iconClass: 'text-red-500' },
  importante: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  dica: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', Icon: Lightbulb, iconClass: 'text-blue-500' },
};

export default function AIActionCard({ action, selected, status, statusMessage, onToggle }: AIActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[action.severidade];
  const isDisabled = status === 'applied' || status === 'applying';
  const appliedBg = status === 'applied' ? 'bg-green-500/10 border-green-500/30' : '';

  return (
    <div className={`rounded-xl border p-3 transition-all ${appliedBg || `${config.bg} ${config.border}`}`}>
      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected || status === 'applied'}
          disabled={isDisabled}
          onCheckedChange={() => onToggle(action.id)}
          className="mt-0.5"
        />
        <config.Icon size={14} className={`${config.iconClass} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{action.titulo}</h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {status !== 'idle' && <AIStatusBadge status={status} message={statusMessage} />}
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {action.impacto}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{action.descricao}</p>

          {action.aplicavel && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 mt-1.5"
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {expanded ? 'Ocultar preview' : 'Ver antes/depois'}
            </button>
          )}

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
