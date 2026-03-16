# Módulo de Gestão de Dados em Massa — Design Spec

> **Data**: 2026-03-16 | **Status**: Aprovado para implementação | **Execução**: Sonnet

---

## 1. Objetivo

Criar um módulo completo de **importação, exportação e edição em massa** para os principais cadastros do ERP Croma Print, permitindo:

- Baixar dados filtrados em CSV/XLSX
- Importar planilhas para cadastro e atualização em massa
- Editar registros inline estilo planilha (DataGrid)
- Executar ações em lote (ativar/inativar, trocar categoria, alterar preço)
- Auditar todas as operações em massa

---

## 2. Decisões Arquiteturais

### Abordagem: Híbrida Pragmática

- **Import/Export Engine** genérica config-driven para o fluxo padrão (80% dos casos)
- **DataGrid editável** como componente reutilizável independente
- **Componentes customizados** para entidades complexas (clientes+contatos, composições)
- **Não usar**: job queue, processamento assíncrono, rollback automático, mapeamento dinâmico de colunas (volumes atuais não justificam)

### Distribuição: Hub Central + Botões nas Listagens

| Local | Funcionalidade |
|---|---|
| `/admin/dados` (Hub) | Lista todas entidades, templates, histórico, importações complexas |
| Listagens existentes | Botões rápidos de exportar (CSV/XLSX) e importar por entidade |
| Listagens admin | DataGrid editável inline + ações em lote via checkbox |

---

## 3. Entidades — Fase 1

| # | Entidade | Tabela Supabase | Import | Export | Bulk Edit | Chave de Update | Complexidade |
|---|---|---|---|---|---|---|---|
| 1 | Matéria-Prima | `materiais` | ✅ | ✅ | ✅ | `id` ou `codigo` | Simples |
| 2 | Produtos | `produtos` | ✅ | ✅ | ✅ | `id` ou `codigo` | Simples |
| 3 | Clientes + Contatos | `clientes` + `cliente_contatos` | ✅ | ✅ | ✅ | `id` ou `cnpj_cpf` | Complexa (1:N) |
| 4 | Fornecedores | `fornecedores` | ✅ | ✅ | ✅ | `id` ou `cnpj_cpf` | Simples |
| 5 | Composição Material | `modelo_materiais` | ✅ | ✅ | ✅ | `modelo_id` + `material_id` | Média (N:N) |
| 6 | Composição Processo | `modelo_processos` | ✅ | ✅ | ✅ | `modelo_id` + `processo` | Média (N:N) |
| 7 | Contas a Receber | `contas_receber` | ✅ | ✅ | ✅ | `id` | Média (FK cliente) |
| 8 | Contas a Pagar | `contas_pagar` | ✅ | ✅ | ✅ | `id` | Média (FK fornecedor) |
| 9 | Leads | `leads` | ✅ | ✅ | ✅ | `id` ou `email` | Simples |
| 10 | Acabamentos | `acabamentos` | ✅ | ✅ | ✅ | `id` ou `nome` | Simples |
| 11 | Serviços | `servicos` | ✅ | ✅ | ✅ | `id` ou `nome` | Simples |

### Fases futuras (backlog)

- **Fase 2**: pedidos, propostas, estoque_movimentacoes, regras_precificacao
- **Fase 3**: pedido_itens, parcelas, comissões, tarefas

---

## 4. Estrutura de Arquivos

```
src/domains/dados/
  pages/
    DadosHubPage.tsx              ← Hub central /admin/dados
    ImportHistoricoPage.tsx       ← Histórico de operações
  components/
    ImportWizard.tsx              ← Wizard 4 etapas: upload → validar → preview → confirmar
    ExportDialog.tsx              ← Dialog: filtros → formato → download
    DataGrid.tsx                  ← Grid editável inline (células clicáveis)
    PreviewTable.tsx              ← Tabela de preview com status por linha
    ValidationReport.tsx          ← Relatório visual de erros
    BulkActionBar.tsx             ← Barra de ações em lote (com checkbox)
    TemplateDownloadButton.tsx    ← Botão baixar modelo por entidade
    FileDropzone.tsx              ← Área de drag & drop para upload
  engine/
    import-engine.ts             ← Core: parse → validate → classify (insert/update) → apply
    export-engine.ts             ← Core: query → filter → format → download
    file-parser.ts               ← Parse CSV/XLSX para array de objetos
    template-generator.ts        ← Gera planilha modelo com exemplos e instruções
    validators/
      common.ts                  ← Validações genéricas (CNPJ, CPF, email, telefone, required)
      materiais.ts               ← Schema Zod + regras específicas de materiais
      produtos.ts
      clientes.ts                ← Inclui validação de contatos inline
      fornecedores.ts
      modelo-materiais.ts        ← Validação de par composto
      modelo-processos.ts
      contas-receber.ts          ← Validação de FK cliente
      contas-pagar.ts            ← Validação de FK fornecedor
      leads.ts
      acabamentos.ts
      servicos.ts
  configs/
    entity-registry.ts           ← Registry central de todas entidades configuradas
    materiais.config.ts
    produtos.config.ts
    clientes.config.ts
    fornecedores.config.ts
    modelo-materiais.config.ts
    modelo-processos.config.ts
    contas-receber.config.ts
    contas-pagar.config.ts
    leads.config.ts
    acabamentos.config.ts
    servicos.config.ts
  hooks/
    useImport.ts                 ← Estado do wizard + mutação de importação
    useExport.ts                 ← Query filtrada + download
    useBulkEdit.ts               ← Tracking de células editadas + save em batch
    useImportHistory.ts          ← Query do histórico de import_logs
  services/
    import.service.ts            ← Lógica de upsert em batch via Supabase
    export.service.ts            ← Query com filtros + formatação
    bulk-edit.service.ts         ← Update em batch via Supabase
```

---

## 5. Modelo de Dados — Banco

### Nova tabela: `import_logs`

```sql
CREATE TABLE import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'export', 'bulk_edit')),
  filename TEXT,
  total_rows INT DEFAULT 0,
  inserted INT DEFAULT 0,
  updated INT DEFAULT 0,
  skipped INT DEFAULT 0,
  errors INT DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_import_logs_entity ON import_logs(entity);
CREATE INDEX idx_import_logs_user ON import_logs(user_id);
CREATE INDEX idx_import_logs_created ON import_logs(created_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os logs"
  ON import_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir logs"
  ON import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Formato de `error_details` (JSONB)

```json
[
  {
    "row": 5,
    "column": "cnpj_cpf",
    "value": "123.456",
    "reason": "CNPJ/CPF inválido — formato esperado: XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX"
  },
  {
    "row": 12,
    "column": "fornecedor_id",
    "value": "Fornecedor ABC",
    "reason": "Fornecedor não encontrado no sistema"
  }
]
```

### Formato de `metadata` (JSONB)

```json
{
  "filters_applied": { "status": "ativo", "categoria": "banner" },
  "format": "xlsx",
  "columns_exported": ["nome", "codigo", "preco_medio", "categoria"],
  "bulk_changes": { "field": "categoria", "old_value": "geral", "new_value": "banner", "count": 23 }
}
```

---

## 6. Fluxo de Importação (ImportWizard)

### Etapa 1 — Upload

- Área de drag & drop (FileDropzone) aceita `.csv` e `.xlsx`
- `file-parser.ts` converte arquivo para `Array<Record<string, string>>`
- **Detecção de linhas de instrução**: o parser identifica a linha de cabeçalho procurando a primeira linha que contém nomes de colunas conhecidos da entidade (matching contra o config). Linhas anteriores (instruções, exemplos do template) são ignoradas automaticamente. Isso permite que templates reimportados funcionem sem o usuário ter que deletar linhas manualmente.
- Mostra preview das primeiras 5 linhas de dados (após o cabeçalho) em tabela simples
- Detecta automaticamente se é CSV (separador `;`) ou XLSX (primeira aba)

### Etapa 2 — Validação

- Cada linha passa pelo validador Zod da entidade
- Validações comuns: campo obrigatório, tipo, formato CNPJ/CPF/email/telefone, enum de status
- Validações de referência: verifica se FK existe no banco (ex: `fornecedor_id` → busca em `fornecedores`)
- Detecção de duplicatas: verifica chave de update contra banco e dentro do próprio arquivo
- Resultado visual:
  - Badge verde "847 válidas"
  - Badge vermelha "12 com erro"
  - Badge amarela "3 duplicatas"
  - Tabela expansível com erros detalhados por linha

### Etapa 3 — Preview

- Classificação de cada linha válida:
  - **INSERT** — chave de update não encontrada no banco
  - **UPDATE** — chave encontrada, pelo menos 1 campo diferente
  - **SKIP** — chave encontrada, todos campos idênticos (nada a mudar)
- Contadores visuais: "523 novos | 312 atualizações | 12 sem alteração"
- Para UPDATEs: mostra quais campos serão alterados (campo, valor atual, valor novo)
- Opção "Importar só as válidas" (checkbox, ativo por padrão)

### Etapa 4 — Confirmação

- Resumo final com botão "Confirmar importação"
- Barra de progresso durante execução
- Ao concluir: relatório com totais + botão "Baixar linhas com erro" (gera planilha só com as falhas pra corrigir e reimportar)
- Log gravado em `import_logs`

### Tratamento de entidades complexas

#### Clientes + Contatos (1:N)

**Tabela de contatos**: `cliente_contatos` (FK: `cliente_id`)
**Colunas de contato**: `nome` (obrig.), `email`, `telefone`, `whatsapp`, `cargo`, `departamento`, `e_decisor`, `principal`

Template com colunas achatadas:
```
nome | cnpj_cpf | email | telefone | endereco | cidade | estado | contato_1_nome | contato_1_email | contato_1_telefone | contato_1_cargo | contato_2_nome | contato_2_email | contato_2_telefone | contato_2_cargo | contato_3_nome | contato_3_email | contato_3_telefone | contato_3_cargo
```

- Importação cria/atualiza o cliente e depois cria/atualiza contatos na tabela `cliente_contatos`
- Colunas `contato_*` vazias são ignoradas
- Máximo 3 contatos por linha (suficiente para 99% dos casos)
- **Mapeamento**: `contato_N_nome` → `cliente_contatos.nome`, `contato_N_email` → `cliente_contatos.email`, etc.
- **Update de contatos**: matching por `nome` do contato dentro do mesmo cliente. Se nome bate → update. Se não bate → insert novo contato. Contatos existentes que não aparecem na planilha ficam intocados (não deleta).

#### Composições — Modelo ↔ Materiais (N:N)

Planilha separada (não mistura com produtos):
```
modelo_codigo | material_codigo | quantidade | unidade
BANNER-001    | LONA-380G      | 1.2        | m²
BANNER-001    | TINTA-SOL      | 0.05       | litro
```

- **Lookup**: `modelo_codigo` → query `produto_modelos` WHERE `codigo = modelo_codigo` para resolver `modelo_id` (UUID). `material_codigo` → query `materiais` WHERE `codigo = material_codigo` para resolver `material_id` (UUID)
- Se par (`modelo_id` + `material_id`) já existe → atualiza quantidade
- Se não existe → insere
- Erro se modelo ou material não encontrado pelo código

#### Composições — Modelo ↔ Processos (N:N)

```
modelo_codigo | processo | tempo_minutos | custo_hora | ordem
BANNER-001    | impressao | 15           | 120.00     | 1
BANNER-001    | acabamento | 10          | 80.00      | 2
```

---

## 7. Fluxo de Exportação

### Nas listagens existentes (botão rápido)

- Dropdown no header da tabela: "Exportar CSV" | "Exportar Excel"
- Exporta respeitando filtros ativos da tela (busca, status, categoria, período)
- Usa `exportCsv.ts` e `exportExcel.ts` existentes (sem recriar)
- `export-engine.ts` é responsável por transformar os resultados da query Supabase no formato `headers: string[]` + `rows: (string | number | null)[][]` que os utilitários existentes esperam. Inclui tradução de nomes de coluna (ex: `preco_medio` → `Preço Médio`) e formatação de valores (datas, moeda)
- Log registrado em `import_logs` com `operation = 'export'`

### No Hub central (`/admin/dados`)

- Card por entidade com botão "Exportar"
- ExportDialog com opções:
  - **Filtros**: status, período (de/até), categoria (quando aplicável)
  - **Formato**: CSV ou XLSX
  - **Modo**:
    - "Relatório" — colunas formatadas, nomes amigáveis, valores por extenso
    - "Template para reimportação" — colunas técnicas, IDs, pronto pra editar e reimportar
  - **Colunas**: checkboxes pra selecionar quais colunas exportar (todas marcadas por padrão)

### Templates de importação

- Botão "Baixar modelo" por entidade no Hub
- `template-generator.ts` gera XLSX com:
  - Linha 1: instrução ("Preencha a partir da linha 4. Colunas com * são obrigatórias")
  - Linha 2: cabeçalhos com * nas obrigatórias (`nome*`, `codigo*`, `preco_medio`, `categoria`)
  - Linhas 3-5: exemplos realistas da Croma Print
  - Formatação: cabeçalhos em negrito, colunas obrigatórias em azul claro

---

## 8. DataGrid Editável (Edição em Massa Inline)

### Componente `DataGrid`

- Substitui a tabela simples nas páginas admin quando ativado
- Botão "Modo edição" no header da listagem
- Cada célula é clicável → vira input ao clicar
- Tipos de input por tipo de campo:
  - `text` → input text
  - `number` → input number com step
  - `select` → dropdown com opções da entidade (categoria, status, unidade)
  - `boolean` → toggle switch
  - `date` → date picker
- Células alteradas ficam com fundo amarelo claro (`bg-amber-50 border-amber-300`)
- Validação inline ao sair da célula (blur) — borda vermelha se inválido

### Barra de estado (fixa no topo quando há alterações)

```
┌─────────────────────────────────────────────────────────┐
│ 📝 14 alterações pendentes    [Descartar]  [Salvar tudo] │
└─────────────────────────────────────────────────────────┘
```

- "Salvar tudo" → confirmação ("Você vai alterar 14 registros em 6 campos. Confirmar?")
- "Descartar" → restaura valores originais
- Se o usuário tentar navegar com alterações pendentes → alerta

### Ações em lote (checkbox)

- Checkbox na primeira coluna de cada linha
- Checkbox "selecionar tudo" no header
- Barra de ações aparece ao selecionar:

```
┌─────────────────────────────────────────────────────────────┐
│ ✓ 32 selecionados  [Alterar campo ▼]  [Ativar]  [Inativar] │
└─────────────────────────────────────────────────────────────┘
```

- "Alterar campo" → dropdown com campos editáveis → input com novo valor → aplica a todos selecionados
- Confirmação antes de aplicar
- Log em `import_logs` com `operation = 'bulk_edit'`

### Ações por entidade

| Entidade | Ações em lote |
|---|---|
| Materiais | Alterar categoria, preço, unidade, fornecedor. Ativar/inativar |
| Produtos | Alterar categoria, markup, status. Ativar/inativar |
| Clientes | Alterar status, vendedor responsável, segmento. Ativar/inativar |
| Fornecedores | Alterar categoria, status. Ativar/inativar |
| Leads | Alterar status pipeline, responsável, origem |
| Contas Receber | Alterar status, forma pagamento |
| Contas Pagar | Alterar status, categoria |
| Acabamentos | Alterar preço, status |
| Serviços | Alterar preço, unidade, status |

---

## 9. Hub Central — `/admin/dados`

### Layout da página

```
┌─────────────────────────────────────────────────────────────┐
│  Gestão de Dados                              [Histórico]   │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Matéria  │ │ Produtos │ │ Clientes │ │Fornece-  │      │
│  │ Prima    │ │          │ │          │ │ dores    │      │
│  │ 467 reg  │ │ 156 reg  │ │ 307 reg  │ │  XX reg  │      │
│  │ [↓][↑][✎]│ │ [↓][↑][✎]│ │ [↓][↑][✎]│ │ [↓][↑][✎]│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Composição│ │Composição│ │ Contas   │ │ Contas   │      │
│  │Material  │ │Processo  │ │ Receber  │ │ Pagar    │      │
│  │ 321 reg  │ │ 362 reg  │ │  XX reg  │ │  XX reg  │      │
│  │ [↓][↑][✎]│ │ [↓][↑][✎]│ │ [↓][↑][✎]│ │ [↓][↑][✎]│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │  Leads   │ │Acabamen- │ │ Serviços │                   │
│  │          │ │  tos     │ │          │                   │
│  │  XX reg  │ │  17 reg  │ │  16 reg  │                   │
│  │ [↓][↑][✎]│ │ [↓][↑][✎]│ │ [↓][↑][✎]│                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                             │
│  [↓] = Exportar  [↑] = Importar  [✎] = Editar em massa    │
│                                                             │
│  ─── Últimas operações ──────────────────────────────────  │
│  │ 16/03 14:30 │ admin │ import │ materiais │ 234 ok │ 3 err │
│  │ 16/03 11:15 │ admin │ export │ clientes  │ 307 reg│       │
│  │ 15/03 09:00 │ admin │ bulk   │ produtos  │ 45 alt │       │
└─────────────────────────────────────────────────────────────┘
```

Cada card tem:
- Nome da entidade
- Contagem de registros (query count)
- Botão exportar (↓) → abre ExportDialog
- Botão importar (↑) → abre ImportWizard
- Botão editar (✎) → navega pra página da entidade em modo edição
- Botão baixar template (no ExportDialog)

---

## 10. Permissões

O sistema de permissões existente usa matriz `Module × Action` (arquivo: `src/shared/constants/permissions.ts`). Roles existentes: `admin`, `diretor`, `comercial`, `comercial_senior`, `financeiro`, `producao`, `compras`, `logistica`, `instalador`. Actions existentes: `ver`, `criar`, `editar`, `excluir`, `aprovar`, `exportar`.

**Mapeamento para bulk operations** (sem criar permissões novas):

| Operação | Permissão usada | Roles com acesso |
|---|---|---|
| Exportar dados | `admin.exportar` | `admin`, `diretor` (já tem `exportar` no módulo admin) |
| Importar dados | `admin.criar` | `admin` (único com `criar` no módulo admin) |
| Editar em massa | `admin.editar` | `admin` (único com `editar` no módulo admin) |
| Ver histórico | `admin.ver` | `admin`, `diretor` |

**Proteção de rota**: `<PermissionGuard module="admin" action="ver">` para o Hub. Botões de import/bulk-edit verificam `admin.criar` / `admin.editar`. Botão de export verifica `admin.exportar`.

**Arquivo de rotas**: adicionar em `src/routes/adminRoutes.tsx` seguindo o padrão existente com lazy loading + PermissionGuard.

---

## 11. Validações por Entidade

### Comuns a todas

- Campos obrigatórios não podem ser vazios
- Tipos numéricos devem ser números válidos
- Datas no formato YYYY-MM-DD ou DD/MM/YYYY (parser aceita ambos)
- Encoding UTF-8 (com BOM para CSV)

### Específicas

| Entidade | Validações |
|---|---|
| Materiais | `codigo` único, `preco_medio` >= 0, `unidade` em lista válida, `categoria` em lista válida |
| Produtos | `codigo` único, `categoria` válida, `markup` > 0 |
| Clientes | `cnpj_cpf` formato válido + único, `email` formato válido, `estado` UF válida (2 letras) |
| Fornecedores | `cnpj_cpf` formato válido + único, `email` formato válido |
| Modelo↔Mat | `modelo_id`/`codigo` deve existir, `material_id`/`codigo` deve existir, `quantidade` > 0 |
| Modelo↔Proc | `modelo_id`/`codigo` deve existir, `tempo_minutos` >= 0, `custo_hora` >= 0 |
| Contas Receber | `cliente_id` ou `cnpj_cpf` deve existir, `valor` > 0, `status` em enum válido |
| Contas Pagar | `fornecedor_id` ou `cnpj_cpf` deve existir, `valor` > 0, `status` em enum válido |
| Leads | `email` único (quando preenchido), `status` em enum pipeline |
| Acabamentos | `nome` único |
| Serviços | `nome` único, `preco` >= 0 |

---

## 12. Ordem Recomendada de Importação

Quando migrando dados de sistema antigo, seguir esta ordem para respeitar dependências:

1. **Fornecedores** (sem dependência)
2. **Materiais** (pode referenciar fornecedor)
3. **Acabamentos** (sem dependência)
4. **Serviços** (sem dependência)
5. **Produtos** (sem dependência direta)
6. **Composição Material** (depende de produtos + materiais)
7. **Composição Processo** (depende de produtos)
8. **Clientes + Contatos** (sem dependência)
9. **Leads** (sem dependência)
10. **Contas a Receber** (depende de clientes)
11. **Contas a Pagar** (depende de fornecedores)

Essa ordem deve estar visível no Hub e nos templates.

---

## 13. Registro de Rotas

Adicionar em `src/routes/adminRoutes.tsx` seguindo o padrão existente:

```tsx
const DadosHubPage = lazy(() => import("@/domains/dados/pages/DadosHubPage"));
const ImportHistoricoPage = lazy(() => import("@/domains/dados/pages/ImportHistoricoPage"));

// Dentro do JSX de adminRoutes:
<Route path="admin/dados" element={
  <PermissionGuard module="admin" action="ver">
    <LazyPage><DadosHubPage /></LazyPage>
  </PermissionGuard>
} />
<Route path="admin/dados/historico" element={
  <PermissionGuard module="admin" action="ver">
    <LazyPage><ImportHistoricoPage /></LazyPage>
  </PermissionGuard>
} />
```

O Hub também deve ser adicionado ao menu lateral de Admin (verificar `src/shared/components/Sidebar.tsx` ou equivalente).

---

## 14. Stack Técnica

### Reutilizar do projeto

- `exportExcel.ts` — exportação XLSX (já existe)
- `exportCsv.ts` — exportação CSV (já existe)
- `xlsx` v0.18.5 — parse de XLSX no upload (já instalado, só usado para write hoje)
- Schemas Zod existentes nos domínios
- `showSuccess()` / `showError()` para toasts
- TanStack Query para queries e mutations
- shadcn/ui para componentes de UI

### Novo

- `DataGrid` component — grid editável com células clicáveis
- `ImportWizard` component — wizard de 4 etapas
- Validators Zod por entidade para importação
- `file-parser.ts` — leitura de CSV/XLSX
- `template-generator.ts` — geração de planilhas modelo
- Migration `031_import_logs.sql` — tabela de auditoria

---

## 15. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Importação corromper dados existentes | Preview obrigatório + confirmação + log completo |
| Planilha com encoding errado | Parser com detecção de encoding + BOM UTF-8 nos templates |
| FK inválida (ex: fornecedor inexistente) | Validação pré-import busca FKs no banco antes de gravar |
| Duplicação acidental | Detecção de duplicatas por chave de update + alerta no preview |
| DataGrid lento com muitos registros | Paginação (50 por página no modo edição) + virtualização se necessário |
| Usuário importa planilha errada | Validação de cabeçalhos — rejeita se colunas não batem com o template |

---

## 16. Fora de Escopo (Fase 1)

- Processamento assíncrono / job queue (volumes atuais < 5.000 linhas)
- Rollback automático de importações
- Mapeamento dinâmico de colunas
- Importação de pedidos/propostas (muitas dependências)
- JSON backup/restore
- Permissões granulares (7 níveis)
- Diff visual de alterações
