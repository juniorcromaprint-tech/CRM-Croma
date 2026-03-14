/**
 * Utilitários para busca segura com ilike do Supabase.
 * Escapa caracteres especiais do SQL LIKE para evitar injeção de padrão.
 */

/**
 * Sanitiza um termo de busca para uso seguro com ilike do Supabase.
 * Escapa caracteres especiais do SQL LIKE: % _ \
 */
export function sanitizeSearch(term: string): string {
  return term
    .trim()
    .replace(/\\/g, '\\\\') // escape backslash primeiro
    .replace(/%/g, '\\%')   // escape %
    .replace(/_/g, '\\_');  // escape _
}

/**
 * Retorna o padrão ilike com wildcards para busca parcial.
 * Uso: .ilike('coluna', ilikeTerm(busca))
 * Uso em .or(): `coluna.ilike.${ilikeTerm(busca)}`
 */
export function ilikeTerm(term: string): string {
  return `%${sanitizeSearch(term)}%`;
}
