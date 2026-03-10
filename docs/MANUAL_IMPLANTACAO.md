# Manual de Implantação — CRM/ERP Croma Print

> Atualizado em: 2026-03-10 | Versão do sistema: 3.0

---

## Pré-requisitos

| Requisito | Versão mínima | Observação |
|---|---|---|
| Node.js | 18.x ou superior | Recomendado: 20.x LTS |
| npm | 9.x ou superior | Vem com Node.js |
| Git | Qualquer versão recente | Para clonar o repositório |
| Conta Supabase | — | Plano gratuito é suficiente para testes |
| Conta Vercel | — | Plano gratuito para deploy |
| Conta GitHub | — | Para conectar ao Vercel |

---

## Passo 1 — Clonar o Repositório

```bash
git clone https://github.com/juniorcromaprint-tech/CRM-Croma.git
cd CRM-Croma
```

Para o App de Campo (produto separado):
```bash
cd APP-Campo
```

---

## Passo 2 — Instalar Dependências

**ERP/CRM (pasta raiz):**
```bash
npm install
```

**App de Campo (se for implantar também):**
```bash
cd APP-Campo
npm install
cd ..
```

---

## Passo 3 — Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto (ERP) copiando o exemplo:

```bash
cp .env.example .env
```

Preencha as variáveis:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...sua_anon_key_aqui...
```

Para encontrar esses valores:
1. Acesse `supabase.com/dashboard`
2. Selecione seu projeto
3. Vá em **Project Settings > API**
4. Copie **Project URL** e **anon/public key**

Para o App de Campo:
```bash
# Dentro da pasta APP-Campo
cp .env.example .env
# Preencher com as mesmas variáveis (mesmo projeto Supabase)
```

---

## Passo 4 — Executar as Migrations no Supabase

Abra o SQL Editor do Supabase: `supabase.com/dashboard/project/SEU_PROJECT_ID/sql`

Execute os arquivos na ordem exata abaixo. Cada arquivo está em `supabase/migrations/`:

| Ordem | Arquivo | Conteúdo | Status esperado |
|---|---|---|---|
| 1 | `001_complete_schema.sql` | 51 tabelas base do ERP | Executar uma vez |
| 2 | `002_schema_corrections.sql` | RLS granular, triggers de auditoria, índices | Executar uma vez |
| 3 | `003_campo_migration.sql` | Tabelas do App de Campo (jobs, fotos, checklists) | Executar uma vez |
| 4 | `003_fiscal_module.sql` | 11 tabelas do módulo fiscal + RPCs NF-e | Executar uma vez |
| 5 | `005_storage_security.sql` | RLS nos buckets de armazenamento de fotos | Executar uma vez |
| 6 | `006_orcamento_module.sql` | Acabamentos, serviços, regras de precificação, templates | **Verificar schema antes** |
| 7 | `007_*.sql` | Correções e melhorias adicionais | Se existir |
| 8 | `008_update_materiais_precos.sql` | 464 materiais com preço real Mubisys | Executar uma vez |
| 9 | `009_update_produtos_markups.sql` | 156 modelos com markup real | Executar uma vez |
| 10 | `010_*.sql` | Migrations mais recentes | Se existir |

**Como executar cada migration:**
1. Abra o arquivo `.sql` em um editor de texto
2. Copie todo o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou `Ctrl+Enter`)
5. Confirme que não há erros vermelhos

**Atenção com a migration 006**: verifique o conteúdo do arquivo antes de executar, pois versões anteriores tinham incompatibilidades de schema. Consulte `docs/ORCAMENTO_AUDIT.md` para detalhes.

---

## Passo 5 — Verificar Dados no Banco

Após executar todas as migrations, verifique no SQL Editor:

```sql
-- Verificar contagem de tabelas críticas
SELECT
  (SELECT COUNT(*) FROM materiais) AS materiais,
  (SELECT COUNT(*) FROM produtos) AS produtos,
  (SELECT COUNT(*) FROM produto_modelos) AS modelos,
  (SELECT COUNT(*) FROM modelo_materiais) AS modelo_materiais,
  (SELECT COUNT(*) FROM clientes) AS clientes;
```

**Resultado esperado:**

| Tabela | Mínimo aceitável | Observação |
|---|---|---|
| `materiais` | > 100 | Seeds Mubisys carregam 467 |
| `produtos` | > 10 | Seeds carregam 156 |
| `produto_modelos` | > 10 | Seeds carregam 156 |
| `modelo_materiais` | > 0 | CRÍTICO — sem isso, preço = R$ 0,00 |
| `clientes` | > 0 | Seeds carregam 307 para demo |

Se `modelo_materiais` tiver 0 registros, o módulo de orçamentos não funcionará. Cadastre os vínculos via `AdminProdutosPage` ou execute o seed de materiais.

---

## Passo 6 — Build de Produção

```bash
# Na raiz do projeto (ERP)
npm run build
```

O comando gera a pasta `dist/` com os arquivos estáticos otimizados.

Para verificar localmente antes do deploy:
```bash
npm run preview
```

Acesse `http://localhost:4173` para ver a versão de produção localmente.

---

## Passo 7 — Deploy no Vercel

### Configuração inicial (primeira vez)

1. Acesse `vercel.com` e faça login
2. Clique em **Add New > Project**
3. Selecione **Import Git Repository**
4. Autorize acesso ao GitHub e selecione `CRM-Croma`
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (raiz, para o ERP) ou `APP-Campo` (para o Campo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL` = sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = sua anon key
7. Clique em **Deploy**

### Deploys automáticos

Após a configuração inicial, toda vez que fizer `git push` para o branch `main`, o Vercel fará deploy automático.

---

## Configuração Inicial do Banco via Interface

Após o deploy, acesse `/admin/setup` (ou `AdminSetupPage`) para:

1. Configurar parâmetros de precificação (custos operacionais da empresa)
2. Verificar se todas as 7 configurações obrigatórias estão preenchidas
3. Criar o primeiro usuário administrador
4. Testar criação de orçamento de exemplo

---

## Troubleshooting

### Tabelas faltando ao acessar o sistema

**Sintoma**: Erros no console como `relation "tabela_x" does not exist`

**Causa**: Uma ou mais migrations não foram executadas

**Solução**:
1. Abra o SQL Editor do Supabase
2. Execute a query: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
3. Compare com a lista de tabelas esperadas
4. Execute as migrations que estão faltando

---

### Preço sempre aparece como R$ 0,00

**Causa mais comum**: `modelo_materiais` com 0 registros

**Diagnóstico**:
```sql
SELECT COUNT(*) FROM modelo_materiais;
-- Se retornar 0, esse é o problema
```

**Solução**: Vincular materiais aos modelos de produto. Acesse `/admin/produtos` e na aba "Modelos", edite cada modelo e adicione os materiais utilizados.

**Segunda causa possível**: Migration 006 não executada — tabelas `acabamentos` e `regras_precificacao` ausentes.

---

### Erro de autenticação ao acessar

**Sintoma**: Tela em branco ou erro "Invalid API key"

**Causa**: Variáveis de ambiente não configuradas corretamente

**Solução**:
1. Verifique se o arquivo `.env` existe na raiz
2. Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas
3. No Vercel, verifique as variáveis de ambiente nas configurações do projeto
4. Após alterar variáveis no Vercel, é necessário fazer um novo deploy

---

### App de Campo não mostra jobs

**Causa provável**: Migration 004 (`004_integracao_bridge.sql`) não executada

**Sintoma**: `instalacao.service.ts` tenta consultar `vw_campo_instalacoes` que não existe

**Solução**: Executar a migration 004 no Supabase SQL Editor

---

### Erro "signUp is not allowed"

**Causa**: Supabase com confirmação de e-mail habilitada ou inscrição desabilitada

**Solução**: No painel do Supabase, vá em **Authentication > Providers > Email** e ajuste as configurações de acordo com a necessidade (habilitar/desabilitar confirmação de e-mail).

---

## Links Úteis

| Recurso | URL |
|---|---|
| Supabase Dashboard | `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw` |
| Supabase SQL Editor | `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` |
| Vercel Dashboard ERP | `vercel.com/juniorcromaprint-tech/crm-croma` |
| Vercel Dashboard Campo | `vercel.com/juniorcromaprint-tech/campo-croma` |
| GitHub Repositório | `github.com/juniorcromaprint-tech/CRM-Croma` |
| ERP em Produção | `tender-archimedes.vercel.app` |
| App de Campo em Produção | `campo-croma.vercel.app` |

---

## Estrutura de Pastas do Projeto

```
CRM-Croma/
├── src/                          # ERP/CRM (produto principal)
│   ├── domains/                  # Módulos de negócio
│   │   ├── comercial/            # Leads, orçamentos, propostas
│   │   ├── clientes/             # Cadastro e detalhe de clientes
│   │   ├── pedidos/              # Gestão de pedidos
│   │   ├── producao/             # Kanban de produção
│   │   ├── estoque/              # Controle de estoque
│   │   ├── financeiro/           # Contas, comissões, DRE
│   │   ├── fiscal/               # NF-e e módulo fiscal
│   │   ├── qualidade/            # Ocorrências
│   │   └── admin/                # Usuários, config, auditoria
│   └── shared/                   # Código compartilhado entre domínios
│       ├── components/           # Componentes reutilizáveis
│       ├── services/             # Motor de precificação, utilitários
│       └── utils/                # Formatação, helpers
├── APP-Campo/                    # App de Campo (produto separado)
├── supabase/
│   └── migrations/               # Arquivos SQL de migration
└── docs/                         # Documentação (este arquivo)
```
