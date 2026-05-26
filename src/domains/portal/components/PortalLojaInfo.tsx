// src/domains/portal/components/PortalLojaInfo.tsx
// =============================================================================
// Bloco "Loja de destino" no portal /p/:token. Renderiza identificador
// (codigo + brand||name) + endereco + cidade/UF + CEP da loja Beira Rio.
//
// Fonte de dados: proposta.store (vem de propostas.config_snapshot.store,
// populado pela Edge Function briefing-beira-rio v9+ e exposto pela RPC
// portal_get_proposta).
//
// Quando o snapshot nao tem nenhum campo util, o bloco nao renderiza
// (orcamentos sem loja vinculada nao mostram nada — comportamento decidido
// com Junior em 2026-05-26).
// =============================================================================
import { Building2 } from 'lucide-react';
import { formatStoreLocation } from '../utils/storeAddress';
import type { PortalStore } from '../services/portal.service';

interface Props {
  store?: PortalStore | null;
}

export function PortalLojaInfo({ store }: Props) {
  const loc = formatStoreLocation(store);
  if (!loc.hasAny) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
          <Building2 size={20} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
            Loja de destino
          </p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {loc.identifier}
          </p>
          {loc.addressLine && (
            <p className="text-sm text-slate-600 mt-2">{loc.addressLine}</p>
          )}
          {loc.cityLine && (
            <p className="text-sm text-slate-500">{loc.cityLine}</p>
          )}
        </div>
      </div>
    </div>
  );
}
