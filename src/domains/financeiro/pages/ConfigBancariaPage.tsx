// ─── Config Bancária Page ────────────────────────────────────────────────────
// Croma Print ERP — Cadastro e gestão de contas bancárias
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Building, Pencil } from 'lucide-react';
import { formatCNPJ } from '@/shared/utils/format';

import BankAccountForm from '../components/BankAccountForm';
import type { BankAccountFormData } from '../schemas/boleto.schemas';
import type { BankAccount } from '../types/boleto.types';
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
} from '../hooks/useBoletos';

export default function ConfigBancariaPage() {
  const { data: accounts, isLoading } = useBankAccounts();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const handleCreate = (data: BankAccountFormData) => {
    createAccount.mutate(data as any, { onSuccess: () => setShowForm(false) });
  };

  const handleUpdate = (data: BankAccountFormData) => {
    if (!editing) return;
    updateAccount.mutate(
      { id: editing.id, ...data } as any,
      { onSuccess: () => setEditing(null) },
    );
  };

  const handleEdit = (account: BankAccount) => {
    setEditing(account);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuração Bancária</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastro de contas bancárias e carteiras para emissão de boletos
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1" /> Nova Conta
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-5">
                <Skeleton className="h-5 w-40 mb-3" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !accounts?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma conta bancária cadastrada</h3>
          <p className="text-sm text-slate-400 mt-1">
            Cadastre uma conta para começar a emitir boletos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <Building size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{acc.nome}</h3>
                      <p className="text-xs text-slate-400">{acc.banco_nome}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(acc)}
                  >
                    <Pencil size={14} />
                  </Button>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agência</span>
                    <span className="text-slate-700 font-mono">
                      {acc.agencia}{acc.agencia_digito ? `-${acc.agencia_digito}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Conta</span>
                    <span className="text-slate-700 font-mono">
                      {acc.conta}-{acc.conta_digito}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Carteira</span>
                    <span className="text-slate-700">{acc.carteira}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CNPJ</span>
                    <span className="text-slate-700">{formatCNPJ(acc.cedente_cnpj)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nº Seq. Atual</span>
                    <span className="text-slate-700 font-mono">{acc.nosso_numero_sequencial}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-400">
                  <span>Juros: {acc.juros_ao_mes}% / Multa: {acc.multa_percentual}%</span>
                  {acc.dias_protesto > 0 && (
                    <span>Protesto: {acc.dias_protesto} dias</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Criar */}
      <BankAccountForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleCreate}
        isSubmitting={createAccount.isPending}
      />

      {/* Dialog Editar */}
      {editing && (
        <BankAccountForm
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSubmit={handleUpdate}
          isSubmitting={updateAccount.isPending}
          title="Editar Conta Bancária"
          defaultValues={{
            nome: editing.nome,
            banco_codigo: editing.banco_codigo,
            banco_nome: editing.banco_nome,
            agencia: editing.agencia,
            agencia_digito: editing.agencia_digito,
            conta: editing.conta,
            conta_digito: editing.conta_digito,
            carteira: editing.carteira,
            convenio: editing.convenio,
            cedente_nome: editing.cedente_nome,
            cedente_cnpj: editing.cedente_cnpj,
            cedente_endereco: editing.cedente_endereco,
            cedente_cidade: editing.cedente_cidade,
            cedente_estado: editing.cedente_estado,
            cedente_cep: editing.cedente_cep,
            instrucoes_padrao: editing.instrucoes_padrao,
            juros_ao_mes: editing.juros_ao_mes,
            multa_percentual: editing.multa_percentual,
            dias_protesto: editing.dias_protesto,
          }}
        />
      )}
    </div>
  );
}
