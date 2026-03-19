// supabase/functions/enriquecer-cnpj/index.ts
// Task 22: Enriquecimento de lead via CNPJ — BrasilAPI + ReceitaWS fallback
//
// RATE LIMITS:
//   BrasilAPI:  3 req/min (free, sem autenticação)
//   ReceitaWS:  3 req/min (free tier, sem autenticação)
// Recomendação: implementar cache no frontend ou usar sparingly.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Socio {
  nome_socio: string;
  qualificacao_socio: string;
}

interface EnriquecimentoCNPJ {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_fiscal_descricao: string | null;
  // Endereço
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  // Contato
  telefone: string | null;
  email: string | null;
  // Dados empresariais
  porte: string | null;
  situacao_cadastral: string | null;
  data_inicio_atividade: string | null;
  capital_social: number | null;
  natureza_juridica_descricao: string | null;
  qsa: Socio[];
  // Meta
  fonte: 'brasilapi' | 'receitaws';
}

function validarCNPJ(cnpj: string): boolean {
  // Remove formatação, aceita só dígitos
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Cálculo dos dígitos verificadores
  const calcDigit = (str: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(str[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits, w1);
  const d2 = calcDigit(digits, w2);

  return d1 === parseInt(digits[12]) && d2 === parseInt(digits[13]);
}

async function fetchBrasilAPI(cnpj: string): Promise<EnriquecimentoCNPJ> {
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CromaPrint-CRM/4.0' },
    // BrasilAPI é tipicamente rápida — timeout de 10s
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BrasilAPI ${res.status}: ${body}`);
  }

  const d = await res.json();

  const qsa: Socio[] = (d.qsa ?? []).map((s: Record<string, string>) => ({
    nome_socio: s.nome_socio ?? s.nome ?? '',
    qualificacao_socio: s.qualificacao_socio ?? s.qualificacao ?? '',
  }));

  return {
    cnpj,
    razao_social: d.razao_social ?? null,
    nome_fantasia: d.nome_fantasia ?? null,
    cnae_fiscal_descricao: d.cnae_fiscal_descricao ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    complemento: d.complemento ?? null,
    bairro: d.bairro ?? null,
    municipio: d.municipio ?? null,
    uf: d.uf ?? null,
    cep: d.cep ?? null,
    telefone: d.ddd_telefone_1 ? d.ddd_telefone_1.trim() || null : null,
    email: d.email ?? null,
    porte: d.porte ?? null,
    situacao_cadastral: d.descricao_situacao_cadastral ?? d.situacao_cadastral ?? null,
    data_inicio_atividade: d.data_inicio_atividade ?? null,
    capital_social: typeof d.capital_social === 'number' ? d.capital_social : null,
    natureza_juridica_descricao: d.natureza_juridica ?? null,
    qsa,
    fonte: 'brasilapi',
  };
}

async function fetchReceitaWS(cnpj: string): Promise<EnriquecimentoCNPJ> {
  const url = `https://receitaws.com.br/v1/cnpj/${cnpj}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CromaPrint-CRM/4.0' },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ReceitaWS ${res.status}: ${body}`);
  }

  const d = await res.json();

  if (d.status === 'ERROR') {
    throw new Error(`ReceitaWS erro: ${d.message ?? 'CNPJ invalido ou nao encontrado'}`);
  }

  // ReceitaWS returns "qsa" as array of { nome, qual }
  const qsa: Socio[] = (d.qsa ?? []).map((s: Record<string, string>) => ({
    nome_socio: s.nome ?? '',
    qualificacao_socio: s.qual ?? '',
  }));

  // ReceitaWS format: telefone field already includes DDD e.g. "(11) 1234-5678"
  const telefone = d.telefone?.trim() || null;

  // Address fields differ slightly from BrasilAPI
  const logradouro = d.logradouro ?? null;
  const numero = d.numero ?? null;
  const complemento = d.complemento ?? null;
  const bairro = d.bairro ?? null;
  const municipio = d.municipio ?? null;
  const uf = d.uf ?? null;
  const cep = d.cep?.replace(/\D/g, '') ?? null;

  return {
    cnpj,
    razao_social: d.nome ?? null,
    nome_fantasia: d.fantasia ?? null,
    cnae_fiscal_descricao: d.atividade_principal?.[0]?.text ?? null,
    logradouro,
    numero,
    complemento,
    bairro,
    municipio,
    uf,
    cep,
    telefone,
    email: d.email?.trim() || null,
    porte: d.porte ?? null,
    situacao_cadastral: d.situacao ?? null,
    data_inicio_atividade: d.abertura ?? null,
    capital_social: d.capital_social ? parseFloat(String(d.capital_social).replace(/[^0-9,.]/g, '').replace(',', '.')) : null,
    natureza_juridica_descricao: d.natureza_juridica ?? null,
    qsa,
    fonte: 'receitaws',
  };
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Token invalido' }, 401, corsHeaders);
    }

    // Role check — comercial, gerente, admin
    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'comercial';
    const allowedRoles = ['comercial', 'gerente', 'admin'];
    if (!allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Sem permissao para enriquecer CNPJ' }, 403, corsHeaders);
    }

    // Parse and validate CNPJ
    const body = await req.json();
    const { cnpj: cnpjRaw } = body;

    if (!cnpjRaw) {
      return jsonResponse({ error: 'cnpj obrigatorio' }, 400, corsHeaders);
    }

    const cnpj = String(cnpjRaw).replace(/\D/g, '');

    if (cnpj.length !== 14) {
      return jsonResponse({ error: 'CNPJ deve ter 14 digitos' }, 400, corsHeaders);
    }

    if (!validarCNPJ(cnpj)) {
      return jsonResponse({ error: 'CNPJ invalido (digitos verificadores incorretos)' }, 400, corsHeaders);
    }

    // Attempt BrasilAPI first, fallback to ReceitaWS
    let enrichment: EnriquecimentoCNPJ;
    let warnings: string[] = [];

    try {
      enrichment = await fetchBrasilAPI(cnpj);
    } catch (brasilApiErr) {
      console.warn('BrasilAPI falhou, tentando ReceitaWS:', brasilApiErr.message);
      warnings.push(`BrasilAPI indisponivel: ${brasilApiErr.message}`);

      try {
        enrichment = await fetchReceitaWS(cnpj);
      } catch (receitaWsErr) {
        console.error('ReceitaWS tambem falhou:', receitaWsErr.message);
        return jsonResponse(
          {
            error: 'Nao foi possivel consultar o CNPJ em nenhuma fonte',
            detalhes: {
              brasilapi: brasilApiErr.message,
              receitaws: receitaWsErr.message,
            },
            aviso_rate_limit: 'BrasilAPI e ReceitaWS permitem apenas 3 requisicoes por minuto no plano gratuito.',
          },
          502,
          corsHeaders
        );
      }
    }

    return jsonResponse(
      {
        ...enrichment,
        warnings: warnings.length > 0 ? warnings : undefined,
        aviso_rate_limit: 'APIs publicas de CNPJ permitem 3 req/min. Use com moderacao.',
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('enriquecer-cnpj error:', error);
    return jsonResponse(
      { error: 'Erro ao enriquecer CNPJ', detail: error.message },
      500,
      corsHeaders
    );
  }
});
