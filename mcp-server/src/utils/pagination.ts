/**
 * Utilitários de paginação para respostas do MCP
 */

import type { PaginatedResponse } from "../types.js";

/**
 * Monta objeto de resposta paginada padronizado
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number
): PaginatedResponse<T> {
  const hasMore = total > offset + items.length;
  return {
    total,
    count: items.length,
    offset,
    items,
    has_more: hasMore,
    ...(hasMore ? { next_offset: offset + items.length } : {}),
  };
}

/**
 * Trunca resposta se exceder limite de caracteres.
 * Retorna o JSON truncado com aviso.
 */
export const CHARACTER_LIMIT = 30_000;

export function truncateIfNeeded(json: string, itemCount: number): string {
  if (json.length <= CHARACTER_LIMIT) return json;

  const suggestion = itemCount > 1
    ? `Use 'limit' menor ou adicione filtros para reduzir os resultados.`
    : `O registro é muito grande. Use campos específicos se possível.`;

  const truncated = json.slice(0, CHARACTER_LIMIT);
  const warning = `\n\n⚠️ Resposta truncada (${json.length} → ${CHARACTER_LIMIT} chars). ${suggestion}`;
  return truncated + warning;
}
