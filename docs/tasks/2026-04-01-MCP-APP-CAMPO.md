# Task: Ferramentas MCP para App Campo

> **Para**: Claude CLI (Sonnet)
> **Prioridade**: Alta — módulo em uso real em campo
> **Contexto**: O App Campo (campo-croma.vercel.app) é usado diariamente pela equipe em dois cenários: instalações vinculadas a pedidos do CRM e serviços de merchandising avulso (sem OS/pedido)

---

## Contexto do Negócio

O App Campo tem dois modos de operação:

1. **Instalação (adesivo, placa, fachada, etc.)** — Hoje a OS vem do Mubisys e é inserida manualmente no App Campo. Futuramente o CRM Croma vai gerar a OS automaticamente via ordem_instalacao.
2. **Merchandising** — Serviço avulso onde o técnico vai a lojas aplicar materiais fornecidos pelo cliente (ex: Beira Rio). O App Campo gera o número da OS automaticamente (sequencial ou aleatório). Não tem pedido nem OS no CRM — é o caso mais comum hoje.

**Situação atual**: O Mubisys ainda é o sistema de gestão principal. Os dados entram manualmente no App Campo. A migração para o CRM Croma está em andamento — quando concluída, instalações criadas no CRM vão direto para o App Campo via bridge.

**Como diferenciar os tipos**:
- Se `tipo_servico` contém "Merchandising" ou "mercham" → merchandising
- Se `ordem_instalacao_id IS NOT NULL` ou `pedido_id IS NOT NULL` → instalação vinculada ao CRM
- Demais casos → instalação manual (OS do Mubisys)

## Tabelas Envolvidas (já existem no banco)

Verificar schema via migrations ou information_schema. Principais:

```
jobs                    — tabela principal de jobs do campo
job_photos              — fotos (antes/depois)
job_videos              — vídeos
assinaturas_campo       — assinaturas digitais dos responsáveis
checklists_campo        — checklists de verificação
midias_campo            — mídias associadas
tarefas_campo           — tarefas do job
campo_audit_logs        — log de auditoria do campo
ordens_instalacao       — ordens de instalação (bridge com ERP)
agenda_instalacao       — agenda de instalações
```

Views de integração (bridge ERP↔Campo):
```
vw_campo_instalacoes    — view consolidada com dados do job + loja + técnico + fotos
vw_campo_fotos          — view de fotos com contagem antes/depois
```

## Ferramentas MCP a Implementar

Criar novo arquivo: `mcp-server/src/tools/campo.ts`

(NOTA: já existe um campo.ts com 2 ferramentas: `croma_listar_instalacoes` e `croma_agendar_instalacao`. Adicionar as novas ferramentas neste mesmo arquivo.)

### Leitura (getAdminClient)

```
croma_listar_jobs_campo
```
- Lista jobs do App Campo com filtros
- Params: status (opcional: "Pendente"|"Em Andamento"|"Concluído"|"Cancelado"), tecnico_id, loja_nome (busca ilike), data_inicio, data_fim, tipo (opcional: "instalacao"|"merchandising"), limit, offset
- **Lógica para tipo**: se `ordem_instalacao_id IS NOT NULL` ou `pedido_id IS NOT NULL` → instalação; senão → merchandising
- Usar a view `vw_campo_instalacoes` como base (já tem joins com loja, técnico, contagem de fotos)
- Retornar: job_id, os_number, tipo_servico, status_campo, data_agendada, loja_nome, loja_marca, loja_endereco, loja_estado, tecnico_nome, fotos_antes, fotos_depois, duracao_minutos

```
croma_detalhe_job_campo
```
- Detalhe completo de um job
- Params: job_id (UUID)
- Buscar na view `vw_campo_instalacoes` + fotos de `job_photos` + assinatura de `assinaturas_campo`
- Retornar: todos os campos acima + notes, issues, signature_url, lat/lng, started_at, finished_at, lista de fotos (url, tipo antes/depois, created_at)

```
croma_listar_fotos_job
```
- Lista fotos de um job específico
- Params: job_id (UUID), tipo (opcional: "before"|"after")
- Buscar em `job_photos` WHERE job_id = params.job_id
- Retornar: id, url, tipo (before/after), caption, created_at

### Escrita (getUserClient)

```
croma_criar_job_campo
```
- Cria novo job no App Campo
- Params:
  - os_number (string, obrigatório): número da OS
  - tipo_servico (string, obrigatório): ex: "Instalação de Adesivo", "Merchandising", "Adesivagem Vitrine"
  - store_id (string UUID, obrigatório): ID da loja
  - data_agendada (string ISO, obrigatório): data agendada
  - assigned_to (string UUID, opcional): técnico responsável
  - ordem_instalacao_id (string UUID, opcional): vínculo com ordem do ERP (null se merchandising)
  - pedido_id (string UUID, opcional): vínculo com pedido do ERP (null se merchandising)
  - notes (string, opcional): instruções/observações
- Status inicial: "Pendente"
- Usar `.select().single()` no insert

```
croma_atualizar_job_campo
```
- Atualiza status e dados de um job
- Params:
  - job_id (string UUID, obrigatório)
  - status (opcional: "Pendente"|"Em Andamento"|"Concluído"|"Cancelado")
  - notes (string, opcional): adicionar notas
  - issues (string, opcional): registrar problemas encontrados
  - started_at (string ISO, opcional): hora de início
  - finished_at (string ISO, opcional): hora de conclusão
- Se status = "Concluído" e finished_at não informado, setar finished_at = now()

### Registro no index.ts

As ferramentas devem ser registradas no `registerCampoTools()` existente. Atualizar comentário de "2 ferramentas" para "7 ferramentas: instalações + jobs campo".

Atualizar contagem total no index.ts.

## Validação

Após implementar, testar:

1. `croma_listar_jobs_campo {}` — deve retornar os jobs existentes (tem dados reais)
2. `croma_listar_jobs_campo {"tipo":"merchandising"}` — deve filtrar jobs sem OS
3. `croma_detalhe_job_campo {"job_id":"6c29b74b-ffce-428a-a23d-51f83947d69f"}` — job da Pacífico (hoje)
4. `croma_listar_fotos_job {"job_id":"e322c00d-7f63-43e8-9410-b50523a20ad1"}` — job Demanos (20 fotos)
5. `croma_criar_job_campo` — criar job teste de merchandising (sem OS)
6. Build: `cd mcp-server && npm run build` — zero erros

## Dados Reais para Teste (não criar dados fictícios)

| Job ID | OS | Loja | Tipo | Status | Fotos |
|--------|-----|------|------|--------|-------|
| `6c29b74b-...` | OS-provisório | Pacífico (Eugênio Pacífico) | Adesivagem Vitrine | Concluído | 3 |
| `e322c00d-...` | 1043 | Demanos | Placas/Adesivos | Concluído | 20 |
| `9ab4d5d9-...` | 1042 | Alemão Calçados | Adesivo | Concluído | 7 |
| `b5c5e145-...` | 1046 | Loja Titela (Pampili) | Instalação de Adesivo | Concluído | 4 |
| `4b2a7735-...` | 1051 | Clóvis Compra Certa | Instalação de Adesivo | Concluído | 4 |

## Observação Importante

Os jobs atuais estão todos com `ordem_instalacao_id = null` e `pedido_id = null` porque são serviços de merchandising (Beira Rio) ou porque os dados vieram antes da integração CRM. Isso é NORMAL e esperado — a ferramenta deve tratar ambos os cenários (com e sem vínculo ao ERP).
