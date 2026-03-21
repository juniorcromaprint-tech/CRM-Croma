import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useAdminConfig(chave: string) {
  return useQuery({
    queryKey: ['admin_config', chave],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', chave)
        .single()
      return data?.valor ?? null
    },
    staleTime: 1000 * 60 * 10,
  })
}
