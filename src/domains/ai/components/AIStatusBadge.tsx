import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { AIActionStatus } from '../types/ai.types';

interface AIStatusBadgeProps {
  status: AIActionStatus;
  message?: string;
}

export default function AIStatusBadge({ status, message }: AIStatusBadgeProps) {
  if (status === 'idle') return null;

  const config = {
    applying: {
      icon: <Loader2 size={10} className="animate-spin" />,
      text: 'Aplicando...',
      className: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    applied: {
      icon: <CheckCircle size={10} />,
      text: 'Aplicado',
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    error: {
      icon: <XCircle size={10} />,
      text: message ? (message.length > 40 ? message.slice(0, 40) + '...' : message) : 'Erro',
      className: 'text-red-700 bg-red-50 border-red-200',
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${config.className}`}
      title={message}
    >
      {config.icon}
      {config.text}
    </span>
  );
}
