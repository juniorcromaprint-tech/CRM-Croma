// supabase/functions/ai-shared/ai-logger.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AILogEntry } from './ai-types.ts';

export async function logAICall(entry: AILogEntry): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('ai_logs').insert(entry);
  } catch (error) {
    // Log but don't fail the main request
    console.error('Failed to log AI call:', error);
  }
}
