// ============================================================================
// FINANCEIRO — Shared UI sub-components (KPI cards, skeletons)
// ============================================================================

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── KPI Card ───────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight font-mono">
            {value}
          </p>
          {sub && (
            <p
              className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

export function KpiSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
