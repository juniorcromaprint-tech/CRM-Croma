# Handoff — Fase 3.2 Patch claudete_bot.py (Claude Code local)

> 2026-05-22 NOITE | Pausa do Cowork por consumo de tokens. Este handoff é auto-contido pra Claude Code local executar a Fase 3.2 sem reler toda a sessão.

## Como usar este handoff

Abra Claude Code (`claude`) no terminal dentro de `C:\Users\Caldera\Claude\JARVIS` e cole:

> Sou Junior. Continuação da Fase 3.2 do plano Claudete-via-ponte-Cowork.
> Lê primeiro:
> 1. `C:\Users\Caldera\Claude\CRM-Croma\docs\plano-ia\2026-05-22-handoff-fase-3.2-claude-code-local.md` (este arquivo, instruções completas)
> 2. `C:\Users\Caldera\Claude\CRM-Croma\docs\plano-ia\2026-05-22-claudete-mapa-tools.md` (arquitetura)
> 3. `C:\Users\Caldera\Claude\Scheduled\claudete-telegram-responder\SKILL.md` (SKILL Cowork que vai consumir a fila)
>
> Aplica princípios karpathy. Confirma antes de aplicar Edit grande.

## Objetivo

Patch cirúrgico em `C:\Users\Caldera\Claude\JARVIS\claudete_bot.py` (5501 linhas) que adiciona **roteamento híbrido**:
- Mensagens leves → caminho atual (Anthropic SDK direto, ~3-5s)
- Mensagens heavy (keywords como "screenshot", "navega", "abre app", "gera planilha", etc) → enfileira em `ai_requests` tipo='telegram-resposta' → SKILL Cowork claima → bot recebe resposta via poll em thread daemon

## O que NÃO mexer

- `responder_claude` (linha 4314-4437) — caminho rápido fica intacto
- Loop agêntico (4339-4404) — funciona, não regredir
- MCP Bridge, SupabaseDirectClient, SupabaseBridge — intactos
- Comandos `/start`, `/contas`, etc — intactos
- Whisper IN / ElevenLabs OUT — intactos

## Mudanças exatas

### 1. Adicionar 3 funções novas DEPOIS da linha 4437 (final de `responder_claude`) e ANTES da linha 4439 (header `# COMANDOS`)

```python
# ════════════════════════════════════════════════════════════════════
# PONTE COWORK — roteamento híbrido pra tasks heavy
# ════════════════════════════════════════════════════════════════════
COWORK_KEYWORDS = [
    "screenshot", "print da tela", "tira print", "tira foto",
    "abre o", "abre app", "abra o",
    "navega no", "navegar no", "abre site", "acessa site",
    "controla o", "controlar",
    "compra ", "comprar ", "reserva passagem", "reservar passagem",
    "preenche formul", "preencher formul", "clica em",
    "gera planilha", "gerar planilha", "gera xlsx", "gera excel",
    "gera apresenta", "gerar apresenta", "gera pptx", "gera slide",
    "gera docx", "gera word", "gera relatório formatado",
    "abre o gmail", "abre o slack", "abre o notion",  # MCPs externos
    "tira screenshot", "captura tela",
]

def precisa_cowork(user_msg: str) -> bool:
    """Decide se a mensagem precisa do poder Cowork (Windows-MCP, Chrome, Skills).
    
    True → enfileira em ai_requests pra SKILL Cowork claimar (~30-60s)
    False → caminho rápido Anthropic-direto (~3-5s)
    """
    if not user_msg:
        return False
    msg_lower = user_msg.lower()
    return any(kw in msg_lower for kw in COWORK_KEYWORDS)


def enfileirar_e_processar_cowork(bot, sb, chat_id: int, user_msg: str, 
                                    mensagem_era_audio: bool = False,
                                    nome_usuario: str = None) -> bool:
    """Enfileira ai_request tipo='telegram-resposta' e spawna thread daemon
    pra aguardar resposta via poll. Retorna True se enfileirou com sucesso.
    
    A thread daemon:
    1. Polla ai_responses WHERE request_id=X a cada 2s, até 120s
    2. Ao receber: envia texto + áudio + attachments via bot
    3. Salva memória pra ambos os lados
    """
    import uuid as _uuid
    
    request_id = str(_uuid.uuid4())
    conversation_id = f"telegram-{chat_id}"  # convenção: chat_id vira conv_id sintético
    
    contexto = {
        "chat_id": chat_id,
        "user_name": nome_usuario or "",
        "text_body": user_msg,
        "audio_transcription": user_msg if mensagem_era_audio else None,
        "is_audio": mensagem_era_audio,
        "is_image": False,
        "image_b64": None,
        "image_mime": None,
        "modelo_solicitado": modelo_atual(chat_id),
    }
    
    # Usa SupabaseDirectClient pra INSERT (SupabaseBridge não tem schema public)
    direct = get_supabase_direct()
    payload = {
        "id": request_id,
        "tipo": "telegram-resposta",
        "entity_type": "telegram_conversation",
        "entity_id": conversation_id,
        "contexto": contexto,
        "status": "pending",
    }
    
    try:
        result = direct.insert_returning("ai_requests", payload)
        if not result:
            log.error(f"[COWORK] Falha INSERT ai_requests pra chat_id={chat_id}")
            return False
    except Exception as e:
        log.error(f"[COWORK] Exception INSERT ai_requests: {e}")
        return False
    
    # Avisa o usuário que está processando
    bot.typing(chat_id)
    bot.send(chat_id, "🛠️ Tarefa pesada — usando Cowork. Te respondo em ~30-60s...")
    
    # Spawn thread daemon que vai pollar e enviar resposta
    th = threading.Thread(
        target=_thread_aguardar_cowork,
        args=(bot, sb, chat_id, request_id, mensagem_era_audio, user_msg),
        daemon=True,
        name=f"cowork-{chat_id}-{request_id[:8]}"
    )
    th.start()
    return True


def _thread_aguardar_cowork(bot, sb, chat_id: int, request_id: str,
                              mensagem_era_audio: bool, user_msg: str):
    """Roda em thread daemon. Polla ai_responses até 120s. Envia resultado via bot.
    
    NUNCA bloquear o main loop — esta função existe pra rodar em background.
    """
    direct = get_supabase_direct()
    cfg = get_config()
    
    inicio = time.time()
    TIMEOUT_S = 120
    POLL_INTERVAL_S = 2
    resposta = None
    
    while (time.time() - inicio) < TIMEOUT_S:
        try:
            rows = direct.select("ai_responses", {"request_id": f"eq.{request_id}"})
            if rows:
                resposta = rows[0]
                break
        except Exception as e:
            log.warning(f"[COWORK poll] {e}")
        time.sleep(POLL_INTERVAL_S)
    
    if not resposta:
        log.warning(f"[COWORK] Timeout {TIMEOUT_S}s aguardando request_id={request_id}")
        bot.send(chat_id, "⏱️ Cowork tá demorando muito. Vou tentar resolver pelo caminho rápido depois. Manda de novo se for urgente.")
        # Marca request como expired pra watchdog não pegar
        try:
            direct.patch("ai_requests", record_id=request_id, data={"status": "expired"})
        except Exception:
            pass
        return
    
    # Extrai dados da resposta
    conteudo = resposta.get("conteudo") or {}
    if isinstance(conteudo, str):
        try:
            conteudo = json.loads(conteudo)
        except Exception:
            conteudo = {"text": conteudo}
    
    texto = conteudo.get("text", "") or "Tarefa concluída."
    audio_recommended = conteudo.get("audio_recommended", False) or mensagem_era_audio
    attachments = conteudo.get("attachments", []) or []
    
    # Envia texto
    if texto:
        bot.send(chat_id, texto)
        memoria_salvar(_supabase_direct if hasattr(sb, 'get') else sb, chat_id, "user", user_msg)
        memoria_salvar(_supabase_direct if hasattr(sb, 'get') else sb, chat_id, "assistant", texto)
    
    # Envia áudio se recomendado
    if audio_recommended and texto:
        eleven_key = cfg.get("elevenlabs_api_key", "")
        if eleven_key:
            try:
                audio_bytes = sintetizar_voz(eleven_key, texto)
                if audio_bytes:
                    telegram_enviar_audio(cfg["telegram_token"], chat_id, audio_bytes)
            except Exception as e:
                log.warning(f"[COWORK] Falha audio OUT: {e}")
    
    # Envia attachments (photos, documents)
    for att in attachments:
        tipo = att.get("type")
        path = att.get("path")
        caption = att.get("caption", "")
        if not path or not Path(path).exists():
            continue
        try:
            with open(path, "rb") as f:
                files_data = f.read()
            url = f"https://api.telegram.org/bot{cfg['telegram_token']}/sendPhoto" if tipo == "photo" else f"https://api.telegram.org/bot{cfg['telegram_token']}/sendDocument"
            # Multipart upload — implementação simplificada
            # TODO: implementar via requests.post(url, files={'photo': files_data}, data={'chat_id': chat_id, 'caption': caption})
            log.info(f"[COWORK] Enviar {tipo}: {path} ({len(files_data)} bytes)")
            # Apaga arquivo temp após envio
            try:
                Path(path).unlink()
            except Exception:
                pass
        except Exception as e:
            log.warning(f"[COWORK] Falha attachment {path}: {e}")
    
    log.info(f"[COWORK] Concluído chat_id={chat_id} request_id={request_id} em {int(time.time()-inicio)}s")
```

### 2. Modificar `processar_comando` (linha 4793-4796)

**ANTES**:
```python
    else:
        # Comando desconhecido — trata como mensagem normal
        bot.typing(chat_id)
        resposta = responder_claude(client, cfg, chat_id, texto, sb)
        bot.send(chat_id, resposta)
```

**DEPOIS**:
```python
    else:
        # Roteamento híbrido: tasks heavy → Cowork, leves → Anthropic direto
        if precisa_cowork(texto):
            log.info(f"[ROUTE] chat_id={chat_id} → COWORK ('{texto[:60]}...')")
            nome_usuario = nome_para_chat_id(chat_id)
            sucesso = enfileirar_e_processar_cowork(bot, sb, chat_id, texto, 
                                                       mensagem_era_audio=False,
                                                       nome_usuario=nome_usuario)
            if not sucesso:
                # Fallback pro caminho rápido se enfileiramento falhar
                bot.typing(chat_id)
                resposta = responder_claude(client, cfg, chat_id, texto, sb)
                bot.send(chat_id, resposta)
        else:
            bot.typing(chat_id)
            resposta = responder_claude(client, cfg, chat_id, texto, sb)
            bot.send(chat_id, resposta)
```

### 3. Verificar se `SupabaseDirectClient` tem método `select` e `patch`

Checar linhas 391-560 do bot (classe SupabaseDirectClient). Se não tem `select(table, filters)`, adicionar — necessário pra polling.

Se não tem `insert_returning`, deve ter (mencionado no diagnóstico Claudete-mente). Confirmar.

## Critério PASS (teste E2E)

1. Reiniciar bot Python (`bot_watchdog.py` ou manual)
2. Mandar pelo Telegram (Junior chat_id=1065519625): **"oi"**
   - Esperado: resposta em ~3-5s (caminho rápido — `precisa_cowork('oi')` = False)
3. Mandar: **"tira print do dashboard Croma"**
   - Esperado: 
     - Imediato: "🛠️ Tarefa pesada — usando Cowork. Te respondo em ~30-60s..."
     - Em 30-90s: foto do dashboard recebida via Telegram
   - Verificar: `SELECT * FROM ai_requests WHERE entity_type='telegram_conversation' ORDER BY created_at DESC LIMIT 1` → status=completed
   - Verificar: `SELECT * FROM ai_responses WHERE request_id='<id>'` → conteudo.text + attachments

## Riscos conhecidos

1. **`SupabaseDirectClient` métodos faltando**: bot pode ter só `insert`, `insert_returning`, `get`. Precisa `select` + `patch`. Auditar antes.
2. **Multipart upload Telegram**: o código tem TODO no envio de attachments. Implementar com `requests.post(url, files={...}, data={...})` — padrão `requests` library.
3. **Schema `ai_requests`**: validar que aceita `tipo='telegram-resposta'` sem CHECK constraint. Migration adicional se necessário.
4. **Hot-reload**: as funções novas devem ser carregadas no restart do bot. Não há mecanismo de hot-reload pra Python — restart normal funciona.
5. **Thread daemon não logada se bot crashar mid-process**: aceitável, watchdog v4 pega via ai_requests status='processing' > 5min.

## Referências completas

- Mapa Claudete (gap analysis): `C:\Users\Caldera\Claude\CRM-Croma\docs\plano-ia\2026-05-22-claudete-mapa-tools.md`
- SKILL Cowork consumidora: `C:\Users\Caldera\Claude\Scheduled\claudete-telegram-responder\SKILL.md`
- SKILL irmã WhatsApp (referência): `C:\Users\Caldera\Claude\Scheduled\croma-whatsapp-responder\SKILL.md` (v7)
- Diagnóstico anti-mentira: `C:\Users\Caldera\Claude\CRM-Croma\docs\plano-ia\2026-05-22-diagnostico-claudete-mente.md`
- STATE atual: `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` (sessão NOITE 2026-05-22)

## Próximas fases (depois desta)

- **3.3**: Patch `ai-requests-fallback-watchdog` v3→v4 cobrir tipo='telegram-resposta' (fallback Anthropic + envio via Telegram Bot API direto se Cowork cair >5min)
- **3.4**: Teste E2E end-to-end já descrito acima
- **4**: Validar capabilities heavy reais (Skills docx/pptx/xlsx, MCPs externos)
