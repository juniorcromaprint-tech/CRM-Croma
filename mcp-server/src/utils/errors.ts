/**
 * Utilitário de tratamento de erros com mensagens acionáveis em português
 */

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Converte erro do Supabase/PostgreSQL em mensagem legível
 */
export function handleSupabaseError(error: unknown): string {
  if (isPostgrestError(error)) {
    const pgError = error as PostgrestError;

    // Violação de chave única (CNPJ duplicado, número duplicado, etc.)
    if (pgError.code === "23505") {
      const detail = pgError.details ?? pgError.message;
      if (detail.includes("cnpj")) {
        return "Erro: CNPJ já cadastrado. Verifique se o cliente já existe.";
      }
      if (detail.includes("numero")) {
        return "Erro: Número já existe. Use um número diferente.";
      }
      return `Erro: Registro duplicado. ${detail}`;
    }

    // Violação de NOT NULL
    if (pgError.code === "23502") {
      return `Erro: Campo obrigatório não preenchido. Detalhes: ${pgError.details ?? pgError.message}`;
    }

    // Violação de FK
    if (pgError.code === "23503") {
      return `Erro: Referência inválida. O registro relacionado não existe. Detalhes: ${pgError.details ?? pgError.message}`;
    }

    // Violação de CHECK constraint (status inválido, etc.)
    if (pgError.code === "23514") {
      return `Erro: Valor inválido para este campo. Detalhes: ${pgError.details ?? pgError.message}`;
    }

    // RLS block
    if (pgError.code === "42501") {
      return "Erro: Sem permissão para esta operação. Verifique a service_role_key.";
    }

    return `Erro no banco de dados (${pgError.code}): ${pgError.message}`;
  }

  if (error instanceof Error) {
    return `Erro: ${error.message}`;
  }

  return `Erro inesperado: ${String(error)}`;
}

/**
 * Type guard para PostgrestError
 */
function isPostgrestError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * Formata resultado de erro para retorno no MCP
 */
export function errorResult(error: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text" as const, text: handleSupabaseError(error) }],
  };
}
