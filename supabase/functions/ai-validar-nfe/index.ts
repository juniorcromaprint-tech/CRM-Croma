// ai-validar-nfe: Pre-emission NF-e validation with AI
// Checks CFOP, NCM, tax rates, required fields before calling SEFAZ
// Returns: { valido, erros[], avisos[], sugestoes[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, authenticateAndAuthorize, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ValidationItem {
  campo: string;
  valor_atual: string | null;
  valor_sugerido: string | null;
  motivo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'financeiro', 'fiscal', 'gerente', 'diretor']);
    if ('error' in authResult) {
      return jsonResponse({ error: authResult.error }, 401, corsHeaders);
    }

    const body = await req.json();
    const { pedido_id, documento_id } = body;

    if (!pedido_id && !documento_id) {
      return jsonResponse({ error: 'pedido_id ou documento_id é obrigatório' }, 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Fetch order + items + client ──────────────────────────────
    let pedidoId = pedido_id;

    if (documento_id && !pedidoId) {
      const { data: doc } = await supabase
        .from('fiscal_documentos')
        .select('pedido_id')
        .eq('id', documento_id)
        .single();
      pedidoId = doc?.pedido_id;
    }

    if (!pedidoId) {
      return jsonResponse({ error: 'Pedido não encontrado' }, 404, corsHeaders);
    }

    const { data: pedido } = await supabase
      .from('pedidos')
      .select(`
        id, numero, valor_total, status,
        clientes(
          razao_social, nome_fantasia, cnpj_cpf, inscricao_estadual,
          endereco, cidade, estado, cep, email, telefone
        )
      `)
      .eq('id', pedidoId)
      .single();

    if (!pedido) {
      return jsonResponse({ error: 'Pedido não encontrado' }, 404, corsHeaders);
    }

    const { data: itens } = await supabase
      .from('pedido_itens')
      .select('id, descricao, quantidade, valor_unitario, valor_total, ncm, cfop, unidade')
      .eq('pedido_id', pedidoId);

    // ── 2. Fetch fiscal config ───────────────────────────────────────
    const { data: fiscalConfig } = await supabase
      .from('fiscal_configuracao')
      .select('*')
      .limit(1)
      .single();

    // ── 3. Deterministic validations ─────────────────────────────────
    const erros: ValidationItem[] = [];
    const avisos: ValidationItem[] = [];
    const sugestoes: ValidationItem[] = [];

    const cliente = pedido.clientes as any;

    // Client validations
    if (!cliente?.cnpj_cpf) {
      erros.push({ campo: 'cliente.cnpj_cpf', valor_atual: null, valor_sugerido: null, motivo: 'CNPJ/CPF do cliente é obrigatório para emissão de NF-e' });
    } else {
      const doc = cliente.cnpj_cpf.replace(/\D/g, '');
      if (doc.length !== 11 && doc.length !== 14) {
        erros.push({ campo: 'cliente.cnpj_cpf', valor_atual: cliente.cnpj_cpf, valor_sugerido: null, motivo: 'CNPJ/CPF com formato inválido (deve ter 11 ou 14 dígitos)' });
      }
    }

    if (!cliente?.razao_social && !cliente?.nome_fantasia) {
      erros.push({ campo: 'cliente.razao_social', valor_atual: null, valor_sugerido: null, motivo: 'Razão social ou nome do cliente é obrigatório' });
    }

    if (!cliente?.endereco) {
      erros.push({ campo: 'cliente.endereco', valor_atual: null, valor_sugerido: null, motivo: 'Endereço do cliente é obrigatório' });
    }

    if (!cliente?.cidade) {
      erros.push({ campo: 'cliente.cidade', valor_atual: null, valor_sugerido: null, motivo: 'Cidade do cliente é obrigatória' });
    }

    if (!cliente?.estado) {
      erros.push({ campo: 'cliente.estado', valor_atual: null, valor_sugerido: null, motivo: 'UF do cliente é obrigatória' });
    } else if (cliente.estado.length !== 2) {
      erros.push({ campo: 'cliente.estado', valor_atual: cliente.estado, valor_sugerido: null, motivo: 'UF deve ter exatamente 2 caracteres' });
    }

    if (!cliente?.cep) {
      avisos.push({ campo: 'cliente.cep', valor_atual: null, valor_sugerido: null, motivo: 'CEP não preenchido — recomendado para NF-e' });
    }

    // IE for PJ
    const isPJ = (cliente?.cnpj_cpf?.replace(/\D/g, '') ?? '').length === 14;
    if (isPJ && !cliente?.inscricao_estadual) {
      avisos.push({ campo: 'cliente.inscricao_estadual', valor_atual: null, valor_sugerido: 'ISENTO', motivo: 'IE não preenchida para pessoa jurídica. Se isento, preencher como "ISENTO"' });
    }

    // Item validations
    if (!itens || itens.length === 0) {
      erros.push({ campo: 'pedido_itens', valor_atual: '0 itens', valor_sugerido: null, motivo: 'Pedido não possui itens — NF-e requer ao menos 1 item' });
    } else {
      for (const item of itens) {
        // NCM
        if (!item.ncm) {
          erros.push({ campo: `item.ncm (${item.descricao?.slice(0, 30)})`, valor_atual: null, valor_sugerido: '4911.10.10', motivo: 'NCM é obrigatório. Para impressos publicitários, sugerido 4911.10.10' });
        } else {
          const ncmClean = item.ncm.replace(/\D/g, '');
          if (ncmClean.length !== 8) {
            erros.push({ campo: `item.ncm (${item.descricao?.slice(0, 30)})`, valor_atual: item.ncm, valor_sugerido: null, motivo: 'NCM deve ter exatamente 8 dígitos' });
          }
        }

        // CFOP
        if (!item.cfop) {
          const isInterstate = fiscalConfig?.uf_emitente && cliente?.estado && fiscalConfig.uf_emitente !== cliente.estado;
          const suggestedCfop = isInterstate ? '6101' : '5101';
          avisos.push({ campo: `item.cfop (${item.descricao?.slice(0, 30)})`, valor_atual: null, valor_sugerido: suggestedCfop, motivo: `CFOP não preenchido. Sugerido ${suggestedCfop} (venda ${isInterstate ? 'interestadual' : 'interna'})` });
        }

        // Value
        if (!item.valor_total || Number(item.valor_total) <= 0) {
          erros.push({ campo: `item.valor_total (${item.descricao?.slice(0, 30)})`, valor_atual: String(item.valor_total ?? 0), valor_sugerido: null, motivo: 'Valor total do item deve ser maior que zero' });
        }

        // Quantity
        if (!item.quantidade || Number(item.quantidade) <= 0) {
          erros.push({ campo: `item.quantidade (${item.descricao?.slice(0, 30)})`, valor_atual: String(item.quantidade ?? 0), valor_sugerido: null, motivo: 'Quantidade deve ser maior que zero' });
        }

        // Unit
        if (!item.unidade) {
          avisos.push({ campo: `item.unidade (${item.descricao?.slice(0, 30)})`, valor_atual: null, valor_sugerido: 'UN', motivo: 'Unidade não preenchida. Será usado "UN" como padrão' });
        }
      }
    }

    // Pedido value check
    if (!pedido.valor_total || Number(pedido.valor_total) <= 0) {
      erros.push({ campo: 'pedido.valor_total', valor_atual: String(pedido.valor_total ?? 0), valor_sugerido: null, motivo: 'Valor total do pedido deve ser maior que zero' });
    }

    // Fiscal config validations
    if (!fiscalConfig) {
      erros.push({ campo: 'fiscal_configuracao', valor_atual: null, valor_sugerido: null, motivo: 'Configuração fiscal não encontrada. Configure em Fiscal > Configuração.' });
    }

    // ── 4. AI-enhanced suggestions (if key available) ────────────────
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRow?.valor as string;

    if (apiKey && itens && itens.length > 0 && erros.length === 0) {
      try {
        const itemsDesc = itens.map(i =>
          `${i.descricao} | NCM: ${i.ncm ?? 'vazio'} | CFOP: ${i.cfop ?? 'vazio'} | Valor: ${i.valor_total}`
        ).join('\n');

        const prompt = `Valide estes itens de NF-e de uma empresa de comunicação visual (impressão digital, adesivos, placas, fachadas):

EMITENTE UF: ${fiscalConfig?.uf_emitente ?? '?'}
DESTINATÁRIO UF: ${cliente?.estado ?? '?'}
DESTINATÁRIO CNPJ: ${isPJ ? 'PJ' : 'PF'}

ITENS:
${itemsDesc}

Para cada item, verifique se o NCM é compatível com o tipo de produto descrito.
Se encontrar inconsistência, responda em JSON:
{"sugestoes": [{"item": "descrição curta", "campo": "ncm", "atual": "valor", "sugerido": "valor correto", "motivo": "explicação breve"}]}
Se tudo estiver OK, responda: {"sugestoes": []}`;

        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://crm-croma.vercel.app',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Você é um especialista fiscal brasileiro. Responda apenas JSON.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 400,
            temperature: 0.2,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content ?? '';
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            for (const s of parsed.sugestoes ?? []) {
              sugestoes.push({
                campo: `${s.item} (${s.campo})`,
                valor_atual: s.atual,
                valor_sugerido: s.sugerido,
                motivo: s.motivo,
              });
            }
          }
        }
      } catch { /* AI failed, continue with deterministic results */ }
    }

    // ── 5. Result ────────────────────────────────────────────────────
    const valido = erros.length === 0;

    await supabase.from('ai_logs').insert({
      funcao: 'validar-nfe',
      user_id: authResult.userId,
      tokens_usados: 0,
      custo: 0,
      metadata: { pedido_id: pedidoId, valido, erros: erros.length, avisos: avisos.length, sugestoes: sugestoes.length },
    }).catch(() => {});

    return jsonResponse({ valido, erros, avisos, sugestoes }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
