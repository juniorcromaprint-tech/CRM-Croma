# CROMA PRINT — CRM/ERP SISTEMA

> v6.3 | 2026-05-25 | Produção — MCP Server **108 ferramentas** + REGRA MODO ORQUESTRADOR

---

## REGRA #0 — MODO ORQUESTRADOR (padrão em TODA sessão)

A sessão principal **planeja, coordena e valida**. Trabalho pesado é delegado pra sub-agents (`Agent` tool). Isso resolve o problema de janela enchendo no fim da sessão — o que vai pro contexto principal é só o sumário, não o trabalho cru.

**Quando disparar sub-agent (regra simples):**
- Recon de código (ler Edge Function de 500+ linhas, schema de tabelas, logs)
- Implementação (criar/editar arquivos com ≥100 linhas novas)
- Deploy multi-step (build + deploy + smoketest + validação)
- Debug de bug específico (investigar, reproduzir, propor fix)
- Qualquer tarefa que sozinho consumiria >30k tokens inline

**Quando fazer inline (sem agent):**
- Tool call único (uma query SQL, um Edit pequeno, um deploy já preparado)
- Decisão arquitetural que exige meu raciocínio com contexto da conversa
- Validação rápida de output de agent

**Paralelismo obrigatório:** se 2+ blocos são independentes, disparar agents em **paralelo** num único turno (múltiplos `Agent()` no mesmo message). Ex: recon webhook + design briefing-beira-rio simultâneos.

**Budget mental:** assumir ~150k tokens disponíveis por sessão. Se passar de 100k, escalar uso de agents. Se passar de 150k, prep próxima sessão e parar (não esperar contexto saturar).

**Cowork vs Claude Code:** trabalho em arquivos >500 linhas (Edit do Cowork trunca) ou rebuilds completos → recomendar Junior rodar Claude Code local. Cowork é melhor pra orquestração + deploys + queries.

**Modo adversarial:** sempre em auditorias/validações. Sub-agents recebem instrução explícita "questione premissas, faça verificações cruzadas, modo adversarial".

**Anti-pattern proibido:** "vou parar pra economizar tokens" sem ter tentado disparar agent. Se o trabalho é necessário e tem ≥30k de carga inline, a resposta NÃO é parar — é delegar pra agent isolado que retorna sumário ≤5k.

**Não negociar:** Junior pode dizer "continua" pra forçar execução, ou "para aqui" pra forçar pausa. Sem isso, default é DELEGAR antes de parar.

---

## REGRA #1 — MCP SERVER CROMA É O SISTEMA

MCP é a interface principal para TODA operação de dados de negócio.

**Hierarquia (SEM EXCEÇÕES):**
1. **MCP Server Croma** — OBRIGATÓRIO para tudo que envolve dados
2. Consultas (leitura): executar direto, sem pedir permissão
3. Alterações (escrita): confirmar com Junior antes
4. Frontend/React: APENAS bugs de UI, features visuais
5. Supabase/apply_migration: apenas infraestrutura (DDL, RLS, schema)

**PROIBIDO ❌** Inventar preços, dados de clientes, ou qualquer valor que existe no banco. Usar SQL direto quando existe ferramenta MCP.

**OBRIGATÓRIO ✅** Consultar preço real antes de cotar. Usar motor Mubisys (materiais + markup + regras). Consultar `croma_custo_real_pedido` / `croma_resumo_impressora` antes de estimar margens.

---

## ACESSO À MCP CROMA NO COWORK ⚠️

No Cowork a MCP Croma **não aparece** em `list_connectors` — invocar via Desktop Commander:

```
mcp__Desktop_Commander__start_process
  command: C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd <tool_name> <json_args>
  shell: cmd
  timeout_ms: 30000
```

- Health check: `croma.cmd croma_health_check`
- JSON sem acentos: `croma.cmd croma_listar_clientes {"limit":5}`
- JSON com acentos/espaços → PowerShell com aspas simples:
  `$env:CROMA_ARGS='{"campo":"valor"}'; & "...\croma.cmd" <tool>`

⚠️ Antes de afirmar "MCP offline" → testar `croma_health_check` primeiro.

---

## DADOS ESSENCIAIS

- **Repo**: `C:\Users\Caldera\Claude\CRM-Croma` | GitHub: `juniorcromaprint-tech/CRM-Croma`
- **Vercel ERP**: `crm-croma.vercel.app` | **Campo**: `campo-croma.vercel.app`
- **Supabase**: `djwjmfgplnqyffdcgdaw`
- **PIX**: CNPJ 18.923.994/0001-83 | **Email**: junior@cromaprint.com.br
- **Obsidian**: `C:\Users\Caldera\Obsidian\JARVIS`

---

## CONTEXTO SOB DEMANDA — LER QUANDO NECESSÁRIO

| Precisa de... | Ler arquivo |
|---|---|
| Ferramentas MCP (108) por módulo | `.context/mcp-ferramentas.md` |
| Dados da empresa, produtos, clientes | `.context/empresa.md` |
| Stack, arquitetura, módulos, dev server | `.context/arquitetura.md` |
| Migrations aplicadas, dados no banco | `.context/migrations.md` |
| HP Latex 365, custeio, consumíveis | `.context/hp-latex.md` |
| Sprints, bugs corrigidos, auditorias | `.context/historico-sprints.md` |
| Padrões de código React/TypeScript | `.context/codigo.md` |
| Princípios Karpathy (dev) | `.context/karpathy.md` |
| Estado atual, blockers | `.planning/STATE.md` |
| Papel do Claude, divisão responsabilidades | `.planning/IDENTITY.md` |
| Visão, requirements, constraints | `.planning/PROJECT.md` |
| Requirements checkáveis (BUG-01, GAP-01) | `.planning/REQUIREMENTS.md` |
| Histórico sessões cross-projeto | `Obsidian → 99-Meta/memory.md` |

**Regra**: não carregar tudo sempre. Ler só o que a tarefa exige.
