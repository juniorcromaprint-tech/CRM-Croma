import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { AIActionStatus } from '../types/ai.types';

interface AIStatusBadgeProps {
  status: AIActionStatus;
  message?: string;
}

export default function AIStatusBadge({ status, message }: AIStatusBadgeProps) {
  if (status === 'idle') return null;

  const config = {
    applying: { icon: <Loader2 size={12} className="animate-spin" />, text: 'Aplicando...', className: 'text-blue-600 bg-blue-50' },
    applied: { icon: <CheckCircle size={12} />, text: 'Aplicado', className: 'text-green-600 bg-green-50' },
    error: { icon: <XCircle size={12} />, text: message ?? 'Erro', className: 'text-red-600 bg-red-50' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
      {config.icon}
      {config.text}
    </span>
  );
}
