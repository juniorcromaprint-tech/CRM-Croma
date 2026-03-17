// ============================================================================
// AgingTable — Tabela de Aging (Contas a Receber por faixa de atraso)
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { brl } from '@/shared/utils/format';
import type { AgingComCliente, AgingResumo } from '../types/motor-financeiro.types';
import { Clock } from 'lucide-react';

interface AgingTableProps {
  data: AgingComCliente[];
  resumo: AgingResumo;
  loading?: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-slate-100">
        <div className="h-5 w-48 bg-slate-100 rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-50 rounded" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <Clock size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">Nenhum título em aberto</h3>
      <p className="text-sm text-slate-400 mt-1">
        Não há contas a receber pendentes para análise de aging
      </p>
    </div>
  );
}

export default function AgingTable({ data, resumo, loading = false }: AgingTableProps) {
  const navigate = useNavigate();

  if (loading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                A Vencer
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                1-30
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                31-60
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                61-90
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                90+
              </th>
              <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Summary row */}
            <tr className="bg-blue-50 font-bold">
              <td className="py-2.5 px-4 text-slate-700">TOTAL</td>
              <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                {brl(resumo.a_vencer)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-amber-700">
                {brl(resumo.d1_30)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-orange-700">
                {brl(resumo.d31_60)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-red-700">
                {brl(resumo.d61_90)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-red-800">
                {brl(resumo.d90_mais)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-slate-800">
                {brl(resumo.total)}
              </td>
            </tr>

            {/* Data rows */}
            {data.map((row) => (
              <tr
                key={row.cliente_id}
                className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                onClick={() => navigate(`/financeiro?cliente_id=${row.cliente_id}`)}
              >
                <td className="py-2.5 px-4 text-slate-700 font-medium truncate max-w-[200px]">
                  {row.nome_fantasia || row.razao_social || '—'}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-slate-600">
                  {row.a_vencer > 0 ? brl(row.a_vencer) : '—'}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${row.d1_30 > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}>
                  {row.d1_30 > 0 ? brl(row.d1_30) : '—'}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${row.d31_60 > 0 ? 'bg-orange-50 text-orange-700' : 'text-slate-400'}`}>
                  {row.d31_60 > 0 ? brl(row.d31_60) : '—'}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${row.d61_90 > 0 ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                  {row.d61_90 > 0 ? brl(row.d61_90) : '—'}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${row.d90_mais > 0 ? 'bg-red-100 text-red-800' : 'text-slate-400'}`}>
                  {row.d90_mais > 0 ? brl(row.d90_mais) : '—'}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-700">
                  {brl(row.total_aberto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
