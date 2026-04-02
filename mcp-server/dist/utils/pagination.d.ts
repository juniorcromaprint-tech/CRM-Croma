/**
 * Utilitários de paginação para respostas do MCP
 */
import type { PaginatedResponse } from "../types.js";
/**
 * Monta objeto de resposta paginada padronizado
 */
export declare function buildPaginatedResponse<T>(items: T[], total: number, offset: number, limit: number): PaginatedResponse<T>;
/**
 * Trunca resposta se exceder limite de caracteres.
 * Retorna o JSON truncado com aviso.
 */
export declare const CHARACTER_LIMIT = 30000;
export declare function truncateIfNeeded(json: string, itemCount: number): string;
//# sourceMappingURL=pagination.d.ts.map