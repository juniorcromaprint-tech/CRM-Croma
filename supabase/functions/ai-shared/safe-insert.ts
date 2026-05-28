// ai-shared/safe-insert.ts — v1 (2026-05-28, ciclo autônomo #16)
//
// Helper defensivo pra INSERT sem propagar exception. Resolve o bug
// `TypeError: supabase.from(...).insert(...).catch is not a function`
// descoberto no ciclo #13 (agent-cron-loop linha 120) — supabase-js v2
// recente removeu `.catch()` direto do PostgrestBuilder.
//
// Substituir:
//   await supabase.from('ai_logs').insert(row).catch(() => {})
// Por:
//   await safeInsert(supabase, 'ai_logs', row)
//
// O .select().single() respeita a regra dura do projeto (RLS detection),
// mas o erro vira retorno estruturado em vez de throw — caller decide.
//
// Pattern preserva a intenção fire-and-forget do `.catch(()=>{})` original
// (não trava o handler principal se ai_logs INSERT falhar) sem perder
// rastreabilidade via console.warn estruturado.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SafeInsertResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}

/**
 * INSERT defensivo com .select().single() — não propaga exception.
 *
 * @param supabase - Cliente Supabase (qualquer auth context)
 * @param table - Nome da tabela
 * @param payload - Row a inserir
 * @param opts.silent - Se true, suprime console.warn em caso de erro
 * @returns { ok, data, error } — caller pode logar/ignorar
 */
export async function safeInsert<T = unknown>(
  supabase: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
  opts: { silent?: boolean } = {},
): Promise<SafeInsertResult<T>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (!opts.silent) {
        console.warn(
          `[safeInsert] ${table} INSERT falhou: ${error.message}` +
            (error.code ? ` (code=${error.code})` : ''),
        );
      }
      return {
        ok: false,
        data: null,
        error: { message: error.message, code: error.code, details: error.details },
      };
    }

    return { ok: true, data: data as T, error: null };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (!opts.silent) {
      console.warn(`[safeInsert] ${table} INSERT exception: ${msg}`);
    }
    return { ok: false, data: null, error: { message: msg } };
  }
}
