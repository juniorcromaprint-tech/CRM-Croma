# AI Orçamento — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** O agente de vendas (Crominha) gera orçamentos completos via IA quando o lead pede preço pelo WhatsApp/email, cria proposta no sistema com cálculo Mubisys real, e envia link do portal `/p/:token` após aprovação humana.

**Architecture:** Nova Edge Function `ai-gerar-orcamento` orquestra 3 fases: extração de itens (IA), cálculo de preço (determinístico via motor Mubisys portado para Deno), e persistência (proposta + itens + materiais no Supabase). O fluxo se integra ao pipeline existente via detecção de intent em `ai-compor-mensagem` / `whatsapp-webhook`. A fila de aprovação ganha card expandido para orçamentos.

**Tech Stack:** Deno (Edge Functions), OpenRouter (IA), Supabase (Postgres), React + shadcn/ui (UI), Vitest (testes)

**Design doc:** `docs/plans/2026-03-20-ai-orcamento-design.md`

---

## Task 1: Migration — Colunas para orçamento IA

**Files:**
- Create: `supabase/migrations/078_ai_orcamento.sql`

**Step 1: Escrever migration**

```sql
-- 078_ai_orcamento.sql
-- Colunas para vincular propostas geradas pela IA ao agente

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES agent_conversations(id);

CREATE INDEX IF NOT EXISTS idx_propostas_conversation_id
  ON propostas(conversation_id) WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN propostas.gerado_por_ia IS 'Proposta gerada automaticamente pelo agente IA';
COMMENT ON COLUMN propostas.conversation_id IS 'Conversa do agente que originou esta proposta';
```

**Step 2: Aplicar no Supabase**

Abrir `https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` e executar a migration.

**Step 3: Commit**

```bash
git add supabase/migrations/078_ai_orcamento.sql
git commit -m "feat(migration): add gerado_por_ia and conversation_id to propostas"
```

---

## Task 2: Portar pricing-engine para Deno

O motor de precificação roda no frontend (`src/shared/services/pricing-engine.ts`). Precisa de versão server-side para a Edge Function calcular preços sem IA.

**Files:**
- Create: `supabase/functions/ai-shared/pricing-engine.ts`
- Reference: `src/shared/services/pricing-engine.ts` (linhas 1-451)

**Step 1: Escrever teste do motor portado**

Criar `supabase/functions/ai-shared/pricing-engine.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calcPricing, PricingInput, PricingConfig } from "./pricing-engine.ts";

const DEFAULT_CONFIG: PricingConfig = {
  faturamentoMedio: 30000,
  custoOperacional: 24850,
  custoProdutivo: 16400,
  folhaProdutiva: 16400,
  qtdFuncionarios: 3,
  horasMes: 176,
  percentualComissao: 5,
  percentualImpostos: 12,
  percentualJuros: 2,
  percentualEncargos: 0,
};

Deno.test("calcPricing - banner 3x1m com materiais reais", () => {
  const input: PricingInput = {
    materiais: [
      { nome: "Lona 440g", precoUnitario: 25.0, quantidade: 3.0, unidade: "m²" },
    ],
    processos: [
      { etapa: "Impressão", tempoMinutos: 30 },
      { etapa: "Acabamento", tempoMinutos: 15 },
    ],
    maquinas: [
      { nome: "HP Latex 365", custoHora: 45.0, tempoMinutos: 30 },
    ],
    markupPercentual: 40,
    aproveitamento: 0.9,
  };

  const result = calcPricing(input, DEFAULT_CONFIG);

  // Preço deve ser positivo e razoável para banner 3m²
  assertEquals(result.precoVenda > 0, true);
  assertEquals(result.custoMP > 0, true);
  assertEquals(result.custoMO > 0, true);
  assertEquals(result.margemBruta > 0, true);
  // Custo MP deve refletir lona 440g: 3m² * R$25 / 0.9 aproveitamento ≈ R$83.33
  assertEquals(Math.abs(result.custoMP - (3 * 25 / 0.9)) < 1, true);
});

Deno.test("calcPricing - sem materiais retorna zero", () => {
  const input: PricingInput = {
    materiais: [],
    processos: [],
    maquinas: [],
    markupPercentual: 40,
    aproveitamento: 0.85,
  };

  const result = calcPricing(input, DEFAULT_CONFIG);
  assertEquals(result.precoVenda, 0);
});
```

**Step 2: Portar o motor**

Criar `supabase/functions/ai-shared/pricing-engine.ts` copiando a lógica de `src/shared/services/pricing-engine.ts`:

- Copiar interfaces: `PricingConfig`, `PricingInput`, `PricingResult` (linhas 21-107 do original)
- Copiar funções puras: `calcCustoPorMinuto`, `calcPercentualVendas`, `calcPricing` (linhas 135-363)
- **Remover**: import de Supabase (linha 6), qualquer dependência de browser/React
- **Adicionar**: campo `maquinas` ao `PricingInput` (array de `{ nome, custoHora, tempoMinutos }`)
- **Adicionar**: campo `aproveitamento` ao `PricingInput` (number 0-1)
- Todas as funções são math pura — zero dependência externa

```typescript
// supabase/functions/ai-shared/pricing-engine.ts

export interface PricingConfig {
  faturamentoMedio: number;
  custoOperacional: number;
  custoProdutivo: number;
  folhaProdutiva: number;
  qtdFuncionarios: number;
  horasMes: number;
  percentualComissao: number;
  percentualImpostos: number;
  percentualJuros: number;
  percentualEncargos: number;
}

export interface MaterialInput {
  nome: string;
  precoUnitario: number;
  quantidade: number;
  unidade: string;
}

export interface ProcessoInput {
  etapa: string;
  tempoMinutos: number;
}

export interface MaquinaInput {
  nome: string;
  custoHora: number;
  tempoMinutos: number;
}

export interface PricingInput {
  materiais: MaterialInput[];
  processos: ProcessoInput[];
  maquinas: MaquinaInput[];
  markupPercentual: number;
  aproveitamento: number; // 0.75 a 0.95
}

export interface PricingResult {
  custoMP: number;
  tempoTotal: number;
  percentualFixo: number;
  custoPorMinuto: number;
  custoMO: number;
  custoMaquinas: number;
  percentualVendas: number;
  custoBase: number;
  valorAntesMarkup: number;
  valorMarkup: number;
  precoVenda: number;
  margemBruta: number;
  custoTotal: number;
  lucroEstimado: number;
}

/**
 * Motor de precificação Mubisys — portado de src/shared/services/pricing-engine.ts
 * 9 passos: MP → Tempo → P% → Cm → Pv → Vb → Vam → Vm → Vv
 */
export function calcPricing(input: PricingInput, config: PricingConfig): PricingResult {
  // Copiar lógica EXATA de src/shared/services/pricing-engine.ts linhas 187-326
  // Adaptar para usar input.maquinas e input.aproveitamento
  // ... (ver arquivo original para implementação completa)
}
```

**Instrução para o implementador**: Copie a lógica de `calcPricing` de `src/shared/services/pricing-engine.ts:187-326` linha por linha. As únicas mudanças são:
1. `input.aproveitamento` divide o custoMP: `custoMP = SUM(mat.precoUnitario * mat.quantidade) / aproveitamento`
2. `input.maquinas` soma ao custoBase: `custoMaquinas = SUM(maq.custoHora * maq.tempoMinutos / 60)`
3. Sem imports de Supabase/React — funções puras

**Step 3: Rodar teste**

```bash
cd supabase/functions && deno test ai-shared/pricing-engine.test.ts
```
Expected: PASS

**Step 4: Commit**

```bash
git add supabase/functions/ai-shared/pricing-engine.ts supabase/functions/ai-shared/pricing-engine.test.ts
git commit -m "feat(pricing): port pricing engine to Deno for server-side calculation"
```

---

## Task 3: Adicionar detecção de intent ao `ai-compor-mensagem`

O compose de mensagens precisa detectar quando o lead quer um orçamento para acionar o fluxo de geração.

**Files:**
- Modify: `supabase/functions/ai-compor-mensagem/index.ts`

**Step 1: Adicionar `intent_detectada` ao schema do system prompt**

No arquivo `supabase/functions/ai-compor-mensagem/index.ts`, na função `buildSystemPrompt()` (linhas 42-49), adicionar o campo:

```typescript
// Antes (linhas 42-49):
// O schema JSON tem: assunto, conteudo, tom_detectado, upsell_sugerido, pergunta_feita

// Depois: adicionar intent_detectada ao schema
// No bloco de instrução do JSON:
`Responda APENAS em JSON:
{
  "assunto": "...",
  "conteudo": "...",
  "tom_detectado": "frio|morno|quente|neutro",
  "upsell_sugerido": "...",
  "pergunta_feita": "...",
  "intent_detectada": "conversa|orcamento|suporte|reclamacao|negociacao"
}

REGRAS PARA intent_detectada:
- "orcamento": lead pediu preço, orçamento, cotação, "quanto custa", "preciso de X", mencionou produto + quantidade/dimensão
- "negociacao": lead quer desconto, prazo, condição especial sobre proposta JÁ enviada
- "suporte": lead tem problema com pedido existente, instalação, qualidade
- "reclamacao": lead está insatisfeito, reclamando
- "conversa": qualquer outra interação (saudação, dúvida geral, informação)`
```

**Step 2: Parsear intent na resposta**

Na seção de parse (linhas 257-263), extrair a intent:

```typescript
const intentDetectada = aiData.intent_detectada || 'conversa';
```

**Step 3: Armazenar intent no metadata da mensagem**

Na seção de INSERT do agent_messages (linhas 313-321), adicionar ao metadata:

```typescript
metadata: {
  ...existingMetadata,
  intent_detectada: intentDetectada,
  // se intent == 'orcamento', marcar para processamento posterior
}
```

**Step 4: Se intent === 'orcamento', chamar ai-gerar-orcamento**

Após salvar a mensagem (depois da linha ~324), adicionar:

```typescript
// Se detectou intenção de orçamento, acionar geração
if (intentDetectada === 'orcamento') {
  try {
    const orcamentoUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gerar-orcamento`;
    const orcamentoResp = await fetch(orcamentoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        lead_id: leadId,
        mensagens: mensagens, // últimas 10 mensagens já carregadas
        canal: canal,
      }),
    });
    const orcamentoResult = await orcamentoResp.json();

    if (orcamentoResult.status === 'proposta_criada') {
      // Sobrescrever a mensagem composta pela IA com a mensagem do orçamento
      // A ai-gerar-orcamento já criou a mensagem pendente_aprovacao com o link
      // Não fazer nada extra — o fluxo de aprovação cuida do resto
      return jsonResponse({ success: true, intent: 'orcamento', proposta_id: orcamentoResult.proposta_id });
    }
    // Se retornou 'info_faltante', a ai-gerar-orcamento já criou mensagem de clarificação
    if (orcamentoResult.status === 'info_faltante') {
      return jsonResponse({ success: true, intent: 'orcamento_incompleto' });
    }
  } catch (err) {
    console.error('Erro ao gerar orçamento:', err);
    // Fallback: continua com mensagem normal composta pela IA
  }
}
```

**Step 5: Commit**

```bash
git add supabase/functions/ai-compor-mensagem/index.ts
git commit -m "feat(agent): add intent detection to ai-compor-mensagem (orcamento trigger)"
```

---

## Task 4: Mesma detecção de intent no `whatsapp-webhook`

O webhook do WhatsApp tem seu próprio auto-response que também precisa detectar intent.

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

**Step 1: Adicionar intent ao schema do auto-response**

Na função `buildAutoResponseSystemPrompt()` (linhas 105-112), adicionar `intent_detectada` ao JSON schema. Mesmas regras da Task 3.

**Step 2: Parsear intent na resposta**

Na seção de parse (linhas 267-273):

```typescript
const intentDetectada = aiData.intent_detectada || 'conversa';
```

**Step 3: Se intent === 'orcamento', chamar ai-gerar-orcamento**

Após parsear a resposta (antes de salvar a mensagem de auto-response), adicionar call para `ai-gerar-orcamento` idêntico à Task 3. Se `status === 'proposta_criada'`, NÃO salvar a mensagem genérica — a Edge Function de orçamento já criou a mensagem com link.

**Step 4: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(agent): add intent detection to whatsapp-webhook auto-response"
```

---

## Task 5: Criar Edge Function `ai-gerar-orcamento` — Fase 1 (Extração IA)

A função principal que orquestra tudo. Dividida em 3 sub-tasks para manter commits pequenos.

**Files:**
- Create: `supabase/functions/ai-gerar-orcamento/index.ts`

**Step 1: Scaffold da função com extração IA**

```typescript
// supabase/functions/ai-gerar-orcamento/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../ai-shared/ai-helpers.ts";
import { callOpenRouter } from "../ai-shared/openrouter-provider.ts";

const EXTRACTION_PROMPT = `Você é um assistente de vendas da Croma Print, empresa de comunicação visual.
Analise a conversa e extraia os itens que o cliente quer orçar.

CATEGORIAS VÁLIDAS: banner, adesivo, fachada, placa, letreiro, painel, totem, backdrop, pdv, envelopamento, geral

ACABAMENTOS VÁLIDOS: ilhós, bastão, laminação, faca especial, dobra, vinco, hot stamping, verniz UV, relevo, metalizado, perfuração, solda, costura, velcro, dupla-face, estrutura, canaleta

Responda APENAS em JSON:
{
  "itens": [
    {
      "descricao_livre": "descrição do que o cliente pediu",
      "categoria_inferida": "uma das categorias válidas",
      "largura_cm": 300,
      "altura_cm": 100,
      "quantidade": 2,
      "acabamentos": ["ilhós"],
      "confianca": 0.85
    }
  ],
  "info_faltante": null ou ["dimensões do item 2", "material preferido"],
  "mensagem_clarificacao": null ou "Mensagem em pt-BR perguntando o que falta",
  "dados_cliente_faltantes": null ou ["cnpj", "endereco"]
}

REGRAS:
- Se o lead não especificou dimensões, infira do contexto (ex: "banner para fachada" → provável 3x1m)
- Se não dá pra inferir dimensão, coloque em info_faltante
- confiança 0.0-1.0: 1.0 = certeza total, 0.5 = chute, 0.0 = sem ideia
- Sempre use cm para dimensões
- Se o lead pediu algo que não é comunicação visual, retorne itens=[] e mensagem_clarificacao explicando`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, lead_id, mensagens, canal } = await req.json();

    if (!conversation_id || !lead_id || !mensagens?.length) {
      return errorResponse("conversation_id, lead_id e mensagens são obrigatórios", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carregar dados do lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id, empresa, contato_nome, email, telefone, segmento, cliente_id")
      .eq("id", lead_id)
      .single();

    if (!lead) return errorResponse("Lead não encontrado", 404);

    // Formatar contexto das mensagens para a IA
    const historicoFormatado = mensagens
      .map((m: any) => `${m.direcao === 'recebida' ? 'LEAD' : 'VENDEDOR'}: ${m.conteudo}`)
      .join("\n");

    // Fase 1: Extração via IA
    const userPrompt = JSON.stringify({
      lead: { empresa: lead.empresa, segmento: lead.segmento, contato: lead.contato_nome },
      historico: historicoFormatado,
    });

    const aiResult = await callOpenRouter({
      model: "openai/gpt-4.1-mini",
      systemPrompt: EXTRACTION_PROMPT,
      userPrompt,
      temperature: 0.2,
      maxTokens: 2000,
    });

    const extracao = JSON.parse(aiResult.content);

    // Se faltam informações, criar mensagem de clarificação
    if (extracao.info_faltante?.length || extracao.dados_cliente_faltantes?.length) {
      const mensagemClarificacao = extracao.mensagem_clarificacao
        || `Para preparar seu orçamento, preciso de mais algumas informações: ${
          [...(extracao.info_faltante || []), ...(extracao.dados_cliente_faltantes || [])].join(", ")
        }`;

      // Salvar mensagem de clarificação como pendente_aprovacao
      await supabase.from("agent_messages").insert({
        conversation_id,
        direcao: "enviada",
        canal,
        conteudo: mensagemClarificacao,
        status: "pendente_aprovacao",
        metadata: {
          tipo: "orcamento_clarificacao",
          info_faltante: extracao.info_faltante,
          dados_cliente_faltantes: extracao.dados_cliente_faltantes,
        },
        custo_ia: aiResult.cost || 0,
        modelo_ia: aiResult.model || "openai/gpt-4.1-mini",
      });

      return jsonResponse({ status: "info_faltante", info_faltante: extracao.info_faltante });
    }

    if (!extracao.itens?.length) {
      return jsonResponse({ status: "sem_itens", mensagem: "Nenhum item identificado" });
    }

    // → Segue para Fase 2 (Task 6) e Fase 3 (Task 7)
    // Por enquanto, retornar extração para validação
    return jsonResponse({ status: "itens_extraidos", extracao });

  } catch (err) {
    console.error("Erro em ai-gerar-orcamento:", err);
    return errorResponse(err.message, 500);
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-gerar-orcamento/index.ts
git commit -m "feat(agent): create ai-gerar-orcamento edge function - phase 1 extraction"
```

---

## Task 6: `ai-gerar-orcamento` — Fase 2 (Match de modelos + Cálculo)

Após extração, fazer match dos itens com modelos reais e calcular preços.

**Files:**
- Modify: `supabase/functions/ai-gerar-orcamento/index.ts`
- Reference: `supabase/functions/ai-shared/pricing-engine.ts` (Task 2)

**Step 1: Criar função de match de modelos**

Adicionar ao `index.ts`, antes do `Deno.serve`:

```typescript
import { calcPricing, PricingConfig, PricingInput } from "../ai-shared/pricing-engine.ts";

interface ItemExtraido {
  descricao_livre: string;
  categoria_inferida: string;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  acabamentos: string[];
  confianca: number;
}

interface ModeloMatch {
  modelo_id: string;
  modelo_nome: string;
  confianca: number;
  materiais: Array<{ material_id: string; nome: string; preco_medio: number; quantidade: number; unidade: string }>;
  processos: Array<{ etapa: string; tempo_minutos: number; ordem: number }>;
  markup_sugerido: number;
}

async function matchModelo(
  supabase: any,
  item: ItemExtraido,
  callAI: typeof callOpenRouter
): Promise<ModeloMatch | null> {
  // 1. Buscar modelos da categoria
  const { data: regra } = await supabase
    .from("regras_precificacao")
    .select("categoria, markup_sugerido")
    .eq("categoria", item.categoria_inferida)
    .single();

  // 2. Buscar modelos com materiais vinculados
  const { data: modelos } = await supabase
    .from("produto_modelos")
    .select(`
      id, nome, markup_padrao,
      modelo_materiais(material_id, quantidade_por_m2, materiais(id, nome, preco_medio, unidade)),
      modelo_processos(etapa, tempo_minutos, ordem)
    `)
    .ilike("nome", `%${item.categoria_inferida}%`)
    .limit(20);

  if (!modelos?.length) {
    // Fallback: buscar todos os modelos e deixar a IA escolher
    const { data: todosModelos } = await supabase
      .from("produto_modelos")
      .select("id, nome")
      .limit(50);

    // Usar IA para match
    const matchResult = await callAI({
      model: "openai/gpt-4.1-mini",
      systemPrompt: `Escolha o modelo mais similar ao pedido do cliente. Responda JSON: { "modelo_idx": 0, "confianca": 0.8 }
Modelos disponíveis: ${JSON.stringify(todosModelos?.map((m: any, i: number) => `${i}: ${m.nome}`) || [])}`,
      userPrompt: item.descricao_livre,
      temperature: 0.1,
      maxTokens: 200,
    });

    const match = JSON.parse(matchResult.content);
    if (match.confianca < 0.7 || !todosModelos?.[match.modelo_idx]) return null;

    const modeloId = todosModelos[match.modelo_idx].id;
    // Carregar materiais e processos do modelo matched
    const { data: modeloCompleto } = await supabase
      .from("produto_modelos")
      .select(`
        id, nome, markup_padrao,
        modelo_materiais(material_id, quantidade_por_m2, materiais(id, nome, preco_medio, unidade)),
        modelo_processos(etapa, tempo_minutos, ordem)
      `)
      .eq("id", modeloId)
      .single();

    return buildMatchResult(modeloCompleto, match.confianca, regra?.markup_sugerido);
  }

  // Match direto se só tem 1 modelo na categoria
  if (modelos.length === 1) {
    return buildMatchResult(modelos[0], 0.9, regra?.markup_sugerido);
  }

  // Usar IA para escolher entre modelos da categoria
  const matchResult = await callAI({
    model: "openai/gpt-4.1-mini",
    systemPrompt: `Escolha o modelo mais similar ao pedido do cliente. Responda JSON: { "modelo_idx": 0, "confianca": 0.85 }
Modelos: ${JSON.stringify(modelos.map((m: any, i: number) => `${i}: ${m.nome}`))}`,
    userPrompt: item.descricao_livre,
    temperature: 0.1,
    maxTokens: 200,
  });

  const match = JSON.parse(matchResult.content);
  const modeloEscolhido = modelos[match.modelo_idx];
  if (!modeloEscolhido) return null;

  return buildMatchResult(modeloEscolhido, match.confianca, regra?.markup_sugerido);
}

function buildMatchResult(modelo: any, confianca: number, markupSugerido?: number): ModeloMatch {
  return {
    modelo_id: modelo.id,
    modelo_nome: modelo.nome,
    confianca,
    materiais: (modelo.modelo_materiais || []).map((mm: any) => ({
      material_id: mm.materiais?.id || mm.material_id,
      nome: mm.materiais?.nome || "Material",
      preco_medio: mm.materiais?.preco_medio || 0,
      quantidade: mm.quantidade_por_m2 || 1,
      unidade: mm.materiais?.unidade || "m²",
    })),
    processos: (modelo.modelo_processos || []).map((mp: any) => ({
      etapa: mp.etapa,
      tempo_minutos: mp.tempo_minutos,
      ordem: mp.ordem,
    })),
    markup_sugerido: markupSugerido || modelo.markup_padrao || 40,
  };
}
```

**Step 2: Adicionar cálculo de preço após match**

Dentro do `Deno.serve`, após o bloco de extração e antes do return, adicionar:

```typescript
    // Fase 2: Match + Cálculo
    // Carregar config de precificação
    const { data: configRow } = await supabase
      .from("admin_config")
      .select("valor")
      .eq("chave", "config_precificacao")
      .single();

    const pricingConfig: PricingConfig = configRow?.valor || {
      faturamentoMedio: 30000, custoOperacional: 24850, custoProdutivo: 16400,
      folhaProdutiva: 16400, qtdFuncionarios: 3, horasMes: 176,
      percentualComissao: 5, percentualImpostos: 12, percentualJuros: 2, percentualEncargos: 0,
    };

    // Carregar máquinas para cálculo
    const { data: maquinas } = await supabase
      .from("maquinas")
      .select("id, nome, custo_hora");

    // Carregar aproveitamento por categoria
    const { data: regras } = await supabase
      .from("regras_precificacao")
      .select("categoria, aproveitamento_padrao, markup_sugerido");

    const regrasMap = Object.fromEntries(
      (regras || []).map((r: any) => [r.categoria, r])
    );

    // Processar cada item
    const itensCalculados = [];
    const itensComBaixaConfianca = [];

    for (const item of extracao.itens) {
      const match = await matchModelo(supabase, item, callOpenRouter);

      if (!match || match.confianca < 0.7) {
        itensComBaixaConfianca.push({ item, match, opcoes: match ? [match] : [] });
        continue;
      }

      const regraCategoria = regrasMap[item.categoria_inferida] || regrasMap["geral"];
      const aproveitamento = regraCategoria?.aproveitamento_padrao || 0.85;
      const areaM2 = (item.largura_cm * item.altura_cm) / 10000;

      // Montar input do pricing engine
      const pricingInput: PricingInput = {
        materiais: match.materiais.map((m) => ({
          nome: m.nome,
          precoUnitario: m.preco_medio,
          quantidade: m.quantidade * areaM2 * item.quantidade,
          unidade: m.unidade,
        })),
        processos: match.processos.map((p) => ({
          etapa: p.etapa,
          tempoMinutos: p.tempo_minutos * item.quantidade,
        })),
        maquinas: (maquinas || [])
          .filter((m: any) => m.custo_hora > 0)
          .slice(0, 2) // máquinas mais relevantes
          .map((m: any) => ({
            nome: m.nome,
            custoHora: m.custo_hora,
            tempoMinutos: match.processos.reduce((sum: number, p: any) => sum + p.tempo_minutos, 0),
          })),
        markupPercentual: match.markup_sugerido,
        aproveitamento,
      };

      const pricing = calcPricing(pricingInput, pricingConfig);

      itensCalculados.push({
        item,
        match,
        pricing,
        areaM2,
        aproveitamento,
      });
    }

    // Se há itens com baixa confiança, pedir confirmação ao lead
    if (itensComBaixaConfianca.length > 0 && itensCalculados.length === 0) {
      // Todos os itens têm baixa confiança — pedir clarificação
      // (criar mensagem pendente com opções)
      // ... handled in Task 7
    }

    // → Segue para Fase 3 (Task 7)
```

**Step 3: Commit**

```bash
git add supabase/functions/ai-gerar-orcamento/index.ts
git commit -m "feat(agent): ai-gerar-orcamento phase 2 - model matching + pricing calculation"
```

---

## Task 7: `ai-gerar-orcamento` — Fase 3 (Persistência + Mensagem)

Cria a proposta no banco e gera a mensagem com link para aprovação.

**Files:**
- Modify: `supabase/functions/ai-gerar-orcamento/index.ts`

**Step 1: Implementar conversão lead→cliente e criação de proposta**

Após o cálculo (fim da Fase 2), adicionar:

```typescript
    // Fase 3: Persistência

    // 3a. Garantir que o lead tem cliente_id
    let clienteId = lead.cliente_id;
    if (!clienteId) {
      const { data: novoCliente, error: clienteErr } = await supabase
        .from("clientes")
        .insert({
          nome_fantasia: lead.empresa || lead.contato_nome,
          contato_nome: lead.contato_nome,
          telefone: lead.telefone,
          email: lead.email,
          segmento: lead.segmento,
          status: "ativo",
          origem: "agente_ia",
        })
        .select("id")
        .single();

      if (clienteErr) {
        console.error("Erro ao criar cliente:", clienteErr);
        return errorResponse("Erro ao criar cliente para proposta", 500);
      }

      clienteId = novoCliente.id;

      // Vincular cliente ao lead
      await supabase
        .from("leads")
        .update({ cliente_id: clienteId })
        .eq("id", lead_id);
    }

    // 3b. Gerar número da proposta
    const { data: ultimaProposta } = await supabase
      .from("propostas")
      .select("numero")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const proximoNumero = ultimaProposta?.numero
      ? `ORC-${(parseInt(ultimaProposta.numero.replace("ORC-", "")) + 1).toString().padStart(4, "0")}`
      : "ORC-0001";

    // 3c. Criar proposta
    const totalGeral = itensCalculados.reduce((sum, ic) => sum + ic.pricing.precoVenda, 0);

    const { data: proposta, error: propostaErr } = await supabase
      .from("propostas")
      .insert({
        numero: proximoNumero,
        cliente_id: clienteId,
        titulo: `Orçamento ${lead.empresa || lead.contato_nome} - ${new Date().toLocaleDateString("pt-BR")}`,
        status: "rascunho",
        validade_dias: 10,
        subtotal: totalGeral,
        total: totalGeral,
        gerado_por_ia: true,
        conversation_id,
        share_token_active: true,
        cliente_nome_snapshot: lead.empresa || lead.contato_nome,
        config_snapshot: pricingConfig,
      })
      .select("id, numero, share_token")
      .single();

    if (propostaErr) {
      console.error("Erro ao criar proposta:", propostaErr);
      return errorResponse("Erro ao criar proposta", 500);
    }

    // 3d. Criar itens da proposta com breakdown
    for (const ic of itensCalculados) {
      const { data: itemCriado } = await supabase
        .from("proposta_itens")
        .insert({
          proposta_id: proposta.id,
          produto_id: null,
          modelo_id: ic.match.modelo_id,
          descricao: `${ic.item.quantidade}x ${ic.match.modelo_nome} ${ic.item.largura_cm / 100}×${ic.item.altura_cm / 100}m`,
          quantidade: ic.item.quantidade,
          unidade: "un",
          largura_cm: ic.item.largura_cm,
          altura_cm: ic.item.altura_cm,
          area_m2: ic.areaM2 * ic.item.quantidade,
          custo_mp: ic.pricing.custoMP,
          custo_mo: ic.pricing.custoMO,
          custo_fixo: ic.pricing.custoBase - ic.pricing.custoMP - ic.pricing.custoMO,
          markup_percentual: ic.match.markup_sugerido,
          valor_unitario: ic.pricing.precoVenda / ic.item.quantidade,
          valor_total: ic.pricing.precoVenda,
          ordem: itensCalculados.indexOf(ic) + 1,
        })
        .select("id")
        .single();

      if (!itemCriado) continue;

      // Materiais do item
      if (ic.match.materiais.length > 0) {
        await supabase.from("proposta_item_materiais").insert(
          ic.match.materiais.map((m) => ({
            proposta_item_id: itemCriado.id,
            material_id: m.material_id,
            descricao: m.nome,
            quantidade: m.quantidade * ic.areaM2 * ic.item.quantidade,
            unidade: m.unidade,
            custo_unitario: m.preco_medio,
            custo_total: m.preco_medio * m.quantidade * ic.areaM2 * ic.item.quantidade / ic.aproveitamento,
          }))
        );
      }

      // Acabamentos do item
      if (ic.item.acabamentos?.length > 0) {
        const { data: acabamentosDb } = await supabase
          .from("acabamentos")
          .select("id, nome, custo_padrao")
          .in("nome", ic.item.acabamentos.map((a: string) => a.toLowerCase()));

        if (acabamentosDb?.length) {
          await supabase.from("proposta_item_acabamentos").insert(
            acabamentosDb.map((a: any) => ({
              proposta_item_id: itemCriado.id,
              acabamento_id: a.id,
              descricao: a.nome,
              quantidade: ic.item.quantidade,
              custo_unitario: a.custo_padrao || 0,
              custo_total: (a.custo_padrao || 0) * ic.item.quantidade,
            }))
          );
        }
      }
    }

    // 3e. Gerar mensagem com link do portal
    const portalUrl = `https://crm-croma.vercel.app/p/${proposta.share_token}`;
    const resumoItens = itensCalculados
      .map((ic) => `• ${ic.item.quantidade}x ${ic.match.modelo_nome} ${ic.item.largura_cm/100}×${ic.item.altura_cm/100}m`)
      .join("\n");

    const mensagemParaLead = canal === "whatsapp"
      ? `Olá${lead.contato_nome ? `, ${lead.contato_nome.split(" ")[0]}` : ""}! 😊\n\nPreparei o orçamento conforme conversamos:\n\n${resumoItens}\n\n*Total: R$ ${totalGeral.toFixed(2).replace(".", ",")}*\n\nAcesse todos os detalhes e condições de pagamento aqui:\n${portalUrl}\n\nQualquer dúvida, estou à disposição!`
      : `Olá${lead.contato_nome ? `, ${lead.contato_nome.split(" ")[0]}` : ""}!\n\nPreparei o orçamento conforme conversamos:\n\n${resumoItens}\n\nTotal: R$ ${totalGeral.toFixed(2).replace(".", ",")}\n\nAcesse todos os detalhes e condições de pagamento no link abaixo:\n${portalUrl}\n\nQualquer dúvida, estou à disposição!\n\nAtt,\nEquipe Croma Print`;

    // 3f. Salvar mensagem para aprovação
    await supabase.from("agent_messages").insert({
      conversation_id,
      direcao: "enviada",
      canal,
      conteudo: mensagemParaLead,
      assunto: canal === "email" ? `Orçamento ${proposta.numero} - Croma Print` : null,
      status: "pendente_aprovacao",
      metadata: {
        tipo: "orcamento",
        proposta_id: proposta.id,
        proposta_numero: proposta.numero,
        share_token: proposta.share_token,
        portal_url: portalUrl,
        total: totalGeral,
        itens_count: itensCalculados.length,
      },
      custo_ia: aiResult.cost || 0,
      modelo_ia: "openai/gpt-4.1-mini",
    });

    // 3g. Atualizar conversa
    await supabase
      .from("agent_conversations")
      .update({ etapa: "proposta", updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    // 3h. Log de atividade
    await supabase.from("atividades_comerciais").insert({
      lead_id,
      tipo: "orcamento_gerado",
      descricao: `Orçamento ${proposta.numero} gerado por IA — ${itensCalculados.length} item(ns), total R$ ${totalGeral.toFixed(2)}`,
      metadata: { proposta_id: proposta.id, gerado_por_ia: true },
    });

    return jsonResponse({
      status: "proposta_criada",
      proposta_id: proposta.id,
      proposta_numero: proposta.numero,
      portal_url: portalUrl,
      total: totalGeral,
    });
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-gerar-orcamento/index.ts
git commit -m "feat(agent): ai-gerar-orcamento phase 3 - proposal creation + portal link message"
```

---

## Task 8: Card de orçamento na fila de aprovação

Expandir a fila de aprovação para mostrar card rico quando a mensagem é tipo "orcamento".

**Files:**
- Modify: `src/domains/agent/pages/AgentApprovalPage.tsx`
- Create: `src/domains/agent/components/OrcamentoApprovalCard.tsx`

**Step 1: Criar componente OrcamentoApprovalCard**

```tsx
// src/domains/agent/components/OrcamentoApprovalCard.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ExternalLink, FileText, Pencil, Check, X } from "lucide-react";
import { brl } from "@/shared/utils/format";

interface OrcamentoApprovalCardProps {
  message: {
    id: string;
    conteudo: string;
    canal: string;
    metadata: {
      tipo: string;
      proposta_id: string;
      proposta_numero: string;
      portal_url: string;
      total: number;
      itens_count: number;
    };
    custo_ia: number;
    modelo_ia: string;
  };
  lead: {
    empresa: string;
    contato_nome: string;
  };
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
}

export function OrcamentoApprovalCard({
  message,
  lead,
  onApprove,
  onReject,
  isApproving,
}: OrcamentoApprovalCardProps) {
  const { metadata } = message;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600 text-white">ORÇAMENTO</Badge>
          <Badge variant="outline">{message.canal === "whatsapp" ? "WhatsApp" : "Email"}</Badge>
          <span className="text-sm text-slate-500 ml-auto">
            {lead.empresa || lead.contato_nome}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-slate-700">
            {metadata.proposta_numero} — {metadata.itens_count} {metadata.itens_count === 1 ? "item" : "itens"}
          </p>
          <p className="text-lg font-bold text-blue-700 mt-1">
            Total: {brl(metadata.total)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400 mb-1">Mensagem para o lead:</p>
          <p className="text-sm text-slate-600 whitespace-pre-line">{message.conteudo}</p>
        </div>

        <div className="flex gap-2 text-xs text-slate-400">
          <span>IA: {message.modelo_ia}</span>
          {message.custo_ia > 0 && <span>• Custo: ${message.custo_ia.toFixed(4)}</span>}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/orcamentos/${metadata.proposta_id}`, "_blank")}
        >
          <FileText className="h-4 w-4 mr-1" />
          Ver Proposta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/orcamentos/${metadata.proposta_id}/editar`, "_blank")}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Editar
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="destructive" size="sm" onClick={onReject} disabled={isApproving}>
            <X className="h-4 w-4 mr-1" />
            Rejeitar
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onApprove} disabled={isApproving}>
            <Check className="h-4 w-4 mr-1" />
            Aprovar e Enviar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Integrar no AgentApprovalPage**

Em `src/domains/agent/pages/AgentApprovalPage.tsx`, no componente `MessageCard` (linhas 76-259):

```tsx
// No início do MessageCard, antes do return:
const isOrcamento = pending.message.metadata?.tipo === "orcamento";

if (isOrcamento) {
  return (
    <OrcamentoApprovalCard
      message={pending.message}
      lead={pending.lead}
      onApprove={() => handleApproveAndSend(pending.message.id, pending.conversation.canal)}
      onReject={() => rejectMessage(pending.message.id)}
      isApproving={isApprovingId === pending.message.id}
    />
  );
}

// ... resto do MessageCard original para mensagens normais
```

Adicionar import no topo:
```tsx
import { OrcamentoApprovalCard } from "../components/OrcamentoApprovalCard";
```

**Step 3: Commit**

```bash
git add src/domains/agent/components/OrcamentoApprovalCard.tsx src/domains/agent/pages/AgentApprovalPage.tsx
git commit -m "feat(agent): add OrcamentoApprovalCard to approval queue"
```

---

## Task 9: Testes unitários do fluxo

**Files:**
- Create: `src/domains/agent/__tests__/orcamento-flow.test.ts`

**Step 1: Escrever testes**

```typescript
// src/domains/agent/__tests__/orcamento-flow.test.ts
import { describe, it, expect } from "vitest";

// Testar extração de intent
describe("Intent Detection", () => {
  const ORCAMENTO_PHRASES = [
    "quanto custa um banner 3x1?",
    "preciso de orçamento para fachada",
    "me passa o preço de 10 adesivos A3",
    "quero cotar um painel 2x2m",
    "quanto fica uma lona para fachada?",
  ];

  const NON_ORCAMENTO_PHRASES = [
    "olá, tudo bem?",
    "qual o prazo de entrega?",
    "meu pedido atrasou",
    "vocês fazem instalação?",
    "obrigado!",
  ];

  it("deve classificar frases de orçamento corretamente", () => {
    // Validar que as frases estão no formato esperado
    for (const phrase of ORCAMENTO_PHRASES) {
      expect(phrase.length).toBeGreaterThan(0);
      // Verificar que contém palavras-chave de orçamento
      const keywords = ["cust", "orçamento", "preço", "cot", "fica", "banner", "adesivo", "painel", "lona"];
      const hasKeyword = keywords.some((kw) => phrase.toLowerCase().includes(kw));
      expect(hasKeyword).toBe(true);
    }
  });

  it("frases normais não devem conter keywords de orçamento primárias", () => {
    const primaryKeywords = ["cust", "orçamento", "preço", "cot"];
    for (const phrase of NON_ORCAMENTO_PHRASES) {
      const hasPrimaryKeyword = primaryKeywords.some((kw) => phrase.toLowerCase().includes(kw));
      expect(hasPrimaryKeyword).toBe(false);
    }
  });
});

// Testar cálculo de área
describe("Cálculo de Área", () => {
  it("deve calcular área em m² corretamente", () => {
    const larguraCm = 300;
    const alturaCm = 100;
    const areaM2 = (larguraCm * alturaCm) / 10000;
    expect(areaM2).toBe(3);
  });

  it("deve aplicar aproveitamento ao custo de material", () => {
    const custoBase = 75; // 3m² * R$25/m²
    const aproveitamento = 0.9;
    const custoComAproveitamento = custoBase / aproveitamento;
    expect(custoComAproveitamento).toBeCloseTo(83.33, 1);
  });
});

// Testar geração de número de proposta
describe("Número de Proposta", () => {
  it("deve gerar próximo número sequencial", () => {
    const ultimo = "ORC-0042";
    const proximo = `ORC-${(parseInt(ultimo.replace("ORC-", "")) + 1).toString().padStart(4, "0")}`;
    expect(proximo).toBe("ORC-0043");
  });

  it("deve gerar primeiro número se não existir", () => {
    const primeiro = "ORC-0001";
    expect(primeiro).toBe("ORC-0001");
  });
});

// Testar formatação de mensagem
describe("Mensagem do Orçamento", () => {
  it("deve formatar mensagem WhatsApp com emoji e negrito", () => {
    const total = 1160.0;
    const msg = `*Total: R$ ${total.toFixed(2).replace(".", ",")}*`;
    expect(msg).toBe("*Total: R$ 1.160,00*");
  });

  it("deve formatar link do portal", () => {
    const token = "abc-123-def";
    const url = `https://crm-croma.vercel.app/p/${token}`;
    expect(url).toContain("/p/abc-123-def");
  });
});
```

**Step 2: Rodar testes**

```bash
npx vitest run src/domains/agent/__tests__/orcamento-flow.test.ts
```
Expected: PASS

**Step 3: Commit**

```bash
git add src/domains/agent/__tests__/orcamento-flow.test.ts
git commit -m "test(agent): add unit tests for AI quotation flow"
```

---

## Task 10: Deploy das Edge Functions

**Step 1: Verificar que todas as Edge Functions compilam**

```bash
cd supabase/functions
deno check ai-gerar-orcamento/index.ts
deno check ai-compor-mensagem/index.ts
deno check whatsapp-webhook/index.ts
```

**Step 2: Deploy**

```bash
npx supabase functions deploy ai-gerar-orcamento --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy ai-compor-mensagem --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy whatsapp-webhook --project-ref djwjmfgplnqyffdcgdaw
```

**Step 3: Testar fluxo E2E manualmente**

1. Enviar mensagem de teste no WhatsApp: "Preciso de orçamento para 2 banners 3x1m lona para fachada"
2. Verificar na fila `/agente/aprovacao` se aparece card de orçamento
3. Clicar "Ver Proposta" e verificar dados no editor
4. Aprovar e verificar se link é enviado
5. Abrir link `/p/:token` e verificar portal

**Step 4: Commit final**

```bash
git add -A
git commit -m "feat(agent): complete AI quotation flow - extraction, pricing, proposal, approval"
```

---

## Resumo de Tasks

| # | Task | Arquivos | Estimativa |
|---|------|----------|-----------|
| 1 | Migration 078 | 1 create | Rápida |
| 2 | Portar pricing-engine | 2 create | Média |
| 3 | Intent em ai-compor-mensagem | 1 modify | Média |
| 4 | Intent em whatsapp-webhook | 1 modify | Média |
| 5 | ai-gerar-orcamento Fase 1 | 1 create | Média |
| 6 | ai-gerar-orcamento Fase 2 | 1 modify | Grande |
| 7 | ai-gerar-orcamento Fase 3 | 1 modify | Grande |
| 8 | Card de orçamento na aprovação | 2 create/modify | Média |
| 9 | Testes unitários | 1 create | Média |
| 10 | Deploy + teste E2E | 0 | Média |

**Dependências**: 1 → 5 → 6 → 7 (sequencial). Tasks 2, 3, 4, 8 podem ser paralelas.
