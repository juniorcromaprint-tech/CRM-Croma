# T5 — MCP Fase 3A: Ferramentas de Vendas (8 novas tools)
> Copiar e colar no CLI

---

Expandir o MCP Server com 8 novas ferramentas focadas em vendas e comunicação comercial.

## Contexto
- MCP Server em mcp-server/src/tools/ — 48 ferramentas atuais
- Padrão: registerXxxTools(server) em cada arquivo, registrado no index.ts
- Usar z.coerce.number() para campos numéricos (lição BUG-FIN-01)
- Usar getSupabaseClient() para leitura
- Usar .select().single() em todo INSERT/UPDATE (lição RLS)

## Criar arquivo: mcp-server/src/tools/comercial.ts

```typescript
// Ferramentas Comerciais — Campanhas, WhatsApp, Contratos
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// ... imports padrão (copiar de outro tools/*.ts)

export function registerComercialTools(server: McpServer): void {
  // 8 ferramentas abaixo
}
```

### Ferramenta 1: croma_listar_campanhas
```
SELECT c.*,
  (SELECT COUNT(*) FROM campanha_destinatarios cd WHERE cd.campanha_id = c.id) as total_destinatarios
FROM campanhas c
ORDER BY c.created_at DESC
```
Filtros: status (rascunho/agendada/enviando/concluida/cancelada), tipo (email/whatsapp)
Retornar: id, nome, tipo, status, assunto, total_destinatarios, created_at

### Ferramenta 2: croma_criar_campanha
INSERT INTO campanhas (nome, tipo, assunto, conteudo, segmento_alvo, status)
Params: nome (required), tipo (email|whatsapp), assunto, conteudo, segmento_alvo
Status default: 'rascunho'
Retornar campanha criada com .select().single()

### Ferramenta 3: croma_listar_conversas_whatsapp
```
SELECT ac.*, l.contato_nome, l.telefone, l.email, l.empresa
FROM agent_conversations ac
LEFT JOIN leads l ON l.id = ac.lead_id
ORDER BY ac.ultima_mensagem_em DESC NULLS LAST
```
Filtros: status (ativa/pausada/encerrada), lead_id, limit (default 20)
Retornar: id, lead_nome, telefone, empresa, etapa, mensagens_enviadas, mensagens_recebidas, score_engajamento, ultima_mensagem_em

### Ferramenta 4: croma_detalhe_conversa_whatsapp
Buscar conversa por ID + últimas 20 mensagens:
```
-- Conversa
SELECT ac.*, l.contato_nome, l.telefone, l.email, l.empresa
FROM agent_conversations ac
LEFT JOIN leads l ON l.id = ac.lead_id
WHERE ac.id = $1

-- Mensagens
SELECT am.id, am.remetente, am.conteudo, am.status, am.metadata, am.created_at
FROM agent_messages am
WHERE am.conversation_id = $1
ORDER BY am.created_at DESC
LIMIT 20
```
Retornar: conversa + array de mensagens (mais recente primeiro)

### Ferramenta 5: croma_enviar_whatsapp
Invocar Edge Function whatsapp-enviar via fetch:
```typescript
const response = await fetch(
  `https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-enviar`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      telefone,
      mensagem, // texto livre (se dentro da janela 24h)
      // OU
      template_name, // nome do template Meta aprovado
      template_params // array de strings para placeholders
    })
  }
);
```
Params: telefone (required), mensagem (optional), template_name (optional), template_params (optional)
Validação: deve ter mensagem OU template_name (não ambos)

### Ferramenta 6: croma_listar_templates_whatsapp
```
SELECT * FROM agent_templates
WHERE canal = 'whatsapp' AND ativo = true
ORDER BY nome
```
Se tabela não existir, retornar lista hardcoded dos 5 templates Meta.

### Ferramenta 7: croma_registrar_movimento (já existe em estoque.ts — verificar)
Se já existe, pular. Se não, criar em estoque.ts.

### Ferramenta 8: croma_listar_fotos_job (já existe em campo.ts — verificar)
Se já existe, pular. Se não, criar.

## Registrar no index.ts:
```typescript
import { registerComercialTools } from "./tools/comercial.js";
// Na função main:
registerComercialTools(server);
```

## Build e teste:
```bash
cd mcp-server && npm run build
# Testar cada ferramenta:
node dist/call-tool.cjs croma_listar_campanhas '{}'
node dist/call-tool.cjs croma_listar_conversas_whatsapp '{"limit":5}'
```

IMPORTANTE:
- Se alguma tabela não existir, a ferramenta deve retornar mensagem amigável (try/catch), não crashar
- Manter o padrão de formatação (formatBRL, formatDate, formatStatus) dos outros tools
- Manter paginação com buildPaginatedResponse quando aplicável
