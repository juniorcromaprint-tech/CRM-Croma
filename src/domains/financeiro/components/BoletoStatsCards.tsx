// ─── Boleto Stats Cards ──────────────────────────────────────────────────────
// Croma Print ERP — 4 KPI cards para boletos
// ─────────────────────────────────────────────────────────────────────────────

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { brl } from '@/shared/utils/format';

interface BoletoStatsData {
  totalEmitidos: number;
  valorEmitidos: number;
  totalAVencer: number;
  valorAVencer: number;
  totalVencidos: number;
  valorVencidos: number;
  totalPagos: number;
  valorPagos: number;
}

interface BoletoStatsCardsProps {
  data?: BoletoStatsData;
  isLoading?: boolean;
}

const CARDS = [
  {
    key: 'emitidos' as const,
    label: 'Total Emitidos',
    icon: Receipt,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    totalKey: 'totalEmitidos' as const,
    valorKey: 'valorEmitidos' as const,
  },
  {
    key: 'aVencer' as const,
    label: 'A Vencer',
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    totalKey: 'totalAVencer' as const,
    valorKey: 'valorAVencer' as const,
  },
  {
    key: 'vencidos' as const,
    label: 'Vencidos',
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    totalKey: 'totalVencidos' as const,
    valorKey: 'valorVencidos' as const,
  },
  {
    key: 'pagos' as const,
    label: 'Pagos',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    totalKey: 'totalPagos' as const,
    valorKey: 'valorPagos' as const,
  },
];

export default function BoletoStatsCards({ data, isLoading }: BoletoStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-7 w-32 mb-1" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const total = data?.[card.totalKey] ?? 0;
        const valor = data?.[card.valorKey] ?? 0;

        return (
          <Card key={card.key} className="rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-xl ${card.bg}`}>
                  <Icon size={18} className={card.color} />
                </div>
                <span className="text-sm text-slate-500 font-medium">{card.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-800">{brl(valor)}</p>
              <p className="text-sm text-slate-400 mt-1">{total} boleto{total !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
