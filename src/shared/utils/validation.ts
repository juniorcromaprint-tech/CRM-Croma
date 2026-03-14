/**
 * Centralized validation utilities for production safety.
 * Uses Zod schemas to validate data before Supabase mutations.
 */
import { z } from "zod";

/**
 * Validates data against a Zod schema before mutation.
 * Throws with user-friendly error messages.
 */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Validação falhou (${context}): ${issues}`);
  }
  return result.data;
}

/**
 * Validates data silently — returns null on failure instead of throwing.
 */
export function validateSafe<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Common validation schemas for reuse across the app
 */
export const commonValidation = {
  uuid: z.string().uuid("ID inválido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "Telefone inválido").optional().nullable(),
  money: z.number().nonnegative("Valor não pode ser negativo"),
  percentage: z.number().min(0).max(100, "Percentual deve ser entre 0 e 100"),
  nonEmptyString: z.string().min(1, "Campo obrigatório"),
};

/**
 * Sanitizes a string for safe insertion (removes potential XSS)
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}
