import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContasAnaliticas, useRazaoConta } from '../hooks/useLancamentos';
import { brl, formatDate } from '@/shared/utils/format';

function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}

export default function RazaoPage() {
  const [contaId, setContaId] = useState('');
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(lastDayOfMonth());

  const { data: contas = [] } = useContasAnaliticas();
  const { data: razao = [], isLoading } = useRazaoConta(contaId, dataInicio, dataFim);

  const contaSelecionada = contas.find(c => c.id === contaId);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Razão Contábil</h1>
        <p className="text-sm text-slate-500 mt-0.5">Extrato detalhado por conta com saldo acumulado</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-48">
          <Label className="text-xs text-slate-500 mb-1.5 block">Conta contábil</Label>
          <Select value={contaId} onValueChange={setContaId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione uma conta..." />
            </SelectTrigger>
            <SelectContent>
              {contas.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.codigo} — {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Data início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-xl w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Data fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-xl w-40"
          />
        </div>
      </div>

      {/* Tabela razão */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {!contaId ? (
          <div className="p-12 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Selecione uma conta</h3>
            <p className="text-sm text-slate-400 mt-1">Escolha uma conta acima para ver o razão</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : razao.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Sem lançamentos</h3>
            <p className="text-sm text-slate-400 mt-1">
              Conta {contaSelecionada?.codigo} — {contaSelecionada?.nome} não tem movimentação no período
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="font-semibold text-slate-700 text-sm">
                {contaSelecionada?.codigo} — {contaSelecionada?.nome}
              </p>
              <p className="text-xs text-slate-400">{razao.length} lançamentos no período</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-100">
                    <th className="px-5 py-3 text-left font-medium">Data</th>
                    <th className="px-5 py-3 text-left font-medium">Histórico</th>
                    <th className="px-5 py-3 text-right font-medium">Débito</th>
                    <th className="px-5 py-3 text-right font-medium">Crédito</th>
                    <th className="px-5 py-3 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {razao.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(row.data_lancamento)}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{row.historico}</td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {row.debito > 0 ? brl(row.debito) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {row.credito > 0 ? brl(row.credito) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${
                        row.saldo_acumulado >= 0 ? 'text-slate-800' : 'text-red-600'
                      }`}>
                        {brl(Math.abs(row.saldo_acumulado))}
                        {row.saldo_acumulado < 0 && ' C'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                    <td colSpan={2} className="px-5 py-3 text-xs">SALDO FINAL</td>
                    <td className="px-5 py-3 text-right">{brl(razao.reduce((s, r) => s + r.debito, 0))}</td>
                    <td className="px-5 py-3 text-right">{brl(razao.reduce((s, r) => s + r.credito, 0))}</td>
                    <td className={`px-5 py-3 text-right ${
                      razao[razao.length - 1]?.saldo_acumulado >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {razao.length > 0 ? brl(Math.abs(razao[razao.length - 1].saldo_acumulado)) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
