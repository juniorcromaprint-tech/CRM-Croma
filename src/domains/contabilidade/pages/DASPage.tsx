import { useState } from 'react';
import { Calculator, CheckCircle2, DollarSign, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDASHistorico, useCalcularDAS, useMarcarDASPago } from '../hooks/useDAS';
import { useConfigTributaria } from '../hooks/useConfigTributaria';
import { DASStatsCards } from '../components/DASStatsCards';
import { AlertasTributarios } from '../components/AlertasTributarios';
import { gerarAlertas, type DASCalculo } from '../services/das-simples.service';
import { brl, formatDate } from '@/shared/utils/format';
import type { DASApuracao } from '../types/contabilidade.types';

function currentMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function DASPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [competencia, setCompetencia] = useState(currentMonthDate());
  const [pagarDialog, setPagarDialog] = useState<DASApuracao | null>(null);
  const [dataPagamento, setDataPagamento] = useState('');

  const { data: historico = [], isLoading } = useDASHistorico(selectedYear);
  const { data: configTrib } = useConfigTributaria();
  const calcularDAS = useCalcularDAS();
  const marcarPago = useMarcarDASPago();

  const ultimoDAS = historico[0] ?? null;
  const alertas = ultimoDAS && configTrib
    ? gerarAlertas(ultimoDAS as unknown as DASCalculo, configTrib.pro_labore_mensal)
    : [];

  function handleMarcarPago() {
    if (!pagarDialog || !dataPagamento) return;
    marcarPago.mutate(
      { id: pagarDialog.id, data: dataPagamento },
      { onSuccess: () => setPagarDialog(null) }
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">DAS — Simples Nacional</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cálculo automático do imposto mensal
          </p>
        </div>
      </div>

      {/* Cards do último DAS */}
      <DASStatsCards apuracao={ultimoDAS} />

      {/* Alertas */}
      {alertas.length > 0 && <AlertasTributarios alertas={alertas} />}

      {/* Calculadora */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-blue-600" />
          Calcular DAS
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label className="text-xs text-slate-500 mb-1.5 block">Competência (mês de referência)</Label>
            <Input
              type="date"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700 gap-2"
            onClick={() => calcularDAS.mutate(competencia)}
            disabled={calcularDAS.isPending}
          >
            {calcularDAS.isPending ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Calculator size={14} />
            )}
            Calcular
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <Info size={11} />
          Busca receitas pagas no mês de competência e RBT12 dos últimos 12 meses
        </p>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Histórico</h2>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500">Ano:</Label>
            <Input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-20 h-7 text-sm rounded-xl"
              min={2020}
              max={2099}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : historico.length === 0 ? (
          <div className="p-12 text-center">
            <Calculator size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Sem apurações em {selectedYear}</h3>
            <p className="text-sm text-slate-400 mt-1">Calcule o DAS acima para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="px-5 py-3 text-left font-medium">Competência</th>
                  <th className="px-5 py-3 text-right font-medium">Receita Mês</th>
                  <th className="px-5 py-3 text-right font-medium">RBT12</th>
                  <th className="px-5 py-3 text-center font-medium">Anexo</th>
                  <th className="px-5 py-3 text-right font-medium">Alíquota Ef.</th>
                  <th className="px-5 py-3 text-right font-medium">DAS</th>
                  <th className="px-5 py-3 text-center font-medium">Vencimento</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map((das) => (
                  <tr key={das.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">
                      {formatDate(das.competencia)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {brl(das.receita_bruta_mes)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {brl(das.rbt12)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        das.anexo === 'III' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Anexo {das.anexo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {(das.aliquota_efetiva * 100).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {brl(das.valor_das)}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500 text-xs">
                      {formatDate(das.data_vencimento)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        das.status === 'pago'
                          ? 'bg-green-100 text-green-700'
                          : das.status === 'conferido'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {das.status === 'pago' ? 'Pago' : das.status === 'conferido' ? 'Conferido' : 'Calculado'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {das.status !== 'pago' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1"
                          onClick={() => {
                            setPagarDialog(das);
                            setDataPagamento(new Date().toISOString().split('T')[0]);
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Marcar Pago
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog marcar pago */}
      <Dialog open={!!pagarDialog} onOpenChange={() => setPagarDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign size={18} className="text-green-600" />
              Marcar DAS como Pago
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="text-slate-500">DAS de {pagarDialog ? formatDate(pagarDialog.competencia) : ''}</p>
              <p className="font-bold text-lg text-slate-800">{pagarDialog ? brl(pagarDialog.valor_das) : ''}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Data de Pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarDialog(null)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleMarcarPago}
              disabled={marcarPago.isPending || !dataPagamento}
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
