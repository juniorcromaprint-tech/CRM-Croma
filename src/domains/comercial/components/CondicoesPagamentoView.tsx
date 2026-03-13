// src/domains/comercial/components/CondicoesPagamentoView.tsx
import { CreditCard } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import type { PaymentConditions } from './CondicoesPagamento';

interface Props {
  conditions: PaymentConditions;
  valorTotal: number;
}

const LABELS: Record<string, string> = {
  pix: 'PIX à vista',
  boleto_vista: 'Boleto à vista',
  boleto_parcelado: 'Boleto parcelado',
  cartao: 'Cartão de crédito',
  entrada_parcelas: 'Entrada + parcelas',
  prazo_ddl: 'Prazo DDL',
};

export function CondicoesPagamentoView({ conditions, valorTotal }: Props) {
  if (!conditions.forma_pagamento) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={18} className="text-slate-500" />
        <h4 className="font-semibold text-sm text-slate-700">Condições de Pagamento</h4>
      </div>
      <p className="text-sm font-medium text-slate-900 mb-1">
        {LABELS[conditions.forma_pagamento] || conditions.forma_pagamento}
      </p>
      {conditions.forma_pagamento === 'entrada_parcelas' && (
        <div className="text-sm text-slate-600 space-y-0.5">
          <p>Entrada: {brl(valorTotal * conditions.entrada_percentual / 100)} ({conditions.entrada_percentual}%)</p>
          <p>{conditions.parcelas_count}x de {brl((valorTotal * (1 - conditions.entrada_percentual / 100)) / conditions.parcelas_count)}</p>
          {(conditions.prazo_dias?.length ?? 0) > 0 && (
            <p className="text-slate-400">Vencimentos: {conditions.prazo_dias.join('/')} dias</p>
          )}
        </div>
      )}
      {(conditions.forma_pagamento === 'boleto_parcelado' || conditions.forma_pagamento === 'prazo_ddl') && (
        <div className="text-sm text-slate-600 space-y-0.5">
          <p>{conditions.parcelas_count}x de {brl(valorTotal / conditions.parcelas_count)}</p>
          <p className="text-slate-400">Vencimentos: {(conditions.prazo_dias || []).join('/')} dias</p>
        </div>
      )}
      {conditions.forma_pagamento === 'cartao' && (
        <p className="text-sm text-slate-600">{conditions.parcelas_count}x de {brl(valorTotal / conditions.parcelas_count)}</p>
      )}
    </div>
  );
}
