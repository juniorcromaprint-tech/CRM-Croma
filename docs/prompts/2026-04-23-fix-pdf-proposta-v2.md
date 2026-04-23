# PROMPT — Sessão Sonnet Autônoma — Fix PDF Proposta v2

> **Cole este prompt inteiro no início da nova sessão Cowork com Sonnet.**
> **Junior não estará disponível durante a execução — trabalhe a noite toda até entregar 100%.**

---

## Contexto

Você é Claude Sonnet operando no Cowork do Junior (dono da Croma Print Comunicação Visual). O Junior deixou a sessão rodando durante a noite e espera encontrar **todas as 12 correções do PDF de proposta entregues em produção** quando acordar.

**Autonomia total concedida**: executar, commitar, fazer deploy, validar, registrar no vault. Não esperar aprovação para nada. Não pedir confirmação. Se encontrar bloqueio, resolver sozinho ou reverter com segurança.

**Idioma**: todas as interações, commits e mensagens em **português brasileiro**.

---

## Primeiro passo obrigatório — ler nesta ordem

1. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` — papel do Claude, stack, regras MCP Server Croma
2. `C:\Users\Caldera\Claude\CRM-Croma\docs\plans\2026-04-23-pdf-proposta-v2-plano.md` — **PLANO DETALHADO com os 12 fixes, código, SQL, commits, deploy**
3. `C:\Users\Caldera\Claude\CRM-Croma\.claude\rules\supabase-mutations.md` — regra `.select().single()` obrigatório
4. `C:\Users\Caldera\Claude\CRM-Croma\.claude\rules\alert-dialog-async.md` — regra `e.preventDefault()` obrigatório
5. `C:\Users\Caldera\Claude\CRM-Croma\.claude\rules\agent-vendas-coleta-dados.md` — dados de pagamento hardcoded
6. `C:\Users\Caldera\Obsidian\JARVIS\99-Meta\memory.md` (primeiras 80 linhas) — memória recente
7. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` — estado atual do projeto

> ⚠️ **Atenção PowerShell**: `read_file` retorna vazio para `.md` no Windows. Use Desktop Commander com `start_process` + `Get-Content -Raw -Encoding UTF8`. Referência: `C:\Users\Caldera\Claude\JARVIS\.planning\LEITURA-ARQUIVOS.md`.

---

## Missão

Aplicar **os 12 fixes do plano v2** no PDF de proposta (Cliente, Ficha Técnica, OS Produção), commitar, fazer deploy em produção, validar, e registrar resultado. 100% entregue — é uma exigência explícita do Junior.

### Caso de teste principal (validar com este)

- **Proposta**: `PROP-2026-0024`
- **ID**: `5b695afc-38f4-4b4e-b825-7094bb981f27`
- **URL produção**: `https://crm-croma.vercel.app/propostas/5b695afc-38f4-4b4e-b825-7094bb981f27`
- **Cliente**: Renner (Porto Alegre-RS)
- **Bug P0.1 confirmado**: telefone `(51) 3584-2200` aparece truncado como `2200` — causa na linha 144 de `src/domains/comercial/services/orcamento-pdf-enrich.service.ts`, regex `split(/\s*[—\-]\s*/)` quebra no hífen do telefone. Fix: `split(/\s+[—–]\s+/)` (exigir espaço em volta do em-dash).

### Repositório

- Local: `C:\Users\Caldera\Claude\CRM-Croma`
- Branch de trabalho: **criar** `fix/pdf-proposta-v2-completo` a partir de `main`
- Deploy: cherry-pick para `main` → Vercel auto-deploy

---

## Regra de ouro — ordem de execução

Seguir exatamente a ordem dos **3 commits** definidos no plano (§ Commits). Não tentar fazer tudo de uma vez:

1. **Commit 1 — P0 (blockers)**: dados cliente + telefone + email + cidade + regex bug
2. **Commit 2 — P1 (alto valor)**: QR code portal + observações internas (migration 131) + 6 termos padrão + validade
3. **Commit 3 — P2 (polish)**: tipografia + espaçamento + logo + footer

Cada commit passa por build local (`npm run build`) antes de `git push`.

---

## Hierarquia de ferramentas (ordem de preferência)

| Situação | Ferramenta |
|---|---|
| Consultar proposta, cliente, materiais | **MCP Server Croma** via `mcp__Desktop_Commander__start_process` → `C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd <tool> {json}` |
| Migration SQL (criar coluna `observacoes_internas`) | `mcp__d972dcbc...__apply_migration` (project_id `djwjmfgplnqyffdcgdaw`) |
| Ler/escrever arquivos do repo | `Read` / `Edit` / `Write` direto |
| Rodar npm, git, PowerShell no Windows | `mcp__Desktop_Commander__start_process` com `shell: "powershell.exe"` ou `cmd` |
| Validar PDF final no browser | `mcp__Claude_in_Chrome__*` — abrir `/propostas/:id`, gerar PDF, inspecionar |
| Registrar decisões/aprendizados | `mcp__Desktop_Commander__write_file` no vault `C:\Users\Caldera\Obsidian\JARVIS\` |

**Proibido**: inventar dado de cliente, preço, CNPJ. Sempre consultar o banco via MCP. Ver `.claude/rules/anti-alucinacao.md` (se existir) e regra #1 do CLAUDE.md.

---

## Dados hardcoded (nunca esquecer)

- **PIX Croma**: CNPJ `18.923.994/0001-83` (Croma Print Comunicação Visual)
- **Email oficial**: `junior@cromaprint.com.br`
- **Supabase project_id**: `djwjmfgplnqyffdcgdaw`
- **Telegram chat_id Junior**: `1065519625`
- **Vercel ERP**: `crm-croma.vercel.app` (auto-deploy de `main`)

---

## Deploy

Use o script já testado e funcional: `C:\Users\Caldera\Claude\CRM-Croma\.claude\deploy-cherry-pick.ps1`.

Ele: checa branch, descarta `mcp-server/dist/tools/financeiro.js` e `mcp-server/src/tools/financeiro.ts` (build artifacts que bloqueiam checkout), vai para `main`, pull, cherry-pick do commit passado como `$args[0]`, push.

Chamar: `& 'C:\Users\Caldera\Claude\CRM-Croma\.claude\deploy-cherry-pick.ps1' <SHA_DO_COMMIT_NO_BRANCH>`.

> ⚠️ **PowerShell**: sempre `git commit -F msgfile.txt` (nunca `-m "com espaços"`). Template em `C:\Users\Caldera\Obsidian\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-04-22-git-commit-F-powershell.md`.

---

## Validação pós-deploy

Para cada commit, depois que Vercel terminar o build (~2 min):

1. Abrir `https://crm-croma.vercel.app/propostas/5b695afc-38f4-4b4e-b825-7094bb981f27` via `mcp__Claude_in_Chrome__navigate`
2. Clicar em "Gerar PDF" / inspecionar render
3. Conferir cada item do **Checklist final** (§ 16 itens no plano)
4. Se algum item falhar → novo commit de fix → novo deploy → re-validar
5. Só marcar como "concluído" depois que os 16 itens passarem

---

## Critérios de sucesso (100% exigido)

- [ ] P0.1 — Telefone do cliente completo (`(51) 3584-2200`, não `2200`)
- [ ] P0.2 — Email do cliente aparece em linha separada
- [ ] P0.3 — Cidade + UF aparecem
- [ ] P0.4 — Bug regex corrigido (whitespace-em-dash)
- [ ] P1.5 — QR code com link do portal do cliente
- [ ] P1.6 — Campo `observacoes_internas` existe (migration 131) e é renderizado só na OS Produção
- [ ] P1.7 — 6 termos padrão renderizados (prazo, validade, frete, cancelamento, revisão, garantia)
- [ ] P1.8 — Validade em destaque visual (faixa ou card)
- [ ] P2.9 — Tipografia com hierarquia clara (títulos / subtítulos / corpo)
- [ ] P2.10 — Espaçamento consistente entre blocos
- [ ] P2.11 — Logo Croma no header com tamanho correto
- [ ] P2.12 — Footer com dados PIX + email em todas as páginas
- [ ] Build local passa (`npm run build`)
- [ ] Commits na `main` com deploy Vercel verde
- [ ] PDF real gerado e validado via Chrome MCP
- [ ] Sem regressão em outras propostas (testar ao menos 1 outra: listar via `croma_listar_propostas` e pegar 1 aleatória)

---

## Protocolo de fim de sessão (executar antes de desligar)

Quando as 12 correções estiverem em produção e validadas:

1. **Atualizar STATE.md**: `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` — mudar "Last activity" e "Current Position"
2. **Atualizar memory.md**: prepend de bloco da sessão em `C:\Users\Caldera\Obsidian\JARVIS\99-Meta\memory.md`
3. **Criar daily note**: `C:\Users\Caldera\Obsidian\JARVIS\01-Daily\2026-04-23.md`
4. **Criar aprendizado**: `C:\Users\Caldera\Obsidian\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-04-23-pdf-proposta-v2-completo.md` com root cause do regex bug e padrões usados (QR code, migration, termos padrão)
5. **Enviar Telegram ao Junior** via ferramenta disponível (chat_id `1065519625`):
   ```
   ✅ PDF proposta v2 — 100% entregue em produção.
   Commits: <sha1> (P0), <sha2> (P1), <sha3> (P2).
   Validado em PROP-2026-0024. Checklist 16/16.
   Detalhes no vault.
   ```

Se o envio via Telegram não estiver disponível, deixar uma nota em `00-Inbox/2026-04-23-resultado-pdf-v2.md` no vault para o Junior ver de manhã.

---

## Em caso de bloqueio sério

Se algo impedir progresso (build quebrado que não dá pra resolver, migration rejeitada, Vercel down):

1. Reverter o commit problemático (`git revert <sha>` e push) — **nunca deixar produção quebrada**
2. Registrar o bloqueio no vault (`00-Inbox/2026-04-23-bloqueio.md`) com: o que tentou, erro exato, hipótese da causa
3. Avisar Junior via Telegram com tag `[BLOQUEIO]`
4. Continuar com os outros fixes que ainda dão pra aplicar (não desistir da sessão inteira)

---

## Autonomia — o que você NÃO deve fazer

- ❌ Pedir confirmação ao Junior durante a noite (ele não responderá)
- ❌ Parar no primeiro erro — tentar alternativas, revertir se necessário, continuar
- ❌ Inventar dado de cliente, CNPJ, preço (sempre consultar via MCP)
- ❌ Deixar produção com build vermelho no Vercel
- ❌ Encerrar sem atualizar o vault Obsidian

## Autonomia — o que você DEVE fazer

- ✅ Executar os 3 commits na ordem, um por vez, validando cada um
- ✅ Resolver bloqueios técnicos sozinho (PowerShell quirks, git conflicts, etc.)
- ✅ Atualizar vault em tempo real a cada marco grande (não deixar tudo pro fim)
- ✅ Testar em 1 outra proposta além de PROP-2026-0024 para evitar regressão
- ✅ Finalizar com mensagem de conclusão clara no Telegram (ou Inbox do vault)

---

## Início

Após ler os 7 arquivos obrigatórios acima, confirme internamente que entendeu e comece direto pelo **Commit 1 (P0 — blockers)**. Não escreva "vou começar" — apenas comece.

**Boa noite de trabalho. O Junior acorda às 7h. Até lá, os 12 fixes têm que estar em produção.**
