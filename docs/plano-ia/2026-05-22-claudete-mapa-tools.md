# Claudete — Mapa de Tools Atual vs Gap Cowork

> 2026-05-22 NOITE | Fase 2 do plano "Claudete = Jarvis via ponte Cowork" | Pré-requisito pra Fase 3.1 (criar SKILL `claudete-telegram-responder`).

## TL;DR

`claudete_bot.py` (5501 linhas, 244KB, ~5500 commits desde fev/2026) é um bot Telegram custom com loop agêntico Anthropic SDK + 104 tools MCP Croma via bridge local (porta 7888) + ~20 tools locais (registrar_gasto, memorizar, ler_arquivo, etc). Robusto, multiusuário (Junior+Vivi), memória Supabase, voz IN (Whisper) e OUT (ElevenLabs) já funcionam.

**Gap pra "Cowork-igual"**: faltam exclusivamente as tools que só existem dentro de sessão Claude Desktop — Windows-MCP, Claude in Chrome, Desktop Commander, workspace bash sandbox, 104 Skills, WebSearch, MCPs conectados (Slack/Gmail/Notion/Linear/etc).

**Patch necessário (Fase 3.2)**: linha 4348-4404 (loop agêntico). Substituir `_claude_create_with_retry()` por enfileirar em `ai_requests` (tipo='telegram-resposta'). SKILL Cowork claima, executa com tools heavy, devolve via Telegram Bot API. Watchdog cobre fallback Anthropic em 5min.

## Arquitetura observada do claudete_bot.py

### Entrada de mensagem
- **Long-poll** raw HTTP a `api.telegram.org` (linha 677). Não usa python-telegram-bot lib.
- `main()` (5150) → `processar_comando()` (4763) → `responder_claude()` (4314) para texto livre.
- Comandos `/start`, `/ajuda`, `/contas`, `/gastos`, `/metas`, `/resumo`, `/agenda`, `/croma`, `/haiku`, `/sonnet`, `/clear`, `/status` (4442-4763) — atalhos determinísticos sem IA.

### Loop agêntico (4339-4404)
```python
MAX_ITERACOES = 5
tools_disponiveis = bridge_get_tools_para_mensagem(user_msg)  # filtra por keywords
for iteracao in range(MAX_ITERACOES):
    resp = _claude_create_with_retry(client, model=modelo, max_tokens=1024,
                                     temperature=0.2, system=system,
                                     messages=mensagens_loop, tools=tools_disponiveis)
    if resp.stop_reason == "end_turn": break
    if resp.stop_reason == "tool_use":
        for bloco in resp.content:
            if bloco.type == "tool_use":
                resultado = bridge_execute_tool(tool_name, tool_input, sb, chat_id)
                # ... appendar tool_result e seguir loop
```

Bug "Claudete mente" da sessão MADRUGADA: corrigido em `SupabaseDirectClient.insert()` linhas 398-434 (Prefer: return=representation + check len(rows)>0). Mas Fase B do diagnóstico (auditar 104 tools MCP Croma) segue pendente.

### Tools registradas
1. **TOOLS_CLAUDETE** locais (~20):
   - Financeiro: `registrar_gasto`, `listar_gastos_recentes`, `resumo_financeiro_mes`, `confirmar_pagamento_conta`
   - Agenda: `agendar_consulta` (cria evento Google Calendar)
   - Memória: `registrar_info`, `memorizar` (escreve no vault Obsidian)
   - Arquivos: `ler_arquivo`, `escrever_arquivo`, `listar_arquivos` (com `_path_ok` whitelist)
   - Croma: ~25 atalhos (`croma_listar_clientes`, `croma_criar_proposta`, `croma_dashboard_executivo`, etc) — todos delegam pra MCP Server via `croma_chamar()` (4182) que invoca `node.exe` direto sem cmd intermediário.
   - Croma generic: `croma_executar_erp` (3795) — escape hatch pra invocar qualquer das 104 tools MCP via nome+args.
2. **bridge_tools** dinâmicas (`_get_bridge_tools_cached`, linha 1872): vem da MCP Bridge HTTP porta 7888 — expõe 104 tools MCP Croma com schemas completos. Cached.
3. **Filtragem** por mensagem (linha 1971, `bridge_get_tools_para_mensagem`): classifica intenção (`_classificar_intencao`) e devolve só tools relevantes — reduz prompt size.

### MCP Bridge (porta 7888)
- Subprocess Node rodando local, expõe API HTTP.
- `BRIDGE.get_tools()` (1882) — lista tools com schemas.
- `BRIDGE.call(tool, args)` — invoca tool, devolve resultado.
- `SupabaseBridge` (570-657) — wrapper que faz get/post/patch/delete via bridge (em vez de SupabaseDirectClient).

### Capabilities atuais (resumo)

| Categoria | Status | Onde |
|---|---|---|
| MCP Croma (104 tools) | ✅ via bridge porta 7888 | linhas 1872-2052 |
| Voz IN | ✅ Groq Whisper-large-v3-turbo | linha 945-995 |
| Voz OUT | ✅ ElevenLabs TTS + Telegram sendVoice | linhas 1071-1130 |
| Multimodal (imagem) | ✅ Anthropic vision | linha 4271-4313 |
| Memória persistente | ✅ Supabase `telegram_memoria` | linhas 789-847 |
| Multiusuário (Jr+Vivi) | ✅ vault paths + perfil override | linhas 211-269 |
| Obsidian vault | ✅ read memory.md/state.md + busca | linhas 849-885, 1168-1245 |
| Google Calendar | ✅ gcal_listar_eventos | linha 1750 |
| Filesystem read/write | ✅ com whitelist `_path_ok` | linhas 3995-4159 |
| Hot-reload autorizados | ✅ + pedidos de acesso | linhas 4864-5077 |
| Fila offline (retry) | ✅ fila_adicionar/flush | linhas 2968-3025 |
| Anti-alucinação | ✅ regras .claude/rules/ + RLS fix | system prompt |
| Goal-Driven Verification | ⚠️ parcial — só no `_insert_returning` | linhas 416-434 |

## Gap pra "Cowork-igual"

| Capability | Cowork tem | Claudete tem | Disponível em bot Python externo? |
|---|---|---|---|
| **Windows-MCP** (PowerShell, Click, Type, Screenshot, App, MultiEdit, Process, Notification) | ✅ | ❌ | **NÃO** — MCP local da sessão Claude Desktop |
| **Claude in Chrome** (navegar real, click, type, file_upload, get_page_text, JS) | ✅ | ❌ | **NÃO** — extensão Chrome controlada pela sessão |
| **Desktop Commander start_process** | ✅ | ❌ | **NÃO** — MCP local da sessão |
| **workspace bash sandbox** (Linux, Python, Node, curl) | ✅ | ❌ | **NÃO** — Cowork-specific |
| **104 Skills** (docx, pptx, xlsx, humanizer, sales:*, marketing:*, etc) | ✅ | ❌ | Parcial — algumas têm CLI standalone, maioria não |
| **WebSearch** (Google/Bing nativo) | ✅ | ❌ | Possível via API paga; hoje não tem |
| **WebFetch / web_fetch_vercel_url** | ✅ | ❌ | Possível com urllib direto, hoje não tem |
| **MCPs conectados Cowork** (Slack, Gmail nativo, Notion, Linear, Asana, Datadog, Vercel, GitHub, Canva, Apollo, etc, ~40 servidores) | ✅ | ❌ (só MCP Croma) | Possível conectar individualmente, mas duplica config |
| **Scheduled tasks** (criar via natural language) | ✅ via mcp__scheduled-tasks__ | ❌ | Possível replicar com cron Python, hoje não tem |

**Conclusão**: nenhuma das tools heavy roda em bot Python externo. Só sessão Claude Desktop (= ponte Cowork) entrega.

## Recomendação arquitetural (atualizada após mapear código)

### Caminho B puro (escolhido pelo Junior)

Substitui `responder_claude` por enfileirar em `ai_requests`. Todos os pedidos via Telegram vão pela ponte Cowork.

**Prós**: simplicidade, herda 100% das tools Cowork.
**Contras**:
- Latência sobe de ~3-5s (Anthropic direto) pra ~15-60s (ponte).
- Mensagens simples ("oi", "que horas são", "quanto gastei esse mês") sofrem desnecessariamente.
- Janela Cowork = ponto único de falha (watchdog em 5min é o fallback).

### Híbrido (sugestão — mencionar pro Junior decidir antes da Fase 3.2)

Roteamento por intenção (Karpathy: Goal-Driven Execution).

```python
def precisa_cowork(user_msg: str) -> bool:
    keywords = [
        "screenshot", "print", "tira foto", "abre app", "abre o", "controla",
        "navega", "abre site", "compra", "reserva", "passagem",
        "preenche formul", "clica em", "tira print",
        # Skills heavy:
        "gera planilha", "gera apresenta", "gera docx",
    ]
    return any(k in user_msg.lower() for k in keywords)
```

- `precisa_cowork()` retorna True → enfileira em `ai_requests`, latência 15-60s
- False → roda loop agêntico atual com Anthropic SDK direto, latência 3-5s

**Prós**: mensagens rápidas continuam rápidas. Tarefas heavy ganham poderes Cowork.
**Contras**: 2 paths pra manter (mas roteamento é uma função de 5 linhas).

**Minha opinião**: híbrido é o caminho. Mas Junior escolheu B puro — respeito a decisão. Se ele quiser híbrido depois, é trivial trocar.

## Plano da Fase 3 (atualizado com info do código)

### 3.1 — SKILL `claudete-telegram-responder` (espelho v6-atendimento + adaptações)

Diferenças do espelho WhatsApp:
- Tipo da fila: `'telegram-resposta'` (em vez de `'whatsapp-resposta'`)
- Contexto jsonb: `{chat_id, user_id, user_name, text_body, audio_transcription, is_audio, is_image, image_b64, image_mime, conversation_chat_id}`
- Multiusuário: detecta `chat_id` (1065519625=Junior, 7755709957=Vivi) → carrega vault correto (`99-Meta/memory.md` vs `99-Meta/memory-vivi.md`)
- Envio: Telegram Bot API `sendMessage` (texto) ou `sendVoice` (ElevenLabs OGG/Opus)
- Catálogo completo de tools Cowork (Windows-MCP, Chrome, Skills, MCPs, etc) no system prompt
- Goal-Driven Verification obrigatória pós-mutation (mesma regra do v6-DONO)
- INSERT em `pessoal.log_acoes` com `origem='telegram_cowork'`, `origem_chat_id=<chat_id>`

Schema sugerido pra `agent_messages` Telegram (ou tabela paralela): reusar `agent_messages` com `canal='telegram'` + metadata `{chat_id, modo:'jarvis-pessoal'}`.

### 3.2 — Patch `claudete_bot.py`

Pontos de mudança (cirúrgicos, Karpathy):

1. **Função nova** `enfileirar_request_cowork(sb, chat_id, user_msg, contexto_extra)` — INSERT em `ai_requests` tipo='telegram-resposta'. Retorna ai_request.id.

2. **Função nova** `aguardar_resposta_cowork(sb, request_id, timeout=90)` — POLL `ai_responses` WHERE request_id=X. Timeout em 90s. Se não veio: fila offline (mensagem "Tô processando, te mando assim que ficar pronto") + watchdog pega.

3. **Modificar** `responder_claude` (linha 4314): no início, se Caminho B puro → enfileira direto. Se híbrido → checa `precisa_cowork(user_msg)`.

4. **Modificar** `main()` ou handler de updates: quando ai_request completed assincronamente, envia mensagem via Telegram Bot API (já tem `TelegramBot.send`).

5. **Fila offline**: já existe (`fila_adicionar`/`fila_flush`). Reusa pra mensagens enquanto Cowork ocupado.

### 3.3 — Watchdog v3 → v4

Patch em `supabase/functions/ai-requests-fallback-watchdog/index.ts`:
- Filtro atual: `tipo='whatsapp-resposta'` em `status IN ('pending','processing')` + age > 5min
- Novo: `tipo IN ('whatsapp-resposta','telegram-resposta')`
- Fallback Anthropic: roda loop agêntico simplificado (sem Windows-MCP/Chrome porque não tem). Envia via Telegram Bot API direto se tipo=telegram.

### 3.4 — Teste E2E

1. Junior manda "oi" no Telegram → bot enfileira → SKILL claima → responde "Oi Junior, o que tu precisa?" via Telegram em <90s.
2. Junior manda "tira print do dashboard Croma" → SKILL usa Claude in Chrome navega `crm-croma.vercel.app/dashboard` + screenshot + Telegram sendPhoto.

## Riscos identificados

1. **Hot-reload do bot**: bot tem reload automático de autorizados via `croma_telegram_*` tools. O patch precisa não quebrar isso. Vou tocar só `responder_claude` e adicionar 2 funções novas — zero impacto no reload.

2. **Memória**: hoje `memoria_carregar/salvar` (789-847) é chamado dentro de `responder_claude`. Quando o flow vai pra Cowork, a SKILL precisa fazer o mesmo. Vou passar instrução clara no system prompt da SKILL.

3. **Multimodal (imagem)**: `responder_multimodal` (4271) hoje converte image → base64 → Anthropic. Pra Cowork: passar `image_b64` no contexto da `ai_requests`, SKILL decodifica e usa. Mais espaço em banco mas funciona.

4. **Áudio OUT**: hoje `telegram_enviar_audio` chama ElevenLabs + sendVoice. Pode ficar no bot (lado bot detecta `agent_messages.metadata.audio_output=true` → sintetiza+envia) OU mover pra SKILL (mas Telegram Bot API precisa ser invocada do lado bot, então melhor manter no bot).

5. **Loop agêntico vs SKILL agêntica**: hoje bot já tem MAX_ITERACOES=5. SKILL Cowork tem janela maior. Isso é ganho automático.

6. **Custo**: Cowork = $0. Fallback watchdog = ~$0.03/msg. Se Cowork ficar offline 1h e fluxo Vivi+Junior gerar 30 msgs → ~$0.90. Aceitável.

## Decisões pendentes pro Junior

1. **Híbrido ou B puro?** Junior já escolheu B puro, mas com base no código que vi, recomendo reabrir essa decisão (5 linhas de roteamento por keyword resolvem latência sem perder poder).
2. **Mensagens curtas e rápidas vão sofrer latência?** Se Junior aceitar, B puro.
3. **Manter Anthropic SDK como fallback dentro do bot mesmo com B puro?** Sim — fila offline + retry. Já existe.

---

**Status**: Fase 2 ✅ entregue. Próximo passo: Fase 3.1 (criar SKILL `claudete-telegram-responder`).
