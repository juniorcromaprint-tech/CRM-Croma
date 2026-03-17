// ============================================================================
// CreditBlockBanner — Alerta de cliente inadimplente
// Croma Print ERP/CRM
// ============================================================================

import { ShieldAlert } from 'lucide-react';
import { useClienteInadimplente } from '@/domains/financeiro/hooks/useMotorFinanceiro';

interface CreditBlockBannerProps {
  clienteId: string;
}

export default function CreditBlockBanner({ clienteId }: CreditBlockBannerProps) {
  const { data: inadimplente, isLoading } = useClienteInadimplente(clienteId);

  if (isLoading || !inadimplente) return null;

  return (
    <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-center gap-3">
      <ShieldAlert className="text-red-600 shrink-0" size={24} />
      <div>
        <p className="font-semibold text-red-800">Cliente com títulos vencidos</p>
        <p className="text-sm text-red-600">
          Existem contas a receber em atraso para este cliente
        </p>
      </div>
    </div>
  );
}
