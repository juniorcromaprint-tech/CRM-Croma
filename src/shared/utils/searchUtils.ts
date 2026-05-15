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

/**
 * Extrai apenas os dígitos de uma string. Útil para CNPJ/CPF/telefone.
 */
export function digitsOnly(term: string): string {
  return term.replace(/\D/g, '');
}

/**
 * Padrão ILIKE com wildcards entre cada dígito — casa com strings que tenham
 * pontuação no meio (ex: CNPJ "64.668.836/0001-41" casado por "64668836").
 * Retorna string vazia se não houver dígitos suficientes para evitar falsos
 * positivos amplos. Mínimo padrão: 3 dígitos.
 */
export function digitsLooseTerm(term: string, min = 3): string | null {
  const d = digitsOnly(term);
  if (d.length < min) return null;
  return `%${d.split('').join('%')}%`;
}
