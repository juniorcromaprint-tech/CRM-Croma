// ─── Boleto Status Badge ─────────────────────────────────────────────────────
// Croma Print ERP — Badge colorido para status de boleto
// ─────────────────────────────────────────────────────────────────────────────

import { Badge } from '@/components/ui/badge';
import type { BoletoStatus } from '../types/boleto.types';

const STATUS_CONFIG: Record<BoletoStatus, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  emitido: { label: 'Emitido', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  pronto_remessa: { label: 'Pronto Remessa', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  remetido: { label: 'Remetido', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  registrado: { label: 'Registrado', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  pago: { label: 'Pago', className: 'bg-green-100 text-green-700 border-green-200' },
  rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-700 border-red-200' },
  cancelado: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

interface BoletoStatusBadgeProps {
  status: BoletoStatus;
}

export default function BoletoStatusBadge({ status }: BoletoStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
