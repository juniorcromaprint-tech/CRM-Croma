# Fiscal + Empresas + Edge Functions: Plano Completo de Correções

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all broken Edge Functions, integrate the central `empresas` table across the system, fix certificate bugs, deploy missing Edge Functions, move empresa management to `/admin/empresa`, and replace hardcoded company names with dynamic data.

**Architecture:** Migration 065 already created the `empresas` table with Croma Print data. The frontend has hooks (`useEmpresas.ts`) and a CRUD component (`TabEmpresas.tsx`). This plan: (1) fixes bugs in Edge Functions and frontend, (2) deploys 6 missing Edge Functions, (3) moves empresa management to a central admin page, (4) wires all modules to read from `empresas`.

**Tech Stack:** React 19, TypeScript, Vite, Supabase (Edge Functions Deno + Postgres + Storage), TanStack Query v5, shadcn/ui, Tailwind CSS

---

## Já Resolvido na Sessão Anterior (NÃO refazer)

Estes itens foram corrigidos na sessão de diagnóstico e NÃO precisam ser refeitos:

| Item | Como foi resolvido |
|------|-------------------|
| Vercel deploy falhando (8x) | package.json corrigido + Install Command override → deploy OK |
| Git user sramos-pix | Global + local config trocado para juniorcromaprint-tech |
| Ambientes mostrando "—" nos cards | Query `useFiscalAmbientes` atualizada com colunas corretas |
| Dois ambientes ativos simultaneamente | UPDATE no banco: produção → `ativo=false` |
| Toggle buttons desabilitados | Resolvido automaticamente ao corrigir os ativos |
| Migration 065 (empresas) | Já aplicada no Supabase |
| Migrations 028, 029, 030, 033 | Aplicadas no Supabase nesta sessão |
| Dados da Croma Print no ambiente produção | UPDATE no banco com dados reais |

---

## Context: Current State (2026-03-18)

### Database
- ✅ Tabela `empresas` existe com 1 registro (Croma Print, CNPJ 18923994000183)
- ✅ `fiscal_ambientes` tem `empresa_id` FK preenchido
- ✅ Migrations 028, 029, 030, 033, 065 todas aplicadas

### Edge Functions — Status de Deploy
| Function | Deployed | Status |
|----------|:--------:|--------|
| `ai-analisar-orcamento` | ✅ | OK |
| `ai-briefing-producao` | ✅ | OK |
| `ai-composicao-produto` | ✅ | OK |
| `ai-detectar-problemas` | ✅ | OK |
| `ai-resumo-cliente` | ✅ | OK |
| `create-user` | ✅ | OK |
| `fiscal-cancelar-nfe` | ✅ | OK |
| `fiscal-consultar-nfe` | ✅ | OK |
| `fiscal-emitir-nfe` | ✅ | OK |
| `fiscal-gerar-danfe` | ✅ | OK |
| `fiscal-inutilizar-nfe` | ✅ | OK |
| `fiscal-sync-status` | ✅ | OK |
| `fiscal-testar-certificado` | ✅ | ⚠️ BUG: não trata prefixo `env:` em `arquivo_encriptado_url` |
| `enviar-email-campanha` | ❌ | PRECISA DEPLOY |
| `enviar-email-proposta` | ❌ | PRECISA DEPLOY |
| `fiscal-deploy-certificado` | ❌ | PRECISA DEPLOY |
| `onedrive-criar-pasta` | ❌ | PRECISA DEPLOY |
| `onedrive-upload-proposta` | ❌ | PRECISA DEPLOY |
| `resolve-geo` | ❌ | PRECISA DEPLOY |

### Frontend Bugs
1. **"Testar Certificado"** dá erro — Edge Function tenta achar `env:NFE_CERT_BASE64` como arquivo no Storage
2. **Upload de certificado** grava em colunas inexistentes (`arquivo_url`, `storage_path`) — coluna correta: `arquivo_encriptado_url`
3. **TabAmbientes** duplica dados de empresa que agora vivem em `empresas`
4. **"Croma Print" hardcoded** em 10+ arquivos (PDFs, OS, portal, login)
5. **Empresa cadastrada dentro de `/fiscal/configuracao`** — deveria ser `/admin/empresa`

---

## Task 1: Fix Edge Function `fiscal-testar-certificado`

**Files:**
- Modify: `supabase/functions/fiscal-testar-certificado/index.ts`

**O bug:** `arquivo_encriptado_url` no banco é `env:NFE_CERT_BASE64` (referência a env var). A Edge Function tenta buscar isso como arquivo no bucket `fiscal-certificados`, não acha, e retorna "Arquivo não encontrado".

**Step 1: Abrir o arquivo e localizar o bloco de verificação de storage (linhas 106-127)**

O código atual faz:
```typescript
const storagePath = cert.arquivo_encriptado_url;
const folder = storagePath?.split('/').slice(0, -1).join('/') ?? 'certificados';
const fileName = storagePath?.split('/').pop();
// ... tenta listar arquivos no bucket
```

**Step 2: Substituir o bloco de verificação de storage (linhas 106-127)**

Trocar TODO o bloco entre o comentário `// Verifica se arquivo existe no storage` e o comentário `// Calcula dias restantes` por:

```typescript
    // Verifica se arquivo/referência existe
    const storagePath = cert.arquivo_encriptado_url;

    if (!storagePath) {
      const resultado = { ok: false, mensagem: 'Nenhum arquivo ou referência de certificado configurada' };
      await supabaseAdmin.from('fiscal_certificados').update({
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_status: 'falha_config',
        updated_at: new Date().toISOString(),
      }).eq('id', certificado_id);
      return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (storagePath.startsWith('env:')) {
      // Certificate stored as env var reference (e.g., "env:NFE_CERT_BASE64")
      // This is a valid configuration — the actual cert lives as a Vercel/Supabase secret
      const envName = storagePath.replace('env:', '');
      if (!envName) {
        const resultado = { ok: false, mensagem: 'Referência de certificado inválida (env: sem nome)' };
        await supabaseAdmin.from('fiscal_certificados').update({
          ultimo_teste_em: new Date().toISOString(),
          ultimo_teste_status: 'falha_config',
          updated_at: new Date().toISOString(),
        }).eq('id', certificado_id);
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // env-based certificate is valid — skip storage file check
    } else {
      // Storage-based certificate — verify file exists in bucket
      const folder = storagePath.split('/').slice(0, -1).join('/') || 'certificados';
      const fileName = storagePath.split('/').pop();

      let arquivoExiste = false;
      if (fileName) {
        const { data: files } = await supabaseAdmin.storage
          .from('fiscal-certificados')
          .list(folder);
        arquivoExiste = (files ?? []).some((f: { name: string }) => f.name === fileName);
      }

      if (!arquivoExiste) {
        const resultado = { ok: false, mensagem: 'Arquivo do certificado não encontrado no storage seguro' };
        await supabaseAdmin.from('fiscal_certificados').update({
          ultimo_teste_em: new Date().toISOString(),
          ultimo_teste_status: 'falha_arquivo',
          updated_at: new Date().toISOString(),
        }).eq('id', certificado_id);
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
```

**Step 3: Corrigir a ação de auditoria (linha 161)**

Trocar `'trocar_certificado'` por `'testar_certificado'`:
```typescript
      p_acao: 'testar_certificado',
```

**Step 4: Fix mismatch de status entre Edge Function e Frontend**

A Edge Function grava `ultimo_teste_status: 'sucesso'` mas o frontend em `FiscalCertificadoPage.tsx` verifica `=== 'ok'`. O badge nunca fica verde.

**Opção A (recomendada):** Alterar o frontend para aceitar ambos. Em `src/domains/fiscal/pages/FiscalCertificadoPage.tsx`, trocar TODAS as ocorrências (linhas ~304, ~309, ~585):

De:
```typescript
certAtivo.ultimo_teste_status === 'ok'
```
Para:
```typescript
certAtivo.ultimo_teste_status === 'sucesso' || certAtivo.ultimo_teste_status === 'ok'
```

E na tabela de histórico (linha ~585):
De:
```typescript
c.ultimo_teste_status === 'ok'
```
Para:
```typescript
c.ultimo_teste_status === 'sucesso' || c.ultimo_teste_status === 'ok'
```

**Step 5: Deploy da Edge Function atualizada no Supabase**

Via Supabase CLI:
```bash
npx supabase functions deploy fiscal-testar-certificado --project-ref djwjmfgplnqyffdcgdaw
```

Ou via Dashboard: https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/functions → fiscal-testar-certificado → Update → colar o código atualizado.

**Step 6: Testar**

Navegar para https://crm-croma.vercel.app/fiscal/certificado → clicar "Testar Certificado".
Expected: Toast verde "Certificado testado com sucesso!" E badge verde "Sucesso" no card.

**Step 7: Commit**
```bash
git add supabase/functions/fiscal-testar-certificado/index.ts src/domains/fiscal/pages/FiscalCertificadoPage.tsx
git commit -m "fix(fiscal): handle env: prefix in testar-certificado + fix status badge mismatch"
```

---

## Task 2: Fix Upload de Certificado — Colunas Erradas

**Files:**
- Modify: `src/domains/fiscal/pages/FiscalCertificadoPage.tsx`

**O bug:** O `handleUpload` (linhas 158-164) grava em `arquivo_url` e `storage_path`, que NÃO existem na tabela. A coluna real é `arquivo_encriptado_url`. Além disso, falta o campo `cnpj_titular` que é NOT NULL no banco — o insert vai falhar com violação de constraint.

**Referência correta:** `src/domains/fiscal/services/certificate.service.ts` linhas 60-69 faz o insert correto. Usar como modelo.

**Step 1: Localizar o payload do insert (linhas 158-164)**

Código atual:
```typescript
const payload: any = {
  nome: formUpload.nome,
  tipo_certificado: 'a1',
  arquivo_url: urlData?.publicUrl ?? storagePath,
  storage_path: storagePath,
  ativo: false,
};
```

**Step 2: Corrigir para usar as colunas corretas + adicionar cnpj_titular**

Substituir por:
```typescript
const payload: any = {
  nome: formUpload.nome,
  tipo_certificado: 'a1',
  arquivo_encriptado_url: storagePath,
  cnpj_titular: formUpload.cnpj_titular || '', // campo obrigatório NOT NULL
  ativo: false,
};
```

> **IMPORTANTE:** O form de upload precisa coletar o CNPJ titular do certificado. Adicionar um campo `<Input>` para CNPJ no formulário de upload, ou preencher automaticamente a partir da empresa ativa via `useEmpresaPrincipal()`.

**Step 3: Remover a linha que pega URL pública (linhas 152-155)**

Essa URL pública não é usada — o bucket é privado. Remover:
```typescript
// REMOVER estas linhas:
const { data: urlData } = supabase.storage
  .from('fiscal-certificados')
  .getPublicUrl(storagePath);
```

**Step 4: Build check**
```bash
pnpm run build
```

**Step 5: Commit**
```bash
git add src/domains/fiscal/pages/FiscalCertificadoPage.tsx
git commit -m "fix(fiscal): use correct column arquivo_encriptado_url in cert upload"
```

---

## Task 3: Deploy TODAS as 6 Edge Functions Faltantes no Supabase

**IMPORTANTE:** Nada pode ficar pra depois. Todas as 6 funções devem ser deployed.

**Funções + Secrets necessários:**

| Function | Secrets necessários |
|----------|-------------------|
| `fiscal-deploy-certificado` | `VERCEL_TOKEN`, `NFE_SERVICE_PROJECT_ID` |
| `enviar-email-proposta` | `RESEND_API_KEY` |
| `enviar-email-campanha` | `RESEND_API_KEY` |
| `onedrive-criar-pasta` | `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_REFRESH_TOKEN` |
| `onedrive-upload-proposta` | `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_REFRESH_TOKEN` |
| `resolve-geo` | Nenhum adicional |

**Step 1: Verificar/instalar Supabase CLI**
```bash
npx supabase --version
```
Se não tiver, instalar: `npm install -g supabase`

**Step 2: Deploy todas as funções**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma

npx supabase functions deploy fiscal-deploy-certificado --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy enviar-email-proposta --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy enviar-email-campanha --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy onedrive-criar-pasta --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy onedrive-upload-proposta --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy resolve-geo --project-ref djwjmfgplnqyffdcgdaw
```

**Se o CLI não funcionar, usar o Dashboard:**
1. Abrir https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/functions
2. Para cada função: New Function → nome exato → colar código de `supabase/functions/<nome>/index.ts`

**Step 3: Configurar Secrets no Supabase**

Abrir https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/settings/functions

Verificar que existem os seguintes secrets:
- `RESEND_API_KEY` — chave API do Resend para envio de emails
- `ONEDRIVE_CLIENT_ID` — ID do app Microsoft registrado
- `ONEDRIVE_CLIENT_SECRET` — Secret do app Microsoft
- `ONEDRIVE_REFRESH_TOKEN` — Token de refresh OAuth do OneDrive
- `VERCEL_TOKEN` — Token API do Vercel (para deploy de certificado)
- `NFE_SERVICE_PROJECT_ID` — ID do projeto Vercel do nfe-service

**Se algum secret não existir:** A função vai deployar mas vai dar erro ao ser chamada. Documentar quais secrets faltam para o usuário configurar depois.

**Step 4: Verificar deploy**

Abrir https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/functions
Todas as 20 funções devem aparecer como **Active**:
- ✅ ai-analisar-orcamento
- ✅ ai-briefing-producao
- ✅ ai-composicao-produto
- ✅ ai-detectar-problemas
- ✅ ai-resumo-cliente
- ✅ create-user
- ✅ enviar-email-campanha ← NEW
- ✅ enviar-email-proposta ← NEW
- ✅ fiscal-cancelar-nfe
- ✅ fiscal-consultar-nfe
- ✅ fiscal-deploy-certificado ← NEW
- ✅ fiscal-emitir-nfe
- ✅ fiscal-gerar-danfe
- ✅ fiscal-inutilizar-nfe
- ✅ fiscal-sync-status
- ✅ fiscal-testar-certificado (UPDATED)
- ✅ onedrive-criar-pasta ← NEW
- ✅ onedrive-upload-proposta ← NEW
- ✅ resolve-geo ← NEW

---

## Task 4: Criar Página Central `/admin/empresa`

**Files:**
- Create: `src/domains/admin/pages/EmpresaPage.tsx`
- Modify: `src/routes/adminRoutes.tsx` (adicionar rota)
- Modify: `src/components/layout/Sidebar.tsx` (adicionar menu item)

**Step 1: Criar a página `EmpresaPage.tsx`**

Criar arquivo `src/domains/admin/pages/EmpresaPage.tsx`:

```tsx
import React from 'react';
import { Building2 } from 'lucide-react';
import TabEmpresas from '@/domains/fiscal/components/TabEmpresas';

export default function EmpresaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Cadastro da Empresa
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Dados da empresa utilizados em notas fiscais, orçamentos, relatórios e documentos
        </p>
      </div>
      <TabEmpresas />
    </div>
  );
}
```

**Step 2: Adicionar rota em `adminRoutes.tsx`**

Abrir `src/routes/adminRoutes.tsx` e adicionar dentro do array de children:

```tsx
{
  path: 'empresa',
  lazy: async () => {
    const { default: EmpresaPage } = await import('@/domains/admin/pages/EmpresaPage');
    return { Component: EmpresaPage };
  },
},
```

**Step 3: Adicionar item no Sidebar**

Abrir `src/components/layout/Sidebar.tsx`, localizar a seção de menu "Configurações" ou "Admin" e adicionar:

```tsx
{ label: 'Empresa', href: '/admin/empresa', icon: Building2 },
```

Importar `Building2` de `lucide-react` no topo se não existir.

**Step 4: Build check**
```bash
pnpm run build
```

**Step 5: Testar**
- Navegar para `/admin/empresa`
- Verificar que o form da empresa aparece com dados da Croma Print
- Editar e salvar → confirmar persistência

**Step 6: Commit**
```bash
git add src/domains/admin/pages/EmpresaPage.tsx src/routes/adminRoutes.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(admin): add central empresa management page at /admin/empresa"
```

---

## Task 5: Atualizar TabAmbientes para Ler de `empresas`

**Files:**
- Modify: `src/domains/fiscal/hooks/useFiscal.ts` (query do useFiscalAmbientes)
- Modify: `src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx` (TabAmbientes section)

**Step 1: Atualizar query em `useFiscal.ts`**

Na função `useFiscalAmbientes` (linha ~46), trocar o select:

De:
```typescript
.select('id, codigo, nome, tipo, endpoint_base, ativo, cnpj_emitente, razao_social_emitente, ie_emitente, crt, created_at, updated_at')
```

Para:
```typescript
.select('id, codigo, nome, tipo, endpoint_base, ativo, empresa_id, empresas(id, razao_social, cnpj, ie, crt), created_at, updated_at')
```

**Step 2: Atualizar os cards de ambiente em `FiscalConfiguracaoPage.tsx`**

Localizar onde os cards de ambiente mostram dados de emitente (linhas ~329-336). Trocar de `amb.cnpj_emitente` / `amb.razao_social_emitente` para `(amb as any).empresas?.cnpj` / `(amb as any).empresas?.razao_social`.

**Step 3: No form de edição de ambiente, trocar campos de emitente por Select de empresa**

Importar `useEmpresasAtivas` de `../hooks/useEmpresas` e substituir os campos manuais por:

```tsx
const { data: empresasAtivas = [] } = useEmpresasAtivas();

<div>
  <Label>Empresa Emitente</Label>
  <Select
    value={form.empresa_id || ''}
    onValueChange={(val) => setForm(f => ({ ...f, empresa_id: val }))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecione a empresa" />
    </SelectTrigger>
    <SelectContent>
      {empresasAtivas.map(emp => (
        <SelectItem key={emp.id} value={emp.id}>
          {emp.razao_social} ({emp.cnpj})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Remover os campos: `cnpj_emitente`, `razao_social_emitente`, `ie_emitente`, `im_emitente`, `crt`, `logradouro`, `numero_endereco`, `complemento`, `bairro`, `municipio`, `uf`, `cep`, `codigo_municipio_ibge`, `telefone_emitente`.

**Step 4: Atualizar mutation de salvar ambiente** — enviar apenas `empresa_id`.

**Step 5: Build check + test**
```bash
pnpm run build
```

**Step 6: Commit**
```bash
git add src/domains/fiscal/hooks/useFiscal.ts src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx
git commit -m "refactor(fiscal): ambientes read empresa from central empresas table"
```

---

## Task 6: Criar Hook `useEmpresaPrincipal`

**Files:**
- Create: `src/shared/hooks/useEmpresaPrincipal.ts`

**Step 1: Criar o hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmpresaPrincipal {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  ie: string | null;
  im: string | null;
  telefone: string | null;
  logo_url: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}

/** Hook React: retorna a empresa principal (primeira ativa). Cache de 5 min. */
export function useEmpresaPrincipal() {
  return useQuery({
    queryKey: ['empresa_principal'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, razao_social, nome_fantasia, cnpj, ie, im, telefone, logo_url, logradouro, numero_endereco, bairro, municipio, uf, cep')
        .eq('ativa', true)
        .order('created_at')
        .limit(1)
        .single();
      if (error) return null;
      return data as EmpresaPrincipal;
    },
  });
}

/** Função async (não-hook): para uso em geração de PDF, funções utilitárias. */
export async function fetchEmpresaPrincipal(): Promise<EmpresaPrincipal | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, cnpj, ie, im, telefone, logo_url, logradouro, numero_endereco, bairro, municipio, uf, cep')
    .eq('ativa', true)
    .order('created_at')
    .limit(1)
    .single();
  if (error) return null;
  return data as EmpresaPrincipal;
}
```

**Step 2: Commit**
```bash
git add src/shared/hooks/useEmpresaPrincipal.ts
git commit -m "feat: add useEmpresaPrincipal hook for centralized company data"
```

---

## Task 7: Substituir "Croma Print" Hardcoded em ~22 Ocorrências (15 Arquivos)

> **AUDIT COMPLETA (2026-03-18):** 4 agents auditaram o codebase inteiro. Lista abaixo é EXAUSTIVA.

**Files (todos Modify):**

| # | Arquivo | Linhas aprox | O que mudar |
|---|---------|-------------|-------------|
| 1 | `src/domains/comercial/components/OrcamentoPDF.tsx` | ~121, ~131 | Alt text logo + assinatura bloco |
| 2 | `src/domains/comercial/pages/OrcamentoViewPage.tsx` | ~331, ~562 | Header + footer |
| 3 | `src/domains/comercial/components/SharePropostaModal.tsx` | ~47, ~58 | WhatsApp share text + email subject |
| 4 | `src/domains/producao/pages/OrdemServicoPage.tsx` | ~204 | Header da OS |
| 5 | `src/domains/producao/pages/OrdemServicoOPPage.tsx` | ~185 | Header da OP |
| 6 | `src/domains/producao/components/os/OSPrintLayout.tsx` | ~459, ~620 | Alt text logo + footer impressão |
| 7 | `src/domains/producao/pages/TvPage.tsx` | ~260 | Título TV produção |
| 8 | `src/domains/portal/components/PortalFooter.tsx` | ~13, ~18, ~20 | Alt text logo + copyright + tagline |
| 9 | `src/domains/portal/components/PortalHeader.tsx` | ~25 | Alt text logo |
| 10 | `src/domains/portal/components/PortalConfirmation.tsx` | ~60 | Email link texto |
| 11 | `src/shared/pages/LoginPage.tsx` | ~63, ~128 | Branding + copyright |
| 12 | `src/domains/financeiro/pages/DrePage.tsx` | ~587 | Título relatório |
| 13 | `src/components/Layout.tsx` (ou `Sidebar.tsx`) | ~51, ~68 | "Cromaprint" no sidebar |
| 14 | `src/domains/admin/pages/AdminConfigPage.tsx` | ~620, ~725 | Docs de precificação |

**NÃO MUDAR (aceitável como está):**
- Alt text de logo em SVGs (pode manter como fallback)
- Testes unitários (`cnab400-itau.test.ts:28`) — dados mock
- URLs como `crm-croma.vercel.app` — são nomes de deploy
- Comentários e documentação

**Estratégia:**

### Para componentes React (com hooks disponíveis):
```tsx
import { useEmpresaPrincipal } from '@/shared/hooks/useEmpresaPrincipal';

const { data: empresa } = useEmpresaPrincipal();
const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
```

Usar em: `OrcamentoViewPage`, `OrdemServicoPage`, `OrdemServicoOPPage`, `TvPage`, `DrePage`, `LoginPage`, `SharePropostaModal`, `Layout`, `AdminConfigPage`

### Para componentes de PDF (não usam hooks):
Passar empresa como prop. Quem chama busca via `fetchEmpresaPrincipal()`:
```tsx
const empresa = await fetchEmpresaPrincipal();
<OrcamentoPDF empresa={empresa} ... />
```

Usar em: `OrcamentoPDF`, `OSPrintLayout`

### Para portal público (sem auth):
Usar `fetchEmpresaPrincipal()` no server ou passar via props do parent. Fallback: manter "Croma Print" como default.

Usar em: `PortalFooter`, `PortalHeader`, `PortalConfirmation`

**Step 1:** Em cada arquivo, buscar TODAS as ocorrências de:
- `"Croma Print Comunicacao Visual"`
- `"Croma Print Comunicação Visual"`
- `"CROMA PRINT COMUNICACAO VISUAL"`
- `"CROMA PRINT"`
- `"Croma Print"`
- `"Cromaprint"`

**Step 2:** Substituir pela variável dinâmica conforme a estratégia acima.

**Step 3: Build check**
```bash
pnpm run build
```

**Step 4: Testar visualmente**
- Abrir um orçamento → header/footer
- Abrir uma OS → header
- Abrir `/tv` → título
- Abrir `/login` → branding
- Abrir portal público → footer + confirmation page
- Compartilhar proposta via WhatsApp → preview text
- Sidebar do ERP → nome correto

**Step 5: Commit**
```bash
git add src/domains/comercial/ src/domains/producao/ src/domains/portal/ src/shared/pages/ src/domains/financeiro/ src/components/ src/domains/admin/
git commit -m "refactor: replace all 22 hardcoded Croma Print references with dynamic empresa data"
```

---

## Task 8: Atualizar Tipos TypeScript Fiscais

**Files:**
- Modify: `src/domains/fiscal/types/fiscal.types.ts`

**Step 1: Adicionar `empresa_id` nas interfaces**

```typescript
// FiscalAmbiente — adicionar:
empresa_id?: string;
empresas?: {
  id: string;
  razao_social: string;
  cnpj: string;
  ie?: string;
  crt?: number;
};

// FiscalDocumento — adicionar:
empresa_id?: string;

// FiscalCertificado — adicionar:
empresa_id?: string;

// FiscalSerie — adicionar:
empresa_id?: string;
```

**Step 2: Build + Commit**
```bash
pnpm run build
git add src/domains/fiscal/types/fiscal.types.ts
git commit -m "feat(fiscal): add empresa_id to fiscal TypeScript interfaces"
```

---

## Task 9: Remover Tab Empresas Duplicada do Fiscal Config

> Já coberto no plan original.



**Files:**
- Modify: `src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx`

**Step 1:** Remover `<TabsTrigger value="empresas">` do `<TabsList>`.

**Step 2:** Trocar `defaultValue="empresas"` para `defaultValue="ambientes"`.

**Step 3:** Remover `<TabsContent value="empresas"><TabEmpresas /></TabsContent>`.

**Step 4:** Remover import de `TabEmpresas` se não for mais usado.

**Step 5:** Adicionar Alert com link para `/admin/empresa`:

```tsx
<Alert className="border-blue-200 bg-blue-50">
  <Building2 className="w-4 h-4 text-blue-600" />
  <AlertDescription className="text-blue-800 text-sm">
    Os dados da empresa emitente são gerenciados em{' '}
    <a href="/admin/empresa" className="font-semibold underline hover:text-blue-900">
      Configurações → Empresa
    </a>
  </AlertDescription>
</Alert>
```

**Step 6: Build + Commit**
```bash
pnpm run build
git add src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx
git commit -m "refactor(fiscal): remove duplicate empresas tab, link to /admin/empresa"
```

---

## Task 10: 🚨 CRÍTICO — NF-e Emitir: Ler Dados da Empresa do Banco (Não de Env Vars)

> **Descoberta na auditoria final.** A Edge Function `fiscal-emitir-nfe` tem dados hardcoded da Croma Print como fallback. Se as env vars não estiverem configuradas, a NF-e sai com dados errados. Isso viola regulamentação fiscal.

**Files:**
- Modify: `supabase/functions/fiscal-emitir-nfe/index.ts`

**O bug (linhas ~251-281):** O código constrói o emitente assim:
```typescript
xNome: Deno.env.get('NFE_RAZAO_SOCIAL') ?? 'CROMA PRINT COMUNICACAO VISUAL LTDA'
IE: Deno.env.get('NFE_IE') ?? '142826237111'
xLgr: Deno.env.get('NFE_ENDERECO') ?? 'RUA PAULO OROZIMBO'
nro: Deno.env.get('NFE_NUMERO') ?? '424'
// ... 10+ campos hardcoded
```

**A correção:** O documento fiscal (`fiscal_documentos`) já tem `empresa_id`. Buscar a empresa antes de montar o XML.

**Step 1: Adicionar query da empresa no início do handler**

Após buscar o `fiscal_documentos`, adicionar:
```typescript
// Buscar dados da empresa emitente
const { data: empresa, error: empError } = await supabaseAdmin
  .from('empresas')
  .select('*')
  .eq('id', documento.empresa_id)
  .single();

if (empError || !empresa) {
  return new Response(JSON.stringify({ ok: false, mensagem: 'Empresa emitente não encontrada' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**Step 2: Substituir TODOS os `Deno.env.get('NFE_...')` pelo objeto `empresa`**

Mapeamento:
| Env Var Hardcoded | Campo `empresas` |
|---|---|
| `NFE_RAZAO_SOCIAL` | `empresa.razao_social` |
| `NFE_CNPJ` | `empresa.cnpj` |
| `NFE_IE` | `empresa.ie` |
| `NFE_IM` | `empresa.im` |
| `NFE_CRT` | `empresa.crt` (1=Simples, 2=SN excedido, 3=Normal) |
| `NFE_ENDERECO` | `empresa.logradouro` |
| `NFE_NUMERO` | `empresa.numero_endereco` |
| `NFE_COMPLEMENTO` | `empresa.complemento` |
| `NFE_BAIRRO` | `empresa.bairro` |
| `NFE_MUNICIPIO` | `empresa.municipio` |
| `NFE_UF` | `empresa.uf` |
| `NFE_CEP` | `empresa.cep` |
| `NFE_COD_IBGE` | `empresa.codigo_municipio_ibge` |
| `NFE_TELEFONE` | `empresa.telefone` |

**Step 3: Manter env vars APENAS como override (não fallback)**

```typescript
// Prioridade: env var (override manual) > empresa do banco > erro
const emitente = {
  xNome: empresa.razao_social,
  CNPJ: empresa.cnpj.replace(/\D/g, ''),
  IE: empresa.ie?.replace(/\D/g, '') ?? '',
  CRT: String(empresa.crt ?? 3),
  xLgr: empresa.logradouro ?? '',
  nro: empresa.numero_endereco ?? 'S/N',
  xCpl: empresa.complemento ?? '',
  xBairro: empresa.bairro ?? '',
  xMun: empresa.municipio ?? '',
  UF: empresa.uf ?? '',
  CEP: empresa.cep?.replace(/\D/g, '') ?? '',
  cMun: empresa.codigo_municipio_ibge ?? '',
  fone: empresa.telefone?.replace(/\D/g, '') ?? '',
};
```

**Step 4: Deploy atualizado**
```bash
npx supabase functions deploy fiscal-emitir-nfe --project-ref djwjmfgplnqyffdcgdaw
```

**Step 5: Commit**
```bash
git add supabase/functions/fiscal-emitir-nfe/index.ts
git commit -m "fix(fiscal): emitir-nfe reads empresa from DB instead of hardcoded env vars"
```

---

## Task 11: Edge Functions de Email — Sender Dinâmico

> **Descoberta na auditoria.** Duas Edge Functions de email têm sender hardcoded.

**Files:**
- Modify: `supabase/functions/enviar-email-campanha/index.ts`
- Modify: `supabase/functions/enviar-email-proposta/index.ts`

**O problema:**
- `enviar-email-campanha` linha ~102: `from: 'Croma Print <noreply@cromaprint.com.br>'`
- `enviar-email-proposta` linha ~79: `from: Deno.env.get('EMAIL_FROM') || 'Croma Print <noreply@cromaprint.com.br>'`

**Step 1: Em ambas as functions, buscar empresa ativa**

```typescript
const { data: empresa } = await supabaseAdmin
  .from('empresas')
  .select('razao_social, nome_fantasia')
  .eq('ativa', true)
  .order('created_at')
  .limit(1)
  .single();

const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
const emailFrom = Deno.env.get('EMAIL_FROM') || `${nomeEmpresa} <noreply@cromaprint.com.br>`;
```

**Step 2:** Usar `emailFrom` no campo `from` de cada envio Resend.

**Step 3: Deploy**
```bash
npx supabase functions deploy enviar-email-campanha --project-ref djwjmfgplnqyffdcgdaw
npx supabase functions deploy enviar-email-proposta --project-ref djwjmfgplnqyffdcgdaw
```

**Step 4: Commit**
```bash
git add supabase/functions/enviar-email-campanha/index.ts supabase/functions/enviar-email-proposta/index.ts
git commit -m "fix: email functions use dynamic empresa name as sender"
```

---

## Task 12: Verificar Invocações de Edge Functions via `fetch()` Direto

> **Descoberta na auditoria.** 3 arquivos chamam Edge Functions via `fetch()` direto em vez de `supabase.functions.invoke()`. Funciona, mas precisa garantir URL e headers corretos.

**Files para verificar (não necessariamente corrigir):**

| Arquivo | Linha | Function chamada | Método |
|---------|-------|-----------------|--------|
| `src/domains/portal/services/tracking.service.ts` | ~50 | `resolve-geo` | `fetch()` direto |
| `src/domains/portal/services/portal-upload.service.ts` | ~22 | `onedrive-upload-proposta` | `fetch()` direto |
| `src/domains/comercial/components/SharePropostaModal.tsx` | ~58 | `enviar-email-proposta` | `fetch()` direto |

**Step 1:** Abrir cada arquivo e verificar:
- URL usa `${SUPABASE_URL}/functions/v1/<nome>` ✅
- Header inclui `Authorization: Bearer ${SUPABASE_ANON_KEY}` ✅
- Body é JSON válido ✅

**Step 2:** Se algum estiver errado, corrigir. Se todos estiverem OK, apenas documentar que foram verificados.

**Step 3: Testar** após deploy das Edge Functions na Task 3:
- Portal → tracking → `resolve-geo` deve retornar geo data
- Portal → upload arquivo → `onedrive-upload-proposta` deve funcionar (com secrets configurados)
- Compartilhar proposta → `enviar-email-proposta` deve enviar email

---

## Ordem de Execução

```
FASE 1 — Bug Fixes (urgente, user-facing)
├── Task 1: Fix Edge Function testar-certificado + DEPLOY no Supabase
├── Task 2: Fix upload colunas erradas
└── Task 3: Deploy TODAS as 6 Edge Functions faltantes

FASE 2 — Empresa Central + Críticos
├── Task 4: Criar /admin/empresa
├── Task 5: TabAmbientes → usar empresas
├── Task 6: Hook useEmpresaPrincipal
├── Task 9: Remover tab duplicada do fiscal
├── Task 10: 🚨 NF-e emitir ler empresa do banco (CRÍTICO fiscal)
└── Task 11: Email functions sender dinâmico

FASE 3 — Polish + Verificação
├── Task 7: Substituir hardcoded "Croma Print" (~22 ocorrências, 15 arquivos)
├── Task 8: Atualizar tipos TypeScript
└── Task 12: Verificar invocações fetch() direto
```

Tasks dentro de cada fase podem rodar em paralelo. Fases devem ser sequenciais.

---

## Verificação Final (checklist obrigatório — 20 itens)

Após completar TODAS as tasks:

### Build & Testes
- [ ] `pnpm run build` passa sem erros
- [ ] `pnpm run test` passa (102 testes)

### Certificado Digital (Tasks 1, 2)
- [ ] "Testar Certificado" funciona em `/fiscal/certificado` → toast verde "sucesso"
- [ ] Badge de último teste mostra verde "Sucesso" (não "Falhou") após testar
- [ ] Upload de novo certificado grava corretamente no banco (coluna `arquivo_encriptado_url`)

### Empresa Central (Tasks 4, 5, 6, 9)
- [ ] `/admin/empresa` mostra e edita dados da Croma Print
- [ ] `/admin/empresa` aparece no menu lateral (Sidebar)
- [ ] `/fiscal/configuracao` → tab Ambientes mostra dados da empresa via relação (sem campos duplicados)
- [ ] `/fiscal/configuracao` não tem mais tab "Empresas" (só link para /admin/empresa)
- [ ] Ambientes têm Select de empresa (não campos manuais de CNPJ/razão social)

### Edge Functions (Tasks 3, 10, 11)
- [ ] **TODAS as 20 Edge Functions** aparecem como Active no Supabase Dashboard
- [ ] Nenhuma Edge Function local ficou sem deploy
- [ ] `fiscal-emitir-nfe` lê empresa do banco (ZERO dados hardcoded de emitente)
- [ ] Email functions usam nome dinâmico da empresa
- [ ] Secrets verificados: RESEND_API_KEY, ONEDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN, VERCEL_TOKEN

### Hardcoded "Croma Print" (Task 7)
- [ ] Orçamentos, OS, portal, login mostram nome dinâmico da empresa
- [ ] SharePropostaModal usa nome dinâmico no WhatsApp
- [ ] Sidebar do ERP mostra nome da empresa do banco
- [ ] `grep -r "Croma Print" src/ --include="*.tsx" --include="*.ts"` retorna ZERO (exceto fallbacks)

### Final
- [ ] Commit final feito e push para `main`
