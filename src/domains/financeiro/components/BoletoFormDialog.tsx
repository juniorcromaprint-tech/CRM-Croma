// ─── Boleto Form Dialog ──────────────────────────────────────────────────────
// Croma Print ERP — Criar/editar boleto bancário
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
import { bankSlipCreateSchema, type BankSlipFormData } from '../schemas/boleto.schemas';
import { useBankAccounts } from '../hooks/useBoletos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BoletoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BankSlipFormData) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<BankSlipFormData>;
  title?: string;
}

export default function BoletoFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaultValues,
  title = 'Novo Boleto',
}: BoletoFormDialogProps) {
  const { data: bankAccounts } = useBankAccounts();

  // Clientes para o select
  const { data: clientes } = useQuery({
    queryKey: ['clientes', 'select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_fantasia, razao_social, cpf_cnpj, endereco, cidade, estado, cep')
        .order('nome_fantasia');
      return data ?? [];
    },
  });

  const form = useForm<BankSlipFormData>({
    resolver: zodResolver(bankSlipCreateSchema),
    defaultValues: {
      valor_nominal: 0,
      valor_desconto: 0,
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ valor_nominal: 0, valor_desconto: 0, ...defaultValues });
    }
  }, [open, defaultValues, form]);

  // Autopreenche dados do sacado quando selecionar cliente
  const handleClienteChange = (clienteId: string) => {
    form.setValue('cliente_id', clienteId);
    const cliente = clientes?.find((c) => c.id === clienteId);
    if (cliente) {
      form.setValue('sacado_nome', cliente.nome_fantasia || cliente.razao_social || '');
      form.setValue('sacado_cpf_cnpj', cliente.cpf_cnpj || '');
      form.setValue('sacado_endereco', cliente.endereco || '');
      form.setValue('sacado_cidade', cliente.cidade || '');
      form.setValue('sacado_estado', cliente.estado || '');
      form.setValue('sacado_cep', cliente.cep || '');
    }
  };

  const handleFormSubmit = (data: BankSlipFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Conta Bancária */}
          <div className="space-y-1.5">
            <Label>Conta Bancária *</Label>
            <Select
              value={form.watch('bank_account_id') || ''}
              onValueChange={(v) => form.setValue('bank_account_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nome} — {acc.banco_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.bank_account_id && (
              <p className="text-xs text-red-500">{form.formState.errors.bank_account_id.message}</p>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente (Sacado) *</Label>
            <Select
              value={form.watch('cliente_id') || ''}
              onValueChange={handleClienteChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia || c.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.cliente_id && (
              <p className="text-xs text-red-500">{form.formState.errors.cliente_id.message}</p>
            )}
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                {...form.register('valor_nominal', { valueAsNumber: true })}
                placeholder="0,00"
              />
              {form.formState.errors.valor_nominal && (
                <p className="text-xs text-red-500">{form.formState.errors.valor_nominal.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento *</Label>
              <Input type="date" {...form.register('data_vencimento')} />
              {form.formState.errors.data_vencimento && (
                <p className="text-xs text-red-500">{form.formState.errors.data_vencimento.message}</p>
              )}
            </div>
          </div>

          {/* Sacado (preenchido pelo cliente selecionado) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do Pagador *</Label>
              <Input {...form.register('sacado_nome')} placeholder="Nome completo ou razão social" />
              {form.formState.errors.sacado_nome && (
                <p className="text-xs text-red-500">{form.formState.errors.sacado_nome.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>CPF/CNPJ *</Label>
              <Input {...form.register('sacado_cpf_cnpj')} placeholder="Apenas números" />
              {form.formState.errors.sacado_cpf_cnpj && (
                <p className="text-xs text-red-500">{form.formState.errors.sacado_cpf_cnpj.message}</p>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input {...form.register('sacado_endereco')} placeholder="Rua, número" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input {...form.register('sacado_cidade')} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input {...form.register('sacado_estado')} maxLength={2} placeholder="RS" />
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input {...form.register('sacado_cep')} placeholder="00000-000" />
            </div>
          </div>

          {/* Desconto */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                {...form.register('valor_desconto', { valueAsNumber: true })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data Limite Desconto</Label>
              <Input type="date" {...form.register('data_limite_desconto')} />
            </div>
          </div>

          {/* Seu Número / Instruções */}
          <div className="space-y-1.5">
            <Label>Seu Número (referência)</Label>
            <Input {...form.register('seu_numero')} placeholder="Número de controle interno" />
          </div>
          <div className="space-y-1.5">
            <Label>Instruções</Label>
            <Textarea
              {...form.register('instrucoes')}
              placeholder="Instruções para o banco..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Boleto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
