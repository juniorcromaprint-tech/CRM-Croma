// supabase/functions/buscar-leads-google/index.ts
// Task 21: Busca ativa de leads via Google Places API (Text Search)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LeadDiscoberto {
  nome: string;
  endereco: string;
  telefone: string | null;
  website: string | null;
  google_maps_url: string | null;
  tipos: string[];
  avaliacao: number | null;
  total_avaliacoes: number | null;
  metadata?: Record<string, unknown>;
}

const DEMO_LEADS: LeadDiscoberto[] = [
  {
    nome: 'Calçados Renner Ltda',
    endereco: 'Av. Paulista, 1234 - Bela Vista, São Paulo - SP, 01310-100',
    telefone: '(11) 3456-7890',
    website: 'https://calcadosrenner.com.br',
    google_maps_url: 'https://maps.google.com/?cid=1234567890',
    tipos: ['shoe_store', 'clothing_store', 'store'],
    avaliacao: 4.3,
    total_avaliacoes: 287,
    metadata: { demo: true },
  },
  {
    nome: 'Redes & Franquias Calçados SP',
    endereco: 'Rua Augusta, 890 - Consolação, São Paulo - SP, 01305-000',
    telefone: '(11) 2345-6789',
    website: null,
    google_maps_url: 'https://maps.google.com/?cid=2345678901',
    tipos: ['shoe_store', 'store'],
    avaliacao: 4.1,
    total_avaliacoes: 142,
    metadata: { demo: true },
  },
  {
    nome: 'Mega Store Calçados e Acessórios',
    endereco: 'Shopping Eldorado - Av. Rebouças, 3970 - Pinheiros, São Paulo - SP',
    telefone: '(11) 3987-6543',
    website: 'https://megastorecalcados.com.br',
    google_maps_url: 'https://maps.google.com/?cid=3456789012',
    tipos: ['shoe_store', 'shopping_mall', 'store'],
    avaliacao: 4.5,
    total_avaliacoes: 521,
    metadata: { demo: true },
  },
  {
    nome: 'Pé de Pano Calçados Infantis',
    endereco: 'Rua Oscar Freire, 450 - Jardins, São Paulo - SP, 01426-000',
    telefone: '(11) 3088-1234',
    website: 'https://pedepano.com.br',
    google_maps_url: 'https://maps.google.com/?cid=4567890123',
    tipos: ['shoe_store', 'clothing_store'],
    avaliacao: 4.7,
    total_avaliacoes: 89,
    metadata: { demo: true },
  },
  {
    nome: 'Armazém do Esporte Calçados',
    endereco: 'Av. Brigadeiro Faria Lima, 2200 - Jardim Paulistano, São Paulo - SP',
    telefone: '(11) 4002-8922',
    website: 'https://armazem-esporte.com.br',
    google_maps_url: 'https://maps.google.com/?cid=5678901234',
    tipos: ['shoe_store', 'sporting_goods_store', 'store'],
    avaliacao: 4.2,
    total_avaliacoes: 334,
    metadata: { demo: true },
  },
];

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth check — manual (this function does not use AIFunctionName registry)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Nao autorizado' }, 401, corsHeaders);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
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
    const {
      query,
      tipo_negocio,
      regiao,
      max_resultados = 20,
    } = body;

    if (!query) {
      return jsonResponse({ error: 'query obrigatoria' }, 400, corsHeaders);
    }

    const maxResultados = Math.min(Math.max(1, Number(max_resultados) || 20), 20);

    // Check for Google Places API key
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!apiKey) {
      // Demo mode: return fake leads
      console.warn('buscar-leads-google: GOOGLE_PLACES_API_KEY nao configurada — retornando modo demo');
      return jsonResponse(
        {
          leads: DEMO_LEADS.slice(0, maxResultados),
          total: DEMO_LEADS.length,
          query,
          regiao: regiao ?? null,
          demo: true,
          aviso: 'Modo demonstracao — configure GOOGLE_PLACES_API_KEY para busca real',
        },
        200,
        corsHeaders
      );
    }

    // Build Google Places Text Search request
    // Using new Places API v1 (GA from 2023)
    const searchBody: Record<string, unknown> = {
      textQuery: regiao ? `${query} ${regiao}` : query,
      maxResultCount: maxResultados,
      languageCode: 'pt-BR',
    };

    if (tipo_negocio) {
      searchBody.includedType = tipo_negocio;
    }

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

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(searchBody),
    });

    if (!placesRes.ok) {
      const errorText = await placesRes.text();
      console.error('Google Places API error:', placesRes.status, errorText);
      return jsonResponse(
        { error: 'Erro ao consultar Google Places', detail: errorText },
        502,
        corsHeaders
      );
    }

    const placesData = await placesRes.json();
    const places = placesData.places ?? [];

    // Map Places API results to our lead schema
    const leads: LeadDiscoberto[] = places.map((place: Record<string, unknown>) => {
      const displayName = place.displayName as { text?: string } | undefined;
      return {
        nome: displayName?.text ?? 'Sem nome',
        endereco: (place.formattedAddress as string) ?? '',
        telefone: (place.nationalPhoneNumber as string) ?? null,
        website: (place.websiteUri as string) ?? null,
        google_maps_url: (place.googleMapsUri as string) ?? null,
        tipos: (place.types as string[]) ?? [],
        avaliacao: typeof place.rating === 'number' ? place.rating : null,
        total_avaliacoes: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      } satisfies LeadDiscoberto;
    });

    return jsonResponse(
      {
        leads,
        total: leads.length,
        query,
        regiao: regiao ?? null,
        demo: false,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('buscar-leads-google error:', error);
    return jsonResponse(
      { error: 'Erro ao buscar leads', detail: error.message },
      500,
      corsHeaders
    );
  }
});
