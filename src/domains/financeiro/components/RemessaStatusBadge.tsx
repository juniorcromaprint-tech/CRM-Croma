// ─── Remessa Status Badge ────────────────────────────────────────────────────
// Croma Print ERP — Badge colorido para status de remessa bancária
// ─────────────────────────────────────────────────────────────────────────────

import { Badge } from '@/components/ui/badge';
import type { RemessaStatus } from '../types/boleto.types';

const STATUS_CONFIG: Record<RemessaStatus, { label: string; className: string }> = {
  gerado: { label: 'Gerado', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  baixado: { label: 'Baixado', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  enviado: { label: 'Enviado', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  processado: { label: 'Processado', className: 'bg-green-100 text-green-700 border-green-200' },
  erro: { label: 'Erro', className: 'bg-red-100 text-red-700 border-red-200' },
};

interface RemessaStatusBadgeProps {
  status: RemessaStatus;
}

export default function RemessaStatusBadge({ status }: RemessaStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.gerado;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
