# T4 — Turbinar Agente WhatsApp (Follow-up Inteligente)
> Copiar e colar no CLI

---

Melhorar o agente WhatsApp para ser mais agressivo no follow-up e fechamento de vendas.

## Contexto
- whatsapp-webhook v15 funciona: recebe → Claude responde → detecta intenção → gera orçamento via Mubisys
- agent-cron-loop roda cada 30min com 15 regras (cobrança, follow-up, estoque, produção)
- Regras follow_up_lead_24h e follow_up_proposta_48h já existem
- Templates WhatsApp: croma_abertura, croma_followup, croma_proposta, croma_cobranca, croma_reativacao (T3)

## Tarefas

### 1. Novas regras de follow-up no agent-cron-loop

Criar migration `113_novas_regras_follow_up.sql`:

```sql
INSERT INTO agent_rules (nome, modulo, tipo, ativo, condicao, acao, prioridade) VALUES
-- Follow-up 2h após enviar orçamento (se não respondeu)
('follow_up_orcamento_2h', 'comercial', 'follow_up', true,
 '{"descricao":"Propostas enviadas há mais de 2h sem resposta do cliente"}',
 '{"tipo":"enviar_mensagem","canal":"whatsapp","mensagem_template":"Oi {{nome}}! Conseguiu ver o orçamento que enviei? Se tiver alguma dúvida sobre valores ou prazos, é só me chamar! 😊"}',
 80),

-- Follow-up quando cliente visualizou portal mas não respondeu
('follow_up_visualizou_portal', 'comercial', 'follow_up', true,
 '{"descricao":"Cliente acessou portal da proposta mas não respondeu no WhatsApp"}',
 '{"tipo":"enviar_mensagem","canal":"whatsapp","mensagem_template":"Vi que você deu uma olhada na proposta! Alguma dúvida? Posso ajustar valores ou condições de pagamento se precisar."}',
 75),

-- Reativação de clientes inativos há 90+ dias
('reativacao_cliente_90d', 'comercial', 'reativacao', true,
 '{"descricao":"Clientes com último pedido há mais de 90 dias e sem pedido ativo"}',
 '{"tipo":"enviar_template","canal":"whatsapp","template":"croma_reativacao"}',
 30)
ON CONFLICT (nome) DO NOTHING;
```

### 2. Implementar handlers no agent-cron-loop

No `agent-cron-loop/index.ts`, adicionar cases no `processAgentRules()`:

**a) follow_up_orcamento_2h:**
```typescript
case 'follow_up_orcamento_2h': {
  // Buscar propostas criadas há >2h onde:
  // - proposta tem lead vinculado
  // - lead tem telefone
  // - não houve mensagem do cliente após a proposta ser enviada
  // - dentro do horário comercial (8-18h BRT)
  const query = `
    SELECT p.id, p.numero, p.created_at, l.id as lead_id, l.contato_nome, l.telefone,
      (SELECT MAX(am.created_at) FROM agent_messages am
       JOIN agent_conversations ac ON ac.id = am.conversation_id
       WHERE ac.lead_id = l.id AND am.remetente = 'cliente') as ultima_msg_cliente
    FROM propostas p
    JOIN leads l ON l.id = p.lead_id
    WHERE p.status = 'enviada'
      AND p.created_at < NOW() - INTERVAL '2 hours'
      AND p.created_at > NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM agent_messages am
        JOIN agent_conversations ac ON ac.id = am.conversation_id
        WHERE ac.lead_id = l.id
          AND am.remetente = 'cliente'
          AND am.created_at > p.created_at
      )
  `;
  // Para cada resultado, enviar mensagem personalizada
  // Usar wasRecentlyProcessed() para deduplicação
  break;
}
```

**b) follow_up_visualizou_portal:**
```typescript
case 'follow_up_visualizou_portal': {
  // Buscar portal_tracking onde viewed_at != null E não houve resposta do cliente depois
  const query = `
    SELECT pt.proposta_id, pt.viewed_at, p.numero, l.id as lead_id, l.contato_nome, l.telefone
    FROM portal_tracking pt
    JOIN propostas p ON p.id = pt.proposta_id
    JOIN leads l ON l.id = p.lead_id
    WHERE pt.viewed_at IS NOT NULL
      AND pt.viewed_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM agent_messages am
        JOIN agent_conversations ac ON ac.id = am.conversation_id
        WHERE ac.lead_id = l.id
          AND am.remetente = 'cliente'
          AND am.created_at > pt.viewed_at
      )
  `;
  break;
}
```

**c) reativacao_cliente_90d:**
```typescript
case 'reativacao_cliente_90d': {
  // Buscar clientes com último pedido > 90 dias, sem pedido ativo, com telefone
  const query = `
    SELECT c.id, c.nome, c.telefone, c.email,
      MAX(p.created_at) as ultimo_pedido
    FROM clientes c
    JOIN pedidos p ON p.cliente_id = c.id
    WHERE c.telefone IS NOT NULL
      AND c.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM pedidos p2
        WHERE p2.cliente_id = c.id
          AND p2.status NOT IN ('concluido', 'cancelado', 'entregue')
      )
    GROUP BY c.id, c.nome, c.telefone, c.email
    HAVING MAX(p.created_at) < NOW() - INTERVAL '90 days'
    LIMIT 10
  `;
  // Usar template croma_reativacao (fora da janela 24h)
  break;
}
```

### 3. Melhorar system prompt do whatsapp-webhook

No `whatsapp-webhook/index.ts`, função `buildCromaSystemPrompt()`, ajustar:

```
REGRAS DE VENDAS (ser direto e fechar rápido):
- Máximo 2 perguntas antes de oferecer orçamento
- Quando o cliente perguntar "quanto custa", pedir APENAS: produto + dimensões. Enquanto coleta, dar faixa de preço: "Banners costumam ficar entre R$35 e R$80 por m², dependendo do material e acabamento"
- Quando tiver produto + dimensões + dados cadastrais completos, gerar orçamento AUTOMATICAMENTE sem pedir confirmação
- Incluir senso de urgência: "Essa cotação é válida por 7 dias"
- Oferecer desconto PIX: "Pagamento à vista no PIX tem 5% de desconto"
- Se o cliente pedir desconto, oferecer no máximo 10% (respeitando regras_precificacao.desconto_maximo)
- Ser amigável mas profissional. Não enrolar.
- NUNCA inventar preços — sempre usar o motor Mubisys via ai-gerar-orcamento
```

### 4. Métricas no resumo diário do Telegram (22h)

No agent-cron-loop, seção do resumo noturno, adicionar:
```typescript
// Métricas do dia
const metricas = await supabase.rpc('execute_sql_readonly', { sql_query: `
  SELECT
    (SELECT COUNT(*) FROM agent_messages WHERE remetente = 'agente' AND created_at::date = CURRENT_DATE) as msgs_enviadas,
    (SELECT COUNT(*) FROM agent_messages WHERE remetente = 'cliente' AND created_at::date = CURRENT_DATE) as msgs_recebidas,
    (SELECT COUNT(*) FROM propostas WHERE created_at::date = CURRENT_DATE) as orcamentos_gerados,
    (SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE) as leads_novos
`});

// Incluir no texto do Telegram:
// 📊 Resumo do dia:
// • Mensagens enviadas: X
// • Mensagens recebidas: Y (taxa resposta: Z%)
// • Orçamentos gerados: N
// • Leads novos: M
```

### 5. Deploy

```bash
# Deploy edge functions atualizadas
supabase functions deploy agent-cron-loop --project-ref djwjmfgplnqyffdcgdaw
supabase functions deploy whatsapp-webhook --project-ref djwjmfgplnqyffdcgdaw

# Aplicar migration
# (migration pode ser aplicada via Supabase dashboard ou MCP apply_migration)
```

### 6. Testar
- Verificar que as novas regras aparecem em agent_rules
- Rodar agent-cron-loop manualmente para verificar que não dá erro
- Verificar que o system prompt atualizado está correto

IMPORTANTE:
- Respeitar horário comercial (8h-18h BRT) — não mandar mensagem fora desse horário
- Máximo 50 mensagens/dia (config em admin_config)
- Deduplicação: usar wasRecentlyProcessed() para evitar spam
- PIX CNPJ: 18.923.994/0001-83 (hardcoded, nunca mudar)
- Email: junior@cromaprint.com.br (hardcoded)
