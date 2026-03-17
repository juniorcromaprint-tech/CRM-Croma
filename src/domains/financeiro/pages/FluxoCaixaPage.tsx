// ============================================================================
// FluxoCaixaPage — Fluxo de Caixa Projetado
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import KpiCard from '@/shared/components/KpiCard';
import CashFlowChart from '../components/CashFlowChart';
import { useFluxoCaixa, useSaldoRealizado } from '../hooks/useMotorFinanceiro';

const PERIODOS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 },
] as const;

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function FluxoCaixaPage() {
  const [dias, setDias] = useState(90);

  const { data: fluxo, isLoading: loadingFluxo } = useFluxoCaixa(dias);
  const { data: saldo, isLoading: loadingSaldo } = useSaldoRealizado();

  const totais = useMemo(() => {
    if (!fluxo || fluxo.length === 0) {
      return { entradas: 0, saidas: 0, saldoProjetado: 0 };
    }
    const entradas = fluxo.reduce((acc, d) => acc + d.entradas, 0);
    const saidas = fluxo.reduce((acc, d) => acc + d.saidas, 0);
    const saldoProjetado = fluxo[fluxo.length - 1]?.saldo_acumulado ?? 0;
    return { entradas, saidas, saldoProjetado };
  }, [fluxo]);

  const saldoProjetadoNegativo = totais.saldoProjetado < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Fluxo de Caixa</h1>
            <p className="text-sm text-slate-500">Projeção de entradas e saídas</p>
          </div>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDias(p.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dias === p.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Saldo Atual"
          value={brl(saldo ?? 0)}
          icon={<DollarSign size={20} />}
          color="blue"
          loading={loadingSaldo}
        />
        <KpiCard
          title="Entradas Projetadas"
          value={brl(totais.entradas)}
          icon={<ArrowDownLeft size={20} />}
          color="green"
          loading={loadingFluxo}
        />
        <KpiCard
          title="Saídas Projetadas"
          value={brl(totais.saidas)}
          icon={<ArrowUpRight size={20} />}
          color="red"
          loading={loadingFluxo}
        />
        <KpiCard
          title="Saldo Projetado"
          value={brl(totais.saldoProjetado)}
          icon={<Wallet size={20} />}
          color={saldoProjetadoNegativo ? 'amber' : 'green'}
          loading={loadingFluxo}
        />
      </div>

      {/* Chart */}
      <CashFlowChart data={fluxo ?? []} loading={loadingFluxo} />

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Detalhamento Diário</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Entradas
                </th>
                <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Saídas
                </th>
                <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Saldo Dia
                </th>
                <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingFluxo ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-2.5 px-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 w-24 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 w-24 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 w-24 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 w-24 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : !fluxo || fluxo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    Nenhum dado de fluxo para o período selecionado
                  </td>
                </tr>
              ) : (
                fluxo.map((row) => (
                  <tr key={row.data} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">
                      {formatDateBR(row.data)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600">
                      {row.entradas > 0 ? brl(row.entradas) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-red-600">
                      {row.saidas > 0 ? brl(row.saidas) : '—'}
                    </td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${row.saldo_dia < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {brl(row.saldo_dia)}
                    </td>
                    <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${row.saldo_acumulado < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {brl(row.saldo_acumulado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
