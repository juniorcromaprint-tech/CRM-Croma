# ERP Croma Print — Correção Total (100% Funcional)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir todos os 5 problemas críticos identificados pelos agentes QA para que o ERP funcione 100% — Lead→Cliente, Orçamento com preço real, Produção com processos, NF-e em homologação, App de Campo integrado.

**Architecture:** 4 trilhas paralelas independentes + 1 sequential após seed. Cada trilha toca áreas diferentes do sistema sem conflito.

**Tech Stack:** React 19 + TypeScript, Supabase (PostgreSQL + Edge Functions), TanStack Query v5

---

## TRILHA A — QA-001: Conversão Lead → Cliente (frontend only)

**Arquivo:** `src/domains/comercial/pages/LeadDetailPage.tsx`

### Task A1: Corrigir handleConverter para criar cliente

**Problema:** `handleConverter` (linha 103) apenas muda status do lead para "convertido" mas NÃO insere registro em `clientes`. O fluxo comercial fica bloqueado.

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx:103-114`

**Step 1: Ler o arquivo completo para entender imports existentes**

```bash
cat src/domains/comercial/pages/LeadDetailPage.tsx | head -30
```

**Step 2: Verificar se useCreateCliente já está disponível no hook**

```bash
grep -n "useCreateCliente\|createCliente\|ClienteInput" src/domains/clientes/hooks/useClientes.ts | head -10
```

**Step 3: Adicionar import de useCreateCliente no topo do LeadDetailPage.tsx**

Adicionar ao bloco de imports existente (onde estão outros hooks):
```tsx
import { useCreateCliente } from '@/domains/clientes/hooks/useClientes';
```

**Step 4: Adicionar hook dentro do componente (junto com os outros hooks)**

Após linha onde `updateLead` é declarado:
```tsx
const createCliente = useCreateCliente();
```

**Step 5: Substituir handleConverter**

Substituir o bloco atual (linhas 103-114) por:

```tsx
const handleConverter = async () => {
  if (!id || !lead) return;

  try {
    // 1. Criar cliente a partir dos dados do lead
    await createCliente.mutateAsync({
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? undefined,
      telefone: lead.contato_telefone ?? undefined,
      segmento: lead.segmento ?? undefined,
      origem: 'lead_convertido',
    });

    // 2. Marcar lead como convertido
    updateLead.mutate(
      { id, status: 'convertido' },
      {
        onSuccess: () => {
          setConvertOpen(false);
          navigate('/clientes');
        },
      }
    );
  } catch (error) {
    showError('Erro ao converter lead em cliente');
  }
};
```

**Step 6: Build check**

```bash
cd /c/Users/Caldera/Claude/CRM-Croma && npm run build 2>&1 | tail -20
```

Expected: sem erros de TypeScript no arquivo modificado.

**Step 7: Commit**

```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx
git commit -m "fix(comercial): handleConverter cria registro em clientes ao converter lead

QA-001: conversao Lead->Cliente agora insere na tabela clientes antes
de marcar o lead como convertido, desbloqueando o fluxo comercial."
```

---

## TRILHA B — QA-002: Seed modelo_materiais + modelo_processos

**Problema:** 467 materiais existem mas ZERO estão vinculados aos 156 modelos de produto. Motor Mubisys recebe arrays vazios → orçamento = R$0,00. Migration 010 falhou silenciosamente por IDs não encontrados.

**Files:**
- Create: `supabase/migrations/022_seed_modelo_materiais_processos.sql`

### Task B1: Criar migration 022 com seed completo por categoria

**Estratégia:** Buscar materiais por nome ILIKE (mais robusto que por código), vincular por categoria de produto. Cada categoria tem seu conjunto canônico de materiais + processos.

**Mapeamento por categoria:**

| Categoria | Materiais principais | Processo |
|-----------|---------------------|---------|
| banners_lonas | lona 440g, ilhós, impressão digital | Impressão + Acabamento |
| adesivos | vinil adesivo, laminação | Impressão + Aplicação |
| acm / fachadas | ACM 3mm, parafuso/rebite | Corte + Montagem |
| displays | PVC 3mm / acrílico | Corte + Montagem |
| roll_up | lona, mecanismo roll-up | Impressão + Montagem |
| caixas_luz / backlight | lona, perfil alumínio LED | Impressão + Elétrica |
| grafica | papel couchê / off-set | Impressão + Acabamento |

**Step 1: Verificar categorias reais no banco**

Execute via Supabase MCP:
```sql
SELECT DISTINCT categoria FROM produtos ORDER BY categoria;
```

**Step 2: Verificar materiais disponíveis por nome**

```sql
SELECT nome, codigo, preco_medio, unidade
FROM materiais
WHERE preco_medio > 0
ORDER BY nome
LIMIT 30;
```

**Step 3: Criar o arquivo de migration**

Criar `supabase/migrations/022_seed_modelo_materiais_processos.sql` com o conteúdo completo abaixo.

O script deve:
1. Usar `DO $$ DECLARE ... BEGIN ... END $$` com variáveis UUID para cada material
2. Buscar materiais por nome ILIKE (tolerante a variações)
3. Para CADA modelo de produto, inserir registros em `modelo_materiais` com:
   - `material_id` (FK)
   - `quantidade_por_unidade` (baseada na área do modelo quando disponível, ou valor fixo por unidade)
   - `unidade` (m2, un, ml, kg)
   - `tipo` = 'principal' ou 'acabamento'
4. Para CADA produto, inserir registros em `modelo_processos` com etapas e tempos realistas
5. Usar `ON CONFLICT DO NOTHING` para ser idempotente

**Quantidades de referência para banners (base m²):**
- Lona 440g: 1.1 m² por m² do banner (10% de perda)
- Ilhós: 8 por m² (aprox)
- Impressão digital: 1 m² por m² (serviço, custo/m²)

**Step 4: Executar migration no Supabase via MCP**

Usar `apply_migration` do Supabase MCP.

**Step 5: Verificar resultado**

```sql
SELECT
  p.nome as produto,
  pm.nome as modelo,
  COUNT(mm.id) as qtd_materiais,
  COUNT(mp.id) as qtd_processos
FROM produto_modelos pm
JOIN produtos p ON p.id = pm.produto_id
LEFT JOIN modelo_materiais mm ON mm.modelo_id = pm.id
LEFT JOIN modelo_processos mp ON mp.modelo_id = pm.id
GROUP BY p.nome, pm.nome
ORDER BY qtd_materiais ASC
LIMIT 20;
```

Expected: todos os modelos com qtd_materiais > 0

**Step 6: Commit**

```bash
git add supabase/migrations/022_seed_modelo_materiais_processos.sql
git commit -m "feat(db): seed modelo_materiais e modelo_processos por categoria

QA-002: vincula materiais reais (467) aos modelos de produto (156) por
categoria usando ILIKE. Adiciona processos padrao por tipo de produto.
Motor Mubisys agora recebe arrays populados -> orcamento com preco real."
```

---

## TRILHA C — QA-003: Executar Migration 004 (Bridge ERP↔Campo)

**Problema:** Migration 004 nunca foi executada. Triggers `fn_create_job_from_ordem` e `fn_sync_job_to_ordem` ausentes. App de Campo não recebe ordens de instalação.

**Files:**
- Execute: `supabase/migrations/004_integracao_bridge.sql` (via Supabase MCP)

### Task C1: Executar migration 004

**Step 1: Verificar se as tabelas jobs e stores existem**

Via Supabase MCP:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('jobs', 'stores', 'ordens_instalacao')
ORDER BY table_name;
```

**Step 2: Ler o conteúdo completo da migration 004**

```bash
cat supabase/migrations/004_integracao_bridge.sql
```

**Step 3: Executar via Supabase MCP `apply_migration`**

Usar a tool `apply_migration` com o conteúdo completo do arquivo.

**Step 4: Verificar resultado**

```sql
-- Verificar colunas adicionadas
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobs'
AND column_name IN ('ordem_instalacao_id', 'pedido_id', 'pedido_item_id');

-- Verificar view criada
SELECT 1 FROM information_schema.views
WHERE table_name = 'vw_campo_instalacoes';

-- Verificar triggers criados
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name LIKE '%campo%' OR trigger_name LIKE '%sync%' OR trigger_name LIKE '%bridge%';
```

**Step 5: Commit**

```bash
git commit --allow-empty -m "feat(db): migration 004 executada - bridge ERP<>Campo ativo

QA-003: triggers fn_create_job_from_ordem e fn_sync_job_to_ordem
funcionando. View vw_campo_instalacoes disponivel."
```

---

## TRILHA D — QA-004/005: Módulo Fiscal NF-e

**Problema duplo:**
- QA-004: `NFE_PROVIDER_TOKEN` ausente → modo DEMO sem transmissão real
- QA-005: `fiscal_ambientes` sem colunas fiscais (CNPJ, IE, endereço) → campos obrigatórios NF-e ausentes
- QA-004b: `chave_acesso` sem dígito verificador MD5

**NOTA IMPORTANTE:** Para NF-e homologação funcionar de verdade, o usuário precisa fornecer:
- CNPJ da Croma Print
- Inscrição Estadual
- Token do Focus NFe (ou provedor escolhido)
- Certificado A1 (.pfx)

O que podemos fazer SEM essas informações:
1. Adicionar as colunas que faltam em `fiscal_ambientes`
2. Corrigir a UI para incluir todos os campos necessários
3. Corrigir a geração da `chave_acesso` com dígito verificador
4. Documentar o procedimento de configuração

### Task D1: Migration — adicionar colunas fiscais em fiscal_ambientes

**Files:**
- Create: `supabase/migrations/023_fiscal_ambientes_campos.sql`

**Conteúdo da migration:**

```sql
-- 023 — Adiciona campos fiscais completos em fiscal_ambientes
-- Necessários para emissão NF-e válida (NT 2019.001 / 4.0)

ALTER TABLE public.fiscal_ambientes
  ADD COLUMN IF NOT EXISTS cnpj_emitente        text,
  ADD COLUMN IF NOT EXISTS razao_social_emitente text,
  ADD COLUMN IF NOT EXISTS ie_emitente           text,    -- Inscrição Estadual
  ADD COLUMN IF NOT EXISTS im_emitente           text,    -- Inscrição Municipal (NFS-e)
  ADD COLUMN IF NOT EXISTS crt                   integer DEFAULT 1 CHECK (crt IN (1,2,3)),
  -- 1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal
  ADD COLUMN IF NOT EXISTS logradouro            text,
  ADD COLUMN IF NOT EXISTS numero_endereco       text,
  ADD COLUMN IF NOT EXISTS complemento           text,
  ADD COLUMN IF NOT EXISTS bairro                text,
  ADD COLUMN IF NOT EXISTS municipio             text,
  ADD COLUMN IF NOT EXISTS uf                    char(2),
  ADD COLUMN IF NOT EXISTS cep                   text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text,
  ADD COLUMN IF NOT EXISTS telefone_emitente     text;

COMMENT ON COLUMN public.fiscal_ambientes.cnpj_emitente IS 'CNPJ da empresa emitente (sem formatação)';
COMMENT ON COLUMN public.fiscal_ambientes.crt IS '1=Simples Nacional, 3=Regime Normal (Lucro Presumido/Real)';
COMMENT ON COLUMN public.fiscal_ambientes.codigo_municipio_ibge IS 'Código IBGE do município emitente (7 dígitos)';
```

**Step 1: Criar o arquivo de migration**

**Step 2: Executar via Supabase MCP**

**Step 3: Verificar colunas criadas**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fiscal_ambientes'
ORDER BY ordinal_position;
```

### Task D2: Atualizar FiscalConfiguracaoPage.tsx — Tab Ambientes

**Files:**
- Modify: `src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx`

**Objetivo:** Adicionar todos os campos fiscais ao formulário de edição do ambiente.

**Step 1: Ler o arquivo completo**

**Step 2: Expandir `formAmb` state para incluir todos os novos campos**

```tsx
const [formAmb, setFormAmb] = useState({
  cnpj_emitente: '',
  razao_social_emitente: '',
  ie_emitente: '',
  im_emitente: '',
  crt: 1,
  logradouro: '',
  numero_endereco: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  cep: '',
  codigo_municipio_ibge: '',
  telefone_emitente: '',
  ativo: true,
});
```

**Step 3: Expandir `abrirEdicao` para popular os novos campos**

**Step 4: Adicionar campos ao formulário JSX** — organizar em seções:
- Seção "Identificação": CNPJ, Razão Social, IE, IM, CRT
- Seção "Endereço": Logradouro, Número, Complemento, Bairro, Município, UF, CEP, Código IBGE
- Seção "Contato": Telefone

**Step 5: Incluir todos os campos no `salvarAmbiente`**

**Step 6: Build check + commit**

### Task D3: Corrigir geração de chave_acesso com dígito verificador

**Files:**
- Modify: `supabase/functions/fiscal-emitir-nfe/index.ts`

**Problema:** linha 201 gera chave sem dígito verificador:
```ts
chave_acesso: `35${...}1`, // termina com "1" fixo, sem DV
```

**Step 1: Ler o arquivo completo**

**Step 2: Adicionar função calcDVChaveNFe antes do serve()**

```typescript
/**
 * Calcula o dígito verificador da chave de acesso NF-e
 * usando o módulo 11 conforme Manual de Orientação do Contribuinte
 */
function calcDVChaveNFe(chave43: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let idx = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]) * pesos[idx % 8];
    idx++;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
```

**Step 3: Atualizar geração da chave no modo DEMO (linha ~201)**

```typescript
const cUF = '35'; // São Paulo — será dinâmico quando fiscal_ambientes tiver uf
const aamm = new Date().toISOString().slice(2, 7).replace('-', '');
const cnpjLimpo = (cnpjEmitente ?? '').replace(/\D/g, '').padStart(14, '0');
const mod = '55'; // NF-e
const serie = '001';
const nNF = numero.toString().padStart(9, '0');
const tpEmis = '1';
const cNF = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
const chave43 = `${cUF}${aamm}${cnpjLimpo}${mod}${serie}${nNF}${tpEmis}${cNF}`;
const dv = calcDVChaveNFe(chave43);
const chave_acesso = `${chave43}${dv}`;
```

**Step 4: Redeploy da Edge Function**

```bash
supabase functions deploy fiscal-emitir-nfe --project-ref djwjmfgplnqyffdcgdaw
```

**Step 5: Commit**

```bash
git add supabase/functions/fiscal-emitir-nfe/index.ts
git commit -m "fix(fiscal): chave_acesso NF-e com digito verificador modulo-11

QA-004: calcula DV correto segundo Manual de Orientacao do Contribuinte.
Chave de 44 digitos valida no formato exigido pela SEFAZ."
```

---

## TRILHA E — Seed modelo_processos (sequencial após B)

**Depende de:** Trilha B (precisa que os modelos estejam com materiais para ter sentido)

### Task E1: Garantir modelo_processos por categoria na migration 022

(Incluído na migration 022 — não precisa de migration separada)

Processos padrão por categoria:

| Categoria | Etapas | Tempo (min/m²) |
|-----------|--------|----------------|
| banners_lonas | Impressão, Acabamento (ilhós), Embalagem | 15, 10, 5 |
| adesivos | Impressão, Laminação, Recorte, Embalagem | 12, 8, 10, 5 |
| acm / fachadas | Corte CNC, Dobra, Montagem, Pintura | 20, 15, 30, 10 |
| displays | Corte, Montagem, Embalagem | 15, 20, 5 |
| roll_up | Impressão, Montagem estrutura, Embalagem | 15, 10, 5 |
| caixas_luz | Impressão, Montagem elétrica, Instalação | 15, 45, 30 |
| grafica | Impressão, Corte, Dobra, Embalagem | 5, 3, 3, 2 |

---

## VERIFICAÇÃO FINAL

Após todas as trilhas, executar:

### Check 1: Fluxo completo Lead → Orçamento

1. Criar lead em `/leads/novo`
2. Converter em cliente — verificar que aparece em `/clientes`
3. Criar orçamento em `/orcamentos/novo`
4. Selecionar produto + modelo → verificar que materiais auto-preenchem
5. Verificar que preço calculado > R$0,00

### Check 2: App de Campo

```sql
-- Verificar se trigger existe
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%job%' OR routine_name LIKE '%campo%';
```

### Check 3: NF-e

1. Acessar `/fiscal/configuracao`
2. Editar ambiente homologação → preencher CNPJ/IE/endereço
3. Criar documento fiscal de teste
4. Verificar que chave de acesso tem 44 dígitos

---

## BLOQUEADORES QUE REQUEREM USUÁRIO

Para NF-e real (não DEMO), o usuário precisa fornecer:

1. **CNPJ da Croma Print** — para `fiscal_ambientes.cnpj_emitente`
2. **Inscrição Estadual** — para `fiscal_ambientes.ie_emitente`
3. **Endereço completo** — para campos de endereço
4. **Token Focus NFe** — `NFE_PROVIDER_TOKEN` no Supabase Edge Functions > Secrets
5. **Certificado A1** (.pfx) — upload em `/fiscal/certificado`

Estes itens são de configuração, não de código. Quando tiver, entrar em `/fiscal/configuracao`.
