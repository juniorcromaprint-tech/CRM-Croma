import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBalancete } from '../hooks/useLancamentos';
import { brl } from '@/shared/utils/format';

function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}

export default function BalancetePage() {
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(lastDayOfMonth());

  const { data: rows = [], isLoading } = useBalancete(dataInicio, dataFim);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        debitos: acc.debitos + r.total_debitos,
        creditos: acc.creditos + r.total_creditos,
        saldo: acc.saldo + r.saldo,
      }),
      { debitos: 0, creditos: 0, saldo: 0 }
    );
  }, [rows]);

  const rowsComMovimento = rows.filter(r => r.total_debitos > 0 || r.total_creditos > 0);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Balancete</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conferência débitos x créditos por conta</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4 items-end flex-wrap">
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

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : rowsComMovimento.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Sem lançamentos no período</h3>
            <p className="text-sm text-slate-400 mt-1">Importe extratos ou crie lançamentos manuais</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="px-5 py-3 text-left font-medium">Código</th>
                    <th className="px-5 py-3 text-left font-medium">Conta</th>
                    <th className="px-5 py-3 text-center font-medium">Tipo</th>
                    <th className="px-5 py-3 text-right font-medium">Débitos</th>
                    <th className="px-5 py-3 text-right font-medium">Créditos</th>
                    <th className="px-5 py-3 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowsComMovimento.map((row) => (
                    <tr key={row.conta_id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.codigo}</td>
                      <td className="px-5 py-3 font-medium text-slate-700">{row.nome}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.tipo === 'receita' ? 'bg-green-100 text-green-700' :
                          row.tipo === 'despesa' ? 'bg-red-100 text-red-700' :
                          row.tipo === 'ativo' ? 'bg-blue-100 text-blue-700' :
                          row.tipo === 'passivo' ? 'bg-orange-100 text-orange-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {row.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{brl(row.total_debitos)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{brl(row.total_creditos)}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${
                        row.saldo > 0 ? 'text-green-700' : row.saldo < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {brl(Math.abs(row.saldo))}
                        {row.saldo < 0 && ' C'}
                        {row.saldo > 0 && ' D'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-700">
                    <td colSpan={3} className="px-5 py-3 text-sm">TOTAIS</td>
                    <td className="px-5 py-3 text-right">{brl(totais.debitos)}</td>
                    <td className="px-5 py-3 text-right">{brl(totais.creditos)}</td>
                    <td className={`px-5 py-3 text-right ${
                      Math.abs(totais.debitos - totais.creditos) < 0.01 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(totais.debitos - totais.creditos) < 0.01
                        ? '✓ Equilibrado'
                        : `Diferença: ${brl(Math.abs(totais.debitos - totais.creditos))}`}
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
