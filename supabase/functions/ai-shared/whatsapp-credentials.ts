// supabase/functions/ai-shared/whatsapp-credentials.ts
// Single source of truth for WhatsApp Cloud API credentials.
//
// All Edge Functions that talk to Meta Graph API MUST use this helper.
// Credentials live in `admin_config` (table) — NEVER read Deno.env.get()
// for WHATSAPP_* keys, because env vars can drift from the canonical
// values stored in the database and silently break sends with errors
// like "(#131030) Recipient phone number not in allowed list" when
// stale test-mode values get used.
//
// Rotation flow: UPDATE admin_config SET valor='<new>' WHERE chave='WHATSAPP_ACCESS_TOKEN'
// → all functions pick up the new value on the next invocation. Zero redeploy.

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
}

export interface WhatsAppCredentialsError {
  ok: false;
  missing: string[];
  message: string;
}

export type WhatsAppCredentialsResult =
  | ({ ok: true } & WhatsAppCredentials)
  | WhatsAppCredentialsError;

const REQUIRED_KEYS = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_API_VERSION',
] as const;

const DEFAULT_API_VERSION = 'v22.0';

/**
 * Loads canonical WhatsApp credentials from the admin_config table.
 *
 * Use the service-role client (returned by getServiceClient()) so RLS
 * doesn't block the read.
 *
 * Returns a tagged-union result so callers must explicitly handle the
 * "missing config" case instead of crashing with undefined.
 */
// deno-lint-ignore no-explicit-any
export async function getWhatsAppCredentials(supabase: any): Promise<WhatsAppCredentialsResult> {
  const { data: configs, error } = await supabase
    .from('admin_config')
    .select('chave, valor')
    .in('chave', REQUIRED_KEYS as unknown as string[]);

  if (error) {
    return {
      ok: false,
      missing: ['<query failed>'],
      message: `Falha ao ler admin_config: ${error.message ?? error}`,
    };
  }

  const cfg: Record<string, string> = {};
  for (const c of configs ?? []) cfg[c.chave] = c.valor;

  const accessToken = cfg['WHATSAPP_ACCESS_TOKEN'];
  const phoneNumberId = cfg['WHATSAPP_PHONE_NUMBER_ID'];
  const wabaId = cfg['WHATSAPP_BUSINESS_ACCOUNT_ID'];
  const apiVersion = cfg['WHATSAPP_API_VERSION'] || DEFAULT_API_VERSION;

  const missing: string[] = [];
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!wabaId) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID');

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      message: `Credenciais WhatsApp ausentes em admin_config: ${missing.join(', ')}`,
    };
  }

  return {
    ok: true,
    accessToken,
    phoneNumberId,
    wabaId,
    apiVersion,
  };
}

/**
 * Sends a payload via Meta Cloud API using the canonical credentials.
 *
 * Returns the parsed Meta response on success, or a structured error
 * with the raw body so callers can persist it to agent_messages.erro_mensagem.
 */
export async function postToMetaCloud(
  creds: WhatsAppCredentials,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; metaData: Record<string, unknown> }
  | { ok: false; status: number; body: string }
> {
  const url = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body: body.substring(0, 1000) };
  }

  const metaData = (await res.json()) as Record<string, unknown>;
  return { ok: true, metaData };
}
