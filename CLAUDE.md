# CROMA PRINT — CRM/ERP SISTEMA

> **Versão**: 6.0 | **Atualizado**: 2026-04-24 | **Status**: Produção — MCP Server 93 ferramentas

---

## REGRA #1 — MCP SERVER CROMA É O SISTEMA

O MCP Server Croma é a interface principal para TODA operação. Claude opera a Croma ATRAVÉS do MCP.

**Hierarquia (SEM EXCEÇÕES):**

1. **MCP Server Croma** — OBRIGATÓRIO para tudo que envolve dados do negócio
2. **Consultas (leitura)**: executar direto, sem pedir permissão
3. **Alterações (escrita)**: confirmar com Junior antes
4. **Frontend/React**: APENAS para bugs de UI, features visuais
5. **Supabase/apply_migration**: apenas infraestrutura técnica (DDL, RLS, schema)

**PROIBIDO ❌**

- Inventar preços — consultar `materiais` + `produto_modelos` + `regras_precificacao` via MCP
- Inventar dados de clientes — buscar no banco via MCP
- Usar SQL direto quando existe ferramenta MCP para a operação
- Estimar/chutar qualquer valor que existe no banco

**OBRIGATÓRIO ✅**

- Consultar preço real antes de cotar qualquer produto
- Criar propostas/orçamentos reais no sistema
- Usar motor Mubisys (materiais + markup + regras) para precificação
- Consultar `croma_custo_real_pedido` / `croma_resumo_impressora` antes de estimar margens

---

## ACESSO À MCP CROMA — MEMORIZAR (não esquecer!)

A MCP Croma é acessada de forma DIFERENTE em cada surface do Claude:

| Surface | Como invocar |
|---|---|
| **Telegram (Claudete)** | Bot Python conecta direto à MCP via stdio |
| **Claude Code (CLI)** | Ferramentas `croma_*` aparecem nativas via stdio |
| **Cowork (Desktop) ⚠️** | **VIA Desktop Commander** — não aparece em `list_connectors` |

### Comando bridge no Cowork (sempre que operar Croma daqui):

```
mcp__Desktop_Commander__start_process
  command: C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd <tool_name> <json_args>
  shell: cmd
  timeout_ms: 30000
```

**Exemplos práticos:**

- Health check: `croma.cmd croma_health_check`
- JSON sem acentos: `croma.cmd croma_listar_clientes {"limit":5}`
- JSON com acentos/espaços (use PowerShell, aspas simples preservam literal):
  ```
  $env:CROMA_ARGS='{"campo":"valor com espaço","outro":"acentuação"}';
  & "C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd" <tool>
  ```

⚠️ **Antes de afirmar "MCP Croma offline"** → SEMPRE testar com `croma_health_check`. Em 99% dos casos ela está ativa no Cowork — só não aparece como "MCP deferred" porque é um binário bridge, não um servidor MCP nativo registrado.

---

## DADOS ESSENCIAIS

- **Repo**: `C:\Users\Caldera\Claude\CRM-Croma` | GitHub: `juniorcromaprint-tech/CRM-Croma`
- **Vercel ERP**: `crm-croma.vercel.app` | **Campo**: `campo-croma.vercel.app`
- **Supabase**: `djwjmfgplnqyffdcgdaw`
- **PIX**: CNPJ 18.923.994/0001-83 | **Email**: [junior@cromaprint.com.br](mailto:junior@cromaprint.com.br)
- **Visão**: Primeira empresa de comunicação visual gerida por IA

---

## PADRÕES DE CÓDIGO

- **Código**: TypeScript/inglês | **UI**: pt-BR em TUDO que o usuário vê
- **Cards**: `rounded-2xl` | **Inputs**: `rounded-xl`
- **Cor primária**: `bg-blue-600 hover:bg-blue-700`
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- **Formatação**: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- **Supabase client**: `@/integrations/supabase/client.ts`
- **Mutations**: TODO insert/update DEVE usar `.select().single()` (detectar RLS silencioso)
- **AlertDialogAction async**: SEMPRE `e.preventDefault()` + fechar dialog manualmente via `onSettled`
- **Auth**: `ProtectedRoute` obrigatório. Login em todas as rotas exceto `/p/:token` e `/nps/:token`

### Estado Vazio Padrão

```tsx
<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
  <Icon size={40} className="mx-auto text-slate-300 mb-3" />
  <h3 className="font-semibold text-slate-600">Título</h3>
  <p className="text-sm text-slate-400 mt-1">Ação sugerida</p>
</div>
```

---

## CONTEXTO SOB DEMANDA — LER QUANDO NECESSÁRIO

Precisa de...Ler arquivoLista das 93 ferramentas MCP por módulo`.context/mcp-ferramentas.md`Dados da empresa, produtos, clientes referência`.context/empresa.md`Stack, arquitetura, módulos, dev server`.context/arquitetura.md`Migrations aplicadas, dados no banco`.context/migrations.md`HP Latex 365, custeio, consumíveis`.context/hp-latex.md`Sprints concluídos, bugs corrigidos, auditorias`.context/historico-sprints.md`Estado atual, última atividade, blockers`.planning/STATE.md`Papel do Claude, divisão responsabilidades`.planning/IDENTITY.md`Visão, requirements, constraints`.planning/PROJECT.md`Requirements checkáveis (BUG-01, GAP-01)`.planning/REQUIREMENTS.md`Histórico sessões cross-projeto`Obsidian → 99-Meta/memory.md`

**Regra**: não carregar tudo sempre. Ler só o que a tarefa exige.

---

## GSD — CONTEXTO ESTRUTURADO

1. Ler [IDENTITY.md](http://IDENTITY.md) + [STATE.md](http://STATE.md) antes de tarefa não-trivial
2. Atualizar [STATE.md](http://STATE.md) após work significativo
3. Marcar requirements como \[x\] quando completados
4. Logar decisões em [PROJECT.md](http://PROJECT.md)
5. Atualizar Obsidian `memory.md` ao final de sessões produtivas

---

## OBSIDIAN VAULT

Memória persistente cross-projeto: `C:\Users\Caldera\Obsidian\JARVIS`

- Decisões → `10-Projetos/Croma-Print/decisoes/`
- Aprendizados → `10-Projetos/Croma-Print/aprendizados/`
- Processos → `30-Conhecimento/Processos/`
- Usar `[[wikilinks]]` para conectar notas