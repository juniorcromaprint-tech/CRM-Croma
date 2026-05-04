// supabase/functions/stores-geocode/index.ts
// Geocodifica uma store via Nominatim (OpenStreetMap) e salva lat/lng.
// Respeita usage policy do Nominatim: User-Agent obrigatorio, 1 req/s.
// Idempotente: se a store ja tem lat/lng, retorna skipped.
//
// Fix 2026-04-27:
//  - Adicionado `city` ao SELECT (migration 139 adicionou a coluna, Edge nao estava usando)
//    -> Causa raiz #1 do 404: Campinas nunca era enviada ao Nominatim
//  - Estrategia primaria: Nominatim structured params (street/city/state/postalcode)
//    -> Mais preciso que free-text; ignora sufixos como PISO 2 automaticamente
//  - Limpeza de sufixos de endereco antes de enviar como street=
//    -> "Av X, 3900 - PISO 2" vira "Av X, 3900"
//  - Conversao de sigla de estado para nome completo (structured API exige)
//    -> "SP" vira "Sao Paulo"
//  - Fallback: free-text com endereco limpo + city se structured retornar 0 resultados
//  - UPDATE inclui geocodificado_em e geocodificado_por

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'CromaPrint-ERP/1.0 (junior@cromaprint.com.br)';

// Mapa de siglas de estado BR -> nome completo para Nominatim structured search
const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

// Remove sufixos de complemento do logradouro que confundem o Nominatim.
// Ex: "Av John Boyd Dunlop, 3900 - PISO 2"  -> "Av John Boyd Dunlop, 3900"
//     "Rua Cavalheiro, 252 - A"              -> "Rua Cavalheiro, 252"
//     "Av X, 100 - Bloco B - Sala 3"         -> "Av X, 100"
const SUFFIX_PATTERN =
  /\s*[-–]\s*(PISO|ANDAR|BLOCO|BL|LOJA|SALA|APTO\.?|AP|CJ|CONJ|UNID|GALPAO|GALPÃO|MODULO|MÓDULO|PAVILHAO|PAVILHÃO)\b.*/i;

function cleanAddress(address: string): string {
  return address.replace(SUFFIX_PATTERN, '').trim();
}

type NominatimResult = { lat: string; lon: string; display_name: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Estratégia 1: Nominatim structured search (mais preciso, ignora sufixos)
async function nominatimStructured(params: {
  street: string;
  city?: string;
  state?: string;
  postalcode?: string;
}): Promise<NominatimResult[]> {
  const qs = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '0',
    country: 'Brasil',
  });
  if (params.street)     qs.set('street', params.street);
  if (params.city)       qs.set('city', params.city);
  if (params.state)      qs.set('state', params.state);
  if (params.postalcode) qs.set('postalcode', params.postalcode);

  const resp = await fetch(`${NOMINATIM_URL}?${qs.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR', Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`Nominatim structured HTTP ${resp.status}`);
  return await resp.json() as NominatimResult[];
}

// Estratégia 2: free-text com endereço já limpo + city
async function nominatimFreeText(query: string): Promise<NominatimResult[]> {
  const qs = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '0',
  });
  const resp = await fetch(`${NOMINATIM_URL}?${qs.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR', Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`Nominatim freetext HTTP ${resp.status}`);
  return await resp.json() as NominatimResult[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body: { store_id?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: 'body JSON invalido' }, 400);
    }
    const { store_id, force } = body;
    if (!store_id) return json({ error: 'store_id required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'server misconfigured' }, 500);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // FIXADO: inclui `city` — adicionado pela migration 139, ausente antes desta correcao
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id, address, neighborhood, city, state, zip_code, lat, lng, deleted_at')
      .eq('id', store_id)
      .maybeSingle();
    if (storeErr) return json({ error: storeErr.message }, 500);
    if (!store)   return json({ error: 'store not found' }, 404);
    if (store.deleted_at) return json({ error: 'store deletada' }, 410);

    if (!force && store.lat != null && store.lng != null) {
      return json({ skipped: true, reason: 'already geocoded', lat: store.lat, lng: store.lng });
    }
    if (!store.address || !store.address.trim()) {
      return json({ error: 'store sem address' }, 422);
    }

    // Prepara parametros para Nominatim
    const streetClean = cleanAddress(store.address);
    const stateRaw    = (store.state ?? '').trim().toUpperCase();
    const stateFull   = STATE_NAMES[stateRaw] ?? (store.state?.trim() || undefined);
    const city        = store.city?.trim() || undefined;
    const postalcode  = store.zip_code
      ? store.zip_code.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
      : undefined;

    let results: NominatimResult[] = [];
    let strategy = '';

    // --- Estratégia 1: Nominatim structured (mais preciso) ---
    try {
      results = await nominatimStructured({ street: streetClean, city, state: stateFull, postalcode });
      strategy = 'structured';
    } catch (e) {
      return json({
        error: `Nominatim structured falhou: ${(e as Error).message}`,
        street: streetClean, city, state: stateFull,
      }, 502);
    }

    // --- Estratégia 2: fallback free-text se structured não achar ---
    if (!Array.isArray(results) || results.length === 0) {
      const parts = [streetClean, city, stateFull, postalcode, 'Brasil'].filter(Boolean) as string[];
      const freeQuery = parts.join(', ');
      try {
        results = await nominatimFreeText(freeQuery);
        strategy = 'freetext_fallback';
      } catch (e) {
        return json({ error: `Nominatim freetext falhou: ${(e as Error).message}`, query: freeQuery }, 502);
      }

      if (!Array.isArray(results) || results.length === 0) {
        return json({
          error: 'endereco nao encontrado no Nominatim',
          street: streetClean,
          city,
          state: stateFull,
          postalcode,
          strategies_tried: ['structured', 'freetext_fallback'],
        }, 404);
      }
    }

    const latNum = Number.parseFloat(results[0].lat);
    const lngNum = Number.parseFloat(results[0].lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return json({ error: 'resposta Nominatim invalida', raw: results[0] }, 502);
    }

    // Salva lat/lng (stores nao tem geocodificado_em/por — essas colunas sao de ordens_instalacao)
    const { error: updErr } = await supabase
      .from('stores')
      .update({ lat: latNum, lng: lngNum })
      .eq('id', store_id);
    if (updErr) return json({ error: `update falhou: ${updErr.message}` }, 500);

    return json({
      success: true,
      lat: latNum,
      lng: lngNum,
      display_name: results[0].display_name,
      strategy,
      street_sent:    streetClean,
      city_sent:      city,
      state_sent:     stateFull,
      postalcode_sent: postalcode,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
