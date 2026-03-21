// ─── Boleto Form Dialog ──────────────────────────────────────────────────────
// Croma Print ERP — Criar/editar boleto bancário
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
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
import { Loader2, Link2 } from 'lucide-react';
import { bankSlipCreateSchema, type BankSlipFormData } from '../schemas/boleto.schemas';
import { useBankAccounts } from '../hooks/useBoletos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Retorna a data de hoje + N dias no formato YYYY-MM-DD (fuso Sao Paulo). */
function localDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PedidoParaBoleto {
  id: string;
  numero: string | null;
  valor_total: number;
  cliente_id: string;
  clientes: { nome_fantasia: string | null; razao_social: string | null; cpf_cnpj: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null } | null;
  propostas: { prazo_dias: number[] | null; parcelas_count: number | null } | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const [selectedPedidoId, setSelectedPedidoId] = useState<string>('');

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

  // Pedidos elegíveis: aprovado ou em_producao, sem boleto ativo vinculado
  const { data: pedidosElegiveis } = useQuery({
    queryKey: ['pedidos', 'sem-boleto'],
    enabled: open,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<PedidoParaBoleto[]> => {
      // Busca IDs de pedidos que já possuem boleto não-cancelado
      const { data: boletosExistentes } = await supabase
        .from('bank_slips')
        .select('pedido_id')
        .not('pedido_id', 'is', null)
        .not('status', 'eq', 'cancelado');

      const pedidosComBoleto = (boletosExistentes ?? [])
        .map((b) => b.pedido_id as string)
        .filter(Boolean);

      let query = supabase
        .from('pedidos')
        .select(
          'id, numero, valor_total, cliente_id, clientes(nome_fantasia, razao_social, cpf_cnpj, endereco, cidade, estado, cep), propostas(prazo_dias, parcelas_count)',
        )
        .is('excluido_em', null)
        .in('status', ['aprovado', 'em_producao'])
        .order('created_at', { ascending: false });

      if (pedidosComBoleto.length > 0) {
        query = query.not('id', 'in', `(${pedidosComBoleto.join(',')})`);
      }

      const { data } = await query;
      return (data ?? []) as unknown as PedidoParaBoleto[];
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
      setSelectedPedidoId('');
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

  // Autopreenche campos a partir do pedido selecionado
  const handlePedidoChange = (pedidoId: string) => {
    setSelectedPedidoId(pedidoId);

    if (!pedidoId || pedidoId === '__nenhum__') {
      setSelectedPedidoId('');
      form.setValue('pedido_id', null);
      return;
    }

    const pedido = pedidosElegiveis?.find((p) => p.id === pedidoId);
    if (!pedido) return;

    form.setValue('pedido_id', pedido.id);

    // Valor
    form.setValue('valor_nominal', Number(pedido.valor_total) || 0);

    // Cliente + dados do sacado
    if (pedido.cliente_id) {
      form.setValue('cliente_id', pedido.cliente_id);
      const c = pedido.clientes;
      if (c) {
        form.setValue('sacado_nome', c.nome_fantasia || c.razao_social || '');
        form.setValue('sacado_cpf_cnpj', c.cpf_cnpj || '');
        form.setValue('sacado_endereco', c.endereco || '');
        form.setValue('sacado_cidade', c.cidade || '');
        form.setValue('sacado_estado', c.estado || '');
        form.setValue('sacado_cep', c.cep || '');
      }
    }

    // Descrição / Seu Número
    form.setValue('seu_numero', pedido.numero ?? '');

    // Vencimento: 1º prazo da condição de pagamento ou hoje + 7 dias
    const prazo = pedido.propostas?.prazo_dias?.[0];
    const diasVenc = prazo ?? 7;
    form.setValue('data_vencimento', localDatePlusDays(diasVenc));
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

          {/* ── Pedido vinculado (pull automático) ── */}
          <div className="space-y-1.5 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <Label className="flex items-center gap-1.5 text-blue-700 font-medium">
              <Link2 size={14} /> Pedido vinculado
              <span className="text-xs font-normal text-blue-500">(opcional — preenche campos automaticamente)</span>
            </Label>
            <Select
              value={selectedPedidoId || '__nenhum__'}
              onValueChange={handlePedidoChange}
            >
              <SelectTrigger className="rounded-xl bg-white border-blue-200">
                <SelectValue placeholder="Selecione um pedido para preencher automaticamente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">— Nenhum —</SelectItem>
                {pedidosElegiveis?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Pedido #{p.numero ?? p.id.slice(0, 8)} —{' '}
                    {p.clientes?.nome_fantasia || p.clientes?.razao_social || 'Cliente'} —{' '}
                    R$ {Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pedidosElegiveis?.length === 0 && (
              <p className="text-xs text-blue-400">
                Nenhum pedido aprovado ou em produção sem boleto vinculado.
              </p>
            )}
          </div>

          {/* Conta Bancária */}
          <div className="space-y-1.5">
            <Label>Conta Bancária *</Label>
            <Select
              value={form.watch('bank_account_id') || ''}
              onValueChange={(v) => form.setValue('bank_account_id', v)}
            >
              <SelectTrigger className="rounded-xl">
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
              <SelectTrigger className="rounded-xl">
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
                className="rounded-xl"
              />
              {form.formState.errors.valor_nominal && (
                <p className="text-xs text-red-500">{form.formState.errors.valor_nominal.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento *</Label>
              <Input type="date" {...form.register('data_vencimento')} className="rounded-xl" />
              {form.formState.errors.data_vencimento && (
                <p className="text-xs text-red-500">{form.formState.errors.data_vencimento.message}</p>
              )}
            </div>
          </div>

          {/* Sacado (preenchido pelo cliente selecionado) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do Pagador *</Label>
              <Input {...form.register('sacado_nome')} placeholder="Nome completo ou razão social" className="rounded-xl" />
              {form.formState.errors.sacado_nome && (
                <p className="text-xs text-red-500">{form.formState.errors.sacado_nome.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>CPF/CNPJ *</Label>
              <Input {...form.register('sacado_cpf_cnpj')} placeholder="Apenas números" className="rounded-xl" />
              {form.formState.errors.sacado_cpf_cnpj && (
                <p className="text-xs text-red-500">{form.formState.errors.sacado_cpf_cnpj.message}</p>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input {...form.register('sacado_endereco')} placeholder="Rua, número" className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input {...form.register('sacado_cidade')} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input {...form.register('sacado_estado')} maxLength={2} placeholder="RS" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input {...form.register('sacado_cep')} placeholder="00000-000" className="rounded-xl" />
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
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data Limite Desconto</Label>
              <Input type="date" {...form.register('data_limite_desconto')} className="rounded-xl" />
            </div>
          </div>

          {/* Seu Número / Instruções */}
          <div className="space-y-1.5">
            <Label>Seu Número (referência)</Label>
            <Input {...form.register('seu_numero')} placeholder="Número de controle interno" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Instruções</Label>
            <Textarea
              {...form.register('instrucoes')}
              placeholder="Instruções para o banco..."
              rows={3}
              className="rounded-xl"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Boleto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
