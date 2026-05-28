Sou Junior, retomando refundação Beira Rio Parte 4. Objetivo principal:
implementar Telegram como canal de entrada alternativo pra briefing-beira-rio,
mais 1-2 pendências menores se sobrar token.

# REGRAS DA SESSÃO (não negociar)
1. Modo orquestrador OBRIGATÓRIO — tu planeja + coordena + valida. Trabalho pesado
   (recon ≥500 linhas, implementação ≥100 LOC, deploy multi-step, debug isolado)
   vai pra sub-agent via Agent tool. CLAUDE.md REGRA #0 detalha.
2. Budget ~150k tokens. Se passar de 100k, escala agents. Se passar de 150k,
   prepara próxima sessão e para.
3. NUNCA "parar pra economizar tokens" sem ter tentado delegar pra agent.
4. Paralelismo obrigatório se blocos são independentes.
5. NÃO ECONOMIZE em sub-agents paralelos — Junior já reforçou isso.
6. Modo adversarial em validações — agents recebem instrução explícita pra
   questionar premissas + verificações cruzadas.
7. Cowork vs Claude Code: arquivos >500 linhas (Edit do Cowork trunca) → me
   recomenda rodar Claude Code local. Cowork é melhor pra orquestração +
   deploys + queries.
8. Notificar Telegram (chat_id 1065519625) quando tarefa longa terminar.

# LEITURA OBRIGATÓRIA (na ordem)
1. C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md (regra #0 modo orquestrador + #1 MCP)
2. C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md (entrada "Sessão 2026-05-26 MADRUGADA")
3. C:\Users\Caldera\Claude\JARVIS\claudete_bot.py (linhas 5570-5840 — handler brio:* atual)
4. v7 fonte de verdade: outputs/briefing-beira-rio-v7-FINAL.ts

# ESTADO ATUAL EM PROD (não revalidar)
- whatsapp-webhook v44 ACTIVE (verify_jwt=false, guard INTERNAL_PHONES)
- briefing-beira-rio v7 ACTIVE (verify_jwt=false, fix lookup cliente_id +
  params force_store_id + suppress_telegram)
- ai-gerar-orcamento v29 ACTIVE intocado
- claudete_bot.py rodando (PID dinâmico, conferir Get-Process pythonw)
  com handler brio:approve/edit/cancel/pickstore V2 real
- RPCs vault: get_service_role_legacy_jwt + get_telegram_bot_token
- E2E pelo WhatsApp validado: Junior + Viviane podem encaminhar briefings,
  sistema cria proposta SHADOW + card Telegram com botões funcionais
- PROP-2026-0030 (Giseli) e PROP-2026-0031 (Lucas Florindo via pickstore)
  são reais e ficam no banco como histórico

# BUGS JÁ CORRIGIDOS (não revisitar)
- BUG-JWT (SERVICE_ROLE_KEY virou sb_secret_* — lê JWT legado do vault)
- BUG-TG-CARD (TELEGRAM_BOT_TOKEN não chega na Edge — RPC do vault)
- BUG-CALLBACK (handler brio:* faltava no claudete_bot.py)
- BUG-LINK-ERP (rota /orcamentos/<id>, não /propostas/<id>)
- BUG-LOOKUP-FAIL (filtro cliente_id excluía 1258 stores importadas via CSV)
- BUG-PICKSTORE-SILENT (bot morria durante restart; handler V2 implementado)

# OBJETIVO DA SESSÃO

## BLOCO 1 — TELEGRAM-ENTRY: planejamento (~10 min, INLINE com 1 agent recon)

Briefing pra agent recon adversarial:
- Ler claudete_bot.py — entender estrutura de processar_comando, handlers,
  como mensagens texto livres são roteadas hoje
- Identificar onde inserir interceptor (antes de cair pra Anthropic API
  free-form do bot)
- Avaliar:
  (a) Como detectar intent "briefing Beira Rio" sem falso positivo:
      - Comando explícito /briefing OU
      - Regex code Beira Rio \b\d{6}-\d\b OU
      - Combinação (regex + keyword "loja" ou "BR" ou nome cliente)
  (b) Como mapear chat_id Telegram → from_phone (briefing v7 espera E.164):
      - Hardcode no bot (CHAT_ID_JUNIOR=1065519625 → "5511981549118",
        CHAT_ID_VIVIANE=7755709957 → "5511967310547")
      - OU tabela telegram_user_mapping
      - OU admin_config JSON
      - Junior recomenda: hardcode no bot (simples, 2 usuários só, baixa
        mudança)
  (c) Como gerar wamid (Telegram não tem):
      - Format: tg_<chat_id>_<msg_id> ou similar — idempotência por essa key
  (d) Como tratar mídia (foto, voz)? V1: só texto. Foto/voz → bot continua
      processando normal (Anthropic API), NÃO desvia pra briefing
  (e) Como o card SHADOW vai voltar? briefing v7 já envia pro Telegram do
      from_phone — mapeamento reverso (phone → chat_id) já cuida disso?
      ADVERSARIAL: confirmar lendo briefing-beira-rio v7 — provavelmente
      hardcode CHAT_ID_JUNIOR. Pra Viviane: pode precisar passar
      `notify_chat_id` no body do briefing
  (f) Como decidir se a mensagem é briefing ou comando-livre pra Claudete?
      Heurística sugerida: SE detectar code Beira Rio (regex) OU comando
      explícito /briefing — desvia. Caso contrário, segue fluxo Anthropic
      normal do bot
- Output: documento curto de plano com decisões + caminhos de código
  exatos (linhas a editar)

## BLOCO 2 — TELEGRAM-ENTRY: implementação (~25 min, AGENT pesado)

Briefing pra agent implementador:
- Aplicar plano do BLOCO 1
- Adicionar helper telegram_to_phone(chat_id) → str (mapeamento dict
  hardcoded com fallback Junior pra IDs desconhecidos? OU return None +
  log)
- Adicionar detector intent briefing (regex + keyword)
- Adicionar handler `processar_briefing_telegram(bot, mensagem_obj)`:
  - Detecta intent
  - Gera wamid_synthetic = f"tg_{chat_id}_{msg_id}"
  - Chama briefing-beira-rio v7 com {briefing, from_phone, whatsapp_message_id,
    notify_chat_id=chat_id, media_type='text'}
  - Card SHADOW vai aparecer no chat_id direto (briefing v7 deve aceitar
    notify_chat_id ou ser corrigido)
- Patch CRÍTICO em briefing-beira-rio v7 → v8:
  - Adicionar `notify_chat_id` opcional no body
  - Se presente, usa esse em vez do hardcode CHAT_ID_JUNIOR
  - Mantém retrocompat (se ausente, mantém comportamento atual)
- Backup do claudete_bot.py ANTES de editar (timestamp obrigatório)
- ENCODING UTF-8 sem BOM via
  [System.IO.File]::WriteAllText($path, $content, (New-Object
  System.Text.UTF8Encoding $false))
  — Set-Content sem -Encoding UTF8 quebrou o arquivo numa sessão passada
- Restartar bot via Stop-Process + Start-Process pythonw
- Log explícito "[TG-BRIEFING] intent=detected chat_id=X" pra audit

## BLOCO 3 — SMOKETEST E2E TELEGRAM (~10 min, INLINE)

INLINE (Junior testa):
- Junior abre Telegram → Claudete → manda mensagem de briefing
  ("Orçamento PS 1mm 80x40 loja 186958-1 Giseli")
- Esperado:
  1. Bot detecta intent (log appears)
  2. Card SHADOW aparece no chat dele em 10-30s com Aprovar/Editar/Cancelar
  3. Clica Aprovar → status muda no banco
- Validar no banco (SELECT recente em propostas + ai_requests)
- Mensagem livre normal ("oi tudo bem") deve seguir Anthropic API (não cair
  no briefing) — testar pra confirmar não regressão

Se Viviane estiver disponível: ela testa pelo Telegram dela também
(CHAT_ID 7755709957). Se mapeamento phone Viviane bater + card chegar no
chat dela, win duplo.

## BLOCO 4 — STATUS TELEGRAM + UPDATE STATE.md (~5 min, INLINE)

- Telegram chat_id 1065519625 (sem parse_mode Markdown!) com status
- Edit STATE.md adicionando entrada nova MADRUGADA-2 ou similar

# PENDÊNCIAS QUE FICAM PRA DEPOIS (NÃO TENTAR NESSA SESSÃO se token escasso)
1. Disparo WhatsApp automático pós-Aprovar (Meta janela 24h — precisa
   template aprovado)
2. Auditar 1258 stores sem cliente_id — vincular as Beira Rio (lookup v7
   já funciona, é cosmético)
3. Persistir RPCs em migration versionada (20260526_create_vault_rpcs.sql)
4. Auditar outras Edge Functions usando SERVICE_ROLE_KEY ou
   TELEGRAM_BOT_TOKEN com mesmo padrão dos bugs corrigidos
5. Trocar emojis (✅❌✏️) por ASCII no bot — emojis não renderizam em
   alguns clientes Telegram (Junior viu "?? EDITAR")
6. Tela ERP /orcamentos/pendentes-aprovacao
7. E2E real Viviane Quinta 28/05 (cronograma original)
8. Bug Claudete-cliente-fantasma (antigo)
9. agent-cron-loop 500 (ler admin_config.debug_cron_last_error)

# CUIDADOS APRENDIDOS (não repetir)
- Edit do Cowork trunca files >500 linhas — usar Python heredoc + bash OU
  delegar pra Claude Code
- Telegram parse_mode=Markdown estoura facilmente (caractere errado quebra
  request) — usar SEM parse_mode ou validar texto
- pg_net pra smoketest interno (não temos SERVICE_ROLE_KEY exposto no Cowork)
  — mas pg_net default timeout é 5s, briefing pode levar 9s. Não falha o
  processamento, só não vê HTTP response — validar via SELECT em ai_requests
- ai_requests com whatsapp_message_id LIKE 'wamid.SMOKETEST_%' OU
  'tg_TEST_%' = dados de teste, limpar no fim (CASCADE: agent_messages →
  atividades → conversations → propostas → leads → ai_requests)
- claudete_bot.py: SEMPRE backup antes de patch +
  [System.IO.File]::WriteAllText UTF-8 sem BOM
- briefing v7 tem suppress_telegram=true pra smoketest sem poluir chat
- Junior pode dizer "continua" pra forçar execução, ou "para aqui" pra
  forçar pausa
- 6 stores Beira Rio com cliente_id setado (formato "186958-1 Giseli") +
  1258 stores importadas via CSV sem cliente_id. v7 lookup busca code
  global, fuzzy mantém restrição Beira Rio

# CRÍTICOS DE ARQUITETURA (mantra antes de mexer)
- WhatsApp Croma = canal cliente (atendimento) + ENTRY Beira Rio via
  encaminhar Viviane/Junior
- Telegram Claudete = comando-livre dono + AGORA também ENTRY Beira Rio
  (adição dessa sessão)
- Bot Python autônomo Anthropic API — NÃO usa Cowork pra mensagens leves
- Ponte Cowork foi DESLIGADA em 22/05 (revisão estratégica) — não tentar
  reabilitar

Estou pronto. Pode arrancar disparando agent recon do BLOCO 1.
