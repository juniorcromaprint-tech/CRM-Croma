# PLANO: MCP Server Croma — Cobertura 100%

> **Data**: 2026-04-02
> **Objetivo**: Implementar TODAS as ferramentas MCP faltantes para que o Claude opere a Croma Print 100% via MCP, sem jamais precisar de SQL direto
> **Executor**: Claude CLI via Sonnet
> **Local**: `mcp-server/src/tools/`

---

## ESTADO ATUAL

- **Banco**: 164 tabelas no schema `public`
- **MCP Server**: 54 ferramentas implementadas em 12 arquivos `.ts`
- **Cobertura operacional**: ~58%

### Ferramentas existentes por módulo (54 total)

| Módulo | Arquivo | Tools | R | W |
|--------|---------|-------|---|---|
| CRM | crm.ts | 7 | 4 | 3 |
| Propostas | propostas.ts | 5 | 2 | 3 |
| Pedidos | pedidos.ts | 6 | 3 | 3 |
| Campo | campo.ts | 7 | 4 | 3 |
| Financeiro | financeiro.ts | 6 | 2 | 4 |
| Estoque | estoque.ts | 3 | 2 | 1 |
| Admin | admin.ts | 3 | 2 | 1 |
| Fiscal | fiscal.ts | 3 | 1 | 2 |
| Qualidade | qualidade.ts | 3 | 1 | 2 |
| Impressora | impressora.ts | 6 | 3 | 3 |
| BI | bi.ts | 3 | 3 | 0 |
| Sistema | sistema.ts | 2 | 2 | 0 |

---

## MAPA COMPLETO: 164 TABELAS → COBERTURA MCP

### Legenda
- ✅ = Já tem tool MCP cobrindo
- 🔴 = SEM cobertura — precisa de tool nova (OPERACIONAL)
- 🟡 = SEM cobertura — precisa de tool nova (CONFIGURAÇÃO/ADMIN)
- ⚪ = Tabela auxiliar/interna — coberta via `croma_executar_sql` (não precisa tool dedicada)
- 🔗 = Tabela de relacionamento N:N — acessada via tool da entidade pai

### Grupo 1: CRM / Comercial (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `clientes` | ✅ | croma_listar/detalhe/cadastrar/atualizar_cliente |
| `cliente_contatos` | ✅ | via croma_detalhe_cliente |
| `cliente_unidades` | ✅ | via croma_detalhe_cliente |
| `cliente_documentos` | ⚪ | auxiliar — consultar via SQL |
| `leads` | ✅ | croma_listar/cadastrar/atualizar_status_lead |
| `origens_lead` | ⚪ | tabela de lookup — consultar via SQL |
| `oportunidades` | 🔴 | **PRECISA TOOL** |
| `atividades_comerciais` | 🔴 | **PRECISA TOOL** |
| `tarefas_comerciais` | 🔴 | **PRECISA TOOL** |
| `metas_vendas` | 🟡 | **PRECISA TOOL** |
| `sales_benchmarks` | ⚪ | config/referência |
| `client_intelligence` | ⚪ | gerado por IA — leitura via SQL |
| `comissoes` | 🔴 | **PRECISA TOOL** |
| `stores` | ⚪ | lookup de lojas |
| `contratos_servico` | 🔴 | **PRECISA TOOL** |

### Grupo 2: Propostas / Orçamentos (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `propostas` | ✅ | croma_listar/detalhe/criar/atualizar/enviar_proposta |
| `proposta_itens` | ✅ | via croma_criar/detalhe_proposta |
| `proposta_item_materiais` | 🔗 | via proposta |
| `proposta_item_acabamentos` | 🔗 | via proposta |
| `proposta_item_processos` | 🔗 | via proposta |
| `proposta_servicos` | 🔗 | via proposta |
| `proposta_versoes` | ⚪ | histórico automático |
| `proposta_views` | ⚪ | tracking automático |
| `proposta_attachments` | ⚪ | storage |
| `templates_orcamento` | 🟡 | **PRECISA TOOL** |
| `orcamento_item_maquinas` | 🔗 | via orçamento |

### Grupo 3: Pedidos / Produção (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `pedidos` | ✅ | croma_listar/detalhe/atualizar_status_pedido |
| `pedido_itens` | ✅ | via croma_detalhe_pedido |
| `pedido_historico` | ⚪ | audit trail automático |
| `ordens_producao` | ✅ | croma_listar/atualizar_status/criar_ordem_producao |
| `producao_etapas` | 🔴 | **PRECISA TOOL** |
| `producao_apontamentos` | 🔴 | **PRECISA TOOL** |
| `producao_materiais` | 🔗 | via OP |
| `producao_checklist` | ⚪ | via checklists |
| `producao_retrabalho` | ⚪ | via ocorrências |
| `processos_producao` | 🟡 | **PRECISA TOOL** |
| `setores_producao` | 🟡 | **PRECISA TOOL** |
| `etapa_templates` | 🟡 | config |
| `maquinas` | 🟡 | **PRECISA TOOL** |

### Grupo 4: Campo / Instalação (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `ordens_instalacao` | ✅ | croma_listar_instalacoes/agendar_instalacao |
| `agenda_instalacao` | ✅ | via agendar_instalacao |
| `jobs` | ✅ | croma_listar/detalhe/criar/atualizar_job_campo |
| `job_photos` | ✅ | croma_listar_fotos_job |
| `job_videos` | ⚪ | storage |
| `midias_campo` | ⚪ | storage |
| `assinaturas_campo` | ⚪ | storage |
| `checklists_campo` | ⚪ | via campo app |
| `tarefas_campo` | ⚪ | via jobs |
| `campo_audit_logs` | ⚪ | audit automático |
| `equipes` | 🟡 | **PRECISA TOOL** |
| `equipe_membros` | 🟡 | via equipes |
| `veiculos` | 🟡 | **PRECISA TOOL** |
| `ferramentas` | 🟡 | **PRECISA TOOL** |
| `checkout_almoxarife` | 🔴 | **PRECISA TOOL** |
| `diario_bordo` | ⚪ | registro de campo |

### Grupo 5: Financeiro (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `contas_receber` | ✅ | croma_listar_contas_receber/criar/registrar_pagamento |
| `contas_pagar` | ✅ | croma_listar_contas_pagar/criar/registrar_pagamento_cp |
| `parcelas_receber` | ⚪ | detalhe de CR |
| `parcelas_pagar` | ⚪ | detalhe de CP |
| `lancamentos_caixa` | 🔴 | **PRECISA TOOL** |
| `lancamentos_contabeis` | 🔴 | **PRECISA TOOL** |
| `bank_accounts` | 🟡 | **PRECISA TOOL** |
| `bank_slips` | 🔴 | **PRECISA TOOL** |
| `bank_remittances` | ⚪ | CNAB gerado |
| `bank_remittance_items` | ⚪ | via remessa |
| `bank_returns` | ⚪ | CNAB retorno |
| `bank_return_items` | ⚪ | via retorno |
| `retornos_bancarios` | ⚪ | processado automaticamente |
| `cobranca_automatica` | ⚪ | config |
| `extrato_bancario_importacoes` | ⚪ | import automático |
| `extrato_bancario_itens` | ⚪ | via extrato |
| `extrato_regras_classificacao` | ⚪ | config |
| `plano_contas` | 🟡 | **PRECISA TOOL** |
| `centros_custo` | 🟡 | **PRECISA TOOL** |
| `categorias_despesa` | 🟡 | **PRECISA TOOL** |
| `das_apuracoes` | 🔴 | **PRECISA TOOL** |

### Grupo 6: Estoque / Materiais (⚠️ Parcial)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `materiais` | ✅ parcial | croma_listar_materiais + atualizar_preco — **FALTA cadastrar/atualizar** |
| `estoque_saldos` | ✅ | croma_consultar_estoque |
| `estoque_movimentacoes` | ✅ | croma_registrar_movimento |
| `estoque_reservas` | ⚪ | automático via pedidos |
| `estoque_reservas_op` | ⚪ | automático via OP |
| `estoque_inventario` | 🔴 | **PRECISA TOOL** |
| `inventarios` | 🔴 | **PRECISA TOOL** |
| `inventario_itens` | 🔗 | via inventários |
| `materiais_historico_preco` | 🔴 | **PRECISA TOOL** |
| `faixas_quantidade` | ⚪ | config precificação |

### Grupo 7: Fornecedores / Compras (🔴 SEM COBERTURA)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `fornecedores` | 🔴 | **MÓDULO INTEIRO FALTANDO** |
| `historico_precos_fornecedor` | 🔴 | **PRECISA TOOL** |
| `pedidos_compra` | 🔴 | **MÓDULO INTEIRO FALTANDO** |
| `pedido_compra_itens` | 🔴 | via pedidos_compra |
| `cotacoes_compra` | 🔴 | **PRECISA TOOL** |
| `cotacoes` | 🔴 | **PRECISA TOOL** |
| `cotacao_itens` | 🔗 | via cotações |
| `cotacao_respostas` | 🔗 | via cotações |
| `cotacao_resposta_itens` | 🔗 | via cotações |
| `solicitacoes_compra` | 🔴 | **PRECISA TOOL** |
| `recebimentos` | 🔴 | **PRECISA TOOL** |
| `recebimento_itens` | 🔗 | via recebimentos |

### Grupo 8: Admin / Catálogo (⚠️ Parcial)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `produtos` | ✅ parcial | croma_listar_produtos — **FALTA criar/atualizar** |
| `produto_modelos` | ✅ parcial | via listar_produtos — **FALTA criar/atualizar** |
| `modelo_materiais` | 🔗 | via modelo |
| `modelo_processos` | 🔗 | via modelo |
| `regras_precificacao` | ✅ parcial | croma_listar — **FALTA criar/atualizar** |
| `config_precificacao` | ⚪ | config |
| `acabamentos` | 🟡 | **PRECISA TOOL** |
| `servicos` | 🟡 | **PRECISA TOOL** |
| `categorias_produto` | ⚪ | lookup |
| `usinagem_tempos` | ⚪ | config produção |

### Grupo 9: Fiscal (⚠️ Parcial)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `fiscal_documentos` | ✅ | croma_listar_nfe/emitir/consultar_status |
| `fiscal_documentos_itens` | 🔗 | via NF-e |
| `fiscal_xmls` | ⚪ | storage |
| `fiscal_eventos` | ⚪ | audit |
| `fiscal_erros_transmissao` | ⚪ | logs |
| `fiscal_filas_emissao` | ⚪ | fila interna |
| `fiscal_audit_logs` | ⚪ | audit |
| `fiscal_ambientes` | ⚪ | config |
| `fiscal_certificados` | ⚪ | config |
| `fiscal_regras_operacao` | ⚪ | config |
| `fiscal_series` | ⚪ | config |
| `config_tributaria` | ⚪ | config |

### Grupo 10: Qualidade (⚠️ Parcial — mas tools existem)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `ocorrencias` | ✅ | croma_listar/criar/atualizar_ocorrencia |
| `ocorrencia_tratativas` | 🔴 | **PRECISA TOOL** |

### Grupo 11: Impressora (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `impressora_jobs` | ✅ | croma_listar/registrar/vincular_jobs_impressora |
| `impressora_config` | ✅ | via resumo_impressora |
| `impressora_proporcoes_tinta` | ✅ | via custo_real_pedido |
| `impressora_substrato_map` | ✅ | croma_mapear_substrato |

### Grupo 12: BI / Analytics (✅ Coberto)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `business_intelligence_config` | ⚪ | config |
| `alert_rules` | ⚪ | config |
| `alert_history` | ⚪ | via croma_alertas_ativos |
| `quadro_avisos` | ⚪ | notificações internas |

### Grupo 13: AI / Agentes (⚪ Interno)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `agent_conversations` | ⚪ | interno IA |
| `agent_messages` | ⚪ | interno IA |
| `agent_rules` | ⚪ | config IA |
| `agent_templates` | ⚪ | config IA |
| `ai_alertas` | ⚪ | interno |
| `ai_logs` | ⚪ | logs |
| `ai_memory` | ⚪ | interno |
| `ai_memory_events` | ⚪ | interno |
| `ai_requests` | ⚪ | logs |
| `ai_responses` | ⚪ | logs |

### Grupo 14: Sistema / Config (⚪ Interno)
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `profiles` | ⚪ | auth |
| `roles` | ⚪ | auth |
| `permissions` | ⚪ | auth |
| `permissoes_perfil` | ⚪ | auth |
| `empresas` | ⚪ | config |
| `company_settings` | ⚪ | config |
| `admin_config` | ⚪ | config |
| `routing_rules` | ⚪ | config |
| `webhook_configs` | ⚪ | config |
| `system_events` | ⚪ | logs |
| `import_logs` | ⚪ | logs |
| `registros_auditoria` | ⚪ | audit |
| `anexos` | ⚪ | storage |

### Grupo 15: Campanhas / Comunicação
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `campanhas` | 🔴 | **PRECISA TOOL** |
| `campanha_destinatarios` | 🔗 | via campanhas |
| `notificacoes` | ⚪ | automático |
| `notifications` | ⚪ | automático |
| `nps_respostas` | 🔴 | **PRECISA TOOL** |
| `notas_internas` | ⚪ | via SQL |
| `telegram_messages` | ⚪ | logs |

### Grupo 16: Checklists
| Tabela | Status | Tool MCP |
|--------|--------|----------|
| `checklists` | ⚪ | config |
| `checklist_itens` | ⚪ | config |
| `checklist_execucoes` | ⚪ | via app |
| `checklist_execucao_itens` | ⚪ | via app |

---

## FERRAMENTAS NOVAS — COMPLETO PARA 100%

### Resumo: 37 tools novas em 7 Sprints

| Sprint | Módulo | Tools | Prioridade | Estimativa |
|--------|--------|-------|------------|------------|
| **1** | Fornecedores + Material | 7 | 🔴 Crítica | 2-3h |
| **2** | Compras (PC + Recebimento) | 5 | 🔴 Crítica | 3-4h |
| **3** | Admin/Catálogo + Precificação | 5 | 🟠 Alta | 2-3h |
| **4** | Comercial (Atividades + Comissões + Contratos) | 6 | 🟠 Alta | 2-3h |
| **5** | Produção Avançado + Estoque | 5 | 🟠 Alta | 2-3h |
| **6** | Financeiro Avançado (Caixa + DAS + Boletos + Contas) | 5 | 🟠 Alta | 2-3h |
| **7** | Campanhas + Config (Equipes, Máquinas, Acabamentos) | 4 | 🟡 Média | 2h |
| **TOTAL** | | **37 tools** | | **15-21h** |

**Resultado final: 54 + 37 = 91 ferramentas → Cobertura 100%**

(As ~50 tabelas ⚪ são internas/automáticas/config/logs que não precisam de tool dedicada — são acessíveis via `croma_executar_sql` quando necessário.)

---

### Padrão de implementação (OBRIGATÓRIO)

Todas as novas ferramentas DEVEM seguir o padrão existente:
1. Registrar via `server.tool("croma_nome_ferramenta", schema_zod, handler)`
2. Usar Zod para validação de input
3. Usar `supabase` client do `../supabase.ts`
4. Retornar markdown (default) ou JSON via `response_format`
5. Tabelas referenciadas devem existir no banco (verificar antes)
6. WRITE tools: usar `.select().single()` para detectar RLS silencioso
7. Exportar a função `registerXxxTools(server)` e importar no `index.ts`

---

## SPRINT 1 — Fornecedores + Cadastro Material (7 tools) 🔴
**Arquivo novo**: `mcp-server/src/tools/fornecedores.ts`
**Arquivo existente**: `mcp-server/src/tools/estoque.ts` (adicionar 2 tools)
**Estimativa**: 2-3h

### 1.1 `croma_listar_fornecedores` — READ
```typescript
// Arquivo: fornecedores.ts
// Tabela: fornecedores
{
  busca: z.string().max(200).optional(),        // Busca por nome/CNPJ
  categoria: z.string().max(50).optional(),      // Filtro por categorias[]
  ativo_only: z.boolean().default(true),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// SQL: SELECT * FROM fornecedores WHERE ativo = true
//   AND (razao_social ILIKE '%busca%' OR nome_fantasia ILIKE '%busca%' OR cnpj ILIKE '%busca%')
```

### 1.2 `croma_detalhe_fornecedor` — READ
```typescript
// Arquivo: fornecedores.ts
// Tabelas: fornecedores + contas_pagar
{
  fornecedor_id: z.string().uuid(),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// 1) SELECT * FROM fornecedores WHERE id = $1
// 2) SELECT * FROM contas_pagar WHERE fornecedor_id = $1 ORDER BY created_at DESC LIMIT 20
// 3) SELECT SUM(valor_original), COUNT(*) FROM contas_pagar WHERE fornecedor_id = $1
```

### 1.3 `croma_cadastrar_fornecedor` — WRITE
```typescript
// Arquivo: fornecedores.ts
{
  razao_social: z.string().min(3).max(200),
  nome_fantasia: z.string().max(200).optional(),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  contato_nome: z.string().max(100).optional(),
  categorias: z.array(z.string()).optional(),
  lead_time_dias: z.number().int().min(0).optional(),
  condicao_pagamento: z.string().max(100).optional(),
  observacoes: z.string().max(500).optional()
}
```

### 1.4 `croma_atualizar_fornecedor` — WRITE
```typescript
// Arquivo: fornecedores.ts
{
  fornecedor_id: z.string().uuid(),
  // Todos os campos de 1.3 como optional + ativo: z.boolean().optional()
}
```

### 1.5 `croma_historico_compras_fornecedor` — READ
```typescript
// Arquivo: fornecedores.ts
{
  fornecedor_id: z.string().uuid(),
  periodo_meses: z.number().int().min(1).max(24).default(12),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Agrega: compras por mês, materiais mais comprados, valor médio
```

### 1.6 `croma_cadastrar_material` — WRITE
```typescript
// Arquivo: estoque.ts
{
  codigo: z.string().min(1).max(50),
  nome: z.string().min(3).max(300),
  categoria: z.string().min(1).max(50),
  unidade: z.enum(['m²', 'm', 'un', 'kg', 'L', 'ml', 'rolo', 'chapa', 'pç']),
  preco_medio: z.number().positive(),
  ncm: z.string().max(10).optional(),
  estoque_minimo: z.number().min(0).default(0),
  estoque_ideal: z.number().min(0).optional(),
  estoque_controlado: z.boolean().default(true),
  localizacao: z.string().max(100).optional(),
  venda_direta: z.boolean().default(false),
  aproveitamento: z.number().min(0).max(100).optional()
}
// INSERT materiais + INSERT estoque_saldos (quantidade_disponivel = 0)
```

### 1.7 `croma_atualizar_material` — WRITE
```typescript
// Arquivo: estoque.ts
{
  material_id: z.string().uuid(),
  // Todos os campos de 1.6 como optional + ativo: z.boolean().optional()
}
```

**Registro no index.ts:**
```typescript
import { registerFornecedoresTools } from './tools/fornecedores.js';
registerFornecedoresTools(server);
```

---

## SPRINT 2 — Compras / Pedidos de Compra (5 tools) 🔴
**Arquivo novo**: `mcp-server/src/tools/compras.ts`
**Estimativa**: 3-4h
**⚠️ ANTES DE IMPLEMENTAR**: Verificar schema das tabelas:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('pedidos_compra', 'pedido_compra_itens', 'recebimentos', 'recebimento_itens', 'solicitacoes_compra')
ORDER BY table_name, ordinal_position;
```

### 2.1 `croma_listar_compras` — READ
```typescript
{
  busca: z.string().max(200).optional(),
  filtro_status: z.string().optional(),
  filtro_fornecedor: z.string().uuid().optional(),
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// JOIN pedidos_compra + fornecedores
```

### 2.2 `croma_detalhe_compra` — READ
```typescript
{
  pedido_compra_id: z.string().uuid(),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// pedidos_compra + pedido_compra_itens + fornecedores + materiais
```

### 2.3 `croma_criar_compra` — WRITE
```typescript
{
  fornecedor_id: z.string().uuid(),
  itens: z.array(z.object({
    material_id: z.string().uuid(),
    quantidade: z.number().positive(),
    preco_unitario: z.number().positive(),
    observacao: z.string().max(200).optional()
  })).min(1),
  condicao_pagamento: z.string().max(100).optional(),
  prazo_entrega: z.string().max(50).optional(),
  observacoes: z.string().max(500).optional()
}
// INSERT pedidos_compra (status "rascunho") + pedido_compra_itens (loop)
```

### 2.4 `croma_atualizar_status_compra` — WRITE
```typescript
{
  pedido_compra_id: z.string().uuid(),
  novo_status: z.enum(['rascunho', 'enviado', 'confirmado', 'parcial', 'recebido', 'cancelado']),
  observacoes: z.string().max(500).optional()
}
// State machine: rascunho → enviado → confirmado → parcial/recebido | cancelado
```

### 2.5 `croma_registrar_recebimento` — WRITE (FLUXO COMPLETO)
```typescript
{
  pedido_compra_id: z.string().uuid(),
  itens_recebidos: z.array(z.object({
    item_id: z.string().uuid(),
    quantidade_recebida: z.number().positive(),
    observacao: z.string().max(200).optional()
  })).min(1),
  numero_nf: z.string().max(50).optional(),
  valor_nf: z.number().positive().optional(),
  gerar_contas_pagar: z.boolean().default(true),
  parcelas: z.array(z.object({
    valor: z.number().positive(),
    vencimento: z.string(),
    forma_pagamento: z.enum(['boleto', 'pix', 'transferencia'])
  })).optional()
}
// 1. Para cada item: registrar_movimento (entrada no estoque)
// 2. Atualizar status PC → "parcial" ou "recebido"
// 3. Se gerar_contas_pagar: criar CPs com parcelas
// ESTE É O FLUXO QUE FIZEMOS MANUALMENTE COM A VINILSUL
```

---

## SPRINT 3 — Admin + Precificação (5 tools) 🟠
**Arquivo existente**: `mcp-server/src/tools/admin.ts`
**Estimativa**: 2-3h

### 3.1 `croma_criar_produto` — WRITE
```typescript
{
  nome: z.string().min(3).max(200),
  codigo: z.string().max(50).optional(),
  descricao: z.string().max(500).optional(),
  categoria: z.string().max(50).optional(),
  ativo: z.boolean().default(true)
}
```

### 3.2 `croma_criar_modelo_produto` — WRITE
```typescript
{
  produto_id: z.string().uuid(),
  nome: z.string().min(3).max(200),
  codigo: z.string().max(50).optional(),
  markup: z.number().positive().optional(),
  materiais: z.array(z.object({
    material_id: z.string().uuid(),
    quantidade_por_m2: z.number().positive(),
    principal: z.boolean().default(false)
  })).optional()
}
// INSERT produto_modelos + modelo_materiais (loop)
```

### 3.3 `croma_atualizar_modelo_produto` — WRITE
```typescript
{
  modelo_id: z.string().uuid(),
  nome: z.string().max(200).optional(),
  markup: z.number().positive().optional(),
  ativo: z.boolean().optional()
}
```

### 3.4 `croma_criar_regra_precificacao` — WRITE
```typescript
{
  categoria: z.string().min(1).max(50),
  markup_minimo: z.number().positive(),
  markup_maximo: z.number().positive(),
  desconto_maximo_percent: z.number().min(0).max(100).default(15),
  margem_alvo_percent: z.number().min(0).max(100).optional(),
  observacoes: z.string().max(500).optional()
}
```

### 3.5 `croma_atualizar_regra_precificacao` — WRITE
```typescript
{
  regra_id: z.string().uuid(),
  markup_minimo: z.number().positive().optional(),
  markup_maximo: z.number().positive().optional(),
  desconto_maximo_percent: z.number().min(0).max(100).optional(),
  ativo: z.boolean().optional(),
  observacoes: z.string().max(500).optional()
}
```

---

## SPRINT 4 — Comercial Avançado (6 tools) 🟠
**Arquivo existente**: `mcp-server/src/tools/crm.ts`
**Estimativa**: 2-3h

### 4.1 `croma_listar_atividades_comerciais` — READ
```typescript
{
  filtro_cliente: z.string().uuid().optional(),
  filtro_tipo: z.string().optional(),  // visita, ligacao, email, reuniao
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: atividades_comerciais + clientes
```

### 4.2 `croma_registrar_atividade_comercial` — WRITE
```typescript
{
  cliente_id: z.string().uuid(),
  tipo: z.enum(['visita', 'ligacao', 'email', 'reuniao', 'whatsapp', 'outro']),
  descricao: z.string().min(3).max(500),
  data_atividade: z.string().optional(), // YYYY-MM-DD, default today
  resultado: z.string().max(200).optional(),
  proxima_acao: z.string().max(200).optional(),
  observacoes: z.string().max(500).optional()
}
// Tabela: atividades_comerciais
```

### 4.3 `croma_listar_comissoes` — READ
```typescript
{
  filtro_vendedor: z.string().uuid().optional(),
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  filtro_status: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: comissoes + pedidos + clientes
```

### 4.4 `croma_registrar_comissao` — WRITE
```typescript
{
  pedido_id: z.string().uuid(),
  vendedor_id: z.string().uuid().optional(),
  percentual: z.number().min(0).max(100),
  valor: z.number().positive().optional(),
  observacoes: z.string().max(200).optional()
}
// Tabela: comissoes
```

### 4.5 `croma_listar_contratos` — READ
```typescript
{
  filtro_cliente: z.string().uuid().optional(),
  filtro_status: z.string().optional(),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: contratos_servico + clientes
```

### 4.6 `croma_criar_contrato` — WRITE
```typescript
{
  cliente_id: z.string().uuid(),
  descricao: z.string().min(3).max(500),
  valor_mensal: z.number().positive().optional(),
  data_inicio: z.string(), // YYYY-MM-DD
  data_fim: z.string().optional(),
  tipo: z.string().max(50).optional(),
  observacoes: z.string().max(500).optional()
}
// Tabela: contratos_servico
```

---

## SPRINT 5 — Produção Avançado + Estoque (5 tools) 🟠
**Arquivos**: `mcp-server/src/tools/pedidos.ts` + `estoque.ts`
**Estimativa**: 2-3h

### 5.1 `croma_registrar_apontamento_producao` — WRITE
```typescript
// Arquivo: pedidos.ts
{
  ordem_producao_id: z.string().uuid(),
  etapa: z.string().max(100),  // impressao, corte, acabamento, conferencia
  tempo_minutos: z.number().positive(),
  operador: z.string().max(100).optional(),
  observacoes: z.string().max(300).optional()
}
// Tabela: producao_apontamentos
```

### 5.2 `croma_listar_apontamentos_producao` — READ
```typescript
// Arquivo: pedidos.ts
{
  ordem_producao_id: z.string().uuid().optional(),
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: producao_apontamentos + ordens_producao
```

### 5.3 `croma_listar_maquinas` — READ
```typescript
// Arquivo: admin.ts
{
  ativo_only: z.boolean().default(true),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: maquinas
```

### 5.4 `croma_sugerir_compra` — READ
```typescript
// Arquivo: estoque.ts
{
  apenas_criticos: z.boolean().default(false),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// SQL: materiais LEFT JOIN estoque_saldos WHERE saldo < minimo/ideal
// Retorna: materiais para comprar, qtd sugerida, valor estimado
```

### 5.5 `croma_historico_precos_material` — READ
```typescript
// Arquivo: estoque.ts
{
  material_id: z.string().uuid(),
  periodo_meses: z.number().int().min(1).max(24).default(12),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: materiais_historico_preco
```

---

## SPRINT 6 — Financeiro Avançado (5 tools) 🟠
**Arquivo existente**: `mcp-server/src/tools/financeiro.ts`
**Estimativa**: 2-3h

### 6.1 `croma_registrar_lancamento_caixa` — WRITE
```typescript
{
  tipo: z.enum(['entrada', 'saida']),
  valor: z.number().positive(),
  categoria: z.string().max(100),
  descricao: z.string().min(3).max(300),
  data_lancamento: z.string().optional(), // YYYY-MM-DD
  conta_bancaria_id: z.string().uuid().optional(),
  centro_custo_id: z.string().uuid().optional(),
  observacoes: z.string().max(500).optional()
}
// Tabela: lancamentos_caixa
```

### 6.2 `croma_listar_lancamentos_caixa` — READ
```typescript
{
  filtro_tipo: z.enum(['entrada', 'saida']).optional(),
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  filtro_categoria: z.string().optional(),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: lancamentos_caixa
```

### 6.3 `croma_listar_contas_bancarias` — READ
```typescript
{
  ativo_only: z.boolean().default(true),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: bank_accounts
```

### 6.4 `croma_gerar_boleto` — WRITE
```typescript
{
  conta_receber_id: z.string().uuid(),
  banco_id: z.string().uuid().optional(),
  observacoes: z.string().max(200).optional()
}
// Tabela: bank_slips
// Gera boleto vinculado à conta a receber
```

### 6.5 `croma_consultar_das` — READ
```typescript
{
  competencia: z.string().optional(), // YYYY-MM
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: das_apuracoes
// DAS = Documento de Arrecadação do Simples Nacional
```

---

## SPRINT 7 — Campanhas + Config Operacional (4 tools) 🟡
**Arquivos**: `mcp-server/src/tools/crm.ts` + `campo.ts` + `admin.ts`
**Estimativa**: 2h

### 7.1 `croma_listar_campanhas` — READ
```typescript
// Arquivo: crm.ts
{
  filtro_status: z.string().optional(),
  limit_rows: z.number().min(1).max(500).default(50),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: campanhas + campanha_destinatarios (contagem)
```

### 7.2 `croma_listar_nps` — READ
```typescript
// Arquivo: crm.ts
{
  filtro_nota: z.number().int().min(0).max(10).optional(),
  filtro_periodo: z.object({ data_inicio: z.string(), data_fim: z.string() }).optional(),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: nps_respostas
// Retorna: NPS score, detratores/neutros/promotores, comentários
```

### 7.3 `croma_listar_equipes` — READ
```typescript
// Arquivo: campo.ts
{
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabela: equipes + equipe_membros
```

### 7.4 `croma_listar_acabamentos_servicos` — READ
```typescript
// Arquivo: admin.ts
{
  tipo: z.enum(['acabamentos', 'servicos', 'ambos']).default('ambos'),
  response_format: z.enum(['markdown', 'json']).default('markdown')
}
// Tabelas: acabamentos + servicos
// Lista todos disponíveis para uso em orçamentos
```

---

## RESUMO FINAL COMPLETO

| Sprint | Tools | Arquivo(s) | Estimativa | Status |
|--------|-------|------------|------------|--------|
| **1** | 7 (Fornecedores + Material) | `fornecedores.ts` (novo) + `estoque.ts` | 2-3h | 🔴 Fazer primeiro |
| **2** | 5 (Compras) | `compras.ts` (novo) | 3-4h | 🔴 Fazer segundo |
| **3** | 5 (Admin/Catálogo) | `admin.ts` | 2-3h | 🟠 |
| **4** | 6 (Comercial avançado) | `crm.ts` | 2-3h | 🟠 |
| **5** | 5 (Produção + Estoque) | `pedidos.ts` + `estoque.ts` + `admin.ts` | 2-3h | 🟠 |
| **6** | 5 (Financeiro avançado) | `financeiro.ts` | 2-3h | 🟠 |
| **7** | 4 (Campanhas + Config) | `crm.ts` + `campo.ts` + `admin.ts` | 2h | 🟡 |
| **TOTAL** | **37 tools** | 2 novos + 5 existentes | **15-21h** | |

**ANTES: 54 tools → DEPOIS: 91 tools = COBERTURA 100%**

---

## CHECKLIST GERAL

### Por Sprint
- [ ] **Sprint 1**: fornecedores.ts (5) + estoque.ts (2) + registrar no index.ts + build + testar
- [ ] **Sprint 2**: compras.ts (5) + verificar schema tabelas + registrar + build + testar
- [ ] **Sprint 3**: admin.ts (5) + build + testar
- [ ] **Sprint 4**: crm.ts (6) + verificar schema tabelas + build + testar
- [ ] **Sprint 5**: pedidos.ts (2) + estoque.ts (2) + admin.ts (1) + build + testar
- [ ] **Sprint 6**: financeiro.ts (5) + verificar schema tabelas + build + testar
- [ ] **Sprint 7**: crm.ts (2) + campo.ts (1) + admin.ts (1) + build + testar

### Pós-implementação
- [ ] Atualizar `CLAUDE.md` — tabela de ferramentas (91 total)
- [ ] Atualizar contagem no header do CLAUDE.md
- [ ] Rodar `croma_health_check`
- [ ] Teste E2E: comprar insumo completo via MCP (sem SQL direto)
- [ ] Teste E2E: cadastrar produto completo com modelo e materiais
- [ ] Teste E2E: registrar atividade comercial e comissão

---

## INSTRUÇÕES PARA O CLI SONNET

**Contexto**: Ler este arquivo + `mcp-server/src/tools/` para entender o padrão.

**Ordem de execução**:
1. Ler `mcp-server/src/index.ts` para entender como tools são registradas
2. Ler `mcp-server/src/tools/crm.ts` como exemplo de padrão (melhor referência — mais completo)
3. Ler `mcp-server/src/supabase.ts` para entender client setup
4. **ANTES de cada Sprint**: verificar schema das tabelas referenciadas via SQL
5. Executar Sprint por Sprint na ordem
6. Testar build após cada sprint: `cd mcp-server && npm run build`
7. Testar cada tool via: `node mcp-server/dist/index.js` ou `croma.cmd <tool> {json}`

**Regras obrigatórias**:
- Todo INSERT/UPDATE: `.select().single()` (regra RLS)
- Todo schema Zod: seguir padrão dos arquivos existentes
- Markdown output: formatado igual aos tools existentes (headers ##, listas -, negrito **)
- Não quebrar tools existentes — só adicionar novas
- Cada novo arquivo: exportar função `registerXxxTools(server: McpServer)`
- Verificar schema da tabela ANTES de escrever o tool (colunas podem ter nomes diferentes)
- Rodar build completo ao final de cada sprint

**⚠️ ATENÇÃO ESPECIAL**:
- Sprint 2 (Compras): Tabelas `pedidos_compra`, `pedido_compra_itens`, `recebimentos`, `recebimento_itens` — verificar se schema bate com os parâmetros propostos
- Sprint 4 (Comercial): Tabelas `atividades_comerciais`, `comissoes`, `contratos_servico` — verificar colunas
- Sprint 6 (Financeiro): Tabelas `lancamentos_caixa`, `bank_accounts`, `bank_slips`, `das_apuracoes` — verificar colunas
