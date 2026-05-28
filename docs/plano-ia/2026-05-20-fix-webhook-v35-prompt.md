# Conserto do `whatsapp-webhook` — diff prod (v35) vs repo (v18) + fix do bug "status='respondida' sem envio"

> **Criado**: 2026-05-20 NOITE | **Para executar**: próxima sessão Claude Code CLI
> **Origem**: Junior reportou que mandando WhatsApp pro número da Croma o agente não responde mais. Testes em 20/05 19:53 e 20:02 confirmaram: webhook recebe (HTTP 200), grava `status='respondida'` em `agent_messages` mas `respondido_em=null`, `modelo_ia=null`, sem resposta enviada via Meta API.

---

## Diagnóstico — o que sabemos

### Sintomas confirmados via Supabase MCP

**Mensagens de teste em 20/05:**

| created_at | direcao | status | enviado_em | modelo_ia | respondido_em |
|---|---|---|---|---|---|
| 19:53:18 | recebida | **respondida** | null | null | **null** |
| 20:02:52 | recebida | **respondida** | null | null | **null** |

Webhook gravou `status='respondida'` mas:
- Nenhuma mensagem `direcao='enviada'` foi criada em resposta
- `modelo_ia` continua null (IA nunca foi chamada com sucesso, ou retorno descartado)
- `respondido_em` continua null

**Logs Edge Function (20/05 19:18Z):**
```
POST | 200 | https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook
       version 35, execution_time_ms=1427
```
Depois (mesma janela):
```
POST | 400 | https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-enviar
       version 30, execution_time_ms=287
```

→ webhook chama `whatsapp-enviar` que retorna 400 (provável erro de payload ou auth)
→ webhook continua e marca `status='respondida'` mesmo com falha do envio

### Diferença não-rastreada

- **Repo local** (`supabase/functions/whatsapp-webhook/index.ts`): cabeçalho diz **v18**, importa `openrouter-provider`
- **Produção** (via Supabase MCP `get_edge_function`): é **v35**
- Sem commits no git que expliquem v19-v35

### Outros achados relacionados (provavelmente fora do escopo deste fix)

- `agent-cron-loop` em loop de erro 500
- `ai-compor-mensagem` retorna 401 quando chamado pelo cron (fix S2.6 nunca aplicado nessa função — Grupo B do `.planning/todos/pending/edge-functions-s2.6-checklist.md`)

---

## Plano de execução (Claude Code CLI)

### Fase 1 — Investigar a divergência v18→v35 (sem código alterado)

1. Puxar código deployado via Supabase MCP:
   ```
   mcp__supabase__get_edge_function project_id=djwjmfgplnqyffdcgdaw function_slug=whatsapp-webhook
   ```
2. Salvar em arquivo de scratch (não commit) — ex: `/tmp/webhook-v35-deployed.ts`
3. Diff contra `supabase/functions/whatsapp-webhook/index.ts` (repo v18). Atenção: o resultado é uma linha enorme, usar Python pra fatiar.
4. **Identificar especificamente:**
   - Onde marca `status='respondida'` no UPDATE de `agent_messages` — qual ramo do código.
   - Sequência de chamadas: `generateClaudeResponse` → `sendWhatsApp` ou `whatsapp-enviar` Edge Function → UPDATE status.
   - Se o UPDATE ocorre ANTES de `sendWhatsApp` confirmar sucesso (bug provável).
   - Se há try/catch silenciando erro do `whatsapp-enviar` HTTP 400.

### Fase 2 — Investigar por que `whatsapp-enviar` v30 retorna 400

1. Puxar código deployado: `get_edge_function whatsapp-enviar`
2. Verificar:
   - Payload esperado vs payload que o webhook v35 está mandando
   - Se exige campo novo (ex: `template_params`, `from`, etc) que o webhook não passa em INBOUND
   - Validação de schema (Zod?) que rejeita

### Fase 3 — Decidir estratégia do fix

Três caminhos possíveis, escolher após Fase 1+2:

**A) Fix mínimo no webhook**: mover o `UPDATE status='respondida'` pra DEPOIS de `sendWhatsApp` retornar sucesso. Em caso de erro, gravar `status='erro'` com `erro_codigo`/`erro_mensagem` do retorno do `whatsapp-enviar`.

**B) Fix no `whatsapp-enviar`**: se o 400 for um schema mismatch (webhook v35 passa formato novo, enviar v30 espera antigo), atualizar `whatsapp-enviar` pra aceitar ambos OU atualizar webhook pra passar formato correto.

**C) Resincronizar repo↔prod**: trazer o código v35 deployado pro repo local (e fazer commit com mensagem explicando a divergência), depois aplicar o fix em cima. Mais seguro pro longo prazo.

**Recomendação**: combinar (A) + (C) — sincroniza o repo (commit "sync: bring whatsapp-webhook v18→v35 from production") e em cima aplica o fix de status='respondida'.

### Fase 4 — Aplicar e validar

1. Aplicar fix nos arquivos locais
2. Type-check: `npx tsc --noEmit` (ou `deno check` se Deno)
3. **Confirmar com Junior** o diff exato antes de deployar (regra #1 do CLAUDE.md — alterações precisam confirmação)
4. Deploy via Supabase MCP `deploy_edge_function`
5. Teste E2E:
   - Enviar mensagem manual pro número da Croma (`+5511939471862`) usando outro celular
   - Aguardar 30s
   - Query `SELECT id, status, enviado_em, respondido_em, modelo_ia FROM agent_messages WHERE created_at > now() - interval '1 minute' ORDER BY created_at DESC`
   - Esperado: 1 RECEBIDA + 1 ENVIADA, ambas `status='enviada'` (ou similar), `enviado_em IS NOT NULL`

### Fase 5 — Documentar

1. Atualizar `.planning/STATE.md` com a sessão (o que descobriu, o que corrigiu, versão final do webhook)
2. Salvar aprendizado no Obsidian: `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\aprendizados\YYYY-MM-DD-fix-webhook-v35.md`
3. Marcar bug "status='respondida' sem envio" como RESOLVED no STATE
4. Se necessário, atualizar `MAPA-IA-CROMA.md` removendo o item "webhook v35 vs v18 não-rastreado"

---

## Critério de sucesso

- [ ] Diff repo↔prod identificado e documentado
- [ ] Causa raiz do bug isolada (ramo do código)
- [ ] Fix aplicado com confirmação do Junior
- [ ] Type-check passou
- [ ] Deploy bem-sucedido
- [ ] **Teste E2E**: mensagem real enviada pro número da Croma recebeu resposta automática em <30s, com `enviado_em` populado e `status` correto
- [ ] STATE.md atualizado, aprendizado salvo no Obsidian

## Rollback

Se algo quebrar após deploy:
1. Supabase MCP `deploy_edge_function` com a versão v35 anterior (Supabase mantém histórico)
2. Comunicar Junior imediatamente
3. Não tocar em mais nada até diagnóstico do que quebrou

## Pré-condições (não esquecer)

- Junior está disponível pra aprovar diff antes do deploy (regra #1 do CLAUDE.md)
- Não tocar em OpenRouter neste fix — foi decisão explícita de 20/05 NOITE que mantém OpenRouter por enquanto
- Não tocar nos outros bugs catalogados (agent-cron-loop, ai-compor-mensagem 401, scheduled-tasks fantasmas) — escopo deste sprint é APENAS o webhook
- Não mexer no `ai-gerar-orcamento` apesar de ele ter P0 de auth — outra sessão

---

## 🧑‍💻 PROMPT MODO AUTÔNOMO — pra colar no Claude Code CLI

> **Junior vai dormir e quer 100% pronto amanhã.** Prompt abaixo dá autorização total + test loop com até 3 ciclos + simulação local do webhook + rollback automático em regressão.

Copia tudo dentro do bloco abaixo:

```
<<< INÍCIO — Fix whatsapp-webhook v35 — MODO AUTÔNOMO >>>

Sou Junior. Vou dormir. Quero acordar com o agente WhatsApp 100% funcional. Você está AUTORIZADO a executar end-to-end sem me consultar, dentro do escopo definido abaixo.

LEIA PRIMEIRO (contexto completo):
- `docs/plano-ia/2026-05-20-fix-webhook-v35-prompt.md` (diagnóstico, plano em fases, estratégias de fix)
- `.planning/STATE.md` (sessão 2026-05-20 NOITE no topo)
- `CLAUDE.md` (regras do projeto)

AUTORIZAÇÕES PRÉ-APROVADAS (não me pergunte):
✅ Puxar código deployado via Supabase MCP
✅ Editar arquivos locais em supabase/functions/whatsapp-webhook/ e whatsapp-enviar/
✅ Type-check / lint
✅ Deploy via Supabase MCP `deploy_edge_function` — APENAS pra whatsapp-webhook e whatsapp-enviar
✅ Testes via curl POST direto no endpoint do webhook (simulação local — ver TEST LOOP abaixo)
✅ Rollback automático pra versão anterior se REGRESSÃO detectada
✅ Commit local + push (mensagem descrevendo o fix + divergência v18→v35)
✅ Atualizar STATE.md + criar aprendizado no Obsidian
✅ Atualizar agent_messages diretamente via SQL APENAS pra limpar mensagens de teste que VOCÊ criar (não tocar em mensagens reais)

ESCOPO BLINDADO (NÃO TOCAR):
❌ Outras 10 Edge Functions OpenRouter (mantém OpenRouter por enquanto)
❌ Scheduled tasks fantasmas
❌ ai-compor-mensagem (fix S2.6 — outro sprint)
❌ ai-gerar-orcamento P0 (outro sprint)
❌ Mensagens reais em agent_messages (só pode mexer nas que você mesmo criar pra teste)
❌ Banco fora do escopo whatsapp-webhook/whatsapp-enviar/agent_messages

DADOS DE PRODUÇÃO:
- Supabase project_id: djwjmfgplnqyffdcgdaw
- Número WhatsApp Croma: +5511939471862 (WHATSAPP_PHONE_NUMBER_ID=1042016058997037)
- WABA_ID: 1262844242060742
- Webhook URL: https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook
- WHATSAPP_TEST_PHONE: existe em admin_config — usar pra testes (NÃO contactar números reais)

═══════════════════════════════════════════════════
TEST LOOP — execução autônoma com até 3 ciclos
═══════════════════════════════════════════════════

CICLO 1: Investigação + primeira hipótese
  1.1) Puxar v35 deployado (mcp__supabase__get_edge_function)
  1.2) Salvar em /tmp/webhook-v35-original.ts (BACKUP — usar pra rollback se precisar)
  1.3) Puxar whatsapp-enviar v30 deployado → /tmp/whatsapp-enviar-v30-original.ts
  1.4) Diff vs repo local (cuidado: arquivo é uma linha enorme, fatiar com python)
  1.5) Identificar:
       a) Ramo que marca status='respondida' sem checar sucesso de send
       b) Por que whatsapp-enviar retorna 400 (schema mismatch, auth, payload)
  1.6) Decidir estratégia A/B/C do plano (preferência: A+C combinados)
  1.7) Aplicar fix LOCAL
  1.8) Type-check / lint
  1.9) Deploy via Supabase MCP
  1.10) Executar TESTE SIMULADO (ver abaixo)
  1.11) Se PASSOU: executar TESTE PRODUÇÃO (ver abaixo)
  1.12) Se PASSOU: pular pra DOCUMENTAÇÃO
  1.13) Se FALHOU: ir pro CICLO 2

CICLO 2: Diagnóstico do que falhou + segunda hipótese
  2.1) Puxar logs Edge Function (get_logs) das últimas execuções
  2.2) Analisar onde falhou: foi simulado? foi prod? Que erro?
  2.3) Aplicar segunda hipótese (revisar estratégia escolhida no ciclo 1)
  2.4) Deploy + testes
  2.5) Se PASSOU: documentar e finalizar
  2.6) Se FALHOU: ir pro CICLO 3

CICLO 3: Última tentativa OU rollback
  3.1) Se ainda houver hipótese promissora baseada nos logs do ciclo 2: tentar uma vez mais
  3.2) Se PASSOU: documentar
  3.3) Se FALHOU OU sem hipótese clara:
       - **ROLLBACK**: re-deployar /tmp/webhook-v35-original.ts e /tmp/whatsapp-enviar-v30-original.ts
       - Documentar falha em RELATÓRIO_FALHA.md no outputs/
       - Parar (não tentar ciclo 4)

═══════════════════════════════════════════════════
TESTE SIMULADO (sem precisar de celular do Junior)
═══════════════════════════════════════════════════

O webhook aceita POST direto (não tem signature validation real — WHATSAPP_APP_SECRET vazio, conforme P0 da auditoria). Simular mensagem entrante:

curl -sS -X POST "https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "1262844242060742",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511939471862",
            "phone_number_id": "1042016058997037"
          },
          "contacts": [{
            "profile": {"name": "Teste Autonomo Claude Code"},
            "wa_id": "5511999990001"
          }],
          "messages": [{
            "from": "5511999990001",
            "id": "wamid.TEST_'$(date +%s)'",
            "timestamp": "'$(date +%s)'",
            "type": "text",
            "text": {"body": "Oi, gostaria de saber sobre comunicação visual"}
          }]
        },
        "field": "messages"
      }]
    }]
  }'

Esperar 30s e validar via SQL:

SELECT id, direcao, status, enviado_em, respondido_em, modelo_ia, erro_codigo,
       LEFT(conteudo, 80) AS preview, created_at
FROM agent_messages
WHERE metadata->>'from_phone' = '5511999990001'
  AND created_at > now() - interval '2 minutes'
ORDER BY created_at;

CRITÉRIO PASS:
- Exatamente 2 linhas: 1 RECEBIDA + 1 ENVIADA
- RECEBIDA: status NÃO contém erro, respondido_em IS NOT NULL após processamento
- ENVIADA: status='enviada' OU 'aprovada' OU similar, enviado_em IS NOT NULL, conteudo não vazio
- Nenhuma erro_codigo populado em qualquer das 2

CRITÉRIO FAIL:
- Webhook retornou status >= 400
- Não criou linha ENVIADA
- ENVIADA com erro_codigo populado
- ENVIADA com status='erro'
- Logs Edge Function mostram exception não tratada

LIMPEZA pós-teste simulado:
DELETE FROM agent_messages WHERE metadata->>'from_phone' = '5511999990001';
DELETE FROM agent_conversations WHERE lead_id IN (SELECT id FROM leads WHERE telefone = '+5511999990001');
DELETE FROM leads WHERE telefone = '+5511999990001';

═══════════════════════════════════════════════════
TESTE PRODUÇÃO (se simulado passou)
═══════════════════════════════════════════════════

Usar WHATSAPP_TEST_PHONE da admin_config como destino:

SELECT valor FROM admin_config WHERE chave = 'WHATSAPP_TEST_PHONE';

Mandar mensagem REAL pra esse número via whatsapp-enviar (POST direto na Edge Function com service_role + X-Internal-Call). Aguardar webhook receber confirmação de delivery. Validar agent_messages.

Se WHATSAPP_TEST_PHONE estiver vazio ou inválido, PULAR este teste e marcar relatório com aviso. O teste simulado já é forte indicador.

═══════════════════════════════════════════════════
RELATÓRIO FINAL (sempre gerar — sucesso ou falha)
═══════════════════════════════════════════════════

Salvar em `outputs/2026-05-21-fix-webhook-relatorio.md`:

1. Causa raiz identificada (linhas, ramo, descrição)
2. Estratégia escolhida (A/B/C ou mix)
3. Diff resumido do que mudou em cada arquivo
4. Resultado dos testes (simulado + produção)
5. Versão final deployada (whatsapp-webhook vXX, whatsapp-enviar vYY)
6. Bugs NOVOS descobertos que NÃO foram corrigidos (escopo) — listar pra próxima sessão
7. Tempo total da execução

Em CASO DE FALHA também:
- Qual o último estado tentado
- Qual hipótese ainda não testada
- O que precisa de input humano

DOCUMENTAÇÃO PERMANENTE (apenas em caso de sucesso):
- Atualizar `.planning/STATE.md` no topo com nova sessão 2026-05-21
- Criar `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-05-21-fix-webhook-v35-status-respondida.md`
- Commit local: "fix(whatsapp-webhook): sync v18->v35 + corrige status='respondida' sem envio + valida sucesso de whatsapp-enviar antes de marcar"
- Push pro GitHub (origin/main)

GUARDRAILS:
- Em QUALQUER erro não previsto (Supabase indisponível, MCP erro, etc): pare, documente em outputs/, NÃO ARRISCAR
- NUNCA deploy duas funções de uma vez — sempre uma por vez, testa, depois a outra
- Antes de cada deploy, GARANTIR que /tmp/*-original.ts existe (rollback)
- Se rollback for executado, AVISAR isso explicitamente no relatório final

INÍCIO: Leia o doc principal `docs/plano-ia/2026-05-20-fix-webhook-v35-prompt.md` + STATE.md, depois começa o CICLO 1. Boa noite, te vejo amanhã pelo relatório.

<<< FIM DO PROMPT >>>
```

---

## Anexo — links úteis pra o Claude Code consultar

- `.planning/STATE.md` (sessão 2026-05-20 NOITE) — contexto completo do diagnóstico
- `docs/qa-reports/2026-05-20-auditoria-leads-agente-vendas.md` — auditoria que apontou os 4 P0
- `supabase/functions/whatsapp-webhook/index.ts` — código local v18
- `supabase/functions/whatsapp-enviar/index.ts` — código local da função de envio
- `supabase/functions/ai-shared/whatsapp-credentials.ts` — credenciais Meta
- `supabase/functions/ai-shared/openrouter-provider.ts` — provider ainda usado pelo webhook
- `.planning/todos/pending/edge-functions-s2.6-checklist.md` — fixes pendentes relacionados (não escopo deste fix)
- MCP Server Croma: `C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd` — 103 ferramentas pra consultar dados do negócio

## Notas finais pro Junior

- O fix deve durar entre **45min e 2h** dependendo de quão grande for o diff v18→v35
- Você precisa estar disponível pra **aprovar o diff antes do deploy** — Claude Code vai parar e esperar
- Se você tiver outro celular à mão pra mandar o teste E2E pro +5511939471862, fica mais rápido a validação. Senão pode usar o app WhatsApp Business no próprio celular (manda de outro número)
- Caso o fix seja simples (mover 5 linhas) e funcione, o overhead de documentação fica em ~10min
- Se a causa raiz NÃO for o que esperamos (UPDATE antes do send), Claude Code vai parar e te avisar — não vai inventar fix.
