# Upload de Arquivos do Portal para OneDrive

> **Data**: 2026-03-16 | **Status**: Aprovado | **Autor**: Claude Opus 4.6

---

## Problema

O portal do cliente (`/p/:token`) permite que clientes enviem arquivos de arte para impressão (AI, CDR, PSD, TIFF, etc.). Esses arquivos frequentemente ultrapassam 50MB, tornando o Supabase Storage inviável como destino final. O upload atualmente falha com "Bucket not found" porque o bucket nunca foi criado, e a integração OneDrive via Composio nunca funcionou.

## Decisão

Upload direto ao OneDrive do usuário (`junior.web@live.com`, ~296GB livres) via Composio API (mesma API usada pelo Rube MCP, que já está conectado e ativo).

## Arquitetura

```
Cliente (browser) → Edge Function → Composio API → OneDrive
                                                      │
                                                      ▼
                                               Croma/Clientes/
                                                 {NomeCliente}/
                                                   PROP-XXXX_{arquivo}.ext
```

### Fluxo detalhado

1. **Cliente seleciona/arrasta arquivos** no componente `PortalFileUpload`
2. Para cada arquivo, o browser faz `POST /functions/v1/onedrive-upload-proposta` com `FormData { file, token }` e header `Authorization: Bearer {ANON_KEY}`
3. **Edge Function** (autenticação por share_token, NÃO por JWT de usuário):
   a. Extrai `token` do FormData
   b. Valida `share_token` via query: `SELECT ... FROM propostas WHERE share_token = $1 AND share_token_active = true AND (share_token_expires_at IS NULL OR share_token_expires_at > now())`
   c. Busca nome do cliente + número da proposta via join `propostas → clientes`
   d. Cria pasta `Croma/Clientes/{nomeCliente}/` via `ONE_DRIVE_ONEDRIVE_FIND_FOLDER` primeiro; se não encontrar, `ONE_DRIVE_ONEDRIVE_CREATE_FOLDER` com `parent_folder: /Croma/Clientes`
   e. Renomeia arquivo: `{PROP-2026-XXXX}_{nome-original}.ext`
   f. Faz upload via `ONE_DRIVE_ONEDRIVE_UPLOAD_FILE` com `conflict_behavior: "rename"` e `folder: /Croma/Clientes/{nomeCliente}`
   g. Registra em `proposta_attachments` via INSERT direto (Edge Function usa service_role key):
      ```sql
      INSERT INTO proposta_attachments (proposta_id, nome_arquivo, tipo_mime, tamanho_bytes,
        onedrive_file_id, onedrive_file_url, uploaded_by_type, uploaded_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, 'cliente', $7)
      RETURNING id
      ```
   h. Retorna `{ attachmentId, onedriveUrl }`
4. **Browser** atualiza status do arquivo (loading → concluído)

### Autenticação da Edge Function

**IMPORTANTE**: O portal é público — clientes NÃO são usuários Supabase. A Edge Function:
- NÃO usa `supabase.auth.getUser()` (removido)
- Recebe `Authorization: Bearer {ANON_KEY}` apenas para o Supabase aceitar a chamada
- A autenticação real é pelo `share_token`: se o token é válido, ativo e não expirado, o upload é permitido
- Usa `createClient(url, SERVICE_ROLE_KEY)` para queries ao banco (bypass RLS)

### Estrutura de pastas no OneDrive

```
Croma/
  Clientes/
    BEATRIZ RODRIGUES VILARINHO/
      PROP-2026-0002_arte-fachada-loja1.ai
      PROP-2026-0002_foto-medidas.jpg
      PROP-2026-0002_referencia-cores.pdf
      PROP-2026-0001_banner-evento.psd
    OUTRO CLIENTE LTDA/
      PROP-2026-0003_logo-vetorizado.cdr
```

- Prefixo `{numero-proposta}_` + nome original do arquivo
- Todos os arquivos de um cliente na mesma pasta (flat)
- Sem subpastas por proposta (decisão do usuário)
- A Edge Function atual usa `Proposta-${numero}` como subfolder — isso será REMOVIDO

## Componentes a modificar

### 1. Edge Function: `onedrive-upload-proposta` (reescrita completa)

**Localização**: `supabase/functions/onedrive-upload-proposta/index.ts`

**Mudanças em relação ao código atual**:
- REMOVER: autenticação por JWT (`supabase.auth.getUser()`)
- REMOVER: subfolder por proposta (`Proposta-${numero}`)
- REMOVER: encoding base64 com spread operator (`btoa(String.fromCharCode(...))`) — usar chunked base64 para suportar arquivos grandes
- ADICIONAR: validação de share_token com check de `share_token_active` e `share_token_expires_at`
- ADICIONAR: busca de pasta existente antes de criar (`FIND_FOLDER` → `CREATE_FOLDER`)
- ADICIONAR: prefixo `{PROP-XXXX}_` no nome do arquivo
- ADICIONAR: `conflict_behavior: "rename"` no upload
- ADICIONAR: INSERT direto em `proposta_attachments` (em vez de deixar o frontend fazer via RPC)

**Credenciais** (já existem como env vars no Supabase):
- `COMPOSIO_API_KEY`
- `ONEDRIVE_CONNECTED_ACCOUNT_ID`: `ca_VHrSrrvq1gPQ`

**API Composio utilizada**:
- Endpoint: `https://backend.composio.dev/api/v2/actions/{ACTION_SLUG}/execute`
- Actions:
  - `ONE_DRIVE_ONEDRIVE_FIND_FOLDER` — buscar pasta existente por nome
  - `ONE_DRIVE_ONEDRIVE_CREATE_FOLDER` — criar pasta (se não existir)
  - `ONE_DRIVE_ONEDRIVE_UPLOAD_FILE` — upload do arquivo com chunking automático
- Auth: `x-api-key: {COMPOSIO_API_KEY}` + body `connected_account_id: {ONEDRIVE_CONNECTED_ACCOUNT_ID}`

**Base64 encoding para arquivos grandes**:
O código atual usa `btoa(String.fromCharCode(...new Uint8Array(buffer)))` que estoura o stack para arquivos > ~1MB. Deve ser substituído por encoding chunked:
```typescript
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}
```

### 2. Frontend: `portal-upload.service.ts` (simplificado)

**Localização**: `src/domains/portal/services/portal-upload.service.ts`

**Mudanças**:
- REMOVER: upload para Supabase Storage (`supabase.storage.from('proposta-uploads').upload(...)`)
- REMOVER: tentativa separada de OneDrive (`fetch onedrive-upload-proposta`)
- REMOVER: chamada ao RPC `portal_register_attachment` (Edge Function faz isso agora)
- REMOVER: constante `MAX_FILE_SIZE = 50 * 1024 * 1024`
- SIMPLIFICAR: uma única chamada `fetch` para a Edge Function com FormData
- MANTER: validação de extensões permitidas (`validateFile`)
- A função `uploadFileToPortal` recebe `{ token, file, clientName }` e retorna `{ id }` (attachment ID)

### 3. Frontend: `PortalFileUpload.tsx` (melhorias UX)

**Localização**: `src/domains/portal/components/PortalFileUpload.tsx`

**Mudanças**:
- REMOVER: mensagem "Máx 50MB por arquivo"
- ATUALIZAR: texto para "PDF, AI, CDR, EPS, JPG, PNG, TIFF, PSD — Arquivos de alta qualidade"
- MANTER: estados loading/done/error por arquivo (progress bar real requer XMLHttpRequest, pode ser feito em fase posterior)
- MANTER: drag-and-drop + file input

### 4. RPC `portal_register_attachment` (não será mais chamada pelo frontend)

A RPC continua existindo no banco mas não será chamada pelo frontend. A Edge Function faz INSERT direto usando service_role key. Colunas `storage_path` e `storage_url` ficam NULL (sem Supabase Storage).

### 5. Bucket `proposta-uploads` (não necessário)

A migration 033 criou o bucket mas não será usado neste fluxo. Pode ser mantido como infraestrutura disponível para outros usos futuros.

## Tratamento de erros

| Cenário | Ação |
|---|---|
| Token inválido/expirado/inativo | Retorna 401 `{ error: "Token inválido ou expirado" }` |
| Composio API indisponível | Retorna 503 `{ error: "Serviço de upload indisponível" }` |
| Pasta já existe no OneDrive | Reutiliza (FIND_FOLDER antes de CREATE_FOLDER) |
| Arquivo com nome duplicado | OneDrive renomeia automaticamente (`conflict_behavior: "rename"`) |
| Arquivo muito grande (timeout) | Retorna 408, mensagem "Arquivo muito grande, tente um menor" |
| Extensão não permitida | Validação no frontend antes do upload (não chega na Edge Function) |
| Falha no INSERT do banco | Retorna 500, arquivo já está no OneDrive mas sem registro |

## Limitações conhecidas

1. **Edge Functions do Supabase** têm timeout de ~60s e limite de body ~100MB. Arquivos muito grandes (>100MB) podem falhar. Para esses casos, futuramente podemos implementar upload direto ao OneDrive via browser (requer Azure AD app registration com conta organizacional).
2. **Composio API** é intermediário — adiciona latência. Upload de 50MB pode levar 30-60s.
3. **Dependência do Composio/Rube** — se o serviço ficar indisponível, uploads falham. Sem fallback local.
4. **Colunas `storage_path` e `storage_url`** em `proposta_attachments` ficam sempre NULL neste fluxo (sem Supabase Storage).
5. **Progress bar real** não implementada nesta fase — `fetch()` não suporta progress nativamente. Fase futura pode usar `XMLHttpRequest` com `upload.onprogress`.

## Migração futura (opcional)

Quando/se a empresa tiver conta organizacional Microsoft (@empresa.com):
1. Registrar app no Azure AD (gratuito)
2. Trocar chamadas Composio por Microsoft Graph API direto
3. Implementar upload session (browser → OneDrive direto, sem limite de tamanho)
4. Remover dependência do Composio

## Decisões tomadas

- **Pasta por cliente, não por proposta** — mais simples, equipe busca "arquivos do cliente X"
- **Prefixo da proposta no nome do arquivo** — permite filtrar sem subpastas
- **Sem Supabase Storage** — arquivos de impressão são muito grandes
- **Composio/Rube** — já conectado e funcionando, evita burocracia Azure AD
- **Edge Function registra o attachment** — frontend simplificado, uma única chamada
- **Autenticação por share_token** — portal é público, clientes não são usuários Supabase
- **Base64 chunked** — necessário para arquivos grandes sem estourar o stack
