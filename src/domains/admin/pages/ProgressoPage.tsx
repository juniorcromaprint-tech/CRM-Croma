import { ProgressTracker } from '@/shared/components/ProgressTracker'
import { BarChart2 } from 'lucide-react'

export default function ProgressoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="text-blue-600" size={28} />
        <h1 className="text-2xl font-bold text-slate-800">Progresso ERP</h1>
      </div>
      <ProgressTracker compact={false} />
    </div>
  )
}
