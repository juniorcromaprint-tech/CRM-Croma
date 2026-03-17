// ============================================================================
// RetornoPreview — Preview de arquivo de retorno CNAB 400 parseado
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { brl } from '@/shared/utils/format';
import type { RetornoParseado } from '../services/cnab400-retorno.service';
import { getOcorrenciaLabel } from '../services/cnab400-retorno.service';
import { FileCheck, FileText } from 'lucide-react';

interface RetornoPreviewProps {
  data: RetornoParseado;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function RetornoPreview({ data }: RetornoPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
          <FileText size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-700">
            {data.detalhes.length} registros
          </span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <FileCheck size={16} className="text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            {data.liquidacoes.length} liquidações
          </span>
        </div>
        <div className="text-sm text-slate-500">
          Banco: <span className="font-medium text-slate-700">{data.header.nomeBanco}</span>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nosso Número
                </th>
                <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ocorrência
                </th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data Crédito
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.detalhes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                    Nenhum registro de detalhe encontrado
                  </td>
                </tr>
              ) : (
                data.detalhes.map((d, i) => {
                  const isLiquidacao = ['06', '09', '10', '17'].includes(d.codigoOcorrencia);
                  return (
                    <tr
                      key={`${d.nossoNumero}-${i}`}
                      className={`hover:bg-slate-50/50 transition-colors ${isLiquidacao ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="py-2.5 px-4 text-slate-700 font-mono text-xs">
                        {d.nossoNumero}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                        {brl(d.valorPago)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isLiquidacao
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {getOcorrenciaLabel(d.codigoOcorrencia)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {formatDate(d.dataCredito)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
