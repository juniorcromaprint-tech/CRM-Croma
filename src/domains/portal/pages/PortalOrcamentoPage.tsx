// src/domains/portal/pages/PortalOrcamentoPage.tsx
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, CalendarClock } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import { usePortalProposta, useAprovarProposta } from '../hooks/usePortalProposta';
import { usePortalTracking } from '../hooks/usePortalTracking';
import { PortalHeader } from '../components/PortalHeader';
import { PortalItemList } from '../components/PortalItemList';
import { PortalApproval } from '../components/PortalApproval';
import { PortalFileUpload } from '../components/PortalFileUpload';
import { PortalConfirmation } from '../components/PortalConfirmation';
import { CondicoesPagamentoView } from '@/domains/comercial/components/CondicoesPagamentoView';

export default function PortalOrcamentoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: proposta, isLoading, error } = usePortalProposta(token || '');
  const aprovar = useAprovarProposta();
  const { trackClick } = usePortalTracking(token || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-1">Link Inválido</h2>
          <p className="text-slate-500">Esta proposta não foi encontrada ou o link expirou.</p>
        </div>
      </div>
    );
  }

  if (proposta.aprovado_pelo_cliente) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PortalHeader numero={proposta.numero} />
        <PortalConfirmation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader numero={proposta.numero} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Saudação */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Olá, {proposta.cliente.contato_nome || proposta.cliente.nome_fantasia}!
          </h2>
          <p className="text-slate-500">Segue sua proposta comercial.</p>
        </div>

        {/* Itens */}
        <PortalItemList itens={proposta.itens} onItemClick={trackClick} />

        {/* Condições de Pagamento */}
        {proposta.forma_pagamento && (
          <CondicoesPagamentoView
            conditions={{
              forma_pagamento: proposta.forma_pagamento,
              parcelas_count: proposta.parcelas_count,
              entrada_percentual: proposta.entrada_percentual,
              prazo_dias: proposta.prazo_dias,
            }}
            valorTotal={proposta.valor_total}
          />
        )}

        {/* Total */}
        <div className="bg-blue-600 rounded-2xl p-6 text-center text-white">
          <p className="text-sm opacity-80 mb-1">Valor Total</p>
          <p className="text-3xl font-bold">{brl(proposta.valor_total)}</p>
          {proposta.desconto_percentual > 0 && (
            <p className="text-sm opacity-80 mt-1">Desconto de {proposta.desconto_percentual}% aplicado</p>
          )}
        </div>

        {/* Validade */}
        {(() => {
          const dataValidade = proposta.data_validade
            ? new Date(proposta.data_validade)
            : proposta.validade && proposta.created_at
              ? new Date(new Date(proposta.created_at).getTime() + proposta.validade * 86400000)
              : null;
          if (!dataValidade) return null;
          const hoje = new Date();
          const expirada = dataValidade < hoje;
          const diasRestantes = Math.ceil((dataValidade.getTime() - hoje.getTime()) / 86400000);
          return (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
              expirada
                ? 'bg-red-50 border-red-200 text-red-700'
                : diasRestantes <= 3
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <CalendarClock size={16} />
              {expirada
                ? 'Esta proposta expirou em ' + dataValidade.toLocaleDateString('pt-BR')
                : `Proposta válida até ${dataValidade.toLocaleDateString('pt-BR')} (${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''})`}
            </div>
          );
        })()}

        {/* Upload */}
        <PortalFileUpload
          token={token || ''}
          clientName={proposta.cliente.contato_nome || proposta.cliente.nome_fantasia}
        />

        {/* Aprovação */}
        <PortalApproval
          onApprove={(comentario) => aprovar.mutate({ token: token || '', comentario })}
          isLoading={aprovar.isPending}
          disabled={false}
        />

        {/* Observações */}
        {proposta.observacoes && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Observações</h4>
            <p className="text-sm text-slate-500 whitespace-pre-wrap">{proposta.observacoes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
