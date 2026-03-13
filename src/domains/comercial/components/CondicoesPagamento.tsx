// src/domains/comercial/components/CondicoesPagamento.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brl } from '@/shared/utils/format';

export interface PaymentConditions {
  forma_pagamento: string;
  parcelas_count: number;
  entrada_percentual: number;
  prazo_dias: number[];
}

interface Props {
  value: PaymentConditions;
  onChange: (v: PaymentConditions) => void;
  valorTotal: number;
}

const TIPOS = [
  { value: 'pix', label: 'PIX à vista' },
  { value: 'boleto_vista', label: 'Boleto à vista' },
  { value: 'boleto_parcelado', label: 'Boleto parcelado' },
  { value: 'cartao', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' },
  { value: 'prazo_ddl', label: 'Prazo DDL (30/60/90)' },
];

export function CondicoesPagamento({ value, onChange, valorTotal }: Props) {
  const update = (partial: Partial<PaymentConditions>) =>
    onChange({ ...value, ...partial });

  const previewText = buildPreview(value, valorTotal);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Condições de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Forma de Pagamento</Label>
          <Select value={value.forma_pagamento} onValueChange={(v) => {
            const defaults = getDefaults(v);
            onChange({ forma_pagamento: v, ...defaults });
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {TIPOS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(value.forma_pagamento === 'boleto_parcelado' || value.forma_pagamento === 'cartao') && (
          <div>
            <Label>Número de Parcelas</Label>
            <Input
              type="number" min={2} max={value.forma_pagamento === 'cartao' ? 12 : 24}
              value={value.parcelas_count}
              onChange={(e) => {
                const count = parseInt(e.target.value) || 2;
                const dias = value.forma_pagamento === 'boleto_parcelado'
                  ? Array.from({ length: count }, (_, i) => (i + 1) * 30)
                  : [];
                update({ parcelas_count: count, prazo_dias: dias });
              }}
            />
          </div>
        )}

        {value.forma_pagamento === 'entrada_parcelas' && (
          <>
            <div>
              <Label>Entrada (%)</Label>
              <Input
                type="number" min={10} max={90} step={5}
                value={value.entrada_percentual}
                onChange={(e) => update({ entrada_percentual: parseFloat(e.target.value) || 30 })}
              />
            </div>
            <div>
              <Label>Número de Parcelas</Label>
              <Input
                type="number" min={1} max={24}
                value={value.parcelas_count}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 3;
                  const dias = Array.from({ length: count }, (_, i) => (i + 1) * 30);
                  update({ parcelas_count: count, prazo_dias: dias });
                }}
              />
            </div>
          </>
        )}

        {value.forma_pagamento === 'prazo_ddl' && (
          <div>
            <Label>Prazos (dias)</Label>
            <div className="flex gap-2">
              {(value.prazo_dias || [30, 60, 90]).map((d, i) => (
                <Input
                  key={i} type="number" min={15} max={180} step={15}
                  value={d} className="w-20"
                  onChange={(e) => {
                    const newDias = [...(value.prazo_dias || [30, 60, 90])];
                    newDias[i] = parseInt(e.target.value) || 30;
                    update({ prazo_dias: newDias });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {previewText && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
            {previewText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDefaults(tipo: string): Omit<PaymentConditions, 'forma_pagamento'> {
  switch (tipo) {
    case 'boleto_parcelado': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [30, 60, 90] };
    case 'cartao': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [] };
    case 'entrada_parcelas': return { parcelas_count: 3, entrada_percentual: 30, prazo_dias: [30, 60, 90] };
    case 'prazo_ddl': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [30, 60, 90] };
    default: return { parcelas_count: 1, entrada_percentual: 0, prazo_dias: [] };
  }
}

function buildPreview(v: PaymentConditions, total: number): string {
  if (!v.forma_pagamento || total <= 0) return '';
  switch (v.forma_pagamento) {
    case 'pix': return `PIX à vista: ${brl(total)}`;
    case 'boleto_vista': return `Boleto à vista: ${brl(total)}`;
    case 'boleto_parcelado': {
      const parcela = total / v.parcelas_count;
      return `${v.parcelas_count}x de ${brl(parcela)} • Vencimentos: ${(v.prazo_dias || []).join('/')} dias`;
    }
    case 'cartao': return `${v.parcelas_count}x de ${brl(total / v.parcelas_count)} no cartão`;
    case 'entrada_parcelas': {
      const entrada = total * v.entrada_percentual / 100;
      const restante = total - entrada;
      const parcela = restante / v.parcelas_count;
      return `Entrada: ${brl(entrada)} (${v.entrada_percentual}%) + ${v.parcelas_count}x de ${brl(parcela)}`;
    }
    case 'prazo_ddl': {
      const parcela = total / (v.prazo_dias || [30, 60, 90]).length;
      return `${(v.prazo_dias || []).length}x de ${brl(parcela)} • DDL: ${(v.prazo_dias || []).join('/')} dias`;
    }
    default: return '';
  }
}
