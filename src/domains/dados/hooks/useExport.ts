import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { exportEntityData } from '../services/export.service';
import { logImport } from '../services/import.service';
import { showSuccess, showError } from '@/utils/toast';

interface ExportOptions {
  entityKey: string;
  format: 'csv' | 'xlsx';
  filters?: Record<string, unknown>;
  selectedColumns?: string[];
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();

  const runExport = async (options: ExportOptions) => {
    setIsExporting(true);
    try {
      const result = await exportEntityData(options);
      await logImport(
        user!.id,
        options.entityKey,
        'export',
        null,
        { total_rows: result.count, inserted: 0, updated: 0, skipped: 0, errors: 0 },
      );
      showSuccess(`${result.count} registros exportados`);
    } catch {
      showError('Erro ao exportar dados');
    } finally {
      setIsExporting(false);
    }
  };

  return { runExport, isExporting };
}
