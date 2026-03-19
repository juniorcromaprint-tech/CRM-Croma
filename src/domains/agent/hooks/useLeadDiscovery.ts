import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import {
  buscarLeadsGoogle,
  enriquecerCNPJ,
  importarLeadsDescobertos,
  importarLeadsCSV,
  type DiscoveredLead,
  type ParsedCsvLead,
} from '../services/leadDiscoveryService';

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Mutation to search for leads via Google Places (Edge Function).
 * Returns leads already decorated with dedup info.
 */
export function useSearchLeads() {
  return useMutation({
    mutationFn: buscarLeadsGoogle,
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Mutation to enrich a single lead with CNPJ data from BrasilAPI.
 */
export function useEnrichCNPJ() {
  return useMutation({
    mutationFn: enriquecerCNPJ,
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Mutation to import a list of DiscoveredLeads into the CRM.
 * Invalidates leads queries so the CRM list updates immediately.
 */
export function useImportLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importarLeadsDescobertos,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'leads'] });
      const parts: string[] = [];
      if (result.importados > 0) parts.push(`${result.importados} importado${result.importados !== 1 ? 's' : ''}`);
      if (result.duplicados > 0) parts.push(`${result.duplicados} duplicado${result.duplicados !== 1 ? 's' : ''} ignorado${result.duplicados !== 1 ? 's' : ''}`);
      if (result.erros > 0) parts.push(`${result.erros} erro${result.erros !== 1 ? 's' : ''}`);
      showSuccess(parts.join(' · '));
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Mutation to import CSV-parsed leads into the CRM.
 * Invalidates leads queries.
 */
export function useImportCsvLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leads: ParsedCsvLead[]) => importarLeadsCSV(leads),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'leads'] });
      const parts: string[] = [];
      if (result.importados > 0) parts.push(`${result.importados} importado${result.importados !== 1 ? 's' : ''}`);
      if (result.duplicados > 0) parts.push(`${result.duplicados} duplicado${result.duplicados !== 1 ? 's' : ''} ignorado${result.duplicados !== 1 ? 's' : ''}`);
      if (result.erros > 0) parts.push(`${result.erros} erro${result.erros !== 1 ? 's' : ''}`);
      showSuccess(parts.join(' · '));
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Re-export types for convenience.
 */
export type { DiscoveredLead, ParsedCsvLead };
