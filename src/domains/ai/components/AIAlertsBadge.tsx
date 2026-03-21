// src/domains/ai/components/AIAlertsBadge.tsx

import { Bell } from 'lucide-react';
import { useAlertasAI } from '../hooks/useAlertasAI';

interface AIAlertsBadgeProps {
  onClick?: () => void;
}

export default function AIAlertsBadge({ onClick }: AIAlertsBadgeProps) {
  const { data: alertas = [] } = useAlertasAI();
  const count = alertas.length;
  const hasAlta = alertas.some((a) => a.severidade === 'alta');

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      title={`${count} alertas operacionais`}
    >
      <Bell size={18} className="text-slate-600" />
      <span
        className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs font-bold text-white ${
          hasAlta ? 'bg-red-500' : 'bg-amber-500'
        }`}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}
