
# STATE — CRM Croma

**Última sessão**: 2026-05-21 MANHÃ (Claude Code CLI autônomo — MIGRAÇÃO OpenRouter Onda 1: webhook v36 + ai-gerar-orcamento v12 agora chamam Anthropic API DIRETO. E2E PASS. Ondas 2-3 aguardam OK.)

## Sessão 2026-05-21 MANHÃ — ELIMINAR OPENROUTER (ONDA 1) ✅

### Resultado
✅ **OpenRouter eliminado de 2 funções** (Fase 0 + Onda 1 do plano `docs/plano-ia/2026-05-21-eliminar-openrouter-prompt.md`):
- `whatsapp-webhook` → **v36** (verify_jwt=false preservado): `callOpenRouter` inline reescrito p/ Anthropic API direto (`claude-sonnet-4-20250514`, fallback `claude-haiku-4-5-20251001`).
- `ai-gerar-orcamento` → **v12** (verify_jwt=true): import trocado p/ `anthropic-provider.ts` (drop-in).
- **E2E PASS**: POST simulado → `agent_messages.enviada` com `modelo_ia=claude-sonnet-4-20250514` (prova provider direto), resposta real, `sent_success=true`. Evidence: `outputs/2026-05-21-evidence-onda1.json`.

### Hardening aplicado (na janela)
- **Achado #2** (visibilidade no-reply): caminho `IA null` agora cria `agent_messages status='erro' erro_codigo='IA_NULL'` (antes só Telegram).
- **Achado #1** (ai_logs vazio): **causa real era `user_id NOT NULL`** (não RLS — rls_forced=false). Migration **158**: `user_id` nullable + policy INSERT corrigida `public`→`service_role`. ai_logs voltou a capturar (comprovado: 2123/470 tokens, $0,0134).

### Descobertas / pendências
- ⚠️ **ai-gerar-orcamento: prod v11 era MAIS ANTIGA que o repo**. Deploy v12 trouxe a prod ao nível do repo. Fórmula de preço idêntica (totais não mudam); deltas = cota mais / pede menos esclarecimento. Snapshot v11 salvo p/ rollback (`%TEMP%\openrouter-migration\`).
- ai-gerar-orcamento lookup de lead retornou 404 no teste leve (pré-existente, antes da IA, idêntico ao v11 — não é regressão). Investigar fluxo de orçamento em prod (degrada gracioso).
- `OPENROUTER_API_KEY` **mantida** (secret + admin_config) — não revogar até validar 7 dias.
- Função temp `smoketest-anthropic` deployada p/ smoke test, depois neutralizada (v2). Deletar pelo dashboard.

### Aguardam OK explícito do Junior
- **Onda 2**: ai-qualificar-lead, ai-compor-mensagem, ai-detectar-intencao-orcamento.
- **Onda 3**: ai-analisar-orcamento, ai-resumo-cliente, ai-briefing-producao, ai-detectar-problemas, ai-composicao-produto, ai-classificar-extrato.
- **Limpeza final** (após 7 dias OK): deprecar `openrouter-provider.ts`, remover `OPENROUTER_API_KEY`, revogar no painel OpenRouter, deletar `smoketest-anthropic`.

Relatório completo: `outputs/2026-05-21-eliminar-openrouter-relatorio.md`.

---

## Sessão 2026-05-21 MADRUGADA — INVESTIGAÇÃO WEBHOOK v35 (causa-raiz refutada, agente funcional)

### Resultado
✅ **Agente WhatsApp responde** — simulei 2 POSTs no webhook de produção (v35), incl. a mesma msg curta do Junior de 20/05 ("Oiii boa tarde"): ambos geraram resposta `anthropic/claude-sonnet-4` e enviaram via Meta (`sent_success=true`).
❌ A premissa do plano estava errada. ⏸ **Zero alteração em produção** (sistema funcionando — guardrail "NÃO ARRISCAR" + "não invente fix se causa-raiz difere").

### Causa-raiz refutada
- Webhook v35 **NÃO chama `whatsapp-enviar`** — tem `sendWhatsApp()` própria (Meta Graph direto). O 400 do `whatsapp-enviar` nos logs era de outro chamador (disparo).
- A v35 já grava `status: sent ? 'enviada' : 'erro'` (linha 622). A recebida é que tem `status='respondida'` hardcoded (linha 576) — rótulo enganoso, não a causa.
- **Causa real**: `generateClaudeResponse` retorna `null` por **falha TRANSITÓRIA da OpenRouter**, invisível porque (1) recebida fica 'respondida', (2) caminho null não cria erro, (3) `ai_logs` insert bloqueado por RLS. Latência IA 14-20s (perto do timeout 30s).

### Ações executadas
1. ✅ Puxado v35 deployado (632 linhas) → backup em `%TEMP%\webhook-fix\webhook-v35-original.ts`
2. ✅ **Sync repo↔prod** (estratégia C): `supabase/functions/whatsapp-webhook/index.ts` atualizado v18→v35 + cabeçalho documentando. Resolve a divergência não-rastreada.
3. ✅ 2 testes simulados PASS + limpeza de dados (lead teste removido; lead pré-existente 04/05 preservado)
4. ✅ Relatório `outputs/2026-05-21-fix-webhook-relatorio.md` + aprendizado Obsidian
5. ⏸ Hardening NÃO aplicado (aguarda OK do Junior + validação dele)

### Pendente do Junior (ele pediu para ser avisado e testar)
- **Junior testa ao vivo**: mandar WhatsApp pro +5511939471862 e confirmar resposta. Se responder → resolvido. Se não → aplicar hardening (RLS ai_logs + registro de erro + async/retry) com rollback pronto.
- Hardening recomendado (com aprovação): (1) RLS `ai_logs`, (2) registro `status='erro'` no caminho null, (3) processamento assíncrono via `EdgeRuntime.waitUntil` + retry curto (item que de fato previne o que houve em 20/05).
- `WHATSAPP_TEST_PHONE` em `admin_config` é fictício (+1‑555) — corrigir para testes automáticos futuros.

---

## Sessão 2026-05-20 NOITE — TEMPLATES META + LIMPEZA TUDO

### Contexto
Junior achava que "tínhamos eliminado OpenRouter e Claude (Cowork) respondia WhatsApp direto". Investigação noturna esclareceu mitos e descobriu bugs em produção.

### Achados principais

**OpenRouter ainda ativo**: 11 Edge Functions usam. Decisão de 30/03 nunca foi executada. Drop-in pra Anthropic existe (`anthropic-provider.ts` linha 93: `export const callOpenRouter = callAnthropic`).

**Ponte Cowork — descobriu o histórico real**:
- 24/04 (Sprint Estabilização IA): criada `mcp-bridge-worker` Edge Function + tabelas `ai_requests`/`ai_responses` + hook `useAIBridge.ts`
- Worker NÃO conecta no Cowork — `resumo-cliente` tem handler SQL determinístico; outros tipos re-invocam Edge Functions OpenRouter
- 2 scheduled tasks (`whatsapp-auto-responder` + `croma-ai-request-processor`) que CONECTAVAM Cowork foram DESATIVADOS em 02/04 e os SKILL.md DELETADOS em 17-18/04. Sobrou só fantasma no registry.

**WhatsApp inbound bugado HOJE**: 2 testes Junior (19:53, 20:02) → webhook v35 gravou `status='respondida'` mas `respondido_em=null`, `modelo_ia=null`, sem resposta enviada. Bug do webhook v35 (não rastreado no git — repo local v18).

**195 erros desde 15/05 — códigos Meta confirmados**:
- 50× 132000 (template inválido, parâmetros vazios `["","",""]`)
- 49× 131047 (janela 24h fechada)
- 16× 131026 (undeliverable)

**Templates Meta — banco dessincronizado**: 13 APPROVED na Meta mas `meta_template_name = NULL` no banco. Sincronização feita nesta sessão.

### Ações executadas

1. ✅ `WHATSAPP_ACCESS_TOKEN` validado: SYSTEM_USER NEVER_EXPIRES, escopo `whatsapp_business_management` OK
2. ✅ 4 templates novos PENDING na Meta (submetidos via Graph API):
   - `croma_abertura_varejo` (322 leads Varejo)
   - `croma_abertura_calcados` (779 leads Calçados — maior volume sem template)
   - `croma_abertura_industria` (20 leads)
   - `croma_abertura_franquia`
3. ✅ Banco sincronizado: 6 APPROVED + 3 PENDING populados em `agent_templates.meta_template_name`
4. ✅ Aprendizado salvo: `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-05-20-noite-templates-meta-ponte-cowork.md`
5. ✅ Docs atualizados: `STATE.md`, `MAPA-IA-CROMA.md`
6. ✅ Plano `docs/plano-ia/2026-05-20-plano-eliminacao-openrouter.md` marcado como SUPERSEDED por este STATE (Junior não autorizou execução; OpenRouter mantido por enquanto)

### Bugs ABERTOS (pra próxima sessão)
1. `agent-cron-loop` em loop de erro 500 — gera spam 401 contra `ai-compor-mensagem`. Cron rodando mas falhando tudo.
2. `ai-compor-mensagem` retorna 401 mesmo com service_role — fix S2.6 nunca foi aplicado (Grupo B do checklist).
3. Webhook v35 marca `status='respondida'` antes de enviar — esconde falhas. Diferença com repo local v18 NÃO RASTREADA no git.
4. Scheduled tasks fantasmas (`whatsapp-auto-responder`, `croma-ai-request-processor`) no registry sem arquivo em disco.

### Decisões PENDENTES (próxima sessão)
- Decidir destino dos SKILLs fantasmas: reescrever (se a ponte Cowork voltar) ou remover do registry
- Investigar webhook v35 vs v18 (puxar `get_edge_function whatsapp-webhook` e diff com repo)
- Aplicar fix S2.6 em `ai-compor-mensagem`
- Verificar status das 4 PENDING templates (24h)

---

## Sessão 2026-05-20 — AUDITORIA LEADS+AGENTE + INVESTIGAÇÃO PROVIDER IA (só auditoria)

### Contexto
Junior pediu auditoria completa (17 seções) do fluxo de Leads + Agente de Vendas IA, ótica de uso DIÁRIO pela equipe comercial e "IA ajudando sem colocar a empresa em risco". Pediu entregar SÓ auditoria + plano; execução das correções fica para depois, com autorização explícita.

### Entregue
- **Relatório**: `docs/qa-reports/2026-05-20-auditoria-leads-agente-vendas.md` (17 seções, evidência arquivo:linha + dados de produção via MCP). Cruzado com REQUIREMENTS v4–v7 e memória 2026-05-18.
- 2 agentes paralelos auditaram frontend (Leads) e backend (Edge Functions do agente).
- ⚠️ A auditoria de 2026-05-18 citada na memória apontava p/ `docs/qa-reports/2026-05-18-...md` que **nunca foi salvo** — agora existe relatório real (20/05).

### Números reais (produção, via MCP)
- 3.456 leads; 3.127 em "novo" (90%), 100% parados +7d; 1.741 sem email. Só 4 convertidos (~0,12%).
- 12 propostas, 8 pedidos. Agente: 828 mensagens, 195 erro (23,5%), parado desde 15/05.

### P0 (empresa em risco AGORA — antes de religar o agente)
1. `whatsapp-webhook` aceita payload sem validar signature (`WHATSAPP_APP_SECRET` ausente → `return true`).
2. `ai-gerar-orcamento` SEM autenticação própria.
3. Sem `supabase/config.toml` → `verify_jwt` não versionado.
4. Orçamento formal + PIX enviado AUTOMÁTICO via WhatsApp, sem trava de dados (`checkDadosFaltantes` não existe em código) e sem aprovação humana (apesar de `auto_aprovacao=false`).

### Investigação do PROVIDER de IA (Junior insistiu "não é OpenRouter, é Claude")
**Veredito definitivo — 4 fontes, incluindo o CÓDIGO DEPLOYADO lido via Supabase MCP `get_edge_function`:** o agente do WhatsApp usa **OpenRouter** (`fetch https://openrouter.ai/api/v1/...`, `OPENROUTER_API_KEY` presente `sk-or-…`). Resposta = `claude-sonnet-4` via OpenRouter; qualificação = `glm-4.5-air:free`; composição = `gpt-4.1-mini`. NÃO usa MCP, prompt estático.
- Confusão do Junior: **a Claudete (Telegram) é que é Claude direto + MCP** (`anthropic-provider` + `ANTHROPIC_API_KEY`). Dois sistemas distintos.
- Os 195 erros NÃO são IA/crédito — são **entrega Meta WhatsApp**: 49× cód 131047 (janela 24h fechada → exige template), 50× cód 132000, 71× undeliverable. Agente parou em 15/05 por tentar texto livre fora da janela de 24h.
- `modelo_ia`/`custo_ia` (colunas) ficam NULL/0 porque o webhook grava o modelo dentro de `metadata` (jsonb), não na coluna.

### Decisões PENDENTES do Junior (próxima sessão)
1. Provider do agente: migrar p/ **Claude direto** (`anthropic-provider`, drop-in) OU manter OpenRouter. Junior tende a "só Claude, sem externo". Antes: confirmar saldo `ANTHROPIC_API_KEY`.
2. Cadência por **template** (resolver agente parado desde 15/05) — candidato a P1.
3. Autorizar execução: começar pela **Fase 0** (segurança).

### Estado final
- NADA de código alterado (pedido explícito). Só relatório + vault + auto-memória.
- Pendências estruturais antigas (#12 useClientes excluido_em, #13 contato_nome, #14 conversão clona empresa) seguem válidas e estão refletidas no relatório.

---

## Sessão 2026-05-15 — PROPOSTA SI/MARCOS + 2 FIXES UX

### Contexto
Junior converteu lead via Agente IA (lead `43f55137` veio de scraping Google Maps, sem contato_nome). Cliente novo: **SI - Câmeras, Cerca Elétrica e Alarmes.** (CNPJ `64668836000141`, ID `1efdd402-...`). Pediu replicar PROP-2026-0027 (Grupol — 3 modelos de poste).

### Entregas
1. **PROP-2026-0029 criada** — réplica idêntica da Grupol: 3 alternativas de poste (quadrado/redondo/sextavado × 3m), R$ 7.315, validade 7 dias, status rascunho. ID `19b99fe6-0bbb-4129-a050-6a856a12dae5`.
2. **Cliente SI / contato corrigido**:
   - `cliente_contatos.nome`: "SI - Câmeras…" → **"Marcos"** (contato principal, decisor)
   - `leads.contato_nome` (43f55137): NULL → **"Marcos"** (histórico)
3. **Fix busca de clientes** (commit `694cd1b`, em produção): hoje só achava com nome 100% igual.
   - Adiciona `telefone`, `cidade`, `cpf_cnpj` à OR principal
   - Padrão **digits-loose** para CNPJ (ex: "64668836" agora casa "64.668.836/0001-41")
   - Segunda query em `cliente_contatos` (nome/telefone/whatsapp) → injeta `id.in.(...)` na OR principal — resolve buscar pelo nome do contato quando razão social é diferente
   - Novos helpers em `searchUtils.ts`: `digitsOnly()` e `digitsLooseTerm()`
4. **Fix tela de orçamento** (commit `1504299`, em produção):
   - Removido botão "Enviar" duplicado (`SharePropostaModal.activateToken()` já marca status=enviada)
   - SELECT do cliente em `orcamento.service.ts` agora inclui `telefone`, `email` e embed `cliente_contatos`
   - `OrcamentoViewPage` calcula fallback: `telefone = cliente.telefone ?? contato_principal.whatsapp ?? contato_principal.telefone`; idem email
   - **WhatsApp agora abre `wa.me/{telefone}?text={mensagem com link da proposta}`** já preenchido (Junior validou em produção)
   - Email pré-popula com email do cliente/contato (vazio se ambos NULL — comportamento correto)
5. **Credencial git "sramos-pix" removida** do Windows Credential Manager (estava bloqueando push HTTPS apesar do `user.email` correto). Restou só uma da API GitHub CLI que não bloqueia nada.

### Pendências registradas para próximas sessões
- **Task #12 [BUG-PRE-EXISTENTE]** — `useClientes.ts:85` filtra por `.is('excluido_em', null)` mas a coluna **não existe** em `clientes`. Provável erro silencioso. `useHardDeleteCliente` também usa. Decidir: criar coluna (soft delete) ou remover o filtro.
- **Task #13 [BUG-IA-1]** — Agente IA WhatsApp não atualiza `leads.contato_nome` quando descobre o nome durante a conversa. Adicionar tool `ai_atualizar_lead({lead_id, contato_nome, cargo?, email?})` e instruir o prompt a chamar sempre que cliente se identificar.
- **Task #14 [BUG-IA-2]** — Conversão lead→cliente clona `empresa` para nome do contato quando `contato_nome` é NULL. Deveria perguntar (interativo) ou marcar como "A definir". Foi exatamente o que aconteceu com o Marcos. Verificar edge function `ai-converter-lead` ou `clienteService`.

### Diagnóstico cruzado
O bug do Junior ("buscar Marcos não acha SI") tem **duas causas independentes**:
1. **Hook de busca limitado** (corrigido em 694cd1b)
2. **Dado errado no banco** (Marcos nunca foi gravado como contato — corrigido manualmente, mas Tasks #13/#14 vão evitar acontecer de novo com novos leads)

### Aprendizados registrados
- `Obsidian/10-Projetos/Croma-Print/aprendizados/2026-05-15-busca-clientes-e-conversao-lead.md`

### Status final
- Sistema operacional, 2 fixes em produção, proposta nova como rascunho aguardando Junior disparar
- Vault atualizado: STATE.md + memory.md + daily + aprendizado
- 3 pendências documentadas (#12 #13 #14) para sessões futuras

---

## Sessão 2026-05-12 tarde — AUDITORIA + RESTAURAÇÃO COMMIT TRUNCADO

### Contexto
Junior trouxe revisão feita por outra IA (Codex em worktree `.codex\worktrees\90f1\CRM-Croma`) apontando 5 problemas críticos no `main`:
1. P0: 4 arquivos truncados no commit `1ea65d0` (build/deploy quebrados)
2. P1: incompatibilidade `lead.classificacao` (texto livre) → `clientes.classificacao` (CHECK A/B/C/D)
3. Whitespace em massa em `useLeadsDisparo.ts`
4. Lógica de conversão de lead duplicada em 2 páginas

### Verificação
Confirmei TODOS os achados batendo arquivo por arquivo. Truncamentos exatos:
- `whatsapp-enviar/index.ts`: 366 linhas (era 419), corta em `if (!mr.ok) { // v26…`
- `useWhatsAppStatus.ts`: 134 linhas (era 158), corta em `.select('valor')`
- `WhatsAppStatusCard.tsx`: 163 linhas (era 169), corta em `onClick={() =`
- `useLeadsDisparo.ts`: 471 linhas (era 475), corta no objeto de retorno do `useLeadsDisparoMeta`

### Restauração (6 arquivos finais)
Estratégia: pegar versão íntegra de `HEAD~1` (`a88a168`) via `git show` (não precisa do índice — útil porque o índice estava corrompido), copiar pro working tree, reaplicar manualmente as mudanças funcionais do `1ea65d0` (RPCs `fn_contar_enviadas_hoje` + `fn_limite_diario_efetivo`, contador `todayAttempts`, display de tentativas com erro).

| Arquivo | Linhas finais | O que foi feito |
|---|---|---|
| `supabase/functions/whatsapp-enviar/index.ts` | 434 | Restaurado HEAD~1 + header v27 + bloco pre-check com RPCs |
| `src/domains/agent/hooks/useWhatsAppStatus.ts` | 188 | Restaurado HEAD~1 + `todayAttempts` no tipo + RPCs + attemptsCount |
| `src/domains/agent/components/WhatsAppStatusCard.tsx` | 177 | Restaurado HEAD~1 + bloco display tentativas com erro |
| `src/domains/comercial/hooks/useLeadsDisparo.ts` | 475 | Restaurado HEAD~1 (sem mudança funcional — 1ea65d0 só introduzia whitespace) |
| `src/domains/comercial/pages/LeadDetailPage.tsx` | +5 | Fix P1: mapeamento `classificacao` para A/B/C/D ou null |
| `src/domains/agent/pages/AgentConversationPage.tsx` | +5 | Fix P1: mesmo mapeamento aplicado lá |

### Problemas operacionais encontrados no caminho
1. **Índice git corrompido** (`error: bad signature 0x00000000`) — resolvido com reinicialização da máquina (Junior).
2. **Locks git fantasma** (`HEAD.lock` desde 11/05 16:42, `index.lock` desde 12/05 13:39) — sobrevivem ao reboot mas o git ignora, não atrapalham.
3. **Editor sobrescrevendo Edits** — VS Code/Cursor com os 3 arquivos do WhatsApp abertos estava revertendo meus patches em tempo real. Resolvido com reboot.

### Pendências para Junior
1. ~~Verificar migration 157 aplicada no banco~~ ✅ CONFIRMADO aplicado (RPCs respondem)
2. ~~Commit + push dos 6 arquivos~~ ✅ FEITO: `63bd729` pushado pra origin/main
3. ~~Redeploy edge function `whatsapp-enviar` v27~~ ✅ FEITO via MCP Supabase (version 30 ativa)
4. (Opcional) Refatorar duplicação da lógica de conversão de lead → helper compartilhado.

### Aprendizados registrados
- `10-Projetos/Croma-Print/aprendizados/2026-05-12-commit-1ea65d0-truncado.md` — diagnóstico, sintomas e como evitar.

---

## Sessão 2026-05-12 tarde (parte 2) — FECHAMENTO AUTÔNOMO: CAMPANHA + ENRIQUECIMENTO 35 LEADS

Após o commit `63bd729` pushado, Junior pediu pra resolver todos os pontos em aberto. Apliquei autonomia máxima (CLAUDE.md regra #1) e executei.

### O que foi feito (sequência)
1. **Lead Coliseu ajustado** — `classificacao=NULL`, `contato_nome=NULL`, sócios Receita movidos pra `observacoes`.
2. **Criada campanha "Prospecção Segurança SP"** em ambas as tabelas:
   - `agent_campanhas` id=`ebc7b6f3-9c17-447a-8482-62f6ed9972af` (canal=whatsapp)
   - `campanhas` legacy id=`2bce42e5-9b20-4c24-b1b4-565116a45343` (origem=prospeccao)
3. **35/35 leads atribuídos** à campanha legacy (FK exige `campanhas`, não `agent_campanhas`)
4. **Pre-enriquecimento via regex**: CEP + bairro extraídos do `endereco` para 35/35
5. **Enriquecimento via WebSearch + BrasilAPI** (gratuita, sem chave):
   - **18/35 enriquecidos** com razão social + CNPJ + CNAE + situação + sócios (51% sucesso)
   - **1 descartado** — Sekron Digital com CNPJ INAPTO na Receita Federal
   - **17 sem CNPJ** — empresas pequenas/genéricas. Mantidos dados originais. Anti-alucinação: não chutei.

### Aprendizados técnicos importantes
- **Sistema tem 2 conceitos de campanha**: `campanhas` (legacy, FK leads.campanha_id) vs `agent_campanhas` (agente IA, sem FK direta com leads). Para campanha unificada: criar em ambas.
- **leads.status CHECK**: aceita novo, contato, contatado, em_contato, qualificando, qualificado, proposta, negociacao, ganho, perdido, convertido, descartado. NÃO existe `bloqueado`.
- **campanhas.origem CHECK**: email, redes_sociais, indicacao, prospeccao, evento, outro.
- **Workflow gratuito de enriquecimento**: WebSearch nome+CNPJ → BrasilAPI (3 req/min, sem chave) → UPDATE com observacoes consolidadas. Se CNPJ INAPTO: setar `status='descartado'` + `motivo_descarte`.

### Leads enriquecidos com CNPJ (18)
Coliseu Segurança, ADT, Allarmi, SUHAI, Telewalt, Vigilante Free, Sekron (INAPTO→descartado), EletroportSeg, MultiSAFE, Newsafe, BR Lock Securit, Power Segurança, ARS/Delta Gr, Grupo Arkanjos, Siguri, Locacess & Locatronic, Nexus Security, STS Alarmes.

### Status final
- 35 leads no CRM, em campanha, parcialmente enriquecidos
- Sistema 100% operacional, sem trabalho acumulado
- Vault atualizado: STATE.md + memory.md + daily + aprendizado

---

## Sessão 2026-05-11 (parte 2 — manhã) — FIX BUG CESTA + DISPARO LOTE 1 INICIADO

### Bug crítico encontrado e corrigido
**Sintoma**: ao tentar marcar os 11 leads do lote 1 via UI (buscas diferentes), a cesta zerava a cada nova busca. Junior pediu fix definitivo (não atalho/gambiarra).

**Causa raiz**: linha 119 do `LeadsPage.tsx` chamava `selection.clear()` dentro de `setFilters` — toda mudança de filtro/busca zerava a cesta.

**Fix (commit `34d338e` em main)**:
1. `useLeadsSelection.ts` v2 — persistência em `sessionStorage` (key: `leads-cesta-selection`). State inicializa via `readInitialIds()`, useEffect persiste a cada mudança. Sobrevive a filtro, busca, paginação e reload.
2. `LeadsPage.tsx` — removido `selection.clear()` de `setFilters`. Comentário explicativo da nova behavior.
3. Bonus: `buscar-leads-google v15` (já estava do disparo desbloqueio).

**Validação via Chrome MCP**: marcados 11 leads do lote em 9 buscas diferentes (DEMOCRATA, BEIRA RIO, LOJAO DO BRAS, JACAREI CALCADOS, PALMIPE, NARDUCCI, LOJAS JB, OMEE, SHOEMAX, BECKER, ZUKEN). Final: cesta com 11 leads selecionados, sessionStorage com 11 UUIDs corretos do lote 1. ✅

### Modal de disparo aberto
- Canal: Email
- Template galeria mostrada: 4 opções (Franquia, Indústria, Varejo, Genérico)
- Junior assumiu o controle pra finalizar o disparo manualmente
- Junior removeu BEIRA RIO da cesta (template "Abertura Varejo" cita Beira Rio como cliente — conflito)
- Cesta final no disparo: **10 leads**

### Próximos passos
- Junior dispara via UI (eu monitoro webhooks `email_events` depois)
- BEIRA RIO fica pra disparo separado com email customizado (pendente)
- Quarta 13/05: WhatsApp pros que não responderem (cadência sequencial)

### Pendente da sessão
- Implementar opção C — modal canal "Ambos" (WhatsApp + Email simultâneo). Aprovado pra fazer como feature futura.

### Sessão 2026-05-11 (parte 3 — pós-disparo) — 6 melhorias UX implementadas

Após Junior fazer o disparo manual, deu feedback sobre 8 pontos de UX. Eu rankei + implementei os 6 aprovados:

**Commit `f69d55f` em `origin/main` (Vercel auto-deploy):**

- ✅ #2 Stepper: "Abertura" → "Template"
- ✅ #3 Preview HTML real do email em iframe sandbox (com banner, formatação, assinatura). Botão "Ver email completo" no passo Template.
- ✅ #4 AlertDialog de confirmação final antes do disparo (regra `e.preventDefault()` aplicada). Mostra resumo: template, modo, próxima janela, com aviso "irreversível".
- ✅ #5 Pills de Score visíveis: Todos / Quente (70+) / Morno (30-69) / Frio (<30) ao lado de Segmento. Antes só ficava em "Mais filtros".
- ✅ #7 Busca livre expandida: agora indexa empresa, contato_nome, telefone, telefone2, whatsapp, contato_telefone, email, email2, contato_email. Permite buscar por domínio do email (ex: "lojasbecker" pega lead com @lojasbecker.com.br).
- ✅ #8 Salvar lista pós-disparo como segmento + carregar segmento na cesta. Nova tabela `public.lead_segments` (migration 150, com RLS), hook `useLeadSegments`, componente `SegmentoSalvoLoader` (Sheet à direita), UI no passo Resultado do modal.

**Rejeitado (Junior decidiu não precisar)**: #1 Warning anti-conflito de template (Beira Rio já é cliente ativo, não vai mais ser destinatário).

**Pendente**: #6 → task #14 (modal canal "Ambos") ✅ **IMPLEMENTADO** no commit `6a5e6ae`.

### Sessão 2026-05-11 (parte 4 — final) — Modal canal "Ambos" implementado

**Commit `6a5e6ae` em `origin/main` (Vercel auto-deploy):**

Modal DispararAberturaModal aceita canal "Ambos" (WhatsApp + Email simultâneos):

- Novo tipo local `CanalSelecionado = 'whatsapp' | 'email' | 'ambos'`. Hook `useDispararAbertura` mantém tipo `CanalDisparo` binário (zero refactor invasivo no banco/RPC).
- `CanalToggle` vira 3 botões com count específico por modo.
- Step Template: 2 mini-galerias lado a lado em 'ambos' (1 WhatsApp + 1 Email) com `templateIdWhatsapp` + `templateIdEmail` independentes. Novo componente `MiniGaleria`.
- `handleDisparar` em 'ambos': 2 chamadas sequenciais à RPC `fn_disparar_abertura_em_massa` (primeiro WhatsApp, depois Email) com mesmo `leadIds`. Resultado agrega `DisparoResultRow[]` dos 2.
- AlertDialog confirm: mostra os 2 templates + breakdown "X WhatsApp + Y Email".
- Resumo cadência: lista os 2 templates quando 'ambos'.
- Passo Confirmação: 3 stat cards (WhatsApp/Email/Pulados) em 'ambos'.
- Botão "Disparar X mensagens" em 'ambos' (somatório de mensagens dos 2 canais).

Cada lead recebe 1 ou 2 mensagens conforme canais válidos (telefone E/OU email). Preview HTML detalhado permanece em canal único; em 'ambos' mostra só nomes/badges dos 2 templates.

### Files tocados nesta parte (1)
- `DispararAberturaModal.tsx` (327 insertions, 85 deletions)

### Sessão 2026-05-11 (parte 5 — final) — Split-view `/agente` tipo WhatsApp Web

Junior reportou: "abrir conversa fica confuso, fico voltando pra lista, queria algo mais próximo do WhatsApp". Validado via Chrome MCP — confirmado fluxo ruim: cada conversa abre em página separada (`/agente/conversa/:id`), perde contexto da lista ao voltar.

**Commit `41d8a3d` em `origin/main` (Vercel auto-deploy):**

- `AgentDashboardPage`: quando `?conv=<id>` está na URL, renderiza layout 2-colunas (sidebar 360px com lista compacta + painel direito com thread inline).
- Novo `ConversationRowCompact`: nome/contato/canal/status/score empilhados verticalmente pra caber em sidebar enxuta.
- Click numa conversa atualiza `?conv=<id>` via `setSearchParams` (sem reload, sem perder contexto).
- Filtros compactos na sidebar: busca + 4 score pills + 4 status pills (as mais usadas).
- Botão "X Fechar conversa" volta pro dashboard cheio.
- Botão "Tela cheia" no header da thread → navega pra `/agente/conversa/:id` (deep link externo continua funcionando).
- `AgentConversationPage`: extração de `AgentConversationView({ id, embedded, onAfterDelete })` como export nomeado, reusável. Default export vira wrapper que pega `id` de `useParams`. Em modo `embedded`, esconde "Voltar ao Agente" e usa `onAfterDelete` callback.

**Pattern aplicado** (vai pra `30-Conhecimento/Processos/`): page standalone vira reusável extraindo o JSX como named export `XxxView({ id, embedded, onAfterDelete })`. Default export wrapper minimal. Permite split view sem duplicar lógica.

### Files tocados nesta parte (2)
- `src/domains/agent/pages/AgentDashboardPage.tsx` (split layout + ConversationRowCompact)
- `src/domains/agent/pages/AgentConversationPage.tsx` (extrai AgentConversationView named)

---

## RESUMO DA SESSÃO 2026-05-11 (3 partes da madrugada à manhã)

**4 commits em main**, 22/22 tasks completas + 2 pendentes (Vibe enrichment pra próxima):

| Commit | Resumo |
|---|---|
| `34d338e` | fix bug Cesta (sessionStorage) + v15 service_role buscar-leads-google |
| `f69d55f` | 6 melhorias UX no fluxo de disparo + Segmentos salvos |
| `6a5e6ae` | modal canal Ambos (WhatsApp + Email simultâneo) |
| `41d8a3d` | split-view /agente tipo WhatsApp Web |

**Outras entregas:**
- Patch v15 buscar-leads-google + 50 lojas calçados SP processadas (29 INSERT + 21 UPDATE) + CSV pra download
- Apply Hunter executado (18 leads bloqueados, mas isso foi sessão 10/05 — pra contexto)
- Disparo lote 1 (10 leads, Junior tirou BEIRA RIO pelo conflito de template)
- Migration 150: tabela `lead_segments` com RLS
- Plugins de 2 hooks novos (useLeadSegments, useLeadsSelection v2 sessionStorage)
- 1 componente novo (SegmentoSalvoLoader)
- AgentConversationView extraído como named export reusável

**Pendentes pra próxima sessão:**
- Vibe match + enrich nos 11 leads grandes do lote 1 (~33 créditos)
- CSV → XLSX conversion (bash off hoje)
- Revisar 4 leads suspeitos Apify (Palmas-TO / ES)
- Auditoria do campo `contato_email` (escapou da limpeza 05/05)
- BEIRA RIO disparo separado com template customizado

### Files tocados nesta parte (6 alterados + 2 novos)
- `DispararAberturaModal.tsx` (steppers, preview HTML, confirm dialog, salvar segmento)
- `SegmentoPills.tsx` (nova section ScorePills)
- `useLeadsDisparo.ts` (.or expandido)
- `LeadsPage.tsx` (plug SegmentoSalvoLoader)
- `useLeadSegments.ts` (novo hook CRUD)
- `SegmentoSalvoLoader.tsx` (novo componente Sheet)
- migration 150 `lead_segments_table` (aplicada via apply_migration)

---

## Sessão 2026-05-11 (parte 1 — madrugada) — APIFY GOOGLE MAPS DESBLOQUEADO + 50 LEADS CALÇADOS SP

### Patch principal
- **buscar-leads-google v15** deployed (version 17 ACTIVE) — aceita service_role JWT pra invocação interna via pg_net, mantendo fluxo user JWT normal pra UI. Padrão idêntico ao `dispatch-approved-messages`.
- Helpers `decodeJwtPayload()` + `isServiceRoleToken()` adicionados. Branch condicional: se token é service_role (env match OU JWT decode com role=service_role + iss=supabase), pula getUser/role check.
- Smoke test 5 leads: 200/apify, 100% success, perfil correto (Zona Leste, varejo de bairro real).

### Pipeline executado
1. ✅ **Mapa schema leads** — 37 colunas. Ausentes: `instagram`, `google_place_id`, `metadata`. Solução: tags em `observacoes` (`[place_id]`, `[instagram]`, `[whatsapp_status]`, etc).
2. ✅ **Vibe Prospecting fetch** — 50 BR-SP retail/wholesale footwear: cobertura SÓ marcas grandes (VESTE, Caedu, GUESS, Ricardo Almeida) — não serve pro pedido (varejo de rua). Confirmação do caveat sobre cobertura BR.
3. ✅ **Apify via 7 queries paralelas** (4 + 3 complementares): 63 leads brutos, **52 únicos** por place_id.
4. ✅ **Top 50 selecionados** por quality_score (telefone, website, rating, celular).
5. ✅ **Site scraping em paralelo** via pg_net.http_get (45 sites, 38 sucesso): regex Instagram + WhatsApp confirmado (wa.me, api.whatsapp.com).
6. ✅ **Dedupe contra public.leads**: 21 matched por telefone normalizado, 0 por place_id (1ª busca), 0 por fuzzy nome+cidade.
7. ✅ **UPSERT conservador**: 29 INSERT novos + 21 UPDATE preservando data bom (só preenche campos vazios, nunca sobrescreve).
8. ✅ **CSV exportado** em `Obsidian/10-Projetos/Croma-Print/dados/leads_calcados_google_maps_sao_paulo_2026-05-11.csv`.
9. ⚠️ **XLSX postponed** — bash sandbox indisponível. Excel abre o CSV direto (UTF-8). Conversão pra .xlsx nativo na próxima sessão.

### Stats finais
- 50 processados
- 29 novos no CRM
- 21 atualizados
- 50/50 com telefone (100%)
- 18 WhatsApp confirmado + 16 provável = 34 com WhatsApp em algum nível (68%)
- 22/50 com Instagram (44%)
- 45/50 com website (90%)

### Custo Apify
- Smoke 5 + 4 queries × 15 + 3 queries × 15 = ~110 places ≈ $0.55. Pago via APIFY_API_KEY do Edge Functions secrets.

### Pendências / próxima sessão
- **Vibe enrichment nos 11 validados do lote 1** (Beira Rio, Democrata, Lojão do Brás, etc) — Junior aprovou, pediu como etapa separada. Custo ~33 créditos. Output: revenue, headcount, indústria padronizada, sinais comerciais, recomendações de personalização pro email de segunda.
- **Conversão CSV → XLSX** (bash off hoje).
- **Reviewar 4 leads suspeitos**: Centauro (endereço Palmas-TO), Lojas Economia (Palmas-TO), Peça Rara (Palmas-TO), Gustavo Sapatos Em Geral (DDD 27-ES). Algoritmo pegou matches ruins do Google Maps.
- **Auditoria do campo `contato_email`**: descoberta da sessão anterior pendente — limpeza de 05/05 só varreu `email`/`email2`, esqueceu `contato_email`. Provável que outros leads tenham email quebrado lá.

---

## Sessão 2026-05-10 — APPLY HUNTER ✅ + LOTE 1 TRAVADO + LOTE 2 EM DECISÃO

**Onde paramos:**
- ✅ `fn_apply_email_validation_2026_05(false)` executado → **18 leads bloqueados** com `[NAO INCLUIR]` em `observacoes` (16 invalid + 2 unknown — bate 100% com dry run)
- ✅ Os 5 `accept_all` permaneceram limpos (decisão registrada na sessão anterior)
- ✅ 76 `valid` marcados como validados
- ✅ Nova `vw_proxima_campanha_calcados_30` puxada — 11 com `validacao_status='valid'` (top scores 71-86) + 19 com `pending_validation` (scores 56-63)
- ✅ CSV `2026-05-10-validacao-calcados-LOTE2-PENDENTES.csv` (19 linhas) salvo em `Obsidian/10-Projetos/Croma-Print/dados/`
- ⚠️ Detectado typo no email da MML COMERCIO: `outlool.com.br` (provavelmente `outlook.com.br`) — registrado no CSV pra correção antes de incluir

**Plano final (decisão Junior 2026-05-10 22h):**
- **Segunda 11/05, dentro da janela (9h–17h)**: disparar pros 30 leads (11 validados + 19 pendentes) sem validação Hunter adicional do lote 2.

**Mitigações:**
1. ✅ MML COMERCIO removida — typo `outlool.com.br` estava em `contato_email` (não em `email`/`email2`, por isso escapou da limpeza de 05/05). `contato_email` setado pra NULL, observacoes marcada com `[NAO INCLUIR]`. **LOJAS BETO** (`vanessa@lojasbeto.com.br`, score 56) entrou como substituto na lista de 30.
2. (Recomendado) Disparar em 2 ondas: 11 validados de manhã → 1h espera → 19 pendentes à tarde. Observar bounce rate antes de comprometer todo o lote.
3. (Recomendado) Monitorar `vw_email_campanha_delivery` — pausa imediata se bounce rate > 10%.

**Próximos passos:**
1. Junior dispara pros 30 segunda 11/05 manual via `/leads`
2. Acompanhar webhooks Resend → `email_events`
3. Se bounce rate alto, revisitar opção Hunter Starter (caminho B) pra próximas campanhas

---

## Sessão 2026-05-08 (parte final) — Validação Hunter ⏸ AGUARDANDO "APLICAR"

**Onde paramos:**
- ✅ CSV `2026-05-08-validacao-calcados-FINAL.csv` (543 linhas) subido no Hunter
- ✅ Hunter validou 99 dos 543 (limite plano free, R$ 0 custo)
- ✅ Resultado baixado em `Obsidian/10-Projetos/Croma-Print/dados/026-05-08-validacao-calcados-HUNTER-RESULTADO.csv` (nome com "0" inicial em vez de "2026")
- ✅ Bulk verification ID Hunter: 721584 — `https://hunter.io/bulk-verifications/721584`
- ✅ `staging.email_validation_2026_05` POPULADA com os 99 (TRUNCATE + INSERT direto via MCP)
- ✅ Preview rodado: 76 valid / 16 invalid / 5 accept_all / 2 unknown
- ✅ Dry run rodado: **18 leads SERIAM bloqueados** (16 invalid + 2 unknown)
- ⏸ Apply real (`fn_apply_email_validation_2026_05(false)`) — **NÃO rodado, aguardando "aplicar"**
- ⏸ `leads.observacoes` — NÃO alteradas

**Recomendação registrada (ainda não executada):**
- Bloquear: 16 invalid + 2 unknown
- Manter mas FORA da 1ª campanha: 5 accept_all
- Liberar pra próxima campanha: 76 valid

**Próximos passos quando Junior retomar:**
1. Junior diz "aplicar" → rodar `SELECT * FROM public.fn_apply_email_validation_2026_05(false);`
2. Verificar nova lista dos 30: `SELECT * FROM public.vw_proxima_campanha_calcados_30;` (vai filtrar automaticamente, excluindo os 18 invalid/unknown)
3. Junior aprova os 30
4. Junior dispara manual via `/leads` (Claude não dispara)

---



## Sessão 2026-05-08 — Tracking de email via webhook Resend ⚠️ AGUARDANDO HUMAN-IN-THE-LOOP

### Contexto
Junior disparou 50 emails da campanha "Campanha lojas de calçados" via /leads pela manhã. Zero respostas, zero auto-respostas, zero bounces visíveis. Pediu auditoria completa do fluxo antes de retomar disparos em massa.

### Auditoria entregue
- Fluxo /leads → `fn_disparar_abertura_em_massa` → `agent-enviar-email` → Resend
- Remetente real (do banco `admin_config.agent_config`): `Junior - Croma Print <junior@cromaprint.com.br>` ✅
- Reply-To no fluxo principal: ✅ explícito
- Reply-To em `enviar-email-campanha` e `ai-enviar-nps`: ❌ ausente → patchado
- Causa-raiz do silêncio: **ausência de webhook Resend** = bounces e delivers invisíveis no CRM

### Implementação entregue (autônoma)
- ✅ Migration 142: tabela `email_events` + colunas `delivery_status/at/meta` em `agent_messages` + trigger de prioridade + view `vw_email_campanha_delivery` + RLS
- ✅ Migration 143/144: RPCs `private.reconcile_resend_enqueue/collect` (2 fases via `pg_net`)
- ✅ Edge Function `resend-webhook` deployed v1 ACTIVE (HMAC svix, Web Crypto nativo, dedup por UNIQUE INDEX)
- ✅ Patch `enviar-email-campanha`: `from`/`reply_to` lidos de `admin_config.agent_config`
- ✅ Patch `ai-enviar-nps`: `reply_to` lido de `admin_config.agent_config`
- ✅ Script Node fallback `scripts/reconcile-resend-email-events.mjs`
- ✅ Doc operacional `docs/operacao/email-tracking-resend.md`
- ✅ Auditoria salva em vault: `10-Projetos/Croma-Print/auditorias/2026-05-08-email-disparo-leads.md`

### Bloqueios descobertos
1. **API key send-only**: `vault.secrets.RESEND_API_KEY` é `restricted_api_key` — retorna 401 em GET /emails/{id}. Reconciliação dos 50 disparos antigos depende de criar uma key Full Access no Resend.
2. **Login painel Resend**: requer login + 2FA. Junior precisa criar o endpoint de webhook manualmente.
3. **Secret webhook**: `RESEND_WEBHOOK_SECRET` precisa ser setada no Supabase pelo Junior (painel ou CLI).

### Próximos passos para Junior (na próxima janela)
1. Resend → Webhooks → Add Endpoint com URL `https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/resend-webhook`, marcar todos `email.*`, copiar `whsec_...`
2. Supabase → Functions → Secrets → adicionar `RESEND_WEBHOOK_SECRET=whsec_...`
3. Test event do painel Resend → confirmar inserção em `email_events`
4. (Opcional) Criar API key Full Access → atualizar vault → rodar `reconcile_resend_enqueue` + `collect` pra ver os 50 antigos
5. Disparo controlado de 5 emails (junior@, Gmail, Outlook, inválido, lead-isca)
6. Liberar volume gradativo: 30/dia → 100/dia → 200/dia se bounce rate < 5%
7. Commit pendente: instruções em `.planning/PROXIMO-COMMIT.md`

### Recomendação atual
**NÃO retomar disparo em massa enquanto checklist do item 9 do vault não estiver completo** — sem webhook ativo o problema dos 50 se repete em escala maior.

---



## Sessão 2026-05-07 (parte 7) — UX /agente: filtros + scroll interno ✅

### Pedido do Junior
"Página /agente está perdida quando há volume. Quero filtrar por status e score." Em seguida: "Vamos ter problema de scroll quando tiver mais leads na página."

### O que foi entregue (Entrega 4)
1. **Filtros na /agente** (commit `dd1edde`): pills de status com contagem por status (Todas/Ativas/Aguard. Aprovação/Convertidas/Escaladas/Pausadas/Encerradas), filtro por faixa de score (Quente >70, Morno 30-70, Frio <30, Todos), busca por empresa/contato, persistência em localStorage. Hook `useAgentConversations` já aceitava filtro por status no backend — só faltava UI.
2. **Scroll interno na lista** (commit `3a020c7`): wrapper `max-h-[60vh] overflow-y-auto` em volta da tabela. Column headers `sticky top-0` dentro do scroll. Filtros, KPIs e WhatsApp card permanecem fixos no topo da página enquanto a lista rola por dentro.

### Decisão deferida
Paginação backend para `/agente` quando passar de ~300-500 conversas. Hoje hook traz `SELECT *` sem `.limit()` — funciona bem na escala atual. Junior optou por implementar quando o time relatar lentidão real ("deixa pra quando precisar").

### Range total da sessão (2026-05-06 + 2026-05-07)
**14 commits**: `0358ce2..3a020c7` em main.
- Entrega 1: 5 commits — dropdown vincular campanha
- Entrega 2: 2 commits — banner real
- Entrega 3: 2 commits — /campanhas reescrita
- Hotfixes: 3 commits — schema PT, lead_id, banner UX
- Entrega 4: 2 commits — filtros + scroll interno em /agente

### Aprendizado importante registrado
Schema da tabela `agent_campanhas` usa nomenclatura **PT** (`criada_em`, `criada_por`, `iniciada_em`, `finalizada_em`) enquanto outras tabelas do sistema usam EN (`created_at`, `created_by`). Isso causou 3 hotfixes em sequência. Registrado em `Obsidian/10-Projetos/Croma-Print/aprendizados/2026-05-07-schema-pt-vs-en.md`.

### Pendências
- Time de vendas começa a usar amanhã com filtros + scroll interno funcionando.
- Paginação backend em `/agente` quando volume crescer.
- Eventual UX do agente IA comercial (futura sessão).

---

## Sessão 2026-05-06 (parte 6) — VALIDAÇÃO VISUAL FINAL ✅

### Confirmado pelo Junior em prod
- **/leads banner**: "Campanha ativa · whatsapp · Envelopamento de poste para segurança · 69/194 leads · 338 enviadas · 153 respostas (45%)"
- **/campanhas KPIs globais**: 1 campanha ativa, 338 mensagens enviadas, 153 respostas, 45% taxa de resposta
- **/campanhas card detalhado**: 69/194 leads · 338 enviadas · 182 lidas (54%) · 153 respondidas (45%) · 19 erros · botões Pausar/Concluir/Detalhes funcionando

### Hotfixes aplicados nesta etapa (3)
1. `ba5321b` — `created_at`/`created_by` → `criada_em`/`criada_por` (schema PT real da tabela `agent_campanhas`).
2. `67453ff` — `agent_messages` não tem coluna `lead_id`; trocar para `id` no count de "totalDisparados".
3. `d292fc1` — Banner mostrava "X disparados (226%)" confuso; trocar por "leads/meta · enviadas · respostas (taxa%)" com agregados materializados na própria `agent_campanhas`.

### Range total da sessão (12 commits)
`0358ce2..d292fc1` em main:
- Entrega 1: `cdebd8e..2032220` (5 commits) — dropdown vincular campanha
- Entrega 2: `e0a8548..6e81e62` (2 commits) — banner real
- Entrega 3: `a59a288..837a99f` (2 commits) — /campanhas reescrita
- Hotfixes:  `ba5321b..d292fc1` (3 commits) — schema PT, lead_id, banner UX

### Bugs encontrados e resolvidos durante a sessão
- **FUSE Edit tool truncou 2 arquivos** durante edições. Workaround Python+cp confirmado padrão.
- **Schema PT vs EN**: tabela `agent_campanhas` usa `criada_em` e `criada_por`. Hooks/página assumiam `created_at`/`created_by`. tsc não pega porque types do Supabase estão soltos (strictNullChecks=false).
- **Coluna lead_id ausente em agent_messages**: a tabela só tem `conversation_id`. O `count('lead_id', ...)` falhava silenciosamente.
- **Bug pré-existente revelado**: banner legacy procurava segmento 'seguranca' lowercase sem acento; dado real é 'Segurança'. Por isso banner antigo mostrava "0 leads totais" mesmo com 153 respostas reais no banco.
- **PWA cache**: hash do bundle muda mas service worker pode servir versão velha. Solução: hard reload normal funciona quando o CDN do Vercel atualiza (~3 min após push).

### Estado final em produção
- 12 commits empurrados, HEAD `d292fc1`
- Migration 140: aplicada
- Feature flag: ON
- Campanha "Envelopamento de poste para segurança" registrada em agent_campanhas com 69 leads vinculados, 338 enviadas, 153 respostas
- Toda nova mensagem disparada via /leads pode ser vinculada a campanha pelo dropdown
- /campanhas mostra métricas reais agregadas + permite pausar/ativar/concluir/cancelar/criar campanha rápida

### Pendências
- Time de vendas começa a usar amanhã.
- Eventual ajuste fino de UX se o time relatar atrito.
- Próximas evoluções (não fazer agora): comparativo entre campanhas, dashboard executivo cruzando campanha × proposta × pedido, agente IA sugerindo leads/templates por performance histórica.

---

## Sessão 2026-05-06 (parte 5) — MOTOR COMERCIAL COMPLETO ✅

### Resultado final
3 entregas + flag ON em produção. Time de vendas pode usar imediatamente.

### Entrega 1 (parte 4) — vincular disparo a campanha
HEAD `2032220`. 6 arquivos, 5 commits. Dropdown opcional no passo 3 do modal de disparo. RPC com spread condicional preserva legacy.

### Feature flag ATIVADA
`UPDATE admin_config SET valor='true' WHERE chave='feature_campanhas_link_disparo'`. Validado visualmente pelo Junior em /leads.

### Entrega 2 — CampanhaBanner real
HEAD `6e81e62`. 2 arquivos. Banner usa `useCampanhaAtivaResumo` com fallback legacy. Hook lê campanha em status='ativa' mais recente em `agent_campanhas` e calcula métricas de `agent_messages`/`agent_conversations` filtradas por `campanha_id`.

### Backfill de dados
- **Campanha "Envelopamento de poste para segurança"** criada em `agent_campanhas` (id `fed81ab2-9f07-4153-813e-c37c2c1d9b7d`), status='ativa', meta=194, canal=whatsapp.
- 69 conversations + 376 mensagens do segmento "Segurança" retroativadas para essa campanha.
- Contadores agregados recalculados: 69 leads, 376 criadas, 335 enviadas, 179 lidas, **153 respondidas**, 19 erros.
- Bug pré-existente identificado: fallback legacy do banner usava 'seguranca' minúsculo sem acento; segmento real é 'Segurança'. Isso fazia o banner antigo mostrar "0 leads totais" mesmo com campanha ativa.

### Entrega 3 — /campanhas reescrita
HEAD `837a99f`. 2 arquivos. Página agora opera em `agent_campanhas` (mestre) com:
- KPIs globais: total campanhas, ativas, mensagens enviadas, taxa de resposta agregada.
- Cards por campanha com: nome, canal, status, leads (vs meta), enviadas, lidas (com %), respondidas (com %), erros, barra de progresso.
- Sheet de detalhes com edição inline (nome, meta, data fim) + tab de leads vinculados (lista de empresas/contatos).
- Ações: pausar, ativar, concluir, cancelar — todas com AlertDialog de confirmação seguindo regra `e.preventDefault()`.
- **SEM botão de disparo** (regra de ouro: disparo só em /leads pelo modal).
- Página antiga (608 linhas, tabela `campanhas` legacy + envio direto via Resend) removida.

### Estado pós-sessão (em produção)
- Migration 140: aplicada.
- Feature flag `feature_campanhas_link_disparo`: TRUE.
- Range total empurrado: `0358ce2..837a99f` (9 commits, 8 arquivos).
- HTTP health check: 200 em /, /leads, /campanhas.
- Aba Leads: dropdown "Vincular a campanha" funcional. Banner mostra dados reais da campanha "Envelopamento de poste para segurança". Cada novo disparo grava `campanha_id`.
- Aba Campanhas: lista campanhas reais com métricas vivas. Cria, pausa, ativa, conclui, cancela.

### Métricas reais expostas pela primeira vez (campanha "Envelopamento de poste")
- 69 leads únicos / 194 meta (35.6%)
- 335 mensagens enviadas
- 179 lidas (53% das enviadas)
- 153 respondidas (45.7% das enviadas — taxa excepcional para outbound frio)
- 19 erros

### Workaround do FUSE recorrente
- Edit tool truncou 2 arquivos durante a sessão. Workaround: Python script + `cp -f` atômico (registrado em aprendizado 2026-05-06-fuse-edit-tool-trunca-arquivos).
- 3 pushes em produção via clone temporário em `/tmp/crm-push` (FUSE bloqueia `.git/index.lock`).

### Pendências e próximos passos (não fazer agora)
- Junior valida visualmente: /leads, banner do topo, /campanhas com KPIs.
- Vincular novos disparos a campanhas existentes (já funcional via dropdown).
- Possível Entrega 4 (futuro): edição de canal, múltiplas campanhas ativas simultaneamente, exportação de métricas.
- Agente IA comercial: agora tem base de dados limpa (`agent_messages.campanha_id`) para começar a sugerir leads/templates/follow-ups baseado em performance por campanha.

---

## Sessão 2026-05-06 (parte 4) — ENTREGA 1 EM PRODUÇÃO ✅ (FLAG OFF)

### Push concluído
- 5 commits empurrados para `origin/main`: range `0358ce2..2032220`.
- HEAD: `2032220 feat(leads): wire CampanhaSelector into DispararAberturaModal step 3 behind feature flag (OFF by default)`.
- Workaround usado: clone temporário em `/tmp/crm-push` (necessário porque `.git/index.lock` no Cowork está travado pelo FUSE virtiofs). `cp` seletivo dos 6 arquivos da Entrega 1 → 5 commits no clone → `git push origin main`. Working tree do repo principal não foi tocado (preserva os 20+ arquivos modificados pré-existentes do Junior).
- Vercel respondeu HTTP 200 em `/` e `/leads` após push. Cache-control max-age=0.

### Verificação pós-deploy (Junior)
Abrir `https://crm-croma.vercel.app/leads`, fazer hard reload (Ctrl+Shift+R), selecionar 1 lead, abrir modal, ir até passo 3. Esperado: **passo 3 IDÊNTICO ao de antes da entrega** (sem dropdown novo, porque flag está `false`).

### Status produção
- Migration 140: aplicada em prod.
- Feature flag: `false` (validado via Supabase MCP em 22:30 BRT).
- Frontend novo: deployado, dormente atrás da flag.
- Backend RPC: 3 overloads coexistindo (5 legacy, 6 wrapper, 7 nova). Comportamento legacy bit-a-bit preservado quando frontend chama com 6 args nomeados.



### O que foi feito
1. ✅ **6 arquivos da Entrega 1 implementados** em 5 mini-commits lógicos. Feature flag `feature_campanhas_link_disparo` permanece `false` em produção. Aba Leads visualmente e funcionalmente idêntica.

2. ✅ **Plano detalhado aprovado antes do código** (11 pontos pedidos pelo Junior). Salvo em `JARVIS/plano-entrega-1-campanhas-link.md`.

3. ✅ **Arquivos novos (4)**:
   - `src/shared/hooks/useFeatureFlag.ts` (31 linhas) — wrapper de useAdminConfig com fallback `false` em qualquer falha.
   - `src/domains/comercial/hooks/useAgentCampanhas.ts` (123 linhas) — `useCampanhasAtivas(canal)` lê de `agent_campanhas` filtrando status IN ('ativa','rascunho') e canal compatível. `useCriarCampanhaRapida` cria em status='rascunho'.
   - `src/domains/comercial/components/leads/CampanhaSelector.tsx` (153 linhas) — dropdown shadcn com "Sem campanha (avulso)" default + lista de campanhas + "Criar campanha rápida".
   - `src/domains/comercial/components/leads/QuickCriarCampanhaDialog.tsx` (176 linhas) — dialog mínimo com nome + canal + data_fim opcional.

4. ✅ **Arquivos alterados (2, pure addition)**:
   - `useDispararAbertura.ts`: +23 linhas. Interface `DispararParams` ganhou `campanhaId?: string | null`. `mutationFn` usa **spread condicional** — se campanhaId é falsy, chave `p_campanha_id` NÃO entra no objeto da RPC → cai no overload de 6 args (wrapper de compat) → comportamento bit-a-bit idêntico ao da migration 138.
   - `DispararAberturaModal.tsx`: +27 linhas, **0 deletions**. Imports + estado `campanhaId` + hook `useFeatureFlag` + reset em `handleClose` + bloco condicional do `<CampanhaSelector>` no passo 3 (Cadência), só renderiza com flag ON.

5. ✅ **Cinto + suspensório**: mesmo se um estado residual de `campanhaId` ficar populado, com flag OFF `mutateAsync` recebe `campanhaId: null`. Três camadas independentes (flag, default null, spread condicional) preservam o comportamento legacy.

6. ✅ **Validação tsc PASS** (exit 0, zero erros). Build via `vite build` não rodou no Cowork por causa do bug FUSE virtiofs (nodemodules retorna I/O error) — mesmo problema da sessão 2026-05-04L. Junior precisa rodar `npm run build` na máquina dele para confirmar bundle.

7. ⚠️ **Bug FUSE truncou 2 vezes durante a sessão**. `DispararAberturaModal.tsx` e `useDispararAbertura.ts` foram cortados pelo Edit tool em algum momento. Restaurados via `git show HEAD:...` + Python script com asserts em anchors únicos + `cp -f` atômico. Estado final validado: 727 linhas no modal (700 + 27 esperadas), 113 no hook (92 + 21 esperadas). Todos os helpers preservados (StepDots, CanalToggle, renderPreview, TemplateCard, StatCard, Row, useTemplatesAbertura).

8. ⏭️ **Junior precisa**:
   - Rodar `npm install && npm run build` localmente (FUSE não permite no Cowork).
   - Testar com flag OFF: confirmar visual e funcional iguais (T1-T5 do plano).
   - Só depois ligar a flag em ambiente de teste e rodar T6-T12.
   - Não ativar em produção sem o OK explícito.

### Comportamento garantido (validado por design + tsc)
- Flag OFF + nenhuma campanha selecionada → RPC chamada com **6 args**, `agent_messages.campanha_id IS NULL`, `agent_conversations.campanha_id IS NULL`. **Idêntico à migration 138**.
- Flag ON + "Sem campanha (avulso)" → mesmo comportamento acima.
- Flag ON + campanha selecionada → RPC com **7 args**, vínculos gravados, trigger incrementa `agent_campanhas.total_leads`.

### Visão futura (porque Junior reforçou: agente comercial precisa disso)
Cada disparo agora pode ser auditado por campanha → base de dados limpa para o agente IA medir qual campanha gera proposta/pedido, sugerir templates, propor follow-ups. A Entrega 1 é o **piso** dessa torre. Nenhum dado existente foi corrompido; só foi adicionada capacidade.

### Próximas etapas (NÃO fazer agora — só com OK do Junior)
- Junior: build local + smoke test com flag OFF.
- Entrega 2: CampanhaBanner ler campanha real selecionada (sem hardcode).
- Entrega 3: CampanhasPage usando `agent_campanhas` (nova tabela mestre) + métricas v1.

---

## Sessão 2026-05-06 (parte 3) — MIGRATION 140 APLICADA EM PRODUÇÃO ✅

### O que foi feito
1. ✅ **Migration 140 aplicada em produção** (`apply_migration` via MCP Supabase, 22:30 BRT, fora da janela do cron). Schema persistido no projeto `djwjmfgplnqyffdcgdaw`.
2. ✅ **Feature flag `feature_campanhas_link_disparo` permanece `false`** — disparo continua se comportando exatamente como antes da migration. Frontend nem sabe que existe conceito de campanha.
3. ✅ **Frontend NÃO foi alterado** — `useDispararAbertura.ts`, `DispararAberturaModal.tsx`, `CampanhaBanner.tsx`, `CampanhasPage.tsx` intactos.
4. ✅ **Fluxo atual da aba Leads funcionando** — chamada de 6 argumentos nomeados via PostgREST cai no novo **wrapper de 6 args** que delega para a função de 7 args com `p_campanha_id=NULL`. Comportamento bit-a-bit idêntico ao da 138.
5. ✅ **Wrapper de compatibilidade validado** — teste com chamada real do frontend (named args, dentro de `BEGIN/ROLLBACK` para não criar mensagem real) retornou `status='criado'`, `motivo=null`.
6. ✅ **`agent_conversations.campanha_id`** agora existe (FK opcional para `agent_campanhas`, ON DELETE SET NULL, índice parcial `idx_agent_conversations_campanha`).
7. ✅ **`agent_campanhas` estendida** com 7 colunas novas: `canal` (whatsapp/email/misto), `assunto_email`, `corpo_email`, `imagem_url`, `data_inicio`, `data_fim`, `total_alvo`. Índice `idx_agent_campanhas_canal`.
8. ✅ **CHECK constraint de `agent_campanhas.status`** estendido — agora aceita `rascunho` além de `ativa/pausada/concluida/cancelada`.
9. ✅ **Teste com `BEGIN/ROLLBACK`** confirmou disparo sem campanha funcionando — chamada simulando `useDispararAbertura.ts` retornou comportamento legacy preservado, ROLLBACK reverteu conversa+mensagem do teste.
10. ⏭️ **Próxima etapa = frontend**, somente com nova autorização explícita do Junior.

### Validações (13 smoke tests rodados antes da aplicação, via BEGIN/ROLLBACK)
- ✅ Wrapper 6 args (sem campanha) cria msg com `campanha_id=NULL`
- ✅ Função 7 args com `p_campanha_id=NULL` grava NULL
- ✅ Rascunho → ativa, msg+conv com campanha_id, `total_leads=1`
- ✅ Ativa: `total_leads=1` (manual) + `total_mensagens_criadas=1` (trigger)
- ✅ Campanha pausada bloqueia disparo (RAISE EXCEPTION)
- ✅ Campanha concluida bloqueia
- ✅ Campanha cancelada bloqueia
- ✅ Campanha inexistente bloqueia ("não encontrada")
- ✅ Canal incompatível (email × whatsapp) bloqueia
- ✅ Campanha `misto` aceita template whatsapp
- ✅ CHECK aceita `status='rascunho'` em INSERT direto
- ✅ Trigger atualiza `total_enviadas` no UPDATE de `aprovada→enviada`

### Verificação pós-aplicação (12 itens, todos OK)
- 3 overloads coexistem sem ambiguidade (5 legacy + 6 wrapper + 7 nova)
- agent_conversations.campanha_id presente
- CHECK status com 5 valores
- Feature flag em `false`
- 7 colunas novas em agent_campanhas
- 2 índices novos criados
- Grants para `authenticated` e `service_role` aplicados
- Trigger contadores ativa

### Ajustes técnicos importantes que entraram na migration
- `#variable_conflict use_column` no início do corpo plpgsql — evita conflito entre coluna `status` da tabela e OUT param `status` do `RETURNS TABLE`
- `p_campanha_id` SEM `DEFAULT NULL` na função de 7 args — evita ambiguidade de overload com o wrapper de 6 args. Quem quer disparo avulso usa wrapper; quem quer com campanha passa NULL ou UUID explícito

### Arquivos no repo (commitar quando puder)
- `supabase/migrations/140_campanhas_link_disparo.sql` — migration aplicada
- `supabase/migrations/down/140_down.sql` — rollback completo com corpo da 138 inline (sem dependência de cópia manual)

### Próximo passo (aguardando autorização)
Frontend da Entrega 1: dropdown `CampanhaSelector` no passo 3 do `DispararAberturaModal`, hook `useCampanhasAtivas`, `QuickCriarCampanhaDialog`, `CampanhaBanner` lendo dados reais com fallback. **Feature flag continua OFF** até validação completa do frontend pelo Junior.

---

## Sessão 2026-05-06 (parte 2) — PLANEJAMENTO INTEGRAÇÃO CAMPANHAS ↔ LEADS

### Origem
Junior questionou: a aba `/campanhas` nunca foi usada, mas existe campanha real rodando na aba `/leads` (banner "Envelopamento de poste para segurança"). Como relacionar as duas?

### Diagnóstico
- Existem **duas tabelas paralelas**: `campanhas` (legacy, só email Resend, atrás de feature flag) e `agent_campanhas` (criada na migration 139, vazia, com FK em `agent_messages.campanha_id`).
- O banner "Envelopamento de poste" e o "/8" da rampa são **strings hardcoded** em `CampanhaBanner.tsx`. Métricas exibidas são agregados por segmento, não por campanha.
- A RPC `fn_disparar_abertura_em_massa` **não recebe nem grava `campanha_id`** — só guarda string `'disparo_manual'` em metadata.
- `agent_conversations.campanha_id` **não existe** (precisa migration).
- `leads.campanha_id` aponta para tabela legacy `campanhas`, não para `agent_campanhas`.

### Decisão aprovada (Junior, 2026-05-06)
Ver detalhes em `Obsidian/10-Projetos/Croma-Print/decisoes/2026-05-06-campanhas-link-disparo-leads.md`. Resumo:
- `agent_campanhas` vira tabela mestre da nova UX.
- `campanhas` legacy fica em modo só-leitura (sem migrar agora).
- Dropdown opcional "Vincular a campanha" no passo 3 (Cadência) do modal de disparo da `/leads`.
- Aba Leads **não muda nada** no que funciona hoje (filtros, cesta, seleção em lote, templates, envio WhatsApp+email, imagem, rampa).
- Aba Campanhas **não tem botão de disparo** — só organiza, mede e direciona o usuário pra `/leads`.
- Pausar campanha bloqueia novos disparos por padrão; checkbox opcional para cancelar mensagens pendentes.
- Métricas v1 simples (sem ROI até haver custo).
- Feature flag `feature_campanhas_link_disparo` para rollback instantâneo.

### Próximo passo
**Aplicar migration 140** (a ser apresentada para Junior aprovar antes de subir em produção). Conteúdo planejado:
1. `ALTER TABLE agent_campanhas ADD COLUMN canal text CHECK IN ('whatsapp','email','misto')`, `assunto_email text`, `corpo_email text`, `imagem_url text`, `data_inicio date`, `data_fim date`, `total_alvo int DEFAULT 0`.
2. `ALTER TABLE agent_conversations ADD COLUMN campanha_id uuid REFERENCES agent_campanhas(id) ON DELETE SET NULL` + índice.
3. `DROP/CREATE FUNCTION fn_disparar_abertura_em_massa` aceitando `p_campanha_id uuid DEFAULT NULL` (mantendo overload de 6 args atual). Quando informado, grava em `agent_messages.campanha_id` e `agent_conversations.campanha_id` e faz UPDATE em `agent_campanhas` para incrementar `total_leads`.
4. `INSERT INTO admin_config (chave, valor) VALUES ('feature_campanhas_link_disparo', 'false')` (default off até validação).

### Frente de trabalho aberta
- Requirement `MKT-02` em REQUIREMENTS.md (sub-itens MKT-02.1 a MKT-02.6).
- Tasks 2-11 da TaskList do Cowork.

---

## Sessão 2026-05-06 (parte 1) — PIPELINE DESTRAVADO + EXCLUIR LEADS

### Causa raiz identificada e corrigida (CRÍTICA)
Supabase migrou `service_role_key` para o novo formato `sb_secret_xxx`, mas o gateway das
Edge Functions (`verify_jwt: true`) ainda exige JWT legacy `eyJ...`. Resultado: TODAS as
invocações `agent-cron-loop → whatsapp-enviar` retornavam `401 INVALID_JWT_FORMAT` e as
mensagens ficavam presas em `status='aprovada'` indefinidamente (63 mensagens travadas).

### Solução em camadas (commit `05d19b5` + `e6f9524`)

**FASE 2 — Auth segura**
- JWT legacy guardado em `vault.secrets.service_role_key_legacy_jwt` (nao em texto puro)
- `private.get_service_role_key()` prefere vault legacy, fallback para sb_secret
- `public.get_service_role_key_for_dispatch()` RPC restrita a service_role via GRANT
- Edge `whatsapp-enviar` v25: aceita JWT legacy (decodifica role do payload, gateway ja
  validou assinatura) + sb_secret env match + user JWT
- Edge `agent-enviar-email` v20: mesma logica de auth
- Edge nova `dispatch-approved-messages` v1: dispatcher dedicado com fetch direto +
  Authorization JWT legacy + apikey sb_secret

**FASE 3 — Retry e tratamento de erro**
- `agent_messages.tentativas_envio` + `max_tentativas_envio` + `proximo_envio` (cols novas)
- Backoff exponencial: 5min → 15min → 45min entre tentativas
- Apos `max_tentativas` (3): status → `'falha_envio'` (nao tenta mais)
- Index `idx_agent_messages_dispatch_ready` para query rapida

**FASE 4 — Validado com mensagem real**
- 1 mensagem teste enviada via JWT legacy → wamid retornado, status=enviada
- 12 mensagens reais disparadas em sequencia (15:00–15:01 BRT)
- 5 erros do Meta foram numeros invalidos (Apify Google Maps)

**FASE 5 — Rampa progressiva**
- `public.fn_calcular_limite_diario()` calcula 15→30→60/dia
- `useCampanhaStatus` le do RPC backend (fonte unica da verdade)

**FASE 6 — Janelas BRT consistentes**
- `CampanhaBanner.tsx` le `agent_config.horarios` em vez de hardcoded "10–12 / 14–17"

**FASE 7 — Tabela `agent_campanhas`**
- Schema completo com contadores, status, datas
- `agent_messages.campanha_id` (FK opcional)
- Trigger `fn_atualizar_contadores_campanha` mantem totais sincronizados
- RLS por role (admin/diretor/comercial/comercial_senior)

**Bonus — Header IMAGE em templates**
- Bug separado: template `croma_poste_seg_abertura_v2` foi criado no Meta com header IMAGE.
- `whatsapp-enviar` v25 agora le `admin_config.WHATSAPP_MEDIA_<template_name>` e injeta
  `component type=header parameter type=image` no payload Meta.

**pg_cron**
- Job `dispatch-approved-messages-30min`: `*/30 12-14,17-19 * * 1-6` (BRT 09–12 e 14–17)
- Removido `agent-cron-loop` antigo do dispatch (mantido para regras/follow-ups)

### Excluir leads na tela `/leads` (commits `77f1e89` + `e6f9524`)
- Botao lixeira individual SEMPRE visivel na linha do lead (cinza, fica vermelho ao hover)
- Click → AlertDialog vermelho "⚠ Excluir lead permanentemente?" com bloco vermelho
  destacando "Esta acao e PERMANENTE e IRREVERSIVEL"
- Botao em lote no rodape da `LeadsCesta` (desktop sticky + mobile sheet) com mesma confirmacao
- Hook novo `useExcluirLead` + `useExcluirLeadsEmLote` em `src/domains/comercial/hooks/`
- Soft delete: `UPDATE leads SET excluido_em=now(), excluido_por=user_id` — `vw_leads_disparo`
  ja filtra `excluido_em IS NULL`, leads excluidos somem da listagem automaticamente
- RLS `leads_update`: admin/diretor/comercial/comercial_senior

### Telefone errado em mensagens (commit `037f0b7`)
- 3 lugares com `(11) 4200-3724` hardcoded: `DispararAberturaModal.tsx::renderPreview` +
  2 overloads da RPC `fn_disparar_abertura_em_massa`. Corrigido para `(11) 3399-4517`.

### Deploy Vercel
- Auto-deploy GitHub→Vercel estava parado (motivo nao identificado, possivelmente webhook)
- Deploy disparado manualmente via `vercel --prod --force` → build completo (789 deps,
  vite build, 22.14s) → `dpl_HgGBv8ECtG4skqvaV4uTzm5TXVGY` (`crm-croma-a9srq81mg`) Ready
- Aliased para `crm-croma.vercel.app`
- Service Worker do PWA segurava bundle antigo no browser → precisa aba anonima ou
  desregistrar SW para ver mudancas (anotado nos aprendizados)

### Migrations aplicadas hoje
- `138_fix_telefone_disparo_abertura.sql` (drop+recreate ambos overloads da RPC)
- `139_fix_agent_dispatch_pipeline.sql` (consolidada — JWT legacy + retry + rampa + campanhas)
- + migrations diretas: `fix_service_role_key_legacy_jwt`, `store_jwt_legacy_in_vault_secure`,
  `agent_messages_retry_columns`, `rpc_rampa_progressiva_e_jwt_dispatch`,
  `agent_campanhas_table`, `cron_dispatch_approved_messages`, `fix_rpc_jwt_dispatch_grant_only`

### Commits desta sessao
```
e6f9524 feat(leads): icone excluir sempre visivel + aviso PERMANENTE/IRREVERSIVEL
77f1e89 feat(leads): permite excluir lead direto da tela /leads (individual + lote)
05d19b5 fix(agent): destrava pipeline de disparos WhatsApp + rampa progressiva
037f0b7 fix: corrige telefone (11) 3399-4517 em disparo de abertura
```

---

## Sessoes anteriores

## Base de Leads LIMPA E PRONTA PARA DISPARO ✅

Sessão 2026-05-05 executou limpeza completa dos 2810 leads ativos:
- 640 sites trocados movidos para observacoes
- 585 emails com dominio errado limpos (457 email + 128 email2)
- 87 notas de status removidas do campo email2
- 53 duplicatas email1=email2 limpas
- 324 micro-segmentos consolidados em 17 categorias
- Rescoring completo: 887 quente, 1279 morno, 644 frio
- **1476 emails validos** | **1528 WhatsApp-ready** | **2305 (82%) com canal**
- Padrão: dados removidos preservados em `observacoes` com tags `[tag]`

## Pipeline E2E OPERACIONAL ✅ (WhatsApp + Email)

Sessão N adicionou canal EMAIL ao pipeline de prospecção:
1. RPC `fn_disparar_abertura_em_massa` v5 — valida email (regex), renderiza assunto com variáveis
2. `agent-enviar-email` já funcional (Resend API, domínio cromaprint.com.br verificado)
3. `agent-cron-loop` v17 — nova `processApprovedMessages()` despacha msg aprovadas pelo RPC
4. Frontend: `DispararAberturaModal` v3 com toggle WhatsApp/Email, contagem de elegíveis
5. 7 templates email ativos (4 abertura + 2 followup1 + 1 followup2)
6. Remetente: `junior@cromaprint.com.br` (configurável via `admin_config.agent_config`)

### Bug crítico corrigido (sessão N)
O RPC criava mensagens `status='aprovada'` mas nada as despachava (proximo_followup=NULL).
Adicionada `processApprovedMessages` ao cron que pega mensagens aprovadas e roteia para
`whatsapp-enviar` ou `agent-enviar-email` respeitando janelas e limites diários.

### Pipeline anterior (sessão M):
- `whatsapp-enviar` v22 com header IMAGE automático
- Janelas 09:00-12:00 e 14:00-17:00 BRT
- Cron jobid 15 ATIVO
- 4 leads WhatsApp enviados + 1 E2E

**Commit anterior**: `53c57fa` — feat(disparos): FASE 1-3 pipeline prospeccao WhatsApp

## Status atual

### O que foi feito nesta sessão (2026-05-05) — EMAIL COM IMAGEM INLINE

1. ✅ `agent-enviar-email` v18 deployed — imagem de portfólio renderiza DEPOIS do texto
2. ✅ `DispararAberturaModal` — upload de imagem + toggle "incluir imagem" direto no modal
3. ✅ `AgentConfigPage` EditTemplateForm — upload de imagem no formulário de template
4. ✅ `useDispararAbertura` — passa `p_incluir_imagem` para o RPC
5. ✅ `fn_disparar_abertura_em_massa` v5 — persiste `imagem_url` no metadata da mensagem
6. ✅ Teste E2E: email enviado via Resend para junior@cromaprint.com.br com layout correto
7. ✅ Layout final: texto da abertura → imagem de portfólio (CID inline) → rodapé
8. ✅ v19: imagem embutida como CID attachment (exibe sem "permitir imagens remotas")

**Nota técnica**: Para invocar `agent-enviar-email` fora do horário do cron, usar
`pg_net` direto chamando Resend API (o gateway Supabase requer service_role JWT
que não está acessível via vault — o cron-loop usa internamente).

### O que foi feito na sessão anterior (2026-05-04L) — REDESIGN UX

Junior reportou "interface fraca/ruim, usuário precisa poder selecionar quais
leads e qual abertura". Mockup visual aprovado antes de codar (cards de lead,
cesta lateral sticky, galeria de aberturas, banner de campanha, paginação).

#### Frontend — arquivos criados/atualizados

- ✅ `src/shared/hooks/useDebouncedValue.ts` (novo, 300ms default)
- ✅ `src/domains/comercial/hooks/useLeadsDisparo.ts` — adicionada paginação
  `{page,pageSize}` retornando `{data,totalCount}`, `useLeadsDisparoCountsBySub`,
  `useLeadsDisparoCountsBySegmento`, `useCampanhaStatus`
- ✅ `src/domains/comercial/hooks/useDispararAbertura.ts` — select traz
  `vezes_usado`, `taxa_resposta`, `variaveis`, `template_language`
- ✅ `src/domains/comercial/components/leads/CampanhaBanner.tsx` (novo) —
  banner azul topo com KPIs (total, disparados, dia da rampa, enviadas hoje)
- ✅ `src/domains/comercial/components/leads/SegmentoPills.tsx` (novo) —
  pills clicáveis multi-select com counts ao vivo
- ✅ `src/domains/comercial/components/leads/LeadCard.tsx` (novo) — card
  visual com avatar colorido por sub-segmento, badges, tooltip bloqueio
- ✅ `src/domains/comercial/components/leads/LeadsCardList.tsx` (novo) —
  lista paginada 50/pg, select-all visíveis, paginação shadcn
- ✅ `src/domains/comercial/components/leads/LeadsCesta.tsx` (novo) —
  coluna sticky desktop / Sheet bottom mobile, remove individual, mini-stats
- ✅ `src/domains/comercial/components/leads/LeadsFilters.tsx` (reescrito) —
  busca debounced + Sheet "Mais filtros" com status/temp/região/score/datas
- ✅ `src/domains/comercial/components/leads/DispararAberturaModal.tsx`
  (reescrito) — galeria de templates como cards, preview com lead real
  substituindo placeholders, modo padrão "agendado"
- ✅ `src/domains/comercial/pages/LeadsPage.tsx` (refatorado) — novo layout
  banner→pills→busca→grid (lista|cesta), URL persiste filtros + página

#### Bug fixes aplicados

- ✅ `e.preventDefault()` no AlertDialogAction "Criar mesmo assim" —
  regra `.claude/rules/alert-dialog-async.md`
- ✅ Debounce 300ms na busca livre (evita refetch a cada keystroke)
- ✅ Cesta carrega leads selecionados de qualquer página (não só visível)
- ✅ Paginação preserva filtros ativos na URL

#### Componentes deprecados (mantidos para histórico)

- `LeadsBulkActionBar.tsx` — substituído pelo `LeadsCesta`
- `LeadsTable.tsx` — substituído pelo par `LeadsCardList` + `LeadCard`

### Sessão anterior (2026-05-04K) — Backend FASES 1, 2, 4 parcial

- ✅ FASE 1 SQL: `vw_leads_disparo`, `fn_disparar_abertura_em_massa`, seed
  templates segurança v2
- ✅ FASE 2 Edge Functions: `buscar-leads-google v14` (timeout 120s),
  `whatsapp-enviar v21` (template parametrizado + janelas múltiplas)
- ✅ FASE 4 parcial: `admin_config.agent_config` com janelas duplas e rampa
- ⏳ Cron jobid 15 = `inactive` (correto — religar só após FASE 5 E2E)

## Estado da base (atualizado 2026-05-05)

- `leads`: **2810 ativos** — 17 segmentos limpos
  - 1476 com email válido | 1528 com WhatsApp | 2305 com pelo menos 1 canal
  - Score médio 38.8 | 887 quente, 1279 morno, 644 frio
  - Top segmentos: Outros (937), Calçados e Moda (926), Varejo (358), Segurança (228)
- Templates ativos: **2 WhatsApp** (croma_poste_seg_*) + **7 email** (4 abertura + 2 followup1 + 1 followup2)
- `cron.job` 15: **active** (agent-cron-loop v17)
- `whatsapp-enviar`: v22 (header IMAGE automático)
- `agent-enviar-email`: v19 (imagem CID inline após texto, Resend API)
- `buscar-leads-google`: v14 (timeout 120s)

## Aguardando ação do Junior

- [ ] Escolher ferramenta de email marketing (Brevo, Mailchimp, RD Station, ou nativo Croma)
- [ ] Configurar WhatsApp Business API para disparo em massa
- [ ] Criar templates de mensagem por segmento (além de Segurança)
- [ ] Executar campanhas piloto de email e WhatsApp

## TODO próxima sessão

- [ ] **PRIORIDADE ALTA**: Mídia no WhatsApp (ver/ouvir mensagens de clientes + enviar imagem)
  - Expandir `agent_messages` com `media_url`, `media_type` (image/audio/video/document)
  - Webhook de recebimento deve salvar mídia do cliente (baixar do WhatsApp API → Storage)
  - UI: renderizar `<img>` para fotos, `<audio>` player para áudios na timeline
  - UI: botão de upload de imagem no chat manual (quando assume conversa)
  - Motivo: clientes mandam foto de referência/áudio perguntando sobre serviços — sem ver isso no CRM, Junior fica cego e precisa abrir outro WhatsApp
- [ ] Aplicar `e.preventDefault()` em `src/pages/Produtos.tsx:656`
  (mesmo bug do AlertDialog, fora do escopo desta sessão)
- [ ] Criar templates de abertura para os outros 16 segmentos
- [ ] Considerar virtualização da lista quando passar de 1000 leads visíveis
- [ ] Ações em massa adicionais: atribuir vendedor, marcar contatado,
  exportar CSV (planejadas mas não nesta sessão)

## Documentos chave

- 📄 `.planning/PLANO-DISPAROS-PROSPECCAO.md` — plano técnico FASES 1-5
- 📝 Obsidian: bloco `2026-05-04L` em `99-Meta/memory.md` (a ser criado ao final)
- 🎨 Mockup aprovado: ver bloco visual da sessão Cowork 2026-05-04L

## Referência rápida

- Lead de teste interno bloqueado: `0339d969-29d4-4eea-accb-70a27dbee4ca`
- Supabase project: `djwjmfgplnqyffdcgdaw`
