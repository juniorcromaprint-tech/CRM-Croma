# Cliente Form Autocomplete — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar campo Inscrição Estadual no form de edição de clientes, autocomplete de endereço por CEP (ViaCEP) e autocomplete de dados da empresa por CNPJ (ReceitaWS).

**Architecture:** Dois hooks utilitários (`useCepLookup`, `useCnpjLookup`) com fetch puro (sem dependência nova). `ClienteDetailPage.tsx` consome os hooks e renderiza os novos comportamentos no form de edição existente. Sem migration, sem Edge Function.

**Tech Stack:** React 19, TypeScript, Vite, shadcn/ui (Input, Button, Label), lucide-react (Search, Loader2 já importados)

---

## Task 1: Hook useCepLookup

**Files:**
- Create: `src/domains/clientes/hooks/useCepLookup.ts`

**Step 1: Criar o hook**

```typescript
// src/domains/clientes/hooks/useCepLookup.ts
import { useState, useCallback } from 'react';
import { showError } from '@/utils/toast';

export interface CepResult {
  endereco_rua: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
}

export function useCepLookup() {
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (cep: string): Promise<CepResult | null> => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error('Erro na requisição');
      const data = await res.json();
      if (data.erro) {
        showError('CEP não encontrado');
        return null;
      }
      return {
        endereco_rua: data.logradouro ?? '',
        endereco_bairro: data.bairro ?? '',
        endereco_cidade: data.localidade ?? '',
        endereco_estado: data.uf ?? '',
      };
    } catch {
      showError('Erro ao buscar CEP. Verifique sua conexão.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}
```

**Step 2: Verificar TypeScript**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma\.claude\worktrees\reverent-jennings
npx tsc --noEmit
```
Expected: sem erros

**Step 3: Commit**

```bash
git add src/domains/clientes/hooks/useCepLookup.ts
git commit -m "feat(clientes): hook useCepLookup — autocomplete endereco via ViaCEP"
```

---

## Task 2: Hook useCnpjLookup

**Files:**
- Create: `src/domains/clientes/hooks/useCnpjLookup.ts`

**Step 1: Criar o hook**

```typescript
// src/domains/clientes/hooks/useCnpjLookup.ts
import { useState, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';

export interface CnpjResult {
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
}

// Parser para ReceitaWS
function parseReceitaWS(data: Record<string, string>): CnpjResult {
  return {
    razao_social: data.nome ?? '',
    nome_fantasia: data.fantasia ?? '',
    email: data.email ?? '',
    telefone: data.telefone ?? '',
    endereco_rua: [data.logradouro, data.numero].filter(Boolean).join(', '),
    endereco_numero: data.numero ?? '',
    endereco_bairro: data.bairro ?? '',
    endereco_cidade: data.municipio ?? '',
    endereco_estado: data.uf ?? '',
    endereco_cep: (data.cep ?? '').replace(/\D/g, ''),
  };
}

// Parser para CNPJ.ws (fallback)
function parseCnpjWs(data: Record<string, unknown>): CnpjResult {
  const e = (data.estabelecimento ?? {}) as Record<string, unknown>;
  const cidade = (e.cidade ?? {}) as Record<string, string>;
  const estado = (e.estado ?? {}) as Record<string, string>;
  return {
    razao_social: (data.razao_social as string) ?? '',
    nome_fantasia: (data.nome_fantasia as string) ?? '',
    email: (e.email as string) ?? '',
    telefone: (e.telefone1 as string) ?? '',
    endereco_rua: [(e.logradouro as string), (e.numero as string)].filter(Boolean).join(', '),
    endereco_numero: (e.numero as string) ?? '',
    endereco_bairro: (e.bairro as string) ?? '',
    endereco_cidade: cidade.nome ?? '',
    endereco_estado: estado.sigla ?? '',
    endereco_cep: ((e.cep as string) ?? '').replace(/\D/g, ''),
  };
}

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (cnpj: string): Promise<CnpjResult | null> => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      showError('CNPJ inválido — deve ter 14 dígitos');
      return null;
    }

    setLoading(true);
    try {
      // Tenta ReceitaWS primeiro
      let data: Record<string, unknown> | null = null;
      let source: 'receitaws' | 'cnpjws' = 'receitaws';

      try {
        const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // CORS ou falha — tenta fallback
      }

      // Fallback para CNPJ.ws se necessário
      if (!data || (data as Record<string, string>).status === 'ERROR') {
        const res2 = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`);
        if (!res2.ok) throw new Error('CNPJ não encontrado em nenhuma fonte');
        data = await res2.json();
        source = 'cnpjws';
      }

      // Verifica situação cadastral
      const situacao = ((data as Record<string, string>).situacao ?? (data as Record<string, string>).descricao_situacao_cadastral ?? '').toUpperCase();
      if (situacao && situacao !== 'ATIVA') {
        showError(`Empresa com situação: ${situacao}`);
        return null;
      }

      const result = source === 'receitaws'
        ? parseReceitaWS(data as Record<string, string>)
        : parseCnpjWs(data);

      showSuccess('Dados preenchidos com sucesso');
      return result;
    } catch (err) {
      showError('CNPJ não encontrado ou erro na consulta');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

**Step 3: Commit**

```bash
git add src/domains/clientes/hooks/useCnpjLookup.ts
git commit -m "feat(clientes): hook useCnpjLookup — autocomplete CNPJ via ReceitaWS+fallback"
```

---

## Task 3: Integrar na ClienteDetailPage — campo IE + autocomplete CEP

**Files:**
- Modify: `src/domains/clientes/pages/ClienteDetailPage.tsx`

### 3a — Imports e hooks

**Step 1: Adicionar imports no topo do arquivo**

Logo após a linha `import { useContatos, useCreateContato } from "@/domains/clientes/hooks/useContatos";` (linha ~19), adicionar:

```typescript
import { useCepLookup } from "@/domains/clientes/hooks/useCepLookup";
import { useCnpjLookup } from "@/domains/clientes/hooks/useCnpjLookup";
```

Também adicionar `Search` na lista de imports do lucide-react (já tem `Loader2`):

```typescript
// Antes:
  Loader2,
// Depois:
  Loader2,
  Search,
```

**Step 2: Instanciar os hooks no componente**

Logo após as linhas onde `useContatos` e `useCreateContato` são usados (próximo das outras chamadas de hook, antes dos handlers — em torno da linha 250):

```typescript
const { lookup: lookupCep, loading: cepLoading } = useCepLookup();
const { lookup: lookupCnpj, loading: cnpjLoading } = useCnpjLookup();
```

### 3b — Handler de CEP

**Step 3: Criar handler `handleCepBlur`** (junto com os outros handlers, próximo de `handleSave`):

```typescript
async function handleCepBlur() {
  if (!editForm.endereco_cep) return;
  const result = await lookupCep(editForm.endereco_cep);
  if (result) {
    setEditForm((prev) => ({ ...prev, ...result }));
  }
}
```

### 3c — Handler de CNPJ

**Step 4: Criar handler `handleCnpjBuscar`** (junto com os outros handlers):

```typescript
async function handleCnpjBuscar() {
  if (!editForm.cnpj) return;
  const result = await lookupCnpj(editForm.cnpj);
  if (result) {
    // Só preenche campos vazios
    setEditForm((prev) => ({
      ...prev,
      razao_social: prev.razao_social || result.razao_social,
      nome_fantasia: prev.nome_fantasia || result.nome_fantasia,
      email: prev.email || result.email,
      telefone: prev.telefone || result.telefone,
      endereco_rua: prev.endereco_rua || result.endereco_rua,
      endereco_numero: prev.endereco_numero || result.endereco_numero,
      endereco_bairro: prev.endereco_bairro || result.endereco_bairro,
      endereco_cidade: prev.endereco_cidade || result.endereco_cidade,
      endereco_estado: prev.endereco_estado || result.endereco_estado,
      endereco_cep: prev.endereco_cep || result.endereco_cep,
    }));
  }
}
```

### 3d — Campo Inscrição Estadual no form

**Step 5: Adicionar IE ao `editForm` state inicial** (linha ~330 dentro do `startEditing()`):

```typescript
// Adicionar junto com cnpj:
inscricao_estadual: cliente.inscricao_estadual ?? "",
```

**Step 6: Substituir o bloco do campo CNPJ** (linhas ~599-607) pelo novo bloco com botão Buscar + campo IE:

```tsx
{/* CNPJ com botão Buscar */}
<div>
  <Label>CNPJ</Label>
  <div className="flex gap-2">
    <Input
      value={editForm.cnpj ?? ""}
      onChange={(e) =>
        setEditForm({ ...editForm, cnpj: e.target.value })
      }
      placeholder="00.000.000/0000-00"
      className="flex-1"
    />
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCnpjBuscar}
      disabled={cnpjLoading || !editForm.cnpj}
      className="shrink-0"
    >
      {cnpjLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Search size={14} />
      )}
      <span className="ml-1">{cnpjLoading ? "Buscando..." : "Buscar"}</span>
    </Button>
  </div>
</div>

{/* Inscrição Estadual */}
<div>
  <Label>Inscrição Estadual</Label>
  <Input
    value={editForm.inscricao_estadual ?? ""}
    onChange={(e) =>
      setEditForm({ ...editForm, inscricao_estadual: e.target.value })
    }
    placeholder="Opcional"
  />
</div>
```

### 3e — Autocomplete no campo CEP

**Step 7: Substituir o campo CEP** (linhas ~745-755) adicionando `onBlur` e estado de loading:

```tsx
<div>
  <Label>CEP</Label>
  <div className="relative">
    <Input
      value={editForm.endereco_cep ?? ""}
      onChange={(e) =>
        setEditForm({
          ...editForm,
          endereco_cep: e.target.value,
        })
      }
      onBlur={handleCepBlur}
      placeholder="00000-000"
      disabled={cepLoading}
    />
    {cepLoading && (
      <Loader2
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
      />
    )}
  </div>
</div>
```

**Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

**Step 9: Commit**

```bash
git add src/domains/clientes/pages/ClienteDetailPage.tsx
git commit -m "feat(clientes): IE no form + autocomplete CEP e CNPJ"
```

---

## Task 4: Verificação visual e deploy

**Step 1: Build de produção**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma\.claude\worktrees\reverent-jennings
npx vite build 2>&1 | tail -20
```
Expected: `built in X.Xs` sem erros

**Step 2: Testar no preview (servidor já rodando na porta 8082)**

Navegar para um cliente qualquer → clicar Editar → verificar:
- Campo IE aparece ao lado do CNPJ
- Botão "Buscar" aparece ao lado do CNPJ
- Campo CEP tem comportamento de autocomplete ao sair do campo

**Step 3: Merge para main e push**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma
git merge claude/reverent-jennings --no-ff -m "feat(clientes): IE + autocomplete CEP/CNPJ no cadastro de clientes"
git push origin main
```
Expected: Vercel faz deploy automático em ~1-2 min

---

## Critérios de Conclusão

- [ ] `useCepLookup.ts` criado e compilando
- [ ] `useCnpjLookup.ts` criado com parsers ReceitaWS e CNPJ.ws
- [ ] Campo IE aparece no form de edição
- [ ] Botão "Buscar" ao lado do CNPJ preenche os campos
- [ ] CEP preenche endereço ao perder o foco
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx vite build` sem erros
- [ ] Deploy em main / Vercel
