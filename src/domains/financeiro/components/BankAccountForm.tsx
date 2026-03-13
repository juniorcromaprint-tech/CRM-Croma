// ─── Bank Account Form ───────────────────────────────────────────────────────
// Croma Print ERP — Formulário CRUD de conta bancária
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { bankAccountCreateSchema, type BankAccountFormData } from '../schemas/boleto.schemas';
import { BANK_NAMES, type BankCode } from '../types/boleto.types';

interface BankAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BankAccountFormData) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<BankAccountFormData>;
  title?: string;
}

const BANK_OPTIONS: { code: BankCode; name: string }[] = [
  { code: '341', name: BANK_NAMES['341'] },
  { code: '237', name: BANK_NAMES['237'] },
  { code: '001', name: BANK_NAMES['001'] },
  { code: '033', name: BANK_NAMES['033'] },
];

export default function BankAccountForm({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaultValues,
  title = 'Nova Conta Bancária',
}: BankAccountFormProps) {
  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountCreateSchema),
    defaultValues: {
      carteira: '109',
      juros_ao_mes: 2,
      multa_percentual: 2,
      dias_protesto: 0,
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        carteira: '109',
        juros_ao_mes: 2,
        multa_percentual: 2,
        dias_protesto: 0,
        ...defaultValues,
      });
    }
  }, [open, defaultValues, form]);

  const handleBankChange = (code: string) => {
    form.setValue('banco_codigo', code);
    const bank = BANK_OPTIONS.find((b) => b.code === code);
    if (bank) form.setValue('banco_nome', bank.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome da Conta */}
          <div className="space-y-1.5">
            <Label>Nome da Conta *</Label>
            <Input {...form.register('nome')} placeholder="Ex: Conta Itaú Principal" />
            {form.formState.errors.nome && (
              <p className="text-xs text-red-500">{form.formState.errors.nome.message}</p>
            )}
          </div>

          {/* Banco + Agência + Conta */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Banco *</Label>
              <Select
                value={form.watch('banco_codigo') || ''}
                onValueChange={handleBankChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_OPTIONS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.code} — {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.banco_codigo && (
                <p className="text-xs text-red-500">{form.formState.errors.banco_codigo.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Agência *</Label>
              <div className="flex gap-2">
                <Input {...form.register('agencia')} placeholder="0000" className="flex-1" />
                <Input {...form.register('agencia_digito')} placeholder="DV" className="w-16" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Conta *</Label>
              <div className="flex gap-2">
                <Input {...form.register('conta')} placeholder="00000" className="flex-1" />
                <Input {...form.register('conta_digito')} placeholder="DV" className="w-16" />
              </div>
            </div>
          </div>

          {/* Carteira + Convênio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Carteira</Label>
              <Input {...form.register('carteira')} placeholder="109" />
            </div>
            <div className="space-y-1.5">
              <Label>Convênio</Label>
              <Input {...form.register('convenio')} placeholder="Número do convênio" />
            </div>
          </div>

          {/* Cedente */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold text-slate-600 mb-3">Dados do Cedente (Beneficiário)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Razão Social *</Label>
                <Input {...form.register('cedente_nome')} placeholder="Razão social completa" />
                {form.formState.errors.cedente_nome && (
                  <p className="text-xs text-red-500">{form.formState.errors.cedente_nome.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ *</Label>
                <Input {...form.register('cedente_cnpj')} placeholder="00.000.000/0001-00" />
                {form.formState.errors.cedente_cnpj && (
                  <p className="text-xs text-red-500">{form.formState.errors.cedente_cnpj.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              <Label>Endereço</Label>
              <Input {...form.register('cedente_endereco')} placeholder="Rua, número — Bairro" />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input {...form.register('cedente_cidade')} />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input {...form.register('cedente_estado')} maxLength={2} placeholder="RS" />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input {...form.register('cedente_cep')} placeholder="00000-000" />
              </div>
            </div>
          </div>

          {/* Juros / Multa / Protesto */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold text-slate-600 mb-3">Encargos e Protesto</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Juros ao mês (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('juros_ao_mes', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Multa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('multa_percentual', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dias para Protesto</Label>
                <Input
                  type="number"
                  {...form.register('dias_protesto', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Instruções Padrão */}
          <div className="space-y-1.5">
            <Label>Instruções Padrão</Label>
            <Textarea
              {...form.register('instrucoes_padrao')}
              placeholder="Instruções que serão incluídas em todos os boletos desta conta"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
