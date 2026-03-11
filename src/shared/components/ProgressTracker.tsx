import { Link } from 'react-router-dom'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useProgressTracker, useToggleFeature, type FeatureStatus } from '@/domains/admin/hooks/useProgressTracker'

interface ProgressTrackerProps {
  compact?: boolean
}

/* ─── Compact mode: small dashboard widget ─── */

function CompactWidget({ totalErp, activeCount }: { totalErp: number; activeCount: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-600">ERP Croma</p>
        <Link
          to="/admin/progresso"
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Ver detalhes →
        </Link>
      </div>
      <p className="text-4xl font-bold text-slate-800 tabular-nums leading-none mb-3">
        {totalErp}%
      </p>
      <Progress value={totalErp} className="h-2 mb-2" />
      <p className="text-xs text-slate-400">{activeCount} de 10 módulos ativos</p>
    </div>
  )
}

/* ─── Feature Card (full mode) ─── */

function FeatureCard({ feature }: { feature: FeatureStatus }) {
  const toggle = useToggleFeature()

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{feature.label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{feature.peso}% do total</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            feature.enabled
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {feature.enabled ? 'Ativo' : 'Inativo'}
        </span>
        <Switch
          checked={feature.enabled}
          onCheckedChange={(checked) =>
            toggle.mutate({ key: feature.key, enabled: checked })
          }
          disabled={toggle.isPending}
        />
      </div>
    </div>
  )
}

/* ─── Full mode: admin page ─── */

function FullWidget({
  totalErp,
  features,
}: {
  totalErp: number
  features: FeatureStatus[]
}) {
  const activeCount = features.filter(f => f.enabled).length

  return (
    <div className="space-y-6">
      {/* Progress summary card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Conclusão geral do ERP</p>
            <p className="text-6xl font-bold text-slate-800 tabular-nums leading-none">
              {totalErp}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-600">{activeCount} de 10 módulos</p>
            <p className="text-xs text-slate-400">ativos e configurados</p>
          </div>
        </div>
        <Progress value={totalErp} className="h-3" />
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map(feature => (
          <FeatureCard key={feature.key} feature={feature} />
        ))}
      </div>
    </div>
  )
}

/* ─── Public component ─── */

export function ProgressTracker({ compact = false }: ProgressTrackerProps) {
  const { data, isLoading } = useProgressTracker()

  if (isLoading) {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-100 animate-pulse ${
          compact ? 'p-5 h-28' : 'p-6 h-48'
        }`}
      />
    )
  }

  if (!data) return null

  const activeCount = data.features.filter(f => f.enabled).length

  if (compact) {
    return <CompactWidget totalErp={data.totalErp} activeCount={activeCount} />
  }

  return <FullWidget totalErp={data.totalErp} features={data.features} />
}
