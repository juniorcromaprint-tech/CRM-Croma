// src/domains/portal/components/PortalTimelinePedido.tsx
import { Check, Clock, FileCheck2, Hammer, PackageCheck, Truck } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface PropostaLike {
  status?: string | null
  aprovado_pelo_cliente?: boolean | null
  aprovado_em?: string | null
  created_at?: string | null
}

interface PedidoLike {
  status?: string | null
  created_at?: string | null
  data_conclusao?: string | null
  data_prometida?: string | null
}

interface Props {
  proposta: PropostaLike
  pedido?: PedidoLike | null
}

interface Stage {
  label: string
  done: boolean
  current: boolean
  date?: string | null
  icon: IconCmp
}

function fmtDate(d?: string | null): string | null {
  if (!d) return null
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return null
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return null
  }
}

/**
 * Timeline visual de 5 estados:
 *   Enviada -> Aprovada -> Em produção -> Pronta -> Entregue
 *
 * Mapeamento `pedidos.status`:
 *   em_producao -> "Em produção"
 *   concluido   -> "Pronta pra entrega"
 *   faturado    -> "Entregue"
 *
 * Se pedido for null/undefined, mostra apenas os 2 primeiros estados
 * (Enviada + Aprovada).
 */
export function PortalTimelinePedido({ proposta, pedido }: Props) {
  const aprovadoCliente =
    !!proposta.aprovado_pelo_cliente ||
    proposta.status === 'aprovada_cliente' ||
    proposta.status === 'aprovada' ||
    !!pedido

  const pStatus = pedido?.status ?? null
  const emProducao = pStatus === 'em_producao'
  const concluido = pStatus === 'concluido' || pStatus === 'faturado'
  const entregue = pStatus === 'faturado'

  const allStages: Stage[] = [
    {
      label: 'Proposta enviada',
      done: true,
      current: !aprovadoCliente,
      date: proposta.created_at,
      icon: FileCheck2,
    },
    {
      label: 'Aprovada',
      done: aprovadoCliente,
      current: aprovadoCliente && !pedido,
      date: proposta.aprovado_em,
      icon: Check,
    },
    {
      label: 'Em produção',
      done: emProducao || concluido,
      current: emProducao,
      date: pedido?.created_at,
      icon: Hammer,
    },
    {
      label: 'Pronta',
      done: concluido,
      current: pStatus === 'concluido',
      date: pedido?.data_conclusao,
      icon: PackageCheck,
    },
    {
      label: 'Entregue',
      done: entregue,
      current: entregue,
      date: null,
      icon: Truck,
    },
  ]

  // Sem pedido: só mostra os 2 primeiros estágios.
  const stages = pedido ? allStages : allStages.slice(0, 2)

  const prazo = fmtDate(pedido?.data_prometida)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Próximos passos</h3>
        {prazo && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={12} />
            <span>Previsão: <span className="font-semibold text-slate-700">{prazo}</span></span>
          </div>
        )}
      </div>

      {/* Desktop: horizontal */}
      <ol className="hidden sm:flex items-start justify-between gap-2 relative">
        {stages.map((s, i) => {
          const Icon = s.icon
          const colors = s.done
            ? 'bg-emerald-500 text-white border-emerald-500'
            : s.current
            ? 'bg-blue-500 text-white border-blue-500 ring-4 ring-blue-100'
            : 'bg-slate-100 text-slate-400 border-slate-200'
          const lineColor = stages[i + 1]?.done || stages[i + 1]?.current ? 'bg-emerald-500' : 'bg-slate-200'
          const labelColor = s.done || s.current ? 'text-slate-700 font-semibold' : 'text-slate-400'
          const dateStr = fmtDate(s.date)
          return (
            <li key={s.label} className="flex-1 flex flex-col items-center text-center relative">
              {i < stages.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 right-0 h-0.5 ${lineColor}`}
                  style={{ width: '100%' }}
                  aria-hidden="true"
                />
              )}
              <div
                className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center ${colors}`}
              >
                <Icon size={16} />
              </div>
              <p className={`mt-2 text-xs ${labelColor}`}>{s.label}</p>
              {dateStr && <p className="text-[10px] text-slate-400 mt-0.5">{dateStr}</p>}
            </li>
          )
        })}
      </ol>

      {/* Mobile: vertical */}
      <ol className="sm:hidden space-y-3">
        {stages.map((s, i) => {
          const Icon = s.icon
          const colors = s.done
            ? 'bg-emerald-500 text-white border-emerald-500'
            : s.current
            ? 'bg-blue-500 text-white border-blue-500 ring-4 ring-blue-100'
            : 'bg-slate-100 text-slate-400 border-slate-200'
          const labelColor = s.done || s.current ? 'text-slate-700 font-semibold' : 'text-slate-400'
          const dateStr = fmtDate(s.date)
          const isLast = i === stages.length - 1
          return (
            <li key={s.label} className="flex items-start gap-3 relative">
              <div className="flex flex-col items-center">
                <div
                  className={`relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${colors}`}
                >
                  <Icon size={14} />
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-6 mt-1 ${
                      stages[i + 1]?.done || stages[i + 1]?.current ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="pt-1.5">
                <p className={`text-sm ${labelColor}`}>{s.label}</p>
                {dateStr && <p className="text-xs text-slate-400">{dateStr}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default PortalTimelinePedido
