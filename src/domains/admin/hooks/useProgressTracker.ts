import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

const FEATURES = [
  { key: 'feature_onedrive', label: 'OneDrive Integration', peso: 4.2 },
  { key: 'feature_propostas', label: 'Módulo Propostas', peso: 4.2 },
  { key: 'feature_faturamento_lote', label: 'Faturamento em Lote', peso: 4.2 },
  { key: 'feature_almoxarife', label: 'Almoxarife', peso: 4.2 },
  { key: 'feature_diario_bordo', label: 'Diário de Bordo', peso: 4.2 },
  { key: 'feature_tv_producao', label: 'TV Produção', peso: 4.2 },
  { key: 'feature_relatorios', label: 'Relatórios', peso: 4.2 },
  { key: 'feature_conciliacao', label: 'Conciliação Bancária', peso: 4.2 },
  { key: 'feature_calendario', label: 'Calendário', peso: 4.2 },
  { key: 'feature_campanhas', label: 'Campanhas', peso: 4.2 },
]

export interface FeatureStatus {
  key: string
  label: string
  peso: number
  enabled: boolean
}

export function useProgressTracker() {
  return useQuery({
    queryKey: ['progress_tracker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('chave, valor')
        .in('chave', FEATURES.map(f => f.key))
      if (error) throw new Error(error.message)

      const configMap = Object.fromEntries((data ?? []).map(r => [r.chave, r.valor]))

      const features: FeatureStatus[] = FEATURES.map(f => ({
        ...f,
        enabled: configMap[f.key] === 'true',
      }))

      const base = 58
      const extra = features.reduce((sum, f) => sum + (f.enabled ? f.peso : 0), 0)
      const totalErp = Math.min(100, Math.round((base + extra) * 10) / 10)

      return { features, totalErp, base }
    },
    staleTime: 1000 * 30,
  })
}

export function useToggleFeature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('admin_config')
        .update({ valor: enabled ? 'true' : 'false' })
        .eq('chave', key)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress_tracker'] })
      showSuccess('Configuração atualizada!')
    },
    onError: (e: Error) => showError(e.message),
  })
}
