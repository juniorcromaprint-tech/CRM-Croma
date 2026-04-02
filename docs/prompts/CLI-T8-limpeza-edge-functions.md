# T8 — Limpeza Edge Functions OpenRouter
> Copiar e colar no CLI

---

Limpar e organizar as Edge Functions, arquivando as dormentes e simplificando as redundantes.

## Contexto
- 47 Edge Functions no total
- 22 usam OpenRouter (18 com gpt-4.1-mini, 4 com Claude via OpenRouter)
- Mapa completo em docs/plano-ia/MAPA-IA-CROMA.md
- ~9 funções dormentes/experimentais

## Tarefas

### 1. Criar pasta de arquivo
```bash
mkdir -p supabase/functions/_archived
```

### 2. Mover funções dormentes para _archived

Verificar cada função abaixo — se não é chamada por nenhuma outra função ativa, mover:

```bash
# Funções experimentais nunca integradas
mv supabase/functions/ai-analisar-foto-instalacao supabase/functions/_archived/
mv supabase/functions/buscar-leads-google supabase/functions/_archived/
mv supabase/functions/ai-previsao-estoque supabase/functions/_archived/
mv supabase/functions/ai-preco-dinamico supabase/functions/_archived/
mv supabase/functions/ai-resumo-cliente supabase/functions/_archived/
mv supabase/functions/resolve-geo supabase/functions/_archived/

# Substituídas por implementação melhor
mv supabase/functions/ai-sequenciar-producao supabase/functions/_archived/  # substituída por fn_pcp_sequenciar_op
mv supabase/functions/ai-qualificar-lead supabase/functions/_archived/  # substituída por score no webhook
mv supabase/functions/telegram-webhook supabase/functions/_archived/  # desativado — Channels substitui
```

ANTES DE MOVER: verificar com grep se alguma função ativa referencia a função que será arquivada:
```bash
grep -r "ai-analisar-foto-instalacao" supabase/functions/ --include="*.ts" -l
grep -r "buscar-leads-google" supabase/functions/ --include="*.ts" -l
# ... para cada função
```
Se encontrar referência, NÃO mover. Documentar a dependência.

### 3. Verificar funções potencialmente redundantes

Checar se estas funções são realmente usadas ou se foram substituídas:

a) `ai-detectar-intencao-orcamento` — o whatsapp-webhook v15 já detecta intenção via [INTENT:xxx].
   Se nenhuma outra função chama, arquivar.

b) `ai-classificar-extrato` — verificar se é usada pela página ExtratoBancarioPage.
   Se sim, manter. Se não, arquivar.

c) `ai-composicao-produto` — verificar se é usada pelo OrcamentoEditorPage.
   Se sim, manter. Se não, arquivar.

### 4. Atualizar MAPA-IA-CROMA.md

Adicionar seção ao final do arquivo:

```markdown
## Limpeza 2026-04-01

### Funções Arquivadas (movidas para _archived/)
| Função | Motivo | Substituída por |
|--------|--------|-----------------|
| ai-analisar-foto-instalacao | Experimental, nunca integrada | — |
| buscar-leads-google | Experimental | Vibe Prospecting MCP |
| ai-previsao-estoque | Experimental | agent_rules + estoque_minimo |
| ai-preco-dinamico | Experimental | regras_precificacao + Mubisys |
| ai-sequenciar-producao | Substituída | fn_pcp_sequenciar_op (trigger DB) |
| ai-qualificar-lead | Substituída | Score no whatsapp-webhook v15 |
| ai-resumo-cliente | Nunca integrada | croma_detalhe_cliente MCP |
| resolve-geo | Nunca integrada | — |
| telegram-webhook | Desativado | Claude Channels |

### Funções Ativas (manter)
[listar as ~38 funções que continuam ativas]

### Economia estimada
- OpenRouter: ~9 funções a menos consumindo tokens
- Manutenção: menos código para manter
- Deploy: builds mais rápidos no Supabase
```

### 5. NÃO tocar nas funções de produção ativa:
- whatsapp-webhook ✅
- whatsapp-enviar ✅
- whatsapp-submit-templates ✅
- agent-cron-loop ✅
- ai-gerar-orcamento ✅
- ai-compor-mensagem ✅
- ai-decidir-acao ✅
- agent-enviar-email ✅
- ai-chat-erp ✅
- enviar-email-proposta ✅
- ai-insights-diarios ✅
- ai-analisar-orcamento ✅
- Todas as funções fiscal-* ✅
- ai-shared/ (biblioteca compartilhada) ✅

### 6. Commit
Mensagem: "chore: arquivar 9 Edge Functions dormentes — limpeza OpenRouter"
