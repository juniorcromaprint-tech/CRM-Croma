# HANDOFF → Claude Code — INSTAL-02: Offline-First Real no App Campo

> Gerado por: agent isolado (ciclo #30, recon read-only adversarial) | Data: 2026-05-29
> Alvo: Claude Code (build cross-file > 500 LOC) | Repo: `C:\Users\Caldera\Claude\CRM-Croma`
> App: `APP-Campo/` (deploy `campo-croma.vercel.app`) — PWA React 19 + Vite 6 + vite-plugin-pwa 1.2 + Supabase

---

## 0. TL;DR / Veredicto da auditoria #27 (verificado item a item)

| Afirmação auditoria #27 | Veredicto | Evidência |
|---|---|---|
| VitePWA só com NetworkFirst (cache de leitura) | **CONFIRMADO (parcial)** | `vite.config.ts:50-73`: `NetworkFirst` p/ REST, `NetworkOnly` p/ auth+realtime |
| SEM IndexedDB | **CONFIRMADO** | `grep` em `src/` = 0 refs; deps sem `idb`/`dexie`/`localforage` |
| SEM fila de mutations / replay | **CONFIRMADO** | Nenhum outbox/queue/background-sync no código ou deps |
| SEM service worker custom / background sync | **CONFIRMADO** | SW é o gerado pelo Workbox (`generateSW`), sem `injectManifest`, sem `workbox-background-sync` |
| `JobSignature.tsx:51` bloqueia assinatura offline | **CONFIRMADO (literal)** | linha exata: `if (isOffline) return showError("Assinatura requer internet.");` |
| Conclusão da OS exige rede → causa raiz INSTAL-01 | **CONFIRMADO (lógica sólida)** | assinatura grava `jobs.status='Concluído'` direto no Supabase; trigger `trg_sync_job_to_ordem` → `ordens_instalacao` → trigger `fn_installation_completed`. Tudo gated no write online. |

**CORREÇÃO IMPORTANTE à auditoria #27 (modo adversarial):** a auditoria sugeriu/insinuou que o SW poderia não estar sequer registrado (não há `registerSW`/`virtual:pwa-register` em `main.tsx`). **Isso está incorreto/incompleto.** O `vite-plugin-pwa` usa `injectRegister: 'auto'` por padrão e **injeta a chamada de registro no `index.html` em build-time**. Confirmei no artefato compilado: `APP-Campo/dist/registerSW.js`, `dist/sw.js`, `dist/workbox-79fe7cb5.js` existem e `dist/index.html` referencia `registerSW.js`. Ou seja: **o app-shell É cacheado e o app ABRE offline; a leitura recente fica em cache (NetworkFirst, 5 min)**. O "offline-first é só label" é verdadeiro APENAS para **escrita** (mutations). Para **leitura/abertura**, o PWA funciona. Precisão importa para não prometer demais no fix.

**Conclusão:** o gap real é **ausência total de camada de escrita offline (outbox + replay)** + **bloqueios `isOffline` hardcoded** que impedem o fluxo de conclusão. A auditoria #27 acerta a causa raiz; erra (por omissão) ao dar a entender que o SW não roda.

---

## (a) Estado atual VERIFICADO — com filepaths reais

### Localização do App Campo
- Raiz: `APP-Campo/` (nome do pacote: `croma-campo`, `APP-Campo/package.json`)
- Detalhe da OS: `APP-Campo/src/pages/JobDetail.tsx`
- Componentes de execução: `APP-Campo/src/components/job/JobSignature.tsx`, `JobPhotos.tsx`, `JobVideos.tsx`, `JobArtesReferencia.tsx`, `JobAttachments.tsx`
- Checklist: `APP-Campo/src/components/JobChecklist.tsx`
- Banner offline / shell: `APP-Campo/src/components/Layout.tsx`
- Entry: `APP-Campo/src/main.tsx` (5 linhas — só `createRoot`, **sem** import de PWA)
- PWA config: `APP-Campo/vite.config.ts`
- Supabase client: `APP-Campo/src/integrations/supabase/client.ts`
- React Query: `APP-Campo/src/App.tsx:23` → `const queryClient = new QueryClient();` (bare, sem `networkMode`/`gcTime`/persistência)

### PWA / Service Worker (`APP-Campo/vite.config.ts`)
- `VitePWA({ registerType: 'autoUpdate', ... })` — linhas 13-75
- `workbox.globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` (`:46`) → app-shell precache OK
- `runtimeCaching` (`:50-73`):
  - REST `.../rest/v1/.*` → `NetworkFirst`, cache `supabase-api-cache`, `maxAgeSeconds: 300` (`:52-64`)
  - `.../auth/.*` → `NetworkOnly` (`:66-68`)
  - `.../realtime/.*` → `NetworkOnly` (`:70-72`)
- **`injectRegister` NÃO setado** → default `'auto'` → registro injetado no `index.html` em build. Confirmado em `dist/` (SW ativo em produção).
- **Sem `strategies: 'injectManifest'`** → SW é 100% gerado pelo Workbox; não há ponto de hook para `BackgroundSyncPlugin` hoje.

### Persistência client-side existente (única)
- `localStorage` apenas:
  - rascunho de notas: `JobDetail.tsx:212,222`
  - checklist: `JobDetail.tsx:649-650` (`checklist_${id}`)
  - prefs: `Settings.tsx:21-22,98,104`
- **Sem** `IndexedDB`, **sem** persistência do React Query (`persistQueryClient`).

### Detecção de offline (padrão atual, repetido em 3 lugares)
- `navigator.onLine` + listeners `online`/`offline`:
  - `Layout.tsx:35-46` (banner amarelo "Sem conexão — dados podem estar desatualizados", `:87-91`)
  - `JobDetail.tsx:38,56-65`
  - propagado como prop `isOffline` para `JobPhotos`/`JobVideos`/`JobSignature`

### Pontos que BLOQUEIAM offline hoje (todos retornam `showError`)
| Arquivo:linha | Trecho | Efeito |
|---|---|---|
| `JobSignature.tsx:51` | `if (isOffline) return showError("Assinatura requer internet.");` | **Conclusão da OS travada** (P0) |
| `JobSignature.tsx:124` | botão "Toque para Assinar" `disabled={isOffline}` | idem |
| `JobSignature.tsx:160` | botão "Validar OS" `disabled={isSavingSignature || isOffline}` | idem |
| `JobDetail.tsx:127` | `handleStartJob`: `if (isOffline) return showError("Requer internet para iniciar o serviço.");` | não dá pra iniciar OS no campo sem sinal |
| `JobDetail.tsx:237` | `captureLocation`: `if (isOffline) return showError("GPS requer internet.");` | GPS bloqueado (na verdade GPS funciona offline; só o write precisa de rede) |
| `JobDetail.tsx:412,449,620` | botões `disabled={isOffline ...}` | status/ações travadas |
| `JobPhotos.tsx:84` | `if (isOffline) return showError("Upload requer internet.");` | fotos não sobem offline |
| `JobVideos.tsx:180,338` | bloqueios de gravação/upload | vídeo offline bloqueado |

### Fluxo de conclusão da OS → dependência de rede (verificado)
1. App grava direto no Supabase (sem fila):
   - assinatura: `JobSignature.tsx:60` upload PNG p/ Storage `job_photos`; `:67-75` `UPDATE jobs SET signature_url, notes, status='Concluído', finished_at`.
   - alternativa: `handleFinishJob` `JobDetail.tsx:138-143` → `updateJobMutation` (`:95-124`) faz `.update({status:'Concluído'...}).select().single()`.
2. DB trigger `trg_sync_job_to_ordem` (`supabase/migrations/004_integracao_bridge.sql:151-155`) chama `fn_sync_job_to_ordem` (`:115-149`):
   - `IF NEW.status='Concluído'` → `UPDATE ordens_instalacao SET status='concluida'` (`:123-128`) + `pedido_itens status='instalado'` (`:131-135`).
3. Trigger separado `fn_installation_completed` / `trg_installation_completed` em `ordens_instalacao` (`supabase/migrations/104_ai_bridge_event_triggers.sql:174-202`) emite o evento `installation_completed` (a métrica "0 desde 2026-05-05" do INSTAL-01).

**→ Cadeia inteira pendurada no UPDATE online do `jobs`.** Sem rede no momento da assinatura, o técnico não consegue concluir; OS fica `Pendente`/`Em andamento`; nada propaga. Causa raiz INSTAL-01 **confirmada**.

---

## (b) Gap exato

1. **Não existe outbox de escrita.** Toda mutation (status, notes, signature upload, photos, GPS) vai direto pro Supabase; se offline, é abortada com `showError`, não enfileirada.
2. **Não existe replay.** Não há listener que, ao voltar `online`, drene mutations pendentes.
3. **Assinatura/conclusão bloqueadas por design** (`isOffline` guards), tornando o caso de uso central do campo (assinar a OS no local, muitas vezes sem sinal) impossível offline.
4. **Sem persistência de cache de leitura** além do NetworkFirst do Workbox (some após 5 min / cache evictado) — o técnico pode abrir a OS mas perder dados se o cache expirar.
5. **Storage upload (assinatura PNG, fotos) não tem caminho offline** — `supabase.storage...upload` exige rede e não há blob queue.

---

## (c) Arquitetura-alvo proposta (offline-first de ESCRITA)

Objetivo: técnico assina e conclui a OS **offline**; ao reconectar, tudo sincroniza sozinho e a cadeia de triggers dispara normalmente. Manter o app-shell/leitura atuais (já funcionam).

### Princípio
Camada de **outbox** em IndexedDB + **replay** disparado por evento `online` + (opcional) **Background Sync API** como gatilho redundante. Toda escrita do app passa a ir para a outbox primeiro (optimistic UI), e um sincronizador drena para o Supabase.

### Componentes
1. **`idb` (recomendado)** — wrapper leve sobre IndexedDB (não usar IndexedDB cru; não trazer Dexie só por isso). Adicionar `idb` às deps do `APP-Campo`.
2. **Stores IndexedDB** (db `croma-campo-offline`, version 1):
   - `mutations` (outbox): `{ id (uuid client), type, table, op:'update'|'insert', payload, jobId, createdAt, status:'pending'|'syncing'|'done'|'error', retries, lastError }`
   - `blobs`: `{ id, kind:'signature'|'photo'|'video', jobId, blob, fileName, bucket, createdAt }` (uploads pendentes)
   - `jobsCache` (opcional, p/ leitura confiável offline da OS aberta): snapshot do job + stores.
3. **`src/offline/db.ts`** — abre/migra o IndexedDB, expõe CRUD tipado das stores.
4. **`src/offline/outbox.ts`** — `enqueueMutation()`, `enqueueBlob()`, `getPending()`, `markDone()`, `markError()`.
5. **`src/offline/sync.ts`** — `replayOutbox()`: ordena por `createdAt`, para cada item:
   - se blob: `supabase.storage.from(bucket).upload(fileName, blob)`; obtém publicUrl; injeta na mutation dependente.
   - mutation: aplica `.update/.insert(...).select().single()` (regra do projeto: detectar bloqueio RLS).
   - **Ordem importa**: upload do PNG da assinatura ANTES do `UPDATE jobs.signature_url`. Modelar dependência (blob → mutation que referencia o `signatureUrl`).
   - idempotência: usar `id` client-gerado; on conflict / verificar `status` antes de reprocessar; nunca reenviar `done`.
6. **`src/offline/useOnlineSync.ts`** (hook) — registra listener `window 'online'` + `setInterval` leve de fallback + chama `replayOutbox()`; expõe `pendingCount` p/ UI.
7. **Integração com React Query** (decisão): habilitar `networkMode: 'offlineFirst'` no `QueryClient` (`App.tsx:23`) e, idealmente, `@tanstack/query-sync-storage-persister` + `persistQueryClient` apoiado em IndexedDB para leitura durável. (Opcional na v1; o crítico é a escrita.)
8. **(Opcional, robustez) Background Sync**: migrar para `strategies:'injectManifest'` + `injectManifest` custom SW com `workbox-background-sync` `BackgroundSyncPlugin` na fila de POST/PATCH do Supabase. **Atenção:** isso é mais invasivo (reescreve a estratégia do SW) — fazer só se o replay por evento `online` não bastar. Para v1, **replay via `online` + IndexedDB é suficiente** e bem mais simples/testável.

### Mudança de comportamento na UI
- Trocar os `if (isOffline) return showError(...)` por: **gravar na outbox + feedback "Salvo offline — sincroniza ao reconectar"** (optimistic). Manter UI consistente (badge de "pendente de sync" por OS).
- Assinatura offline: canvas → PNG → `enqueueBlob('signature')` + `enqueueMutation(update jobs status='Concluído'...)`; marcar OS como concluída localmente (optimistic), com selo "aguardando sync".
- Banner do `Layout.tsx` passa a mostrar `pendingCount` ("N alterações aguardando envio").

---

## (d) Arquivos a tocar (lista concreta)

**Novos:**
- `APP-Campo/src/offline/db.ts` (IndexedDB via `idb`)
- `APP-Campo/src/offline/outbox.ts`
- `APP-Campo/src/offline/sync.ts`
- `APP-Campo/src/offline/useOnlineSync.ts`
- `APP-Campo/src/offline/types.ts`
- (opcional BG sync) `APP-Campo/src/sw.ts` (injectManifest custom SW)

**Editar:**
- `APP-Campo/package.json` — add dep `idb` (e, se persistir query, `@tanstack/query-sync-storage-persister`)
- `APP-Campo/src/App.tsx:23` — `QueryClient` com `networkMode:'offlineFirst'` (+ persistência opcional)
- `APP-Campo/src/main.tsx` — montar provider de sync / inicializar DB; (se BG sync) `registerSW` explícito
- `APP-Campo/src/components/job/JobSignature.tsx` — remover bloqueio `:51`, `:124`, `:160`; rota offline (enqueue blob+mutation)
- `APP-Campo/src/pages/JobDetail.tsx` — `handleStartJob` (`:127`), `captureLocation` (`:237`), `updateJobMutation` (`:95-124`), `handleFinishJob` (`:138-143`), botões `disabled={isOffline}` (`:412,449,620`) → enqueue + optimistic
- `APP-Campo/src/components/job/JobPhotos.tsx` — `:84` → enqueue blob
- `APP-Campo/src/components/job/JobVideos.tsx` — `:180,338` (avaliar: vídeo pode ser grande p/ IndexedDB; talvez manter online-only na v1 com aviso claro)
- `APP-Campo/src/components/Layout.tsx` — banner com `pendingCount`
- `APP-Campo/vite.config.ts` — **só** se optar por BG sync (`strategies:'injectManifest'`, `srcDir`, `filename`)

**NÃO tocar:** migrations / triggers (`004_integracao_bridge.sql`, `104_ai_bridge_event_triggers.sql`) — a cadeia DB já funciona; o fix é 100% client. Os triggers disparam normalmente quando o `UPDATE jobs` chega via replay.

---

## (e) Critérios de aceite testáveis

1. **Assinar offline conclui a OS localmente.** Com DevTools "Offline": assinar → UI mostra OS "Concluído (aguardando sync)"; nenhum `showError("Assinatura requer internet")`.
2. **Replay automático ao reconectar.** Voltar online → em ≤ alguns segundos: `jobs.status='Concluído'`, `signature_url` populado, PNG no bucket `job_photos`. Verificar via MCP/SQL: `SELECT status, signature_url, finished_at FROM jobs WHERE id=...`.
3. **Cadeia de triggers dispara pós-replay.** Após sync: `ordens_instalacao.status='concluida'` (trigger 004) e novo registro de evento `installation_completed` (trigger 104) — confirma fix do INSTAL-01.
4. **Idempotência.** Forçar replay duas vezes (ex.: toggle online/offline) → **não** duplica upload nem cria 2º evento; sem erro de constraint.
5. **Fila persiste a reload.** Enfileirar offline → fechar/reabrir o PWA (ainda offline) → mutations continuam na outbox; sincronizam ao voltar online.
6. **Ordem blob→mutation.** O `UPDATE jobs.signature_url` nunca é enviado com URL vazia/quebrada; sempre após upload bem-sucedido do PNG.
7. **RLS detectado.** Toda escrita do replay usa `.select().single()`; bloqueio RLS marca item como `error` (não "done" silencioso) e mostra alerta.
8. **`pendingCount` visível** no banner enquanto houver itens; zera após sync.
9. **Regressão zero online.** Com rede normal, fluxo idêntico ao atual (assinar → concluir) e sem latência perceptível extra.
10. **Build passa** (`pnpm build` no `APP-Campo`) e PWA continua instalável (manifest + SW válidos).

---

## (f) Riscos / cuidados

- **`AlertDialogAction` async** (regra do projeto `.claude/rules/alert-dialog-async.md`): qualquer confirmação async de conclusão precisa de `e.preventDefault()` + close manual. Já há `AlertDialog` em `JobDetail.tsx`.
- **`.select().single()` obrigatório** em todo insert/update do replay (regra `.claude/rules/supabase-mutations.md`) — senão RLS bloqueia silenciosamente e o item "some".
- **Storage não tem RLS-feedback fácil** — `storage.upload` pode falhar (auth expirada). Tratar refresh de sessão antes do replay; se token expirou offline por muito tempo, re-login pode ser necessário (o auth é `NetworkOnly`).
- **Conflito de status** — se o admin mudou a OS no CRM enquanto o técnico estava offline, o replay pode sobrescrever. Mitigar: o trigger só age em transição p/ 'Concluído'; ainda assim, considerar checagem `updated_at`/optimistic-concurrency na v2.
- **Vídeos em IndexedDB** podem estourar quota (arquivos grandes). Recomendo manter `JobVideos` **online-only na v1** (aviso claro), enfileirar só fotos/assinatura/status/notes.
- **Tamanho do bundle** — `idb` é minúsculo (~1-2KB). Não usar Dexie só por isso.
- **iOS Safari/PWA**: Background Sync API **não** é suportada em iOS — por isso o replay via evento `online` (não-SW) é o mecanismo primário e portável; BG sync é só reforço onde existir.
- **`networkMode:'offlineFirst'`** muda comportamento de retry do React Query globalmente — testar telas de listagem (`Jobs.tsx`, `Stores.tsx`) p/ não quebrar loading states.
- **Não duplicar `finished_at`** — `updateJobMutation` (`:100-108`) e `JobSignature` (`:73`) ambos setam `finished_at`; ao enfileirar, definir uma única fonte da verdade pra evitar divergência.

---

## (g) Por que Claude Code (e não Cowork)

- **Build cross-file > 500 LOC novos**: 5-6 arquivos novos em `src/offline/` + edição coordenada de 6+ componentes (JobSignature, JobDetail, JobPhotos, JobVideos, Layout, App, main). O `Edit` do Cowork **trunca arquivos grandes** (`JobDetail.tsx` já tem ~730 linhas) e não é confiável para refactor multi-arquivo com dependências.
- **Iteração local com build/typecheck**: precisa rodar `pnpm build`/`tsc` e testar offline no navegador em loop — fluxo de dev local, não de orquestração.
- **Lógica de concorrência/idempotência** exige iterar com testes — melhor no ambiente de código.
- Cowork fica melhor para: **deploy** (Vercel) pós-merge, **validação via MCP/SQL** dos critérios 2-3 (checar `jobs`/`ordens_instalacao`/eventos após sync) e **smoke-test** final.

---

## Apêndice — comandos de verificação (pós-fix, rodar no Cowork/MCP)

```sql
-- Critério 2/3: OS concluída offline e sincronizada
SELECT id, status, signature_url, finished_at, ordem_instalacao_id
FROM jobs WHERE id = '<job_id_teste>';

SELECT id, status, data_execucao FROM ordens_instalacao WHERE id = '<ordem_id>';

-- Critério 3: evento installation_completed voltou a ser emitido
SELECT event_type, created_at FROM <tabela_eventos_ai_bridge>
WHERE event_type = 'installation_completed' ORDER BY created_at DESC LIMIT 5;
```
(Nome exato da tabela de eventos: ver `supabase/migrations/104_ai_bridge_event_triggers.sql:89` e `106_cockpit_automacao_views.sql`.)
