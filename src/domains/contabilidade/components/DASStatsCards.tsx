import { Calculator, TrendingUp, Calendar, Percent } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import type { DASApuracao } from '../types/contabilidade.types';

interface DASStatsCardsProps {
  apuracao: DASApuracao | null;
}

export function DASStatsCards({ apuracao }: DASStatsCardsProps) {
  if (!apuracao) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
            <div className="h-7 bg-slate-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'DAS do Mês',
      value: brl(apuracao.valor_das),
      sub: `Vence ${apuracao.data_vencimento}`,
      icon: Calculator,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Fator R',
      value: `${(apuracao.fator_r * 100).toFixed(1)}%`,
      sub: apuracao.fator_r >= 0.28 ? '✓ Anexo III' : '⚠ Abaixo de 28%',
      icon: TrendingUp,
      color: apuracao.fator_r >= 0.28 ? 'text-green-600' : 'text-amber-600',
      bg: apuracao.fator_r >= 0.28 ? 'bg-green-50' : 'bg-amber-50',
    },
    {
      label: 'Anexo',
      value: `Anexo ${apuracao.anexo}`,
      sub: `Alíquota efetiva ${(apuracao.aliquota_efetiva * 100).toFixed(2)}%`,
      icon: Percent,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'RBT12',
      value: brl(apuracao.rbt12),
      sub: `Receita mês: ${brl(apuracao.receita_bruta_mes)}`,
      icon: Calendar,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon size={16} className={card.color} />
            </div>
            <span className="text-xs text-slate-500 font-medium">{card.label}</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{card.value}</p>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
