// src/domains/portal/pages/PortalOrcamentoPage.tsx
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, CalendarClock, TrendingDown, Receipt } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import { usePortalProposta, useAprovarProposta } from '../hooks/usePortalProposta';
import { usePortalTracking } from '../hooks/usePortalTracking';
import { useAdminConfig } from '../hooks/useAdminConfig';
import { PortalHeader } from '../components/PortalHeader';
import { PortalItemList } from '../components/PortalItemList';
import { PortalApproval } from '../components/PortalApproval';
import { PortalFileUpload } from '../components/PortalFileUpload';
import { PortalConfirmation } from '../components/PortalConfirmation';
import { PortalFooter } from '../components/PortalFooter';
import { CondicoesPagamentoView } from '@/domains/comercial/components/CondicoesPagamentoView';
import PortalPixInfo from '../components/PortalPixInfo';

export default function PortalOrcamentoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: proposta, isLoading, error } = usePortalProposta(token || '');
  const aprovar = useAprovarProposta();
  const { trackClick } = usePortalTracking(token || '');
  const { data: chavePix } = useAdminConfig('chave_pix');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
        <p className="text-sm text-slate-500">Carregando proposta...</p>
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Inválido</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Esta proposta não foi encontrada ou o link expirou.
            Entre em contato com nosso time comercial para obter um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (proposta.aprovado_pelo_cliente) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PortalHeader numero={proposta.numero} />
        <div className="flex-1">
          <PortalConfirmation />
        </div>
        <PortalFooter />
      </div>
    );
  }

  const clienteNome = proposta.cliente.contato_nome || proposta.cliente.nome_fantasia;

  // Calculate validity
  const dataValidade = proposta.data_validade
    ? new Date(proposta.data_validade)
    : proposta.validade && proposta.created_at
      ? new Date(new Date(proposta.created_at).getTime() + proposta.validade * 86400000)
      : null;
  const hoje = new Date();
  const expirada = dataValidade ? dataValidade < hoje : false;
  const diasRestantes = dataValidade ? Math.ceil((dataValidade.getTime() - hoje.getTime()) / 86400000) : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PortalHeader numero={proposta.numero} clienteNome={clienteNome} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Validity banner */}
        {dataValidade && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            expirada
              ? 'bg-red-50 border border-red-200 text-red-700'
              : diasRestantes !== null && diasRestantes <= 3
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>
            <CalendarClock size={18} className="flex-shrink-0" />
            <span>
              {expirada
                ? `Esta proposta expirou em ${dataValidade.toLocaleDateString('pt-BR')}`
                : `Valida ate ${dataValidade.toLocaleDateString('pt-BR')} (${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''})`}
            </span>
          </div>
        )}

        {/* Items */}
        <PortalItemList itens={proposta.itens} onItemClick={trackClick} />

        {/* Summary card: total + payment */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Total */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 sm:p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium mb-1">Valor Total da Proposta</p>
                <p className="text-3xl sm:text-4xl font-bold tracking-tight">{brl(proposta.valor_total)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Receipt size={24} className="text-white/80" />
              </div>
            </div>
            {proposta.desconto_percentual > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 w-fit">
                <TrendingDown size={14} />
                <span className="text-sm font-medium">Desconto de {proposta.desconto_percentual}% aplicado</span>
              </div>
            )}
          </div>

          {/* Payment conditions */}
          {proposta.forma_pagamento && (
            <div className="p-5 sm:p-6 border-t border-slate-100">
              <CondicoesPagamentoView
                conditions={{
                  forma_pagamento: proposta.forma_pagamento,
                  parcelas_count: proposta.parcelas_count,
                  entrada_percentual: proposta.entrada_percentual,
                  prazo_dias: proposta.prazo_dias,
                }}
                valorTotal={proposta.valor_total}
              />
              {proposta.forma_pagamento === 'pix' && chavePix && (
                <PortalPixInfo chavePix={chavePix} valor={proposta.valor_total ?? 0} />
              )}
            </div>
          )}
        </div>

        {/* File Upload */}
        <PortalFileUpload
          token={token || ''}
          clientName={clienteNome}
        />

        {/* Observations */}
        {proposta.observacoes && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Observações</h4>
            <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">{proposta.observacoes}</p>
          </div>
        )}

        {/* Approval */}
        <PortalApproval
          onApprove={(comentario) => aprovar.mutate({ token: token || '', comentario })}
          isLoading={aprovar.isPending}
          disabled={expirada}
        />
      </main>

      <PortalFooter />
    </div>
  );
}
