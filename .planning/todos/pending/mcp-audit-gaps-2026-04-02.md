# Auditoria MCP Server — Gaps Identificados (2026-04-02)

> Origem: Processo real de compra de insumo (NF 373192 VinilSul) expôs gaps no fluxo

## Resumo

| Módulo | Tools Existentes | Gaps | Cobertura |
|--------|-----------------|------|-----------|
| CRM | 7 | 0 | 100% ✅ |
| Propostas | 5 | 0 | 100% ✅ |
| Pedidos | 6 | 0 | 100% ✅ |
| Financeiro | 6 | 0 | 100% ✅ |
| BI | 3 | 0 | 100% ✅ |
| Sistema | 2 | 0 | 100% ✅ |
| **Fornecedores** | **0** | **5** | **0% 🔴** |
| **Compras** | **0** | **4** | **0% 🔴** |
| Estoque | 3 | 3 | 60% ⚠️ |
| Admin | 3 | 4 | 43% ⚠️ |
| Fiscal | 1 | 2 | 33% ⚠️ |
| Campo | 1 | 2 | 33% ⚠️ |
| Qualidade | 1 | 2 | 33% ⚠️ |
| Impressora | 1 | 1 | 50% ⚠️ |
| **TOTAL** | **39** | **28** | **58%** |

---

## PRIORIDADE 1 — CRÍTICO (bloqueia operações diárias)

### 1. Módulo Fornecedores (5 tools) — MÓDULO COMPLETO FALTANDO
```
croma_listar_fornecedores        → READ fornecedores
croma_detalhe_fornecedor         → READ fornecedores + contas_pagar (histórico)
croma_cadastrar_fornecedor       → WRITE fornecedores
croma_atualizar_fornecedor       → WRITE fornecedores
croma_historico_compras_fornecedor → READ contas_pagar + estoque_movimentacoes
```

### 2. Cadastro de Material (1 tool)
```
croma_cadastrar_material         → WRITE materiais
```

### 3. Módulo Compras (4 tools) — MÓDULO COMPLETO FALTANDO
```
croma_listar_compras             → READ (verificar se tabela existe)
croma_criar_compra               → WRITE
croma_atualizar_status_compra    → WRITE
croma_registrar_recebimento      → WRITE compras + estoque_movimentacoes
```

---

## PRIORIDADE 2 — ALTA (operações semanais)

### 4. Ordens de Instalação - Write (2 tools)
```
croma_agendar_instalacao           → WRITE ordens_instalacao
croma_atualizar_status_instalacao  → WRITE ordens_instalacao
```

### 5. Fiscal - NF-e (2 tools)
```
croma_emitir_nfe                → WRITE fiscal_documentos (via Edge Function)
croma_cancelar_nfe              → WRITE fiscal_documentos
```

### 6. Produtos - Catálogo (2 tools)
```
croma_criar_produto             → WRITE produtos
croma_criar_modelo_produto      → WRITE produto_modelos
```

### 7. Regras Precificação (1 tool)
```
croma_atualizar_regra_precificacao → WRITE regras_precificacao
```

---

## PRIORIDADE 3 — MÉDIA (nice-to-have)

### 8. Qualidade - Write (2 tools)
```
croma_registrar_ocorrencia      → WRITE ocorrencias
croma_atualizar_ocorrencia      → WRITE ocorrencias
```

### 9. Impressora - Vinculação (1 tool)
```
croma_vincular_job_pedido       → WRITE impressora_jobs + pedidos
```

### 10. Estoque Avançado (1 tool)
```
croma_sugerir_compra            → READ materiais + estoque_saldos (analítico)
```

---

## Nota: CLAUDE.md diz 54 ferramentas, banco real tem 39

O CLAUDE.md lista 54 ferramentas, mas a auditoria do código-fonte encontrou 39 implementadas.
Ferramentas listadas no CLAUDE.md mas NÃO encontradas no código:
- `croma_emitir_nfe`, `croma_consultar_status_nfe`
- `croma_agendar_instalacao`
- `croma_criar_ocorrencia`, `croma_atualizar_ocorrencia`
- `croma_resumo_impressora`, `croma_vincular_job_impressora`, `croma_registrar_jobs_impressora`, `croma_custo_real_pedido`, `croma_mapear_substrato`
- `croma_listar_jobs_campo`, `croma_detalhe_job_campo`, `croma_listar_fotos_job`, `croma_criar_job_campo`, `croma_atualizar_job_campo`

Possibilidade: Existem mas em outros arquivos/branches, ou estão no CLAUDE.md como planejamento futuro.

---

## Plano de execução sugerido

**Sprint 1 (2-3h):** P1 — Fornecedores (5) + Cadastrar Material (1) = 6 tools
**Sprint 2 (2-3h):** P2 — Instalação (2) + Produtos (2) + Regras (1) = 5 tools
**Sprint 3 (3-4h):** P1 — Compras (4) — requer verificar/criar tabelas no banco
**Sprint 4 (2-3h):** P2 — NF-e (2) + P3 Qualidade (2) = 4 tools
