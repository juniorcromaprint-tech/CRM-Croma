# Template de prompt — nova sessão Cowork/Claude Code

Use este template como base no início de cada sessão. Substitua os blocos `[FILL]`
pelo que importa pra sessão específica. O bloco fixo de regras de orquestração não
muda — é o que garante que o Claude opera em modo orquestrador desde o primeiro turno.

---

## ESQUELETO PADRÃO (copia tudo abaixo)

```
Sou Junior, [CONTEXTO 1 LINHA — ex: "retomando refundação Beira Rio" / "investigando bug X" / "implementando feature Y"].

# REGRAS DA SESSÃO (não negociar)

1. **Modo orquestrador OBRIGATÓRIO**: você planeja + coordena + valida. Trabalho pesado
   (recon ≥500 linhas, implementação ≥100 LOC, deploy multi-step, debug isolado) vai
   pra sub-agent via `Agent` tool. CLAUDE.md REGRA #0 detalha.

2. **Budget mental ~150k tokens**. Se passar de 100k, escala uso de agents agressivamente.
   Se passar de 150k, prepara próxima sessão e para — não esperar saturar.

3. **NUNCA "parar pra economizar tokens"** sem ter tentado delegar pra agent.
   Anti-pattern proibido.

4. **Paralelismo obrigatório** se blocos são independentes — múltiplos Agent() num
   único turno.

5. **Modo adversarial** em validações/auditorias — sub-agents recebem instrução
   explícita "questione premissas, faça verificações cruzadas".

6. **Cowork vs Claude Code**: arquivos >500 linhas (Edit do Cowork trunca) → me
   recomende rodar Claude Code local em vez de tentar editar aqui.

7. **Notificar Telegram** (chat_id Junior 1065519625) quando tarefa longa terminar.

# LEITURA OBRIGATÓRIA (na ordem)

1. C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md (regras do projeto, REGRA #0 modo orquestrador)
2. C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md (entrada mais recente)
3. [FILL: outros arquivos específicos da sessão — ex: outputs/briefing-beira-rio-v3.ts]

# ESTADO ATUAL EM PROD (não revalidar — já validado)

[FILL: 3-8 bullets do que está deployado e funcionando agora]

Ex:
- whatsapp-webhook v43 ACTIVE OK (fluxo cliente normal funciona)
- briefing-beira-rio v2 ACTIVE com bug 401 INVALID_JWT
- ai-gerar-orcamento v29 ACTIVE intacto
- Stores Beira Rio: 6 ativas (4 sem code, 2 com code)
- Cliente operacional af166ada / Modelo PS 1mm 7f4519ee

# BUGS JÁ CORRIGIDOS (não voltar)

[FILL: bugs resolvidos em sessões anteriores que poderiam confundir]

# OBJETIVO DA SESSÃO (~XX min estimado)

BLOCO 1 — [FILL nome] (~X min)
- [O que fazer]
- [Como validar]
- **Delegação sugerida**: [agent isolado pra recon / fazer inline / paralelo com BLOCO 2]

BLOCO 2 — [FILL nome] (~X min)
- ...

# CUIDADOS APRENDIDOS

[FILL: armadilhas conhecidas — ex: "Edit Cowork trunca >500 linhas, usa Python heredoc"]

Estou pronto. Pode arrancar pelo BLOCO 1.
```

---

## CHECKLIST ANTES DE COLAR PROMPT

- [ ] STATE.md tem entrada da sessão anterior atualizada?
- [ ] Outputs locais ainda existem (`outputs/*.ts` que vou referenciar)?
- [ ] Bugs conhecidos listados pra Claude não revalidar?
- [ ] Objetivo dividido em blocos com estimativa de tempo?
- [ ] Cada bloco diz se é pra delegar (agent) ou inline?

---

## EXEMPLOS DE PROMPTS POR TIPO DE SESSÃO

### Tipo A — Debug de bug específico (sessão curta, ~30 min)
- Foco em 1 bug, agent isolado pra investigar + propor fix
- BLOCO 1 = recon (agent), BLOCO 2 = fix + deploy (inline ou agent)

### Tipo B — Feature nova multi-step (sessão longa, ~90 min)
- Múltiplos blocos, agents em paralelo onde possível
- BLOCO 1 = design (agent paralelo a recon), BLOCO 2-N = implementação

### Tipo C — Auditoria (sessão média, ~60 min)
- Modo adversarial obrigatório em TODOS os agents
- BLOCO 1 = recon adversarial (agent), BLOCO 2 = consolidação inline

### Tipo D — Manutenção/limpeza (sessão curta, ~20 min)
- Várias tasks pequenas, maioria inline (1-2 tool calls cada)
- Agent só pra coisa específica que requer leitura grande
