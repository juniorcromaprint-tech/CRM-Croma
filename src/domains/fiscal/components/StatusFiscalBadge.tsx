import React from 'react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-slate-100 text-slate-600 border-slate-300' },
  validando: { label: 'Validando', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  apto: { label: 'Apto', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  emitindo: { label: 'Emitindo', className: 'bg-amber-100 text-amber-700 border-amber-300 animate-pulse' },
  autorizado: { label: 'Autorizado', className: 'bg-green-100 text-green-800 border-green-400 font-semibold' },
  rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-700 border-red-400' },
  cancelado: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500 border-slate-300 line-through' },
  denegado: { label: 'Denegado', className: 'bg-red-200 text-red-900 border-red-500' },
  inutilizado: { label: 'Inutilizado', className: 'bg-orange-100 text-orange-700 border-orange-300' },
  erro_transmissao: { label: 'Erro Transmissão', className: 'bg-red-50 text-red-600 border-red-300' },
  nao_iniciado: { label: 'Não iniciado', className: 'bg-slate-50 text-slate-400 border-slate-200' },
};

interface Props {
  status: string;
  size?: 'sm' | 'default';
}

export function StatusFiscalBadge({ status, size = 'default' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${config.className} ${size === 'sm' ? 'text-xs px-1.5' : ''}`}>
      {config.label}
    </span>
  );
}

export default StatusFiscalBadge;
