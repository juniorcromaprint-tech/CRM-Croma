import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCNPJ } from '@/shared/utils/format';

export interface CnpjDuplicateResult {
  isDuplicate: boolean;
  clienteNome: string | null;
  clienteId: string | null;
}

/**
 * Check if a CNPJ already exists in the database.
 * Optionally excludes a specific client ID (for edit mode).
 */
export function useCnpjDuplicate() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CnpjDuplicateResult>({
    isDuplicate: false,
    clienteNome: null,
    clienteId: null,
  });

  const check = useCallback(async (cnpj: string, excludeId?: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      setResult({ isDuplicate: false, clienteNome: null, clienteId: null });
      return false;
    }

    setChecking(true);
    try {
      // DB may store CNPJ formatted or unformatted — check both
      const formatted = formatCNPJ(digits);
      let query = supabase
        .from('clientes')
        .select('id, nome_fantasia, razao_social')
        .or(`cnpj.eq.${digits},cnpj.eq.${formatted}`)
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const nome = data[0].nome_fantasia || data[0].razao_social || 'Cliente sem nome';
        setResult({ isDuplicate: true, clienteNome: nome, clienteId: data[0].id });
        return true;
      }

      setResult({ isDuplicate: false, clienteNome: null, clienteId: null });
      return false;
    } catch {
      setResult({ isDuplicate: false, clienteNome: null, clienteId: null });
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult({ isDuplicate: false, clienteNome: null, clienteId: null });
  }, []);

  return { check, checking, ...result, reset };
}
