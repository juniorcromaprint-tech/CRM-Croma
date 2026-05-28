# Diagnóstico: por que Claudete mente

> 2026-05-22 — investigação após Junior reportar que Claudete diz "adicionou cliente/gasto" sem realmente adicionar.

## TL;DR

Bug não é o prompt sistêmico (que tem regra anti-alucinação clara). Bug são **tools que retornam sucesso falso** quando o Supabase RLS bloqueia silenciosamente. Claudete confia no retorno da tool → reporta sucesso → não gravou nada.

## Bug confirmado: `SupabaseDirectClient.insert()` (financeiro pessoal)

**Arquivo**: `C:\Users\Caldera\Claude\JARVIS\claudete_bot.py` linhas 398-434 e 3083-3107.

### Sequência do bug

1. Junior: "gastei 100 reais"
2. Claudete chama `registrar_gasto(valor=100, ...)`
3. `executar_registrar_gasto` tenta `direct.insert_returning("transacoes", payload)` com `Prefer: return=representation`
4. Se PostgREST retorna body vazio (RLS bloqueou): função retorna `None` ✓ honesto
5. **BUG**: código cai em fallback `direct.insert("transacoes", payload)` linha 3097
6. `insert()` usa `Prefer: return=minimal` (default nos headers, linha 404) → PostgREST devolve 201 Created mesmo com 0 rows gravadas
7. `insert()` retorna `True` → função retorna "✅ Registrado"
8. Junior vê "✅ Registrado" → realidade: **0 rows no banco**

### Fix mínimo (Surgical Changes)

Alterar `SupabaseDirectClient.insert()` (linhas 416-434) pra usar `return=representation` e checar tamanho do array:

```python
def insert(self, table: str, data: dict) -> bool:
    """Insere registro direto. Retorna True SOMENTE se row foi efetivamente gravada
    (detecta RLS-block silencioso via return=representation + len(rows) > 0)."""
    if not self._ok:
        return False
    try:
        import urllib.request, json as _j
        body = _j.dumps(data).encode('utf-8')
        headers = dict(self._headers)
        headers['Prefer'] = 'return=representation'  # detecta RLS-block
        req = urllib.request.Request(
            f'{self._url}/rest/v1/{table}',
            data=body, headers=headers, method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                return False
            rows = _j.loads(resp.read().decode('utf-8'))
            return isinstance(rows, list) and len(rows) > 0
    except Exception as e:
        log.error(f"SupabaseDirectClient.insert({table}): {e}")
        return False
```

Após esse fix, o caso "RLS bloqueou" vira retorno `False` → cai no caminho do bridge → se também falhar → fila offline. Junior sempre vê estado real.

## Bug suspeito (não confirmado): tools MCP Croma (`croma_cadastrar_cliente_cnpj` etc)

**Hipótese**: as 104 tools do MCP Croma seguem padrão similar — chamam mutation via supabase-js do bot Python, retornam ok/erro baseado em HTTP status sem checar `.select().single()`. O `CLAUDE.md` do projeto Croma JÁ tem regra obrigatória `.select().single()` pra mutations (`.claude/rules/supabase-mutations.md`), MAS o MCP Server pode não aplicar essa regra em todas as tools.

**Próximo passo**: auditar `C:\Users\Caldera\Claude\CRM-Croma\mcp-server\` — onde estão as 104 tools — e verificar se cada mutation retorna confirmação real (`.select().single()` ou equivalente).

## Plano de ataque proposto (ordem)

### Fase A — fix imediato bug confirmado (15min, risco baixo)
1. Patch `SupabaseDirectClient.insert()` em `claudete_bot.py` (mudança de 2 linhas no Prefer + check len)
2. Testar: forçar RLS bloqueio (ex: payload com campo inválido) → confirmar que retorna False
3. Restart Claudete bot
4. **Junior testa**: manda "gastei 1 real teste" → Claudete responde sucesso APENAS se realmente gravou. Confirma com `SELECT * FROM pessoal.transacoes ORDER BY criado_em DESC LIMIT 1`

### Fase B — auditoria MCP Server Croma (1-2h, risco médio)
1. Listar todas as tools que fazem mutation (INSERT/UPDATE/DELETE no banco)
2. Pra cada uma, verificar:
   - Faz `.select().single()` no fim do mutation?
   - Trata erro silencioso de RLS?
   - Retorna estado real ou só ack do banco?
3. Reportar lista de tools com bug + fix proposto

### Fase C — wrapper genérico "executar-e-verificar" (médio prazo, opcional)
Criar uma camada no bot Python que SEMPRE faz SELECT pós-mutation com critério verificável (ex: lookup pelo ID retornado) antes de reportar sucesso. Independente da tool — protege contra bugs futuros.

### Fase D — desenhar modo dono WhatsApp com Goal-Driven (depois de Fase A+B)
Aplicar tudo aprendido aqui. Toda action no modo dono via WhatsApp segue padrão:
1. Executa mutation
2. SELECT cruzado pra confirmar
3. Reporta estado real (com ID, timestamp, valor exato)
4. Se SELECT falha: reporta erro específico

## Princípios karpathy aplicados neste diagnóstico

1. **Think Before Coding**: descobri o bug ANTES de propor fix amplo. Confirmei com leitura linha-a-linha.
2. **Simplicity First**: fix mínimo de 2 linhas resolve o bug confirmado. Sem reescrever a classe.
3. **Surgical Changes**: toca só `insert()`. Não mexe em `insert_returning`, não mexe em `executar_registrar_gasto`.
4. **Goal-Driven Execution**: critério PASS verificável = "gastei 1 real teste" + SELECT no banco confirma row.

## O que NÃO vou fazer (até Junior autorizar)

- Reescrever tools MCP Croma sem auditoria prévia
- Mexer no prompt sistêmico da Claudete (já está bom — o bug está nas tools, não no prompt)
- Migrar Claudete pra WhatsApp antes de resolver confiabilidade
- Adicionar "Cláusulas de medo" no prompt (tipo "VOCÊ ESTÁ SENDO MONITORADA, NUNCA MINTA") — placebo, não resolve causa raiz
