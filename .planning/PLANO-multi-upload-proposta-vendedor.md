# PLANO v2 — Upload de múltiplos anexos na proposta (vendedor + Claudete via MCP)

> **Status:** Aprovado pelo Junior em 2026-04-14 após revisão crítica.
> **Versão:** 2 (incorpora melhorias de segurança, consistência e MCP para Claudete).
> **Escopo incluído:** Frontend CRM (vendedor) + Edge Functions + Migration + MCP tools (Claudete).
> **Escopo excluído:** Multi-arquivo em `pedido_itens` (fica pra outro sprint).

---

## 1. Contexto — o que já existe (NÃO refazer)

- **Edge `onedrive-upload-interno` v1** deployada: aceita `scope=pedido|proposta`, valida JWT + role, faz upload chunked ao OneDrive, retorna `{ fileId, webUrl }`. Não insere em tabela nenhuma.
- **Edge `onedrive-delete-file` v1** deployada: deleta via Graph, idempotente (404 = sucesso).
- **Tabela `proposta_attachments`**: 14 colunas já criadas. RLS atual = SELECT liberado pra `authenticated`, sem INSERT/UPDATE/DELETE por role (só service_role escreve).
- **Portal cliente** usa edge `onedrive-upload-proposta` + serviço `portal-upload.service.ts` — **não vamos mexer nisso**.
- **MCP Server Croma** tem 93 ferramentas, organizado em `mcp-server/src/tools/` por módulo. Padrão: `server.registerTool(nome, {...}, handler)`.

---

## 2. Decisões fechadas antes de codar

| # | Decisão | Rationale |
|---|---|---|
| D1 | Edge `onedrive-upload-interno` v2 passa a inserir em `proposta_attachments` quando `scope=proposta` | Service_role já autorizado, JWT/role já validados, evita policy RLS permissiva |
| D2 | **Transacional**: se o INSERT falhar, edge deleta o arquivo no OneDrive antes de retornar erro | Evita arquivos órfãos no OneDrive |
| D3 | Delete faz OneDrive **primeiro** (idempotente, 404=ok), DB depois | Se DB falhar, próximo clique auto-recupera. Se OneDrive sumir mas DB não, link quebra sem jeito de recuperar |
| D4 | Validação de **escopo da proposta** na edge: vendedor só anexa/remove onde `vendedor_id = user.id` OU role elevada | Impede vazamento entre propostas |
| D5 | `uploaded_by_type` **sempre definido no backend**, nunca aceito do frontend | Impede falsificação de origem |
| D6 | Policy de delete: admin/diretor/comercial_senior apagam qualquer; vendedor só anexos `uploaded_by_user_id = ele` E `uploaded_by_type='vendedor'`; `uploaded_by_type='cliente'` só admin apaga | Preserva evidência de cliente |
| D7 | Concorrência no upload: **3 em paralelo**, resto em fila | Evita travar browser/rede |
| D8 | Limites: **150MB por arquivo**, **50 arquivos por proposta**, sem limite total | Graph chunked começa a degradar acima de 150MB |
| D9 | SHA-256 + índice `(proposta_id, file_sha256)` pra **bloquear duplicata** na mesma proposta | Evita retry duplicado |
| D10 | **Soft delete** com `deleted_at` — cron limpa 30 dias depois | Recupera arte apagada por engano |
| D11 | Path OneDrive: `Croma/Clientes/{cliente_id_curto}_{nome_fantasia}/{proposta_numero}/{timestamp}_{arquivo}` | Cliente_id é estável; proposta_numero agrupa arquivos da proposta |
| D12 | **UI com retry por arquivo** + partial success | Upload em lote não trava batch inteiro em erro de 1 |
| D13 | MCP tools pra Claudete: `listar_anexos`, `anexar_arquivo_url`, `remover_anexo` | Cliente manda arquivo no WhatsApp → Claudete salva direto na proposta |

---

## 3. Migration 124 — Hardening de `proposta_attachments`

**Arquivo:** `supabase/migrations/124_proposta_attachments_hardening.sql`

```sql
-- Hardening: auditoria, dedup, soft-delete, integridade
-- 2026-04-14

-- Audit trail por usuário
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Dedup por hash
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS file_sha256 text;

-- Soft delete
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Integridade: 1 fileId OneDrive = 1 linha (evita race em retry)
CREATE UNIQUE INDEX IF NOT EXISTS proposta_attachments_onedrive_file_id_uniq
  ON proposta_attachments(onedrive_file_id)
  WHERE onedrive_file_id IS NOT NULL AND deleted_at IS NULL;

-- Dedup: mesma proposta não aceita 2 arquivos com mesmo hash
CREATE UNIQUE INDEX IF NOT EXISTS proposta_attachments_dedup_sha
  ON proposta_attachments(proposta_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND deleted_at IS NULL;

-- Query de listagem otimizada
CREATE INDEX IF NOT EXISTS proposta_attachments_proposta_active_idx
  ON proposta_attachments(proposta_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN proposta_attachments.uploaded_by_user_id IS
  'FK pra profiles.id. NULL = anexo do cliente via portal (sem login). Usado pra auditoria e policy de delete.';
COMMENT ON COLUMN proposta_attachments.file_sha256 IS
  'Hash SHA-256 do arquivo calculado no client antes do upload. Usado pra dedup.';
COMMENT ON COLUMN proposta_attachments.deleted_at IS
  'Soft delete. Cron job de 30d faz hard delete + limpeza OneDrive.';
```

**Commit:** `feat(db): harden proposta_attachments (migration 124)`

---

## 4. Edge `onedrive-upload-interno` v2

**Mudanças vs v1:**

1. Aceita novos campos no FormData: `previewUrl` (string opcional), `fileSha256` (string opcional, hex de 64 chars)
2. **Antes do upload**: verifica escopo da proposta
   ```ts
   if (scope === 'proposta') {
     const { data: proposta } = await supabase
       .from('propostas')
       .select('id, numero, vendedor_id, cliente:clientes(id, nome_fantasia)')
       .eq('id', entityId)
       .maybeSingle();

     const podeAcessar = proposta && (
       proposta.vendedor_id === user.id ||
       ['admin', 'diretor', 'comercial_senior'].includes(profile.role!)
     );
     if (!podeAcessar) return 403;
   }
   ```
3. **Checa dedup por hash** (se veio `fileSha256`):
   ```ts
   if (scope === 'proposta' && fileSha256) {
     const { data: existente } = await supabase
       .from('proposta_attachments')
       .select('id, nome_arquivo')
       .eq('proposta_id', entityId)
       .eq('file_sha256', fileSha256)
       .is('deleted_at', null)
       .maybeSingle();
     if (existente) {
       return 409 { error: 'Arquivo idêntico já anexado', duplicate_of: existente.id };
     }
   }
   ```
4. **Novo path do OneDrive:**
   ```ts
   const clienteIdCurto = clienteId.slice(0, 8);
   const targetPath = `Croma/Clientes/${clienteIdCurto}_${safeCliente}/${proposta.numero}/${Date.now()}_${safeFileName}`;
   ```
5. **Após upload, se scope=proposta**: INSERT em `proposta_attachments` com rollback transacional:
   ```ts
   const { data: attachment, error: attErr } = await supabase
     .from('proposta_attachments')
     .insert({
       proposta_id: entityId,
       nome_arquivo: file.name,
       tipo_mime: file.type || 'application/octet-stream',
       tamanho_bytes: file.size,
       onedrive_file_id: uploadResult.id,
       onedrive_file_url: uploadResult.webUrl,
       preview_url: previewUrl,
       file_sha256: fileSha256,
       uploaded_by_type: 'vendedor', // HARDCODED, nunca do frontend
       uploaded_by_name: uploadedByName,
       uploaded_by_user_id: user.id,
     })
     .select('id')
     .single();

   if (attErr) {
     // Rollback: deleta arquivo do OneDrive
     await fetch(`${GRAPH_BASE}/me/drive/items/${uploadResult.id}`, {
       method: 'DELETE',
       headers: { Authorization: `Bearer ${accessToken}` },
     }).catch(() => {});
     return 500 { error: 'Falha ao registrar anexo. Upload revertido.' };
   }

   attachmentId = attachment.id;
   ```
6. **Response**: `{ fileId, webUrl, uploadedByName, attachmentId }` — `attachmentId` null pra scope=pedido (compat).
7. **Limite de tamanho**: reject 413 se `file.size > 150 * 1024 * 1024`.

**Commit:** `feat(edge): onedrive-upload-interno v2 — scope check, dedup, transactional insert`

---

## 5. Edge `proposta-attachment-delete` (nova)

**Arquivo:** `supabase/functions/proposta-attachment-delete/index.ts`

Fluxo:
1. Valida JWT + role em `[admin, diretor, comercial_senior, comercial, vendedor, producao]`
2. Recebe `{ attachmentId: string }`
3. Busca a linha: `SELECT * FROM proposta_attachments WHERE id = X AND deleted_at IS NULL` + JOIN com `propostas` pra pegar `vendedor_id`
4. **Checa permissão:**
   ```ts
   const isAdmin = ['admin', 'diretor', 'comercial_senior'].includes(profile.role);
   const isCliente = attachment.uploaded_by_type === 'cliente';
   const isOwnUpload = attachment.uploaded_by_user_id === user.id;

   if (isCliente && !isAdmin) return 403 { error: 'Apenas admin pode remover anexos do cliente' };
   if (!isAdmin && !isOwnUpload) return 403 { error: 'Só o uploader ou admin pode remover' };
   ```
5. **OneDrive DELETE primeiro** (se `onedrive_file_id` existe) — silencioso, 404 = ok
6. **DB soft-delete**: `UPDATE proposta_attachments SET deleted_at = now(), deleted_by_user_id = user.id WHERE id = X`
7. Retorna `{ success: true }`

**Commit:** `feat(edge): add proposta-attachment-delete with permission checks`

---

## 6. MCP Tools pra Claudete — NOVO

**Arquivo:** `mcp-server/src/tools/propostas-anexos.ts` (novo módulo)

Registra 3 tools:

### 6.1 `croma_listar_anexos_proposta`
- **Tipo:** readOnly, idempotent
- **Input:** `{ proposta_id: uuid, incluir_deletados?: boolean, response_format?: 'markdown'|'json' }`
- **Query:** `SELECT * FROM proposta_attachments WHERE proposta_id = X AND (deleted_at IS NULL OR :incluir_deletados = true) ORDER BY created_at DESC`
- **Output:** lista com id, nome, tamanho (humanizado), tipo (cliente/vendedor + nome), URL do OneDrive, preview_url se houver
- **Uso Claudete:** "Junior, tem 3 arquivos anexados na proposta PRO-1234: logo.cdr (2.1MB, vendedor Maria), briefing.pdf (500KB, cliente João), foto-fachada.jpg (4MB, cliente João)."

### 6.2 `croma_anexar_arquivo_proposta_url`
- **Tipo:** destructiveHint=false, idempotentHint=false (cria recurso)
- **Input:** `{ proposta_id: uuid, file_url: string, nome_arquivo?: string }`
- **Fluxo:**
  1. Busca proposta + cliente
  2. Download do `file_url` via fetch (aceita redirect)
  3. Calcula SHA-256 do buffer
  4. Monta path OneDrive igual ao da edge
  5. Upload via Graph (simple se <4MB, chunked senão) — reusa helpers
  6. INSERT em `proposta_attachments` com `uploaded_by_type='vendedor'`, `uploaded_by_user_id=getJuniorUserId()`, `uploaded_by_name='Claudete (IA)'`
  7. Rollback no OneDrive se INSERT falhar (mesmo padrão da edge)
- **Uso Claudete:** Junior manda: "Claudete, anexa esse arquivo que o cliente mandou no WhatsApp na proposta PRO-1234: https://..."
- **Helper compartilhado:** extrair `uploadToOneDrive(file, path)` pra `mcp-server/src/utils/onedrive.ts` pra reusar entre tools e eventualmente outras edges.

### 6.3 `croma_remover_anexo_proposta`
- **Tipo:** destructiveHint=true
- **Input:** `{ anexo_id: uuid, confirmar: boolean }` — pede `confirmar=true` pra evitar delete acidental
- **Fluxo:** mesmo da edge `proposta-attachment-delete` mas executa direto via admin client. Policy simplificada: Claudete só remove `uploaded_by_name='Claudete (IA)'` OU se o Junior explicitou "pode remover qualquer coisa da proposta X" (isso o Claude decide no contexto da conversa)
- **Uso Claudete:** "Claudete, remove aquele anexo duplicado da proposta PRO-1234"

**Registrar no `mcp-server/src/index.ts`:**
```ts
import { registerPropostasAnexosTools } from "./tools/propostas-anexos.js";
// ...
registerPropostasAnexosTools(server);
```

**Commit:** `feat(mcp): add proposta attachment tools for Claudete`

---

## 7. Hook `useAttachmentsUpload` (frontend)

**Arquivo:** `src/hooks/useAttachmentsUpload.ts`

**Responsabilidade:** upload multi-arquivo com concorrência limitada, status por arquivo, retry, SHA-256.

**API:**
```ts
export type AttachmentUploadItem = {
  id: string; // uuid gerado local pra key React
  file: File;
  status: 'pending' | 'computing_hash' | 'generating_preview' | 'uploading' | 'done' | 'error' | 'duplicate';
  progress?: number; // 0-100 (opcional, pode ser só stages)
  error?: string;
  attachmentId?: string;
  webUrl?: string;
  previewUrl?: string | null;
  duplicateOf?: string; // id do anexo existente
}

export type UseAttachmentsUpload = {
  items: AttachmentUploadItem[];
  addFiles: (files: File[], propostaId: string) => void; // enfileira
  retryItem: (itemId: string) => void;
  removeFromQueue: (itemId: string) => void;
  clear: () => void;
  isUploading: boolean;
}
```

**Implementação chave:**
- Pool de concorrência **3**: usa biblioteca `p-limit` (já aceitável adicionar — 2KB gzip) OU implementação manual com semáforo
- SHA-256 no browser: `crypto.subtle.digest('SHA-256', await file.arrayBuffer())`
- Validação de tamanho no front ANTES do upload: `file.size > 150MB` → marca como error sem chamar edge
- Validação de extensão: `['pdf','ai','cdr','eps','svg','jpg','jpeg','png','tiff','tif','psd','webp']`
- Preview JPEG só pra `['pdf','jpg','jpeg','png','webp']` — senão skip
- Retry: limpa erro, volta stage pra 'computing_hash' ou 'uploading', reinicia pool

**Commit:** `feat(hook): add useAttachmentsUpload with concurrency limit and retry`

---

## 8. Hook `usePropostaAttachments`

**Arquivo:** `src/domains/comercial/hooks/usePropostaAttachments.ts`

- `usePropostaAttachments(propostaId)` — useQuery, filtra `deleted_at IS NULL`
- `useDeletePropostaAttachment()` — useMutation, chama edge `proposta-attachment-delete`, invalida query
- Tipo `PropostaAttachment` com todos os campos da tabela

**Commit:** `feat(hook): add usePropostaAttachments query + delete mutation`

---

## 9. Componente `PropostaAttachmentsSection`

**Arquivo:** `src/domains/comercial/components/PropostaAttachmentsSection.tsx`

**Props:**
```ts
type Props = {
  propostaId: string;
  readOnly?: boolean; // pra OrcamentoViewPage
}
```

**Estrutura:**
- Header "Arquivos da arte" + contador
- Drop-zone (só se `!readOnly`): `react-dropzone` com `multiple: true`, mostra stats (3/50 arquivos)
- **Fila de upload** (só se `items.length > 0`): lista compacta com progress por arquivo, botão retry em erros, botão cancelar em pending
- **Grid de anexos existentes**: 2-3 colunas responsivo, card por anexo com:
  - Thumb JPEG se `preview_url`, senão ícone por extensão (`FileText` pra PDF, `Image` pra jpg, `FileImage` pra cdr/ai, etc.)
  - Nome + tamanho + formato + quem enviou (badge verde "Vendedor Maria" ou azul "Cliente João")
  - Botão "Abrir no OneDrive" (`target="_blank"`)
  - Botão "Remover" (só se `!readOnly` e permitido):
    - AlertDialog com `AlertDialogAction onClick={e.preventDefault() + await delete + setOpen(false)}` — **regra obrigatória do projeto**
- Estado vazio: "Nenhum arquivo anexado ainda. Arraste ou clique pra enviar."

**Commit:** `feat(comercial): PropostaAttachmentsSection with retry/dedup/softdelete UI`

---

## 10. Integração nas páginas

- **`OrcamentoEditorPage.tsx`**: render `<PropostaAttachmentsSection propostaId={id} />` depois da seção de itens
- **`OrcamentoViewPage.tsx`**: render `<PropostaAttachmentsSection propostaId={id} readOnly />` na aba de visualização

**Commit:** `feat(comercial): wire PropostaAttachmentsSection into editor and view`

---

## 11. Smoke tests em produção

Ordem de deploy:
1. Migration 124
2. Edge `onedrive-upload-interno` v2
3. Edge `proposta-attachment-delete`
4. MCP rebuild (`cd mcp-server && npm run build`) + restart (o Cowork puxa via croma.cmd)
5. Push dos commits frontend → Vercel auto-deploy

Testes críticos:

| Teste | Esperado |
|---|---|
| Vendedor A abre proposta do vendedor B | Recebe 403 ao tentar anexar (scope check) |
| Admin anexa em qualquer proposta | OK |
| Upload 3 arquivos simultâneos de 80MB | Fila respeitada (3 em paralelo), todos sobem |
| Upload 10 arquivos | 3 começam, 7 em fila, progresso individual |
| Mesmo arquivo subido 2x na mesma proposta | 2º retorna 409 duplicate, UI marca como duplicado |
| INSERT DB falha simulada | OneDrive fica limpo (rollback), erro 500 |
| Vendedor tenta remover anexo do cliente | 403 |
| Admin remove anexo do cliente | OK, soft-delete, OneDrive lixeira |
| Remove anexo → 30 dias depois não aparece na lista | OK (filtro `deleted_at IS NULL`) |
| Arquivo CDR 50MB | Upload OK, UI mostra ícone genérico (sem preview) |
| Retry após erro de rede | Só aquele item retoma, outros não afetados |
| Claudete via MCP: `listar_anexos_proposta` | Retorna lista formatada em markdown |
| Claudete via MCP: `anexar_arquivo_proposta_url` com link Drive público | Download + upload + insert OK |
| Claudete via MCP: `remover_anexo_proposta` de anexo do cliente | 403 (Claudete = não-admin) |

---

## 12. Business rules resumidas (referência rápida pra UI e edge)

| Ação | Admin/Diretor/Comercial Senior | Vendedor responsável | Vendedor outro | Cliente (portal) |
|---|---|---|---|---|
| Listar anexos da proposta | ✅ | ✅ | ❌ | ✅ (só os do cliente) |
| Anexar arquivo | ✅ | ✅ | ❌ | ✅ (uploaded_by_type=cliente) |
| Remover anexo vendedor (próprio) | ✅ | ✅ | ❌ | ❌ |
| Remover anexo vendedor (de outro) | ✅ | ❌ | ❌ | ❌ |
| Remover anexo cliente | ✅ | ❌ | ❌ | ✅ (só o próprio, futuro) |

---

## 13. Commits previstos (ordem exata)

1. `feat(db): harden proposta_attachments (migration 124)`
2. `feat(edge): onedrive-upload-interno v2 — scope check, dedup, transactional insert`
3. `feat(edge): add proposta-attachment-delete with permission checks`
4. `feat(mcp): add proposta attachment tools for Claudete`
5. `feat(hook): add useAttachmentsUpload with concurrency limit and retry`
6. `feat(hook): add usePropostaAttachments query + delete mutation`
7. `feat(comercial): PropostaAttachmentsSection with retry/dedup/softdelete UI`
8. `feat(comercial): wire PropostaAttachmentsSection into editor and view`

---

## 14. Estimativa total

| Etapa | Tempo |
|---|---|
| Migration 124 | 10min |
| Edge v2 (upload) | 30min |
| Edge delete | 25min |
| MCP 3 tools + helper onedrive | 50min |
| Hook useAttachmentsUpload (concorrência + hash + retry) | 45min |
| Hook usePropostaAttachments | 15min |
| Componente UI completo | 60min |
| Integração 2 páginas | 15min |
| Smoke tests + ajustes | 30min |
| **Total** | **~4h30min** |

---

## 15. Débitos técnicos herdados (NÃO entram neste plano)

- `onedrive-criar-pasta` usa Composio descontinuada
- Multi-arquivo em `pedido_itens` (cada item ainda 1 arquivo)
- Cron job de hard delete após 30d de `deleted_at` — criar depois
- Anexos legados no bucket `job-attachments/proposta-previews/` não são limpos

---

## 16. Como o executor deve trabalhar

1. **Ler STATE.md + este plano** antes de começar
2. **Seguir a ordem dos commits** — não batch
3. **Após o passo 1 (migration)**: rodar `SELECT column_name FROM information_schema.columns WHERE table_name='proposta_attachments'` pra confirmar colunas
4. **Após passo 2 (edge v2)**: testar smoke de upload via curl com JWT do Junior
5. **Após passo 4 (MCP)**: rebuild com `npm run build` na pasta mcp-server, testar via `croma.cmd croma_listar_anexos_proposta '{"proposta_id":"..."}'`
6. **Após passo 7 (componente)**: deploy Vercel e smoke test manual na UI
7. **Se aparecer algo não previsto**, PARAR e perguntar ao Junior
8. **No fim**: atualizar STATE.md + memory.md + daily note (protocolo fim de sessão do CLAUDE.md)
