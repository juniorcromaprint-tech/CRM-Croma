// ============================================================================
// EstoqueAlertaBadge — Croma Print ERP/CRM
// Badge vermelho exibido no sidebar quando há materiais abaixo do mínimo
// ============================================================================

import { useAlertasEstoque } from '../hooks/useAlertasEstoque';

interface EstoqueAlertaBadgeProps {
  /** Modo colapsado do sidebar: só mostra o ponto vermelho sem número */
  collapsed?: boolean;
}

export default function EstoqueAlertaBadge({ collapsed = false }: EstoqueAlertaBadgeProps) {
  const { data: alertas = [] } = useAlertasEstoque();
  const count = alertas.length;

  if (count === 0) return null;

  if (collapsed) {
    // Modo ícone: ponto vermelho pequeno no canto
    return (
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
    );
  }

  return (
    <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
      {count > 99 ? '99+' : count}
    </span>
  );
}
