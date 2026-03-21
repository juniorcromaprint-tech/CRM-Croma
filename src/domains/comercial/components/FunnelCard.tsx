import { TrendingDown, Users, FileText, ShoppingBag, CheckSquare } from 'lucide-react'
import { brl } from '@/shared/utils/format'

interface FunnelData {
  totalLeads: number
  totalPropostas: number
  totalPedidos: number
  totalFaturados: number
  valorFaturado: number
  txLeadProposta: number
  txPropostaPedido: number
  txPedidoFaturado: number
  txGeral: number
  periodo: string
}

export default function FunnelCard({ data }: { data: FunnelData }) {
  const steps = [
    { icon: <Users size={16} />, label: 'Leads', value: data.totalLeads, tx: null, color: 'bg-blue-500' },
    { icon: <FileText size={16} />, label: 'Propostas', value: data.totalPropostas, tx: data.txLeadProposta, color: 'bg-indigo-500' },
    { icon: <ShoppingBag size={16} />, label: 'Pedidos', value: data.totalPedidos, tx: data.txPropostaPedido, color: 'bg-purple-500' },
    { icon: <CheckSquare size={16} />, label: 'Faturados', value: data.totalFaturados, tx: data.txPedidoFaturado, color: 'bg-emerald-500' },
  ]

  const maxVal = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown size={18} className="text-slate-500" />
          <h3 className="font-semibold text-slate-700 text-sm">Funil de Conversão</h3>
        </div>
        <span className="text-xs text-slate-400">{data.periodo}</span>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-slate-600">
                {step.icon}
                <span className="text-xs font-medium">{step.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {step.tx !== null && (
                  <span className={`text-xs font-semibold ${step.tx >= 50 ? 'text-emerald-600' : step.tx >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                    {step.tx}%
                  </span>
                )}
                <span className="text-sm font-bold text-slate-800 tabular-nums w-8 text-right">{step.value}</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                style={{ width: `${(step.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">Conversão geral lead → faturado</span>
        <span className={`text-sm font-bold ${data.txGeral >= 20 ? 'text-emerald-600' : data.txGeral >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
          {data.txGeral}%
        </span>
      </div>

      <div className="mt-2 text-right">
        <span className="text-xs text-slate-400">Receita faturada: </span>
        <span className="text-xs font-semibold text-slate-700">{brl(data.valorFaturado)}</span>
      </div>
    </div>
  )
}
