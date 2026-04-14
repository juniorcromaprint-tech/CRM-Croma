# PLANO — Migrar useArteUpload pro OneDrive (sem limite de tamanho)

> **Status:** Aprovado pelo Junior em 2026-04-14. Pronto pra execução.
> **Executor esperado:** Sonnet (nova sessão). Opus planejou com investigação profunda.
> **Estimativa:** ~2h20min. Commits separados por passo.

---

## Objetivo

Eliminar o limite efetivo de 10MB do upload de arte pela equipe interna (vendedor). O arquivo original vai pro OneDrive na pasta do cliente (igual ao fluxo do portal cliente), o preview JPEG continua no Supabase Storage pro thumbnail leve. Substituir/remover arte deleta o arquivo antigo no OneDrive.

## Contexto técnico (NÃO REINVESTIGAR — já foi feito pelo Opus)

**Schema atual:**
- `pedido_itens` tem: `arte_url`, `arte_preview_url`, `arte_nome_original`, `arte_tamanho_bytes`, `arte_mime`, `arte_uploaded_at`, `arte_uploaded_by`. **FALTA** `arte_onedrive_file_id`.
- `pedidos` e `propostas` têm `onedrive_folder_id` + `onedrive_folder_url` (não usar — vêm da edge `onedrive-criar-pasta` quebrada com Composio).
- `proposta_attachments` só é usada pelo portal cliente. Não mexer.
- Bucket `job-attachments`: limite 10MB, público read, insert exige role `admin|vendedor|producao`, delete só admin.

**Edges existentes (referência):**
- `onedrive-upload-proposta/index.ts` v13 — Microsoft Graph direto (chunked, scope `Files.ReadWrite`), usa share_token. **NÃO MEXER.**
- `onedrive-criar-pasta/index.ts` — Composio quebrada. Reaproveitar SÓ o padrão de auth JWT (linhas 28-48).

**Microsoft Graph:**
- Upload chunked em `onedrive-upload-proposta` já resolve arquivos grandes.
- DELETE: `DELETE /me/drive/items/{fileId}` → 204. Scope `Files.ReadWrite` já está no refresh token. Move pra lixeira (não apaga permanente).

**Único consumer do useArteUpload hoje:** `src/domains/pedidos/components/PedidoItensArtes.tsx`.

## Decisões já tomadas pelo Junior

- **Estrutura OneDrive:** mesma pasta do cliente (igual portal): `Croma/Clientes/{cliente}/{PED-XXXX}_{arquivo}`
- **Substituir arte:** deletar o antigo do OneDrive (vai pra lixeira do OneDrive de qualquer jeito — tem rede de segurança)
- **Escopo:** só `pedido` por enquanto; deixar hook genérico pra comportar `proposta` no futuro

---

## Passo 1 — Migration `123_pedido_itens_onedrive.sql`

**Arquivo:** `supabase/migrations/123_pedido_itens_onedrive.sql`

```sql
-- Adiciona tracking do arquivo OneDrive na arte do item
-- Necessario pra deletar arquivo antigo ao substituir a arte
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS arte_onedrive_file_id text;

COMMENT ON COLUMN pedido_itens.arte_onedrive_file_id IS
  'DriveItem ID no OneDrive via Microsoft Graph. Usado pra deletar arquivo antigo ao substituir a arte. NULL = arte legada no Supabase Storage (pre-v14) ou ainda nao enviada.';
```

**Aplicar:** `mcp__d972dcbc__apply_migration` com name=`pedido_itens_onedrive` e a query acima.

**Rollback:** `ALTER TABLE pedido_itens DROP COLUMN arte_onedrive_file_id;`

**Commit:** `feat(db): add arte_onedrive_file_id to pedido_itens (migration 123)`

---

## Passo 2 — Edge Function `onedrive-upload-interno`

**Arquivo:** `supabase/functions/onedrive-upload-interno/index.ts`

Base: copiar `onedrive-upload-proposta/index.ts` v13 inteira e fazer 4 mudanças:

### Diferenças em relação à v13

**1. Auth via JWT (substituir o fluxo de share_token):**

```ts
// No começo do serve(), depois do OPTIONS, substituir o bloco que busca proposta via share_token por:
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Token invalido' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Depois, buscar profile + checar role
const { data: profile } = await supabase
  .from('profiles')
  .select('first_name, last_name, full_name, role')
  .eq('id', user.id)
  .single();

if (!profile || !['admin', 'vendedor', 'producao'].includes(profile.role)) {
  return new Response(JSON.stringify({ error: 'Sem permissao para upload' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const uploadedByName = profile.full_name
  || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  || user.email
  || 'Equipe';
```

**2. Input FormData diferente:**

```ts
const file = formData.get('file') as File | null;
const scope = formData.get('scope') as string | null; // 'pedido' | 'proposta'
const entityId = formData.get('entityId') as string | null; // UUID
// itemId e previewUrl sao opcionais (frontend nao precisa deles pra esta edge, gravar pedido_itens e responsabilidade do frontend)

if (!file || !scope || !entityId) {
  return new Response(JSON.stringify({ error: 'file, scope e entityId sao obrigatorios' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
if (!['pedido', 'proposta'].includes(scope)) {
  return new Response(JSON.stringify({ error: 'scope invalido' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**3. Buscar entity dinâmico:**

```ts
const tabela = scope === 'pedido' ? 'pedidos' : 'propostas';
const { data: entity, error: entityError } = await supabase
  .from(tabela)
  .select('id, numero, cliente:clientes(nome_fantasia)')
  .eq('id', entityId)
  .maybeSingle();

if (entityError || !entity) {
  return new Response(JSON.stringify({ error: `${scope} nao encontrado` }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const nomeCliente = (entity.cliente as any)?.nome_fantasia || 'cliente';
const safeCliente = sanitizeName(nomeCliente);
const safeFileName = sanitizeName(file.name);
const numeroEntity = entity.numero ?? entityId;
const targetPath = `Croma/Clientes/${safeCliente}/${numeroEntity}_${safeFileName}`;
```

**4. NÃO escrever em `pedido_itens` nem `proposta_attachments`:**

Só retornar `{ fileId, webUrl }`. O frontend faz o UPDATE em `pedido_itens` (mantém o padrão atual do `PedidoItensArtes.handleUploaded`).

```ts
return new Response(
  JSON.stringify({
    fileId: uploadResult.id,
    webUrl: uploadResult.webUrl,
    uploadedByName,
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

### Manter da v13
- `getCorsHeaders`, `sanitizeName`, `getAccessToken`, `uploadSimple`, `uploadLargeFile`
- Check de env `AZURE_CLIENT_ID_V2` / `AZURE_REFRESH_TOKEN_V2`
- Constante `MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024`

**Deploy:** `mcp__d972dcbc__deploy_edge_function` com name=`onedrive-upload-interno`, verify_jwt=**false** (a edge valida JWT manualmente pra retornar erro customizado; deixar verify_jwt=true também funciona mas dá mensagem genérica — optar pelo controle manual).

**Commit:** `feat(edge): add onedrive-upload-interno for JWT-authed vendor uploads`

---

## Passo 3 — Edge Function `onedrive-delete-file`

**Arquivo:** `supabase/functions/onedrive-delete-file/index.ts`

Edge pequena (~80 linhas):

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('AZURE_CLIENT_ID_V2');
  const refreshToken = Deno.env.get('AZURE_REFRESH_TOKEN_V2');
  if (!clientId || !refreshToken) throw new Error('Credenciais Azure nao configuradas');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Token exchange falhou');
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { fileId } = await req.json();
    if (!fileId || typeof fileId !== 'string') {
      return new Response(JSON.stringify({ error: 'fileId obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accessToken = await getAccessToken();
    const res = await fetch(`${GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 204 = sucesso. 404 = ja deletado (idempotencia, tratar como sucesso).
    if (res.status !== 204 && res.status !== 404) {
      const errBody = await res.text().catch(() => '');
      console.error('[onedrive-delete-file] Graph retornou', res.status, errBody);
      return new Response(JSON.stringify({ error: `Graph ${res.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[onedrive-delete-file] OK fileId=${fileId} status=${res.status}`);
    return new Response(JSON.stringify({ success: true, status: res.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = (err as Error).message || 'Erro interno';
    console.error('[onedrive-delete-file] ERRO:', msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

**Deploy:** `mcp__d972dcbc__deploy_edge_function` com name=`onedrive-delete-file`.

**Commit:** `feat(edge): add onedrive-delete-file for OneDrive cleanup on replace/remove`

---

## Passo 4 — Reescrever `src/hooks/useArteUpload.ts`

Mudanças:
- Remover `ORIGINAL_SIZE_LIMIT` e toda a lógica `shouldUploadOriginal`
- Adicionar `arte_onedrive_file_id` em `ArteUploadResult`
- Preview JPEG continua indo pro Supabase Storage
- Original vai via `fetch` pra edge `onedrive-upload-interno` com `Authorization: Bearer {session.access_token}`
- Progress stages: `gerando_preview` → paralelo(`enviando_preview` + `enviando_original`) → `concluido`

Código completo:

```ts
/**
 * useArteUpload.ts (v2 - 2026-04-14)
 *
 * Faz upload paralelo:
 *  - ORIGINAL: via Edge Function onedrive-upload-interno -> OneDrive na pasta do cliente
 *  - PREVIEW JPEG leve: Supabase Storage bucket job-attachments (pra thumbnail)
 *
 * Sem limite de tamanho (OneDrive aguenta arquivos grandes via chunked upload na edge).
 * Retorna URLs + fileId do OneDrive (necessario pra deletar ao substituir).
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { gerarPreviewArte, type PreviewResult } from '@/lib/arte-preview'

const BUCKET = 'job-attachments'

export type ArteUploadScope = 'pedido' | 'proposta'

export type ArteUploadResult = {
  arte_url: string
  arte_preview_url: string
  arte_nome_original: string
  arte_tamanho_bytes: number
  arte_mime: string
  arte_onedrive_file_id: string
  preview: PreviewResult
}

export type ArteUploadProgress = {
  stage: 'gerando_preview' | 'enviando' | 'concluido' | 'erro'
  message?: string
}

export function useArteUpload() {
  const [progress, setProgress] = useState<ArteUploadProgress>({ stage: 'concluido' })
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (params: {
      file: File
      scope: ArteUploadScope
      entityId: string
      itemId: string
    }): Promise<ArteUploadResult> => {
      const { file, scope, entityId, itemId } = params
      setUploading(true)
      try {
        setProgress({ stage: 'gerando_preview' })
        const preview = await gerarPreviewArte(file)

        const ts = Date.now()
        const baseDir = `artes/${scope}/${entityId}/${itemId}`
        const previewPath = `${baseDir}/preview_${ts}.jpg`

        setProgress({ stage: 'enviando' })

        // Preview no Storage
        const uploadPreview = supabase.storage
          .from(BUCKET)
          .upload(previewPath, preview.blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          })

        // Original no OneDrive via Edge
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Sessao expirada, faca login novamente')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('scope', scope)
        formData.append('entityId', entityId)

        const uploadOriginal = fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-upload-interno`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        )

        const [prevRes, origRes] = await Promise.all([uploadPreview, uploadOriginal])

        if (prevRes.error) throw prevRes.error
        if (!origRes.ok) {
          const err = await origRes.json().catch(() => ({}))
          throw new Error(err.error || `Upload OneDrive falhou (${origRes.status})`)
        }

        const origData = await origRes.json()
        if (!origData.webUrl || !origData.fileId) {
          throw new Error('Resposta do OneDrive incompleta')
        }

        const { data: prevUrl } = supabase.storage.from(BUCKET).getPublicUrl(previewPath)

        setProgress({ stage: 'concluido' })
        return {
          arte_url: origData.webUrl,
          arte_preview_url: prevUrl.publicUrl,
          arte_nome_original: file.name,
          arte_tamanho_bytes: file.size,
          arte_mime: file.type || 'application/octet-stream',
          arte_onedrive_file_id: origData.fileId,
          preview,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha no upload'
        setProgress({ stage: 'erro', message })
        throw error
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  return { upload, progress, uploading }
}
```

**Nota:** `ArteUploader.tsx` hoje tem labels pros stages `gerando_preview | enviando_original | enviando_preview` — consolidar em `enviando` (ver Passo 6).

**Commit:** `refactor(hook): useArteUpload sends original to OneDrive, no size limit`

---

## Passo 5 — Ajustar `src/domains/pedidos/components/PedidoItensArtes.tsx`

Dois handlers precisam ser atualizados:

### handleUploaded
Antes de atualizar, se a arte atual do item tinha `arte_onedrive_file_id`, deletar o antigo.

```tsx
async function handleUploaded(
  itemId: string,
  itemAtualOneDriveId: string | null | undefined,
  result: ArteUploadResult,
) {
  const { data: userData } = await supabase.auth.getUser()

  // Deletar arquivo antigo no OneDrive se existir (silencioso em erro)
  if (itemAtualOneDriveId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-delete-file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ fileId: itemAtualOneDriveId }),
        }
      )
    } catch (err) {
      console.warn('[PedidoItensArtes] falha ao deletar arte antiga do OneDrive:', err)
    }
  }

  await update.mutateAsync({
    id: itemId,
    arte_url: result.arte_url,
    arte_preview_url: result.arte_preview_url,
    arte_nome_original: result.arte_nome_original,
    arte_tamanho_bytes: result.arte_tamanho_bytes,
    arte_mime: result.arte_mime,
    arte_onedrive_file_id: result.arte_onedrive_file_id,
    arte_uploaded_at: new Date().toISOString(),
    arte_uploaded_by: userData.user?.id ?? null,
  })
}
```

Passar `item.arte_onedrive_file_id` como segundo argumento no `onUploaded` do `<ArteUploader />`:

```tsx
onUploaded={(result) => handleUploaded(item.id, item.arte_onedrive_file_id, result)}
```

### handleRemove
Análogo: deletar OneDrive antes de limpar os campos.

```tsx
async function handleRemove(itemId: string, itemOneDriveId: string | null | undefined) {
  try {
    if (itemOneDriveId) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-delete-file`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ fileId: itemOneDriveId }),
          }
        )
      } catch (err) {
        console.warn('[PedidoItensArtes] falha ao deletar OneDrive:', err)
      }
    }

    await update.mutateAsync({
      id: itemId,
      arte_url: null,
      arte_preview_url: null,
      arte_nome_original: null,
      arte_tamanho_bytes: null,
      arte_mime: null,
      arte_onedrive_file_id: null,
      arte_uploaded_at: null,
      arte_uploaded_by: null,
    })
    showSuccess('Arte removida do item')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao remover arte'
    showError(msg)
  }
}
```

Passar o fileId:
```tsx
onRemove={() => handleRemove(item.id, item.arte_onedrive_file_id)}
```

**Commit:** `feat(pedidos): delete OneDrive file on arte replace/remove in PedidoItensArtes`

---

## Passo 6 — Propagar tipos

### `src/components/arte/ArteUploader.tsx`

Tipo `ArteAtual` ganha campo:
```ts
export type ArteAtual = {
  arte_url?: string | null
  arte_preview_url?: string | null
  arte_nome_original?: string | null
  arte_tamanho_bytes?: number | null
  arte_mime?: string | null
  arte_onedrive_file_id?: string | null // NOVO
}
```

Ajustar labels de progresso (o hook consolidou `enviando_preview`/`enviando_original` em `enviando`):
```ts
const labelProgresso =
  progress.stage === 'gerando_preview' ? 'Gerando preview...'
    : progress.stage === 'enviando' ? 'Enviando...'
    : 'Processando...'
```

### `src/domains/pedidos/hooks/usePedidoItens.ts`

- Query `.select()` inclui `arte_onedrive_file_id`
- Tipo retornado do item + input de update aceitam o campo

**Este passo pode ir junto com os commits 4 ou 5 — Sonnet decide. Idealmente fica no commit do Passo 5 (é pré-requisito pro 5 funcionar).**

---

## Passo 7 — Deploy + smoke tests em produção

Ordem obrigatória:
1. Apply migration 123 (`mcp__d972dcbc__apply_migration`)
2. Deploy edge `onedrive-upload-interno`
3. Deploy edge `onedrive-delete-file`
4. `cd /sessions/focused-compassionate-clarke/mnt/CRM-Croma && git add ... && git commit ... && git push` (5 commits)
5. Vercel auto-deploya CRM
6. Aguardar deploy (~2min)

Smoke tests (executar na UI de produção):

| Teste | Resultado esperado |
|---|---|
| Upload PDF ~20MB num item de pedido | `pedido_itens.arte_url` = webUrl do OneDrive; arquivo em `Croma/Clientes/{cliente}/PED-XXXX_{nome}.pdf` |
| Upload PDF ~60MB | Mesmo fluxo — cai no `uploadLargeFile` (chunked). Sem erro. |
| Substituir arte | Arquivo antigo vai pra lixeira do OneDrive; novo aparece na pasta |
| Remover arte | Arquivo vai pra lixeira; `pedido_itens.arte_*` = null |
| Preview no CRM | Thumbnail JPEG aparece normalmente |
| App Campo | Preview aparece (sem precisar do original) |
| Upload <4MB (PNG pequeno) | Cai no `uploadSimple`, sem erro |

Se algum falhar: rollback = reverter commits do frontend (edges + migration podem ficar, são retrocompatíveis).

---

## Consultas SQL úteis pra validação

```sql
-- Ver últimas artes enviadas (confirmar que arte_onedrive_file_id ta sendo gravado)
SELECT id, descricao, arte_nome_original, arte_url, arte_onedrive_file_id, arte_uploaded_at
FROM pedido_itens
WHERE arte_uploaded_at > now() - interval '1 hour'
ORDER BY arte_uploaded_at DESC;

-- Ver se tem artes legadas sem onedrive_file_id (pré-migração)
SELECT count(*) FILTER (WHERE arte_url IS NOT NULL AND arte_onedrive_file_id IS NULL) as legadas,
       count(*) FILTER (WHERE arte_onedrive_file_id IS NOT NULL) as nova_infra
FROM pedido_itens;
```

---

## Débitos técnicos herdados (NÃO faz parte deste plano)

Registrar no STATE.md / memory.md ao final:
- `onedrive-criar-pasta` usa Composio descontinuada → precisa ser reescrita com Microsoft Graph direto
- Bucket `job-attachments` tem limite de 10MB (não 50MB como imaginado) → subir pra 50MB no dashboard dá margem pro preview
- Artes antigas pré-migração em `job-attachments/artes/...` não são limpas → script de limpeza posterior (opcional)

---

## Commits previstos (ordem exata)

1. `feat(db): add arte_onedrive_file_id to pedido_itens (migration 123)`
2. `feat(edge): add onedrive-upload-interno for JWT-authed vendor uploads`
3. `feat(edge): add onedrive-delete-file for OneDrive cleanup`
4. `refactor(hook): useArteUpload sends original to OneDrive, no size limit`
5. `feat(pedidos): delete OneDrive file on arte replace/remove in PedidoItensArtes`

Cada commit deve incluir `Co-Authored-By: Claude Sonnet` no rodapé.

---

## Como o Sonnet deve trabalhar

1. **NÃO reinvestigar.** O Opus já fez. Seguir o plano.
2. **Passo a passo, um commit por vez.** Não batch. Junior tem TDAH, quer ver progresso.
3. **Smoke test entre passos críticos** (especialmente depois do Passo 2 e do Passo 4). Não esperar o final.
4. **Se aparecer algo não-trivial não previsto**, PARAR e perguntar ao Junior. Não improvisar.
5. **Ao final: atualizar `STATE.md` e `memory.md` do Obsidian** (protocolo fim de sessão do CLAUDE.md).
