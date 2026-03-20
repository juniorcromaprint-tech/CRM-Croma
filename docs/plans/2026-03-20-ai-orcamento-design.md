# Design: Agente IA de Orçamentos (Crominha Vendedor)

> **Data**: 2026-03-20 | **Status**: Aprovado | **Execução**: Sonnet (próxima sessão)

---

## Visão Geral

Nova Edge Function `ai-gerar-orcamento` que funciona como "cérebro de vendas" do agente. Quando o lead pede preço em qualquer canal, a IA extrai os itens da conversa, consulta materiais/modelos, calcula preços pelo motor Mubisys, cria a proposta no banco, e coloca na fila de aprovação. Ao aprovar, o link `/p/:token` é enviado pelo mesmo canal.

## Decisões de Design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Autonomia | Semi-autônomo (humano aprova) | Consistente com fluxo atual, evita preços errados |
| Detecção | Conversa natural, IA extrai dados | Natural para WhatsApp, IA já tem contexto dos modelos |
| Match de modelos | Similaridade, confirma se confiança < 70% | Evita fricção mas tem safety net |
| Nível da proposta | Completa com breakdown Mubisys | Motor já existe, portal já mostra breakdown |
| Multi-item | Sim, mesma proposta | Sistema já suporta (proposta_itens separada) |
| Conversão lead→cliente | Automática, pergunta dados faltantes | Proposta exige cliente_id NOT NULL |
| Nova Edge Function | `ai-gerar-orcamento` | Separada da composição, responsabilidade única |
| Migration | 2 colunas (`gerado_por_ia`, `conversation_id`) | Mínimo necessário |
| UI | Card de orçamento na fila de aprovação | Diferencia de mensagens normais |
| Portal | Sem mudanças | Já funciona completo |
| Envio | Fluxo existente (whatsapp-enviar / agent-enviar-email) | Reutiliza infraestrutura |

## Fluxo End-to-End

```
Lead (WhatsApp/Email): "Preciso de 2 banners 3x1m lona para fachada"
                              │
                    ┌─────────▼──────────┐
                    │ whatsapp-webhook /  │
                    │ email inbound       │
                    └─────────┬──────────┘
                              │ (mensagem salva em agent_messages)
                              │
                    ┌─────────▼──────────┐
                    │ ai-compor-mensagem  │ ← detecta intenção "orçamento"
                    │ (já existe)         │
                    └─────────┬──────────┘
                              │ intent: "orcamento"
                              │
                    ┌─────────▼──────────┐
                    │ ai-gerar-orcamento  │ ← NOVA Edge Function
                    │                    │
                    │ 1. Extrai itens    │
                    │ 2. Verifica dados  │ (lead→cliente, CNPJ, endereço)
                    │ 3. Match modelos   │
                    │ 4. Calcula preço   │ (motor Mubisys server-side)
                    │ 5. Cria proposta   │
                    │ 6. Ativa token     │
                    │ 7. Gera mensagem   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ agent_messages      │ status: 'pendente_aprovacao'
                    │ metadata: {        │   proposta_id, tipo: 'orcamento'
                    │   link /p/:token } │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ /agente/aprovacao   │ ← card de orçamento expandido
                    └─────────┬──────────┘
                              │ aprovar
                    ┌─────────▼──────────┐
                    │ whatsapp-enviar /   │ ← envia link do portal
                    │ agent-enviar-email  │
                    └─────────┘
```

## Edge Function `ai-gerar-orcamento` — 3 Fases

### Fase 1 — Extração (IA)

Input: últimas 10 mensagens da conversa + dados do lead.

```json
{
  "itens": [
    {
      "descricao_livre": "banner lona para fachada",
      "categoria_inferida": "banner",
      "largura_cm": 300,
      "altura_cm": 100,
      "quantidade": 2,
      "acabamentos": ["ilhós"],
      "confianca": 0.85
    }
  ],
  "info_faltante": null,
  "mensagem_clarificacao": null,
  "dados_cliente_faltantes": null
}
```

**Se `info_faltante` não é null** → IA responde pedindo mais dados, não cria proposta.
**Se `dados_cliente_faltantes` não é null** → IA pergunta CNPJ/endereço antes de orçar.

### Fase 2 — Cálculo (Determinístico, sem IA)

Para cada item extraído:
1. Filtra `produto_modelos` pela `categoria_inferida`
2. Ranking por similaridade (nome do modelo vs `descricao_livre`)
3. Se confiança < 0.7 → responde com opções ao lead
4. Carrega `modelo_materiais` + `modelo_processos` do modelo matched
5. Busca `regras_precificacao` da categoria
6. Carrega config de precificação (admin_config)
7. Roda pricing-engine server-side (mesmo motor do frontend portado para Deno)
8. Calcula: custoMP, custoMO, custoMaquinas, markup, preço final

100% determinístico — zero alucinação de preço.

### Fase 3 — Persistência (Transaction)

```sql
BEGIN;
  -- 1. Converter lead → cliente se necessário
  INSERT INTO clientes (...) SELECT ... FROM leads WHERE id = $lead_id AND cliente_id IS NULL;
  UPDATE leads SET cliente_id = $new_cliente_id WHERE id = $lead_id;

  -- 2. Criar proposta
  INSERT INTO propostas (cliente_id, vendedor_id, status, titulo, gerado_por_ia, conversation_id, ...);

  -- 3. Itens com breakdown
  INSERT INTO proposta_itens (...);
  INSERT INTO proposta_item_materiais (...);
  INSERT INTO proposta_item_acabamentos (...);

  -- 4. Ativar portal
  UPDATE propostas SET share_token_active = true;

  -- 5. Mensagem para aprovação
  INSERT INTO agent_messages (conversation_id, direcao, canal, conteudo, status, metadata)
  VALUES ($conv_id, 'enviada', $canal, $mensagem_com_link, 'pendente_aprovacao',
          '{"tipo": "orcamento", "proposta_id": "...", "proposta_numero": "..."}');

  -- 6. Atualizar conversa
  UPDATE agent_conversations SET etapa = 'proposta';
COMMIT;
```

## Match de Modelos

1. **Filtro por categoria** — `categoria_inferida` filtra modelos (~15-20 por categoria)
2. **Ranking por similaridade** — compara `descricao_livre` com `produto_modelos.nome` + materiais vinculados
3. **Confiança ≥ 0.7** → usa direto
4. **Confiança < 0.7** → apresenta 2-3 opções ao lead
5. **Sem match** → escala para humano

## Conversão Lead → Cliente

**Campos mínimos** (obrigatórios):
- `nome_fantasia` (empresa do lead)
- `contato_nome`
- `telefone` ou `email` (pelo menos 1)

**Campos desejáveis** (IA tenta obter):
- `cnpj` — pergunta se não tem
- `endereco` (rua, cidade, estado, CEP) — pergunta se envolve instalação/frete
- `segmento` — infere da conversa ou pergunta

IA nunca bloqueia o orçamento por falta de CNPJ — mas faz o esforço de coletar. Humano pode completar depois.

## UI — Card de Orçamento na Aprovação

```
┌──────────────────────────────────────────────┐
│ 🏷️ ORÇAMENTO  │ WhatsApp  │ Lead: Loja XYZ  │
├──────────────────────────────────────────────┤
│ Proposta #247 — 2 itens                      │
│                                              │
│  • 2x Banner Lona 440g 3×1m .... R$ 840,00  │
│  • 10x Adesivo A3 .............. R$ 320,00   │
│                                    ─────────  │
│  Total:                          R$ 1.160,00  │
│                                              │
│ Mensagem pro lead:                           │
│ "Olá! Preparei o orçamento conforme          │
│  conversamos. Acesse aqui: crm-croma..."     │
│                                              │
│ [Ver Proposta Completa]  [Editar no Editor]  │
│                                              │
│ [✅ Aprovar e Enviar]    [❌ Rejeitar]        │
└──────────────────────────────────────────────┘
```

- Badge "ORÇAMENTO" para distinguir de mensagens normais
- Resumo dos itens + total inline
- "Ver Proposta Completa" → `/orcamentos/:id` (nova aba)
- "Editar no Editor" → editor existente, ajustar antes de aprovar
- Aprovar → fluxo existente de envio

## Migration

```sql
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES agent_conversations(id);
CREATE INDEX IF NOT EXISTS idx_propostas_conversation_id ON propostas(conversation_id) WHERE conversation_id IS NOT NULL;
```

## Dependências Existentes (Reutilizadas)

- Motor de precificação (`pricing-engine.ts`) — portar para Deno
- Portal `/p/:token` — sem mudanças
- `whatsapp-enviar` / `agent-enviar-email` — sem mudanças
- `ai-compor-mensagem` — adicionar detecção de intent "orcamento"
- Fila de aprovação (`/agente/aprovacao`) — expandir card
- Editor de orçamentos (`OrcamentoEditorPage`) — sem mudanças

## Fora de Escopo

- Aprovação automática (sem humano) — futuro
- Desconto automático por volume — futuro
- Orçamento recorrente — futuro
- Integração com estoque — futuro
