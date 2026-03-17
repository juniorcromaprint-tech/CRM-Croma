// src/shared/components/SemaforoBadge.tsx

import { cn } from "@/lib/utils";
import type { SemaforoStatus } from "@/domains/estoque/types/estoque.types";

interface SemaforoBadgeProps {
  status: SemaforoStatus;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  pulsing?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const COLOR_MAP: Record<SemaforoStatus, string> = {
  verde: 'bg-emerald-500',
  amarelo: 'bg-amber-500',
  vermelho: 'bg-red-500',
};

const LABEL_MAP: Record<SemaforoStatus, string> = {
  verde: 'Normal',
  amarelo: 'Atenção',
  vermelho: 'Crítico',
};

export function SemaforoBadge({
  status,
  size = 'md',
  label,
  pulsing,
  className,
}: SemaforoBadgeProps) {
  const shouldPulse = pulsing ?? status !== 'verde';

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded-full flex-shrink-0",
          SIZE_MAP[size],
          COLOR_MAP[status],
          shouldPulse && status !== 'verde' && "animate-pulse"
        )}
        aria-label={`Estoque ${LABEL_MAP[status]}`}
        role="img"
      />
      {label !== undefined && (
        <span className="text-xs font-medium text-slate-600">
          {label || LABEL_MAP[status]}
        </span>
      )}
    </span>
  );
}
