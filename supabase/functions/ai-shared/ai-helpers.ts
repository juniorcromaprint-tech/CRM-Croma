// supabase/functions/ai-shared/ai-helpers.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AIFunctionName, AI_ROLE_ACCESS } from './ai-types.ts';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

export function handleCorsOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}

export function jsonResponse(data: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface AuthResult {
  userId: string;
  userRole: string;
}

export async function authenticateAndAuthorize(
  req: Request,
  functionName: AIFunctionName
): Promise<{ auth: AuthResult | null; error: Response | null }> {
  const corsHeaders = getCorsHeaders(req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Nao autorizado' }, 401, corsHeaders),
    };
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Token invalido' }, 401, corsHeaders),
    };
  }

  // Get user role from profiles table
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'comercial';
  const allowedRoles = AI_ROLE_ACCESS[functionName];

  if (!allowedRoles.includes(role)) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Sem permissao para esta funcao de IA' }, 403, corsHeaders),
    };
  }

  return { auth: { userId: user.id, userRole: role }, error: null };
}

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
