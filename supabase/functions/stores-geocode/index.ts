// supabase/functions/stores-geocode/index.ts
// Geocodifica uma store via Nominatim (OpenStreetMap) e salva lat/lng.
// Respeita usage policy do Nominatim: User-Agent obrigatorio, 1 req/s.
// Idempotente: se a store ja tem lat/lng, retorna skipped.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'CromaPrint-ERP/1.0 (junior@cromaprint.com.br)';

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'server misconfigured' }, 500);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id, address, neighborhood, state, zip_code, lat, lng, deleted_at')
      .eq('id', store_id)
      .maybeSingle();
    if (storeErr) return json({ error: storeErr.message }, 500);
    if (!store) return json({ error: 'store not found' }, 404);
    if (store.deleted_at) return json({ error: 'store deletada' }, 410);

    if (!force && store.lat != null && store.lng != null) {
      return json({ skipped: true, reason: 'already geocoded', lat: store.lat, lng: store.lng });
    }
    if (!store.address || !store.address.trim()) {
      return json({ error: 'store sem address' }, 422);
    }

    const parts = [
      store.address,
      store.neighborhood,
      store.state,
      store.zip_code,
      'Brasil',
    ].filter((s) => typeof s === 'string' && s.trim().length > 0) as string[];
    const query = parts.join(', ');

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=br&addressdetails=0`;

    const nominatimResp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR',
        Accept: 'application/json',
      },
    });

    if (!nominatimResp.ok) {
      return json({ error: `nominatim HTTP ${nominatimResp.status}`, query }, 502);
    }

    const results = await nominatimResp.json();
    if (!Array.isArray(results) || results.length === 0) {
      return json({ error: 'endereco nao encontrado no Nominatim', query }, 404);
    }

    const latNum = Number.parseFloat(results[0].lat);
    const lngNum = Number.parseFloat(results[0].lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return json({ error: 'resposta Nominatim invalida', raw: results[0] }, 502);
    }

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
      query,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
