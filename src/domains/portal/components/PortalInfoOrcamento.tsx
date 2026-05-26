// src/domains/portal/components/PortalInfoOrcamento.tsx
// =============================================================================
// Card "Informacoes do Orcamento" — fica entre o header e o PortalItemList.
//
// Exibe 3 campos populados pelo briefing-beira-rio v10:
//   - Referencia (texto livre — ex: "Fachada loja Iguatemi", "Adesivagem cubo")
//   - Prazo de entrega (em dias uteis)
//   - Logistica (instalado / frete / retirada)
//
// Mubisys-equivalente: bloco "Detalhes do Orcamento" no topo da proposta web.
// Estilo segue PortalLojaInfo (rounded-2xl + border slate + bg branco).
// =============================================================================
import { Tag, Clock, Wrench, Truck, Package, HelpCircle } from 'lucide-react';
import type { PortalLogistica } from '../services/portal.service';

interface Props {
  referencia?: string | null;
  prazoEntregaDias?: number | null;
  logistica?: PortalLogistica;
}

interface LogisticaDisplay {
  Icon: typeof Wrench;
  label: string;
  iconColor: string;
  bgColor: string;
}

function getLogisticaDisplay(logistica: PortalLogistica): LogisticaDisplay {
  switch (logistica) {
    case 'instalado':
      return {
        Icon: Wrench,
        label: 'Instalado pela Croma',
        iconColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      };
    case 'frete':
      return {
        Icon: Truck,
        label: 'Entrega via frete',
        iconColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
      };
    case 'retirada':
      return {
        Icon: Package,
        label: 'Retirada no local',
        iconColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
      };
    default:
      return {
        Icon: HelpCircle,
        label: 'A combinar',
        iconColor: 'text-slate-400',
        bgColor: 'bg-slate-50',
      };
  }
}

export function PortalInfoOrcamento({ referencia, prazoEntregaDias, logistica }: Props) {
  // Se nenhum dos 3 campos veio populado, nao renderiza nada (proposta legada).
  const hasReferencia = !!referencia && referencia.trim().length > 0;
  const hasPrazo = typeof prazoEntregaDias === 'number' && prazoEntregaDias > 0;
  const hasLogistica = !!logistica;
  if (!hasReferencia && !hasPrazo && !hasLogistica) return null;

  const logDisplay = getLogisticaDisplay(logistica ?? null);
  const LogIcon = logDisplay.Icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Referencia */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
            <Tag size={18} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
              Referencia
            </p>
            <p className="text-sm font-bold text-slate-900 break-words">
              {hasReferencia ? referencia : '—'}
            </p>
          </div>
        </div>

        {/* Prazo de entrega */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
            <Clock size={18} className="text-sky-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
              Prazo de entrega
            </p>
            <p className="text-sm font-bold text-slate-900">
              {hasPrazo
                ? `${prazoEntregaDias} ${prazoEntregaDias === 1 ? 'dia util' : 'dias uteis'}`
                : '—'}
            </p>
          </div>
        </div>

        {/* Logistica */}
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg ${logDisplay.bgColor} flex items-center justify-center`}
          >
            <LogIcon size={18} className={logDisplay.iconColor} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
              Logistica
            </p>
            <p className="text-sm font-bold text-slate-900">{logDisplay.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
