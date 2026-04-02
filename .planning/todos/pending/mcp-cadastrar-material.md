# Nova Ferramenta MCP: croma_cadastrar_material

**Prioridade**: Alta — operação rotineira que hoje depende de SQL direto
**Criado em**: 2026-04-02
**Origem**: Processo de compra de insumo (NF 373192 VinilSul)

## Problema

Não existe ferramenta MCP para cadastrar materiais novos. Hoje o fluxo de compra de insumos exige:
1. `croma_listar_materiais` — verificar se já existe ✅
2. **INSERT via SQL direto no Supabase** — cadastrar material novo ❌ (deveria ser MCP)
3. `croma_registrar_movimento` — dar entrada no estoque ✅
4. `croma_criar_conta_pagar` — registrar duplicatas ✅

O passo 2 quebra a regra absoluta de usar MCP para tudo.

## Solução

Criar `croma_cadastrar_material` no módulo `admin` ou `estoque` do MCP Server.

### Parâmetros sugeridos
```json
{
  "codigo": "string (obrigatório) — código do produto/fornecedor",
  "nome": "string (obrigatório) — nome completo com fabricante e fornecedor",
  "categoria": "string (obrigatório) — Mídia, Acabamento, Estrutura, etc.",
  "unidade": "string (obrigatório) — m², m, un, kg, L",
  "preco_medio": "number (obrigatório) — preço médio por unidade em R$",
  "ncm": "string — código NCM/SH",
  "estoque_minimo": "number — quantidade mínima de alerta",
  "estoque_ideal": "number — quantidade ideal em estoque",
  "estoque_controlado": "boolean — se controla saldo (default true)",
  "fornecedor_id": "UUID — vínculo com tabela fornecedores"
}
```

### Localização no código
- Arquivo: `mcp-server/src/tools/admin.ts` ou `mcp-server/src/tools/estoque.ts`
- Padrão: seguir mesmo padrão de `croma_cadastrar_cliente` em `crm.ts`

## Também considerar

- `croma_cadastrar_fornecedor` — hoje também não existe como ferramenta MCP (cadastramos VinilSul via SQL direto)
- Vincular material ao fornecedor (tabela de relacionamento ou campo `fornecedor_id` em materiais)
