import { supabase } from "@/integrations/supabase/client";
import { ilikeTerm } from "@/shared/utils/searchUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClienteListParams {
  search?: string;
  segmento?: string;
  classificacao?: string;
  page: number;
  pageSize: number;
}

export interface ClienteListResult {
  data: ClienteRow[];
  total: number;
}

export interface ClienteRow {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  classificacao: string | null;
  ativo: boolean;
  site: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface ClienteCreateInput {
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  segmento?: string;
  classificacao?: string;
  email?: string;
  telefone?: string;
  site?: string | null;
  cidade?: string;
  estado?: string;
  observacoes?: string;
}

export interface ClienteStatsResult {
  total: number;
  byClass: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch paginated list of active clientes with optional filters.
 */
export async function fetchClientes(params: ClienteListParams): Promise<ClienteListResult> {
  const { search, segmento, classificacao, page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clientes")
    .select("*", { count: "exact" })
    .eq("ativo", true)
    .order("nome_fantasia", { ascending: true })
    .range(from, to);

  if (segmento && segmento !== "all") {
    query = query.eq("segmento", segmento);
  }
  if (classificacao && classificacao !== "all") {
    query = query.eq("classificacao", classificacao);
  }
  if (search) {
    const t = ilikeTerm(search);
    query = query.or(`razao_social.ilike.${t},nome_fantasia.ilike.${t},cnpj.ilike.${t}`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data ?? []) as ClienteRow[], total: count ?? 0 };
}

/**
 * Create a new cliente record.
 */
export async function createCliente(input: ClienteCreateInput): Promise<void> {
  const { error } = await supabase.from("clientes").insert(input);
  if (error) throw error;
}

/**
 * Fetch aggregated stats (total + count by classificacao) for active clientes.
 */
export async function fetchClienteStats(): Promise<ClienteStatsResult> {
  const { data, error } = await supabase
    .from("clientes")
    .select("classificacao, segmento")
    .eq("ativo", true);

  if (error) throw error;

  const byClass: Record<string, number> = {};
  data?.forEach((c) => {
    byClass[c.classificacao] = (byClass[c.classificacao] || 0) + 1;
  });

  return { total: data?.length || 0, byClass };
}
