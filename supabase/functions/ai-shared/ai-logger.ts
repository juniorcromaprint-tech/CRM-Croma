// supabase/functions/ai-shared/ai-logger.ts
// v2 (ciclo autonomo #6 2026-05-28): DEFENSIVO — .select().single() obrigatorio +
// retorno estruturado { ok, error } pra detectar falhas em caller. Backward-compat:
// callers que fazem `await logAICall(...)` sem usar retorno continuam funcionando.
// Premissa empiricamente validada (ciclo #6): RLS service_role insert permite,
// helper funciona quando chamado (ai-analisar-orcamento grava 44 rows usando este helper).
// Refactor previne regressoes futuras caso schema mude ou RLS aperte.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AILogEntry } from './ai-types.ts';

export interface LogAICallResult {
  ok: boolean;
  error?: string;
}

export async function logAICall(entry: AILogEntry): Promise<LogAICallResult> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // .select().single() obrigatorio (.claude/rules/supabase-mutations.md) — forca PostgREST
    // a retornar a row criada; sem isso, RLS bloqueado retorna 0 rows sem erro explicito.
    const { data, error } = await supabase
      .from('ai_logs')
      .insert(entry)
      .select()
      .single();

    if (error) {
      console.warn(
        '[ai-logger] insert falhou:',
        error.message,
        '| function:',
        entry.function_name,
        '| status:',
        entry.status,
      );
      return { ok: false, error: error.message };
    }

    if (!data) {
      console.warn('[ai-logger] insert retornou data vazia | function:', entry.function_name);
      return { ok: false, error: 'no row returned (possivel RLS block)' };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[ai-logger] exception:', msg, '| function:', entry.function_name);
    return { ok: false, error: msg };
  }
}
