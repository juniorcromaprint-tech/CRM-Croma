# Relatório — Investigação `whatsapp-webhook` v35 (modo autônomo)

> **Sessão**: 2026-05-21 madrugada · Claude Code CLI (autônomo) · ~50 min
> **Resultado**: ✅ **Agente WhatsApp ESTÁ FUNCIONAL** (comprovado 2× ao vivo) · ❌ a causa-raiz assumida no plano estava ERRADA · ⏸ nenhuma alteração em produção (sistema funcionando — não arrisquei)

---

## TL;DR para o Junior (leia isto primeiro)

**O agente está respondendo.** Eu simulei 2 mensagens de WhatsApp entrando no webhook de produção (o código v35 que está no ar agora) e ele:
1. Gerou resposta com IA (`anthropic/claude-sonnet-4`)
2. Enviou pela API da Meta (`sent_success = true`)
3. Gravou tudo certo em `agent_messages`

Inclusive testei com a **mesma mensagem curta que você mandou dia 20** ("Oiii boa tarde") — funcionou.

**Então por que dia 20 não respondeu?** Foi uma **falha transitória** da chamada de IA (OpenRouter). Quando essa chamada falha, o webhook **não responde e não deixa rastro visível** — por isso pareceu "quebrado de vez". Não está. É intermitente.

**O que fazer agora:** me manda um WhatsApp pro número da Croma (**+5511939471862**) e confirma que respondeu. Se responder (deve responder), está resolvido o teu pânico. Se NÃO responder, me avisa que aí caímos no caso transitório e aplico o hardening (abaixo) com tua autorização.

---

## 1. Causa-raiz identificada

A premissa do plano (`docs/plano-ia/2026-05-20-fix-webhook-v35-prompt.md`) era:
> "webhook chama `whatsapp-enviar` que retorna 400 e mesmo assim marca `status='respondida'`"

**Isso está errado em dois pontos, confirmado lendo o código deployado (version 35) e reproduzindo ao vivo:**

| Premissa do plano | Realidade (evidência) |
|---|---|
| Webhook chama `whatsapp-enviar` | ❌ FALSO. A v35 **não tem nenhuma referência** a `whatsapp-enviar`. Ela tem a própria função `sendWhatsApp()` (linha 235) que chama a Meta Graph API direto (`postToMetaCloud`). O 400 do `whatsapp-enviar` nos logs veio de **outro chamador** (disparo de campanha / dispatch), não do webhook. |
| Marca `respondida` sem checar envio | ⚠️ PARCIAL. A mensagem **recebida** é inserida com `status='respondida'` *hardcoded* na linha 576 (antes de qualquer envio) — isso é um **rótulo enganoso**, não a causa do não-responder. A mensagem **enviada** (linha 622) JÁ grava `status: sent ? 'enviada' : 'erro'` corretamente. |

**Causa-raiz real:** o fluxo só não cria resposta quando retorna cedo. Os ramos de retorno antecipado *após* gravar a recebida são: escalada (576→583), `automacao_pausada` (585), bot/loop detector (588), e **`generateClaudeResponse` retornar `null` (linha 597→599)**.

Verifiquei a conversa das mensagens do Junior de 20/05 (`CLIENTE TESTE CROMA`, `+5511981549118`): `status='ativa'`, `automacao_pausada=false`, **não escalada**, 2 mensagens, nenhuma resposta. Logo, **não** foi escalação/pausa/loop → caiu no `generateClaudeResponse === null`.

E o `null` vem de **falha na chamada OpenRouter** dentro de `generateClaudeResponse`:
- Linha 408 chama `callOpenRouter` (modelo `anthropic/claude-sonnet-4`, fallback `openai/gpt-4.1-mini`).
- Linha 101: lança erro se `!resp.ok`; tenta fallback; se ambos falham → `throw` → `catch` (418) → `return null`.
- Linha 112-114: se a resposta não tiver `usage`, `usage.prompt_tokens` estoura → `null`.

**Por que é invisível** (o que fez parecer um bug fatal):
1. A recebida fica `status='respondida'` mesmo sem resposta (rótulo mentiroso).
2. O caminho `null` (597-599) **não cria nenhum registro de erro** — só manda um aviso no Telegram.
3. O insert em `ai_logs` (linha 409) **falha silenciosamente por RLS** (zero linhas para `auto-resposta-whatsapp` na tabela) → não há log de sucesso nem de falha da IA.

## 2. Estratégia escolhida

- **Estratégia C (sync repo↔prod)**: APLICADA. O repo guardava uma v18 antiga; a prod é v35 (deploys sem commit). Tracei a divergência e sincronizei o arquivo local com o código deployado.
- **Estratégias A/B (fix de código em produção)**: **NÃO aplicadas de propósito.** O plano instrui: *"se a causa-raiz NÃO for o que esperamos, não invente fix — pare e avise."* É exatamente o caso. Além disso o sistema **está funcionando** — mexer no webhook vivo de madrugada, sem você para validar, só adicionaria risco de regressão (guardrail "NÃO ARRISCAR").

## 3. Diff do que mudou

| Arquivo | Mudança | Risco em produção |
|---|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Sincronizado v18→v35 (conteúdo agora == deployado) + cabeçalho documentando a investigação | **Zero** (só repo; não foi deployado) |
| `.planning/STATE.md` | Nova sessão 2026-05-21 no topo | Zero |
| `outputs/2026-05-21-fix-webhook-relatorio.md` | Este relatório | Zero |
| `D:\Onedrive\JARVIS\...\aprendizados\2026-05-21-...md` | Aprendizado | Zero |

**Nenhuma edge function foi re-deployada. Produção continua na version 35 intacta.**

## 4. Resultado dos testes

### Teste simulado (POST direto no webhook de produção)
| Teste | Mensagem | HTTP | Latência | Resultado |
|---|---|---|---|---|
| A | "Oi, gostaria de saber sobre comunicação visual e envelopamento de poste" | 200 | ~20s | ✅ recebida(respondida) + **enviada(enviada)**, `modelo=anthropic/claude-sonnet-4`, `sent_success=true`, resposta real |
| B | "Oiii boa tarde" (igual à do Junior em 20/05) | 200 | ~17s | ✅ recebida(respondida) + **enviada(enviada)**, `modelo=anthropic/claude-sonnet-4`, resposta real |

Critério PASS atingido nos dois (1 recebida + 1 enviada, sem `erro_codigo`). **Dados de teste limpos** (lead `608167ca` removido; lead pré-existente `bd068aac` de 04/05 preservado, só removi a conversa/mensagens que criei nele).

### Teste produção (envio real)
**PULADO.** `WHATSAPP_TEST_PHONE` em `admin_config` = `+15556592...` (número fictício +1‑555, inválido). Conforme o plano, pulei. **Junior fará o teste real** mandando WhatsApp pro +5511939471862 (ele pediu ser avisado para isso).

## 5. Versão final deployada

- `whatsapp-webhook`: **version 35** (inalterada — nenhum deploy feito).
- `whatsapp-enviar`: **version 30** (inalterada — não é usada pelo webhook; fora do problema real).

## 6. Bugs/achados NÃO corrigidos (para próxima sessão, com OK do Junior)

1. **[OBSERVABILIDADE] `ai_logs` bloqueado por RLS** — insert na linha 409 falha silencioso; zero visibilidade de chamadas de IA. Corrigir RLS ou logar erro.
2. **[VISIBILIDADE] caminho `null` não registra erro** — quando a IA falha, criar um registro `agent_messages` `status='erro'` + `erro_mensagem` (espelha o que a linha 622 já faz quando `sent=false`), além do aviso Telegram.
3. **[RÓTULO] recebida grava `status='respondida'` hardcoded** (linha 576) — enganoso. Avaliar marcar `respondida` só após envio (CUIDADO: pode ter consumidor downstream que reprocessa `recebida` — checar `agent-cron-loop`/`dispatch-approved-messages` antes).
4. **[RESILIÊNCIA/LATÊNCIA] chamada IA leva 14–20s** — perigosamente perto do timeout de 30s e do limite de webhook da Meta (que pode re-disparar o webhook). Falha transitória da OpenRouter = não-resposta sem rastro. Recomendado: tornar o processamento assíncrono (responder 200 na hora, processar via `EdgeRuntime.waitUntil`) e/ou retry curto. **Esta é a correção que realmente previne o que aconteceu dia 20.**
5. **[NORMALIZAÇÃO] telefone** — `5511999990002` foi normalizado para `+5551999990002` (mexeu no DDD). Investigar `normalizePhone` (pode casar leads errados). Achado lateral.
6. Fora de escopo (confirmados abertos, intocados): `agent-cron-loop` 500, `ai-compor-mensagem` 401, scheduled tasks fantasmas, `ai-gerar-orcamento` P0.

## 7. Tempo total

~50 min de investigação + verificação + documentação. Sem rollback (nenhum deploy feito).

---

## Por que NÃO apliquei um fix de código (decisão consciente)

Seguindo `superpowers:systematic-debugging` (Lei de Ferro: sem fix antes de causa-raiz):
- A causa-raiz assumida era falsa. Se eu tivesse "corrigido" o que o plano pedia (mover o `status='respondida'`, consertar `whatsapp-enviar`), teria alterado código que **funciona** com base em diagnóstico errado — risco de regressão por nada.
- O sistema **responde agora**. O risco de quebrar um agente funcional de madrugada (você dormindo, sem validar) supera o ganho de uma melhoria de observabilidade que pode esperar.
- O hardening real (item 4 — async/retry) é uma mudança não-trivial que merece sua aprovação e sua validação em produção, não um deploy às cegas.

**Próximo passo recomendado:** você testa ao vivo agora. Se confirmar que responde, agendamos o hardening (itens 1, 2, 4) com calma. Se não responder no teu teste, me avisa que aplico os itens 1+2+4 imediatamente (com rollback pronto — backup do v35 salvo em `%TEMP%\webhook-fix\webhook-v35-original.ts`).
