// ─── Gerar Remessa Dialog ────────────────────────────────────────────────────
// Croma Print ERP — Dialog multi-step para gerar arquivo de remessa CNAB 400
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, CheckCircle2 } from 'lucide-react';
import { brl, formatDate } from '@/shared/utils/format';
import { useBankAccounts } from '../hooks/useBoletos';
import type { BankSlip } from '../types/boleto.types';

interface GerarRemessaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlips: BankSlip[];
  onConfirm: (bankAccountId: string, slipIds: string[]) => void;
  isSubmitting?: boolean;
}

export default function GerarRemessaDialog({
  open,
  onOpenChange,
  selectedSlips,
  onConfirm,
  isSubmitting,
}: GerarRemessaDialogProps) {
  const { data: bankAccounts } = useBankAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const totalValor = selectedSlips.reduce((sum, s) => sum + Number(s.valor_nominal), 0);

  const handleConfirm = () => {
    if (!selectedAccountId) return;
    onConfirm(selectedAccountId, selectedSlips.map((s) => s.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown size={20} />
            Gerar Remessa CNAB 400
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Conta Bancária */}
          <div className="space-y-1.5">
            <Label>Conta Bancária *</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nome} — {acc.banco_nome} (Ag {acc.agencia} / CC {acc.conta})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Resumo dos boletos */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <h4 className="text-sm font-semibold text-slate-600 mb-2">
              Boletos selecionados ({selectedSlips.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {selectedSlips.map((slip) => (
                <div
                  key={slip.id}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">
                      {slip.clientes?.nome_fantasia || slip.clientes?.razao_social || slip.sacado_nome}
                    </span>
                    <span className="text-xs text-slate-400">
                      NN: {slip.nosso_numero} — Venc: {formatDate(slip.data_vencimento)}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800">{brl(Number(slip.valor_nominal))}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Total</span>
              <span className="text-lg font-bold text-blue-600">{brl(totalValor)}</span>
            </div>
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 bg-blue-50 text-blue-700 rounded-xl p-3 text-sm">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <p>
              Ao confirmar, o arquivo de remessa será gerado e os boletos terão seu status
              alterado para <strong>Remetido</strong>. O download será iniciado automaticamente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAccountId || selectedSlips.length === 0 || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Remessa ({selectedSlips.length} boleto{selectedSlips.length !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
