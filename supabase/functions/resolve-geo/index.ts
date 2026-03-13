// supabase/functions/resolve-geo/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || '0.0.0.0';

    // ipinfo.io free tier (50k/month, HTTPS)
    const IPINFO_TOKEN = Deno.env.get('IPINFO_TOKEN') || '';
    const url = IPINFO_TOKEN
      ? `https://ipinfo.io/${clientIp}?token=${IPINFO_TOKEN}`
      : `https://ipinfo.io/${clientIp}/json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('ipinfo.io request failed');
    const data = await res.json();

    return new Response(JSON.stringify({
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ city: '', region: '', country: '' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
