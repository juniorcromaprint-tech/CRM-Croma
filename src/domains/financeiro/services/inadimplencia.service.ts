import { supabase } from '@/integrations/supabase/client';
import type { Inadimplente } from '../types/motor-financeiro.types';

/**
 * Lists all delinquent clients from the v_inadimplentes view.
 */
export async function listarInadimplentes(): Promise<Inadimplente[]> {
  const { data, error } = await (supabase
    .from('v_inadimplentes' as any)
    .select('*'));

  if (error) throw error;

  return (data ?? []) as Inadimplente[];
}

/**
 * Checks if a specific client is delinquent.
 */
export async function clienteInadimplente(clienteId: string): Promise<Inadimplente | null> {
  const { data, error } = await (supabase
    .from('v_inadimplentes' as any)
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle());

  if (error) throw error;

  return (data as Inadimplente) ?? null;
}
