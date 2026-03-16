import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface HistoryFilters {
  entity?: string;
  operation?: 'import' | 'export' | 'bulk_edit' | '';
  dateFrom?: string;
  dateTo?: string;
}

const PAGE_SIZE = 20;

export function useImportHistory() {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['import-history', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('import_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.entity) query = query.eq('entity', filters.entity);
      if (filters.operation) query = query.eq('operation', filters.operation);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    totalPages: Math.ceil((data?.total ?? 0) / PAGE_SIZE),
  };
}
