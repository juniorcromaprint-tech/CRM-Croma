# Croma MCP Server

Servidor MCP que permite ao Claude operar o ERP da Croma Print como funcionário digital.

Conecta diretamente ao Supabase com `service_role_key` (bypass do RLS) e expõe
**25 ferramentas** cobrindo todos os módulos do sistema.

## Ferramentas disponíveis

| Ferramenta | Módulo | Tipo |
|---|---|---|
| `croma_listar_clientes` | CRM | Leitura |
| `croma_detalhe_cliente` | CRM | Leitura |
| `croma_cadastrar_cliente` | CRM | Escrita |
| `croma_atualizar_cliente` | CRM | Escrita |
| `croma_listar_leads` | CRM | Leitura |
| `croma_cadastrar_lead` | CRM | Escrita |
| `croma_listar_propostas` | Orçamentos | Leitura |
| `croma_detalhe_proposta` | Orçamentos | Leitura |
| `croma_criar_proposta` | Orçamentos | Escrita |
| `croma_atualizar_status_proposta` | Orçamentos | Escrita |
| `croma_listar_pedidos` | Pedidos | Leitura |
| `croma_detalhe_pedido` | Pedidos | Leitura |
| `croma_listar_ordens_producao` | Produção | Leitura |
| `croma_atualizar_status_producao` | Produção | Escrita |
| `croma_listar_instalacoes` | Campo | Leitura |
| `croma_agendar_instalacao` | Campo | Escrita |
| `croma_listar_contas_receber` | Financeiro | Leitura |
| `croma_listar_contas_pagar` | Financeiro | Leitura |
| `croma_consultar_estoque` | Estoque | Leitura |
| `croma_listar_materiais` | Estoque | Leitura |
| `croma_dashboard_executivo` | BI | Leitura |
| `croma_alertas_ativos` | BI | Leitura |
| `croma_pipeline_comercial` | BI | Leitura |
| `croma_executar_sql` | Sistema | Leitura |
| `croma_health_check` | Sistema | Leitura |

## Requisitos

- Node.js 18+
- `SUPABASE_SERVICE_ROLE_KEY` configurada no ambiente

## Instalação e build

```bash
cd mcp-server
npm install
npm run build
```

## Configuração no Claude Code

Adicione ao `~/.claude/claude_desktop_config.json` (ou configurações do Claude Code):

```json
{
  "mcpServers": {
    "croma": {
      "command": "node",
      "args": ["C:/Users/Caldera/Claude/CRM-Croma/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_SERVICE_ROLE_KEY": "sua_service_role_key_aqui"
      }
    }
  }
}
```

Ou via CLI:

```bash
claude mcp add croma \
  --command "node" \
  --args "C:/Users/Caldera/Claude/CRM-Croma/mcp-server/dist/index.js" \
  --env "SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key"
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Sim | Chave service_role do Supabase (bypass RLS) |

## Segurança

- `service_role_key` fornece acesso total ao banco — **nunca expor em código ou repositório**
- `croma_executar_sql` aceita apenas queries `SELECT`/`WITH` — DML bloqueado automaticamente
- Transport stdio — servidor roda localmente, sem porta de rede exposta

## Stack

- TypeScript + `@modelcontextprotocol/sdk` v1.6+
- `@supabase/supabase-js` v2
- `zod` para validação de inputs
- Transport: `stdio`
