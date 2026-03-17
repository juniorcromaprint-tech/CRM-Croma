import { brl } from '@/shared/utils/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PrecificacaoBreakdown } from '@/domains/admin/types/precificacao.types';
import { COMPONENTE_CORES, COMPONENTE_LABELS } from '@/domains/admin/types/precificacao.types';

interface PricingBreakdownProps {
  breakdown: PrecificacaoBreakdown;
  mode?: 'full' | 'compact';
  className?: string;
}

function MargemBadge({ margem }: { margem: number }) {
  const pct = (margem * 100).toFixed(1);
  if (margem >= 0.3) {
    return <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">Margem {pct}%</Badge>;
  }
  if (margem >= 0.15) {
    return <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200">Margem {pct}%</Badge>;
  }
  return <Badge variant="default" className="bg-red-100 text-red-700 border-red-200">Margem {pct}%</Badge>;
}

function StackedBar({ breakdown, height = 'h-4' }: { breakdown: PrecificacaoBreakdown; height?: string }) {
  return (
    <div className={cn('flex w-full rounded-full overflow-hidden', height)}>
      {breakdown.componentes.map((c) => (
        <TooltipProvider key={c.componente} delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn('transition-all', COMPONENTE_CORES[c.componente])}
                style={{ width: `${c.percentual}%` }}
                aria-label={`${COMPONENTE_LABELS[c.componente]}: ${c.percentual.toFixed(1)}%`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <span className="font-medium">{COMPONENTE_LABELS[c.componente]}</span>
              <span className="ml-1 text-slate-300">
                {brl(c.valor)} · {c.percentual.toFixed(1)}%
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

export function PricingBreakdown({ breakdown, mode = 'full', className }: PricingBreakdownProps) {
  if (mode === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <StackedBar breakdown={breakdown} height="h-2" />
        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
          {brl(breakdown.precoVenda)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Stacked bar */}
      <StackedBar breakdown={breakdown} height="h-4" />

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-medium text-slate-500">Componente</th>
              <th className="text-right px-3 py-2 font-medium text-slate-500">Valor</th>
              <th className="text-right px-3 py-2 font-medium text-slate-500">%</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.componentes.map((c, i) => (
              <tr
                key={c.componente}
                className={cn(
                  'border-b border-slate-100 last:border-b-0',
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                )}
              >
                <td className="px-3 py-2 flex items-center gap-2">
                  <span
                    className={cn('w-2.5 h-2.5 rounded-full shrink-0', COMPONENTE_CORES[c.componente])}
                  />
                  {COMPONENTE_LABELS[c.componente]}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(c.valor)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  {c.percentual.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <span className="text-sm font-medium text-blue-800">Preço de Venda</span>
        <div className="flex items-center gap-2">
          <MargemBadge margem={breakdown.margemBruta} />
          <span className="text-base font-bold text-blue-700">{brl(breakdown.precoVenda)}</span>
        </div>
      </div>
    </div>
  );
}
