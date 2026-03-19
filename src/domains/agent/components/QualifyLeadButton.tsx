// ============================================================================
// QUALIFY LEAD BUTTON — Croma Print ERP/CRM
// Botão inline para qualificar um lead via IA
// ============================================================================

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useQualifyLead } from '../hooks/useAgentActions';
import type { AgentQualification } from '../types/agent.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QualifyLeadButtonProps {
  leadId: string;
}

// ─── Score color helper ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

const TEMPERATURA_LABEL: Record<string, string> = {
  quente: 'Quente',
  morno: 'Morno',
  frio: 'Frio',
};

const ACAO_LABEL: Record<string, string> = {
  email: 'Enviar e-mail',
  whatsapp: 'Enviar WhatsApp',
  ligar: 'Ligar',
  aguardar: 'Aguardar',
  descartar: 'Descartar',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function QualifyLeadButton({ leadId }: QualifyLeadButtonProps) {
  const [result, setResult] = useState<AgentQualification | null>(null);
  const [open, setOpen] = useState(false);
  const qualify = useQualifyLead();

  function handleQualify(e: React.MouseEvent) {
    e.stopPropagation();
    qualify.mutate(leadId, {
      onSuccess: (data) => {
        setResult(data);
        setOpen(true);
      },
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={result ? undefined : handleQualify}
          disabled={qualify.isPending}
          className="h-8 gap-1.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
        >
          {qualify.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {qualify.isPending ? 'Qualificando...' : result ? `Score ${result.score}` : 'Qualificar'}
        </Button>
      </PopoverTrigger>

      {result && (
        <PopoverContent
          side="top"
          align="start"
          className="w-72 p-4 rounded-2xl shadow-lg border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            {/* Score */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score IA</span>
              <Badge className={`${scoreColor(result.score)} border font-bold text-sm px-2.5 py-0.5`}>
                {result.score}/100
              </Badge>
            </div>

            {/* Score bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.score >= 70 ? 'bg-emerald-400' :
                  result.score >= 40 ? 'bg-amber-400' :
                  'bg-red-400'
                }`}
                style={{ width: `${result.score}%` }}
              />
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Temperatura</span>
                <span className="font-medium text-slate-700">
                  {TEMPERATURA_LABEL[result.temperatura_sugerida] ?? result.temperatura_sugerida}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Segmento</span>
                <span className="font-medium text-slate-700 truncate ml-2 text-right">{result.segmento_refinado}</span>
              </div>
              {result.potencial_estimado > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Potencial</span>
                  <span className="font-medium text-slate-700">
                    R$ {result.potencial_estimado.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Próxima ação</span>
                <span className="font-medium text-slate-700">
                  {ACAO_LABEL[result.proxima_acao] ?? result.proxima_acao}
                </span>
              </div>
            </div>

            {/* Reason */}
            {result.motivo_acao && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2 leading-relaxed">
                {result.motivo_acao}
              </p>
            )}

            {/* Suggested message preview */}
            {result.mensagem_sugerida && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Mensagem sugerida</span>
                <p className="text-xs text-slate-600 bg-blue-50 rounded-xl p-2 leading-relaxed line-clamp-3">
                  {result.mensagem_sugerida}
                </p>
              </div>
            )}

            {/* Risks */}
            {result.riscos.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Riscos</span>
                <ul className="space-y-0.5">
                  {result.riscos.map((risco, i) => (
                    <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{risco}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Re-qualify */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleQualify}
              disabled={qualify.isPending}
              className="w-full h-8 text-xs gap-1.5 mt-1"
            >
              {qualify.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {qualify.isPending ? 'Qualificando...' : 'Re-qualificar'}
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
