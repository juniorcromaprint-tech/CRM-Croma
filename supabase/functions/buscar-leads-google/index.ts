// supabase/functions/buscar-leads-google/index.ts
// Busca ativa de leads via Apify Google Maps Scraper (primary) or Google Places API (fallback)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LeadResult {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  category: string;
  place_id: string;
}

interface ApifyPlace {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  categoryName?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  location?: { lat: number; lng: number };
  city?: string;
  state?: string;
}

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
}

const DEMO_RESULTS: LeadResult[] = [
  {
    name: 'Calcados Renner Ltda',
    address: 'Av. Paulista, 1234 - Bela Vista, Sao Paulo - SP, 01310-100',
    phone: '(11) 3456-7890',
    website: 'https://calcadosrenner.com.br',
    rating: 4.3,
    category: 'shoe_store',
    place_id: 'https://maps.google.com/?cid=1234567890',
  },
  {
    name: 'Redes & Franquias Calcados SP',
    address: 'Rua Augusta, 890 - Consolacao, Sao Paulo - SP, 01305-000',
    phone: '(11) 2345-6789',
    website: '',
    rating: 4.1,
    category: 'shoe_store',
    place_id: 'https://maps.google.com/?cid=2345678901',
  },
  {
    name: 'Mega Store Calcados e Acessorios',
    address: 'Shopping Eldorado - Av. Reboucas, 3970 - Pinheiros, Sao Paulo - SP',
    phone: '(11) 3987-6543',
    website: 'https://megastorecalcados.com.br',
    rating: 4.5,
    category: 'shoe_store',
    place_id: 'https://maps.google.com/?cid=3456789012',
  },
  {
    name: 'Pe de Pano Calcados Infantis',
    address: 'Rua Oscar Freire, 450 - Jardins, Sao Paulo - SP, 01426-000',
    phone: '(11) 3088-1234',
    website: 'https://pedepano.com.br',
    rating: 4.7,
    category: 'shoe_store',
    place_id: 'https://maps.google.com/?cid=4567890123',
  },
  {
    name: 'Armazem do Esporte Calcados',
    address: 'Av. Brigadeiro Faria Lima, 2200 - Jardim Paulistano, Sao Paulo - SP',
    phone: '(11) 4002-8922',
    website: 'https://armazem-esporte.com.br',
    rating: 4.2,
    category: 'sporting_goods_store',
    place_id: 'https://maps.google.com/?cid=5678901234',
  },
];

function mapApifyToResult(place: ApifyPlace): LeadResult {
  return {
    name: place.title ?? 'Sem nome',
    address: place.address ?? '',
    phone: place.phone ?? '',
    website: place.website ?? '',
    rating: typeof place.totalScore === 'number' ? place.totalScore : 0,
    category: place.categoryName ?? '',
    place_id: place.url ?? `apify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function mapGoogleToResult(place: GooglePlace): LeadResult {
  return {
    name: place.displayName?.text ?? 'Sem nome',
    address: place.formattedAddress ?? '',
    phone: place.nationalPhoneNumber ?? '',
    website: place.websiteUri ?? '',
    rating: typeof place.rating === 'number' ? place.rating : 0,
    category: (place.types && place.types[0]) ?? '',
    place_id: place.googleMapsUri ?? `google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

async function searchViaApify(
  searchString: string,
  limit: number,
  apiKey: string,
): Promise<LeadResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(
      'https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchStringsArray: [searchString],
          maxCrawledPlacesPerSearch: limit,
          language: 'pt-BR',
          countryCode: 'br',
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Apify HTTP ${res.status}: ${errText}`);
    }

    const places: ApifyPlace[] = await res.json();
    return places.map(mapApifyToResult);
  } finally {
    clearTimeout(timeout);
  }
}

async function searchViaGoogle(
  query: string,
  region: string | undefined,
  limit: number,
  apiKey: string,
): Promise<LeadResult[]> {
  const searchBody: Record<string, unknown> = {
    textQuery: region ? `${query} ${region}` : query,
    maxResultCount: limit,
    languageCode: 'pt-BR',
  };

  const fieldMask = [
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.websiteUri',
    'places.googleMapsUri',
    'places.types',
    'places.rating',
    'places.userRatingCount',
  ].join(',');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(searchBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const places: GooglePlace[] = data.places ?? [];
  return places.map(mapGoogleToResult);
}

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Nao autorizado' }, 401, corsHeaders);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido' }, 401, corsHeaders);
    }

    // Role check — only comercial, gerente, admin can search leads
    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'comercial';
    const allowedRoles = ['comercial', 'gerente', 'admin'];
    if (!allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Sem permissao para buscar leads' }, 403, corsHeaders);
    }

    // Parse request body
    const body = await req.json();
    const { query, region, limit = 20 } = body;

    if (!query) {
      return jsonResponse({ error: 'query obrigatoria' }, 400, corsHeaders);
    }

    const maxResults = Math.min(Math.max(1, Number(limit) || 20), 50);

    // --- Provider selection: Apify > Google > Demo ---
    const apifyKey = Deno.env.get('APIFY_API_KEY');
    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    // 1) Try Apify
    if (apifyKey) {
      try {
        const searchString = region ? `${query} em ${region}` : query;
        console.log(`buscar-leads-google: Apify search "${searchString}" (limit=${maxResults})`);
        const results = await searchViaApify(searchString, maxResults, apifyKey);
        return jsonResponse(
          { results, source: 'apify' as const },
          200,
          corsHeaders,
        );
      } catch (apifyErr) {
        console.error('buscar-leads-google: Apify failed, trying fallback:', apifyErr.message);
        // Fall through to Google or Demo
      }
    }

    // 2) Try Google Places
    if (googleKey) {
      try {
        console.log(`buscar-leads-google: Google Places search "${query}" region="${region ?? ''}" (limit=${maxResults})`);
        const results = await searchViaGoogle(query, region, maxResults, googleKey);
        return jsonResponse(
          { results, source: 'google' as const },
          200,
          corsHeaders,
        );
      } catch (googleErr) {
        console.error('buscar-leads-google: Google Places failed, falling back to demo:', googleErr.message);
        // Fall through to demo
      }
    }

    // 3) Demo fallback
    if (!apifyKey && !googleKey) {
      console.warn('buscar-leads-google: No API keys configured — returning demo data');
    }
    return jsonResponse(
      { results: DEMO_RESULTS.slice(0, maxResults), source: 'demo' as const },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error('buscar-leads-google error:', error);
    return jsonResponse(
      { error: 'Erro ao buscar leads', detail: error.message },
      500,
      corsHeaders,
    );
  }
});
