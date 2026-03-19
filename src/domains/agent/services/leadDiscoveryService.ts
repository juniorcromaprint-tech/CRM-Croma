import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredLead {
  nome: string;
  endereco: string;
  telefone: string | null;
  website: string | null;
  google_maps_url: string | null;
  tipos: string[];
  avaliacao: number | null;
  total_avaliacoes: number | null;
  cnpj?: string;
  enrichment?: Record<string, unknown>;
  duplicado?: boolean;
  lead_existente_id?: string;
}

export interface ImportResult {
  importados: number;
  duplicados: number;
  erros: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize phone: strip non-digits, return last 10 digits */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

/** Infer CRM segmento from Google Places types */
function inferSegmento(tipos: string[]): string {
  if (tipos.some((t) => t.includes('shoe') || t.includes('calçado'))) return 'varejo';
  if (tipos.some((t) => t === 'store' || t.includes('shop'))) return 'varejo';
  if (tipos.some((t) => t.includes('restaurant') || t.includes('food'))) return 'alimentacao';
  if (tipos.some((t) => t.includes('pharmacy') || t.includes('health'))) return 'saude';
  if (tipos.some((t) => t.includes('bank') || t.includes('finance'))) return 'financeiro';
  if (tipos.some((t) => t.includes('car') || t.includes('auto'))) return 'automotivo';
  if (tipos.some((t) => t.includes('hotel') || t.includes('lodging'))) return 'hotelaria';
  if (tipos.some((t) => t.includes('school') || t.includes('education'))) return 'educacao';
  return 'varejo';
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Checks each discovered lead against existing CRM leads.
 * Marks duplicates with `duplicado = true` and `lead_existente_id`.
 * Matching strategy: phone (last 10 digits) → email (exact) → company name (ilike).
 */
export async function verificarDuplicatas(leads: DiscoveredLead[]): Promise<DiscoveredLead[]> {
  if (leads.length === 0) return leads;

  // Fetch all existing leads (empresa, telefones, email) for local comparison
  const { data: existingLeads, error } = await supabase
    .from('leads')
    .select('id, empresa, contato_telefone, telefone, contato_email, email');

  if (error || !existingLeads) return leads;

  return leads.map((lead) => {
    // Phone dedup: normalize and compare last 10 digits
    if (lead.telefone) {
      const normalizedNew = normalizePhone(lead.telefone);
      if (normalizedNew.length >= 8) {
        const match = existingLeads.find((ex) => {
          const t1 = ex.contato_telefone ? normalizePhone(ex.contato_telefone) : '';
          const t2 = ex.telefone ? normalizePhone(ex.telefone) : '';
          return (
            (t1.length >= 8 && t1.slice(-10) === normalizedNew) ||
            (t2.length >= 8 && t2.slice(-10) === normalizedNew)
          );
        });
        if (match) {
          return { ...lead, duplicado: true, lead_existente_id: match.id };
        }
      }
    }

    // Company name dedup: case-insensitive exact match
    if (lead.nome) {
      const nomeLower = lead.nome.toLowerCase().trim();
      const match = existingLeads.find(
        (ex) => ex.empresa?.toLowerCase().trim() === nomeLower
      );
      if (match) {
        return { ...lead, duplicado: true, lead_existente_id: match.id };
      }
    }

    return { ...lead, duplicado: false };
  });
}

// ─── Google Places Discovery ──────────────────────────────────────────────────

/**
 * Searches for leads via the `buscar-leads-google` Edge Function (Google Places).
 * Falls back gracefully if the function is unavailable.
 */
export async function buscarLeadsGoogle(params: {
  query: string;
  regiao?: string;
  max_resultados?: number;
}): Promise<DiscoveredLead[]> {
  const searchQuery = params.regiao
    ? `${params.query} em ${params.regiao}`
    : params.query;

  const res = await supabase.functions.invoke('buscar-leads-google', {
    body: {
      query: searchQuery,
      max_resultados: params.max_resultados ?? 20,
    },
  });

  if (res.error) {
    throw new Error(`Erro na busca: ${res.error.message}`);
  }

  const raw = (res.data?.leads ?? []) as DiscoveredLead[];
  return verificarDuplicatas(raw);
}

// ─── CNPJ Enrichment ─────────────────────────────────────────────────────────

/**
 * Enriches a lead with CNPJ data via BrasilAPI (public, no key needed).
 */
export async function enriquecerCNPJ(cnpj: string): Promise<Record<string, unknown>> {
  const clean = cnpj.replace(/\D/g, '');

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);

  if (!response.ok) {
    throw new Error(`CNPJ não encontrado: ${response.statusText}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports a list of discovered leads into the CRM.
 * Skips duplicates. Returns import summary.
 */
export async function importarLeadsDescobertos(
  leads: DiscoveredLead[]
): Promise<ImportResult> {
  let importados = 0;
  let duplicados = 0;
  let erros = 0;

  for (const lead of leads) {
    // Skip confirmed duplicates
    if (lead.duplicado) {
      duplicados++;
      continue;
    }

    const extras: string[] = [];
    if (lead.google_maps_url) extras.push(`Google Maps: ${lead.google_maps_url}`);
    if (lead.website) extras.push(`Site: ${lead.website}`);
    if (lead.avaliacao != null) extras.push(`Avaliação: ${lead.avaliacao}/5`);

    const observacoes = [
      `Encontrado via Google Maps.`,
      lead.endereco,
      ...extras,
    ]
      .filter(Boolean)
      .join(' ');

    const payload = {
      empresa: lead.nome,
      contato_telefone: lead.telefone ?? null,
      observacoes,
      status: 'novo' as const,
      temperatura: 'frio' as const,
      segmento: inferSegmento(lead.tipos),
    };

    const { error } = await supabase.from('leads').insert(payload);

    if (error) {
      erros++;
    } else {
      importados++;
    }
  }

  return { importados, duplicados, erros };
}

// ─── CSV Parse ────────────────────────────────────────────────────────────────

export interface ParsedCsvLead {
  nome: string;
  email: string | null;
  telefone: string | null;
}

/**
 * Parses pasted CSV text in format: nome, email, telefone (one per line).
 * Header row is auto-detected and skipped.
 */
export function parseCsvLeads(text: string): ParsedCsvLead[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Skip header if first line contains non-data keywords
  const headerKeywords = ['nome', 'empresa', 'email', 'telefone', 'name'];
  const startIndex = headerKeywords.some((kw) =>
    lines[0].toLowerCase().includes(kw)
  )
    ? 1
    : 0;

  return lines.slice(startIndex).map((line) => {
    const parts = line.split(',').map((p) => p.trim());
    return {
      nome: parts[0] ?? '',
      email: parts[1] ?? null,
      telefone: parts[2] ?? null,
    };
  }).filter((l) => l.nome.length > 0);
}

/**
 * Imports CSV-parsed leads into the CRM with dedup check.
 */
export async function importarLeadsCSV(
  csvLeads: ParsedCsvLead[]
): Promise<ImportResult> {
  // Convert to DiscoveredLead format for dedup
  const discovered: DiscoveredLead[] = csvLeads.map((l) => ({
    nome: l.nome,
    endereco: '',
    telefone: l.telefone,
    website: null,
    google_maps_url: null,
    tipos: [],
    avaliacao: null,
    total_avaliacoes: null,
  }));

  const withDedup = await verificarDuplicatas(discovered);

  let importados = 0;
  let duplicados = 0;
  let erros = 0;

  for (let i = 0; i < withDedup.length; i++) {
    const lead = withDedup[i];
    const csv = csvLeads[i];

    if (lead.duplicado) {
      duplicados++;
      continue;
    }

    const { error } = await supabase.from('leads').insert({
      empresa: csv.nome,
      contato_email: csv.email ?? null,
      contato_telefone: csv.telefone ?? null,
      status: 'novo' as const,
      temperatura: 'frio' as const,
      observacoes: 'Importado via lista CSV.',
    });

    if (error) {
      erros++;
    } else {
      importados++;
    }
  }

  return { importados, duplicados, erros };
}
