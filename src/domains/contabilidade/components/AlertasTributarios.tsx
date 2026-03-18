import { AlertTriangle, Info, AlertCircle, TrendingUp } from 'lucide-react';
import type { AlertaTributario } from '../services/das-simples.service';

interface AlertasTributariosProps {
  alertas: AlertaTributario[];
}

export function AlertasTributarios({ alertas }: AlertasTributariosProps) {
  if (alertas.length === 0) return null;

  const iconMap = {
    info: Info,
    warning: AlertTriangle,
    danger: AlertCircle,
  };

  const colorMap = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };

  const iconColorMap = {
    info: 'text-blue-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  return (
    <div className="space-y-2">
      {alertas.map((alerta, i) => {
        const Icon = iconMap[alerta.severidade];
        return (
          <div
            key={i}
            className={`flex gap-3 p-4 rounded-2xl border ${colorMap[alerta.severidade]}`}
          >
            <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconColorMap[alerta.severidade]}`} />
            <div>
              <p className="font-semibold text-sm">{alerta.titulo}</p>
              <p className="text-xs mt-0.5 opacity-80">{alerta.descricao}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
