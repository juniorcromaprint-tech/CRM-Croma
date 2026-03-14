# Portal do Cliente + Fluxo E2E Completo — Design Spec

> **Data**: 2026-03-12 | **Status**: Aprovado | **Abordagem**: B (domínio portal/ integrado)

---

## 1. Visão Geral

Construir 6 subsistemas integrados no mesmo app React para completar o fluxo de negócio da Croma Print:

1. **Condições de Pagamento** — editor estruturado no orçamento
2. **Precificação Real** — produto Banner-Teste com materiais/processos reais
3. **Portal Público do Cliente** — rota `/p/:token` sem login
4. **Tracking Avançado** — métricas de visualização com termômetro de interesse
5. **OneDrive para Arquivos** — upload do cliente vai direto para OneDrive via Composio
6. **Automação E2E** — cada módulo dispara o próximo automaticamente

**Princípio**: Tudo no mesmo app, mesmo deploy, mesmo domínio. Sem app separado.

---

## 2. Arquitetura

### 2.1 Novo Domínio: `src/domains/portal/`

```
src/domains/portal/
├── pages/
│   └── PortalOrcamentoPage.tsx     — view pública do orçamento
├── components/
│   ├── PortalHeader.tsx            — cabeçalho limpo com logo Croma
│   ├── PortalItemList.tsx          — lista de itens formatada para cliente
│   ├── PortalPaymentInfo.tsx       — condição de pagamento (read-only)
│   ├── PortalApproval.tsx          — botão aprovar + comentário
│   ├── PortalFileUpload.tsx        — upload de arquivos → OneDrive
│   └── PortalTracking.tsx          — script invisível de tracking
├── services/
│   ├── portal.service.ts           — fetch proposta por token (anon)
│   ├── tracking.service.ts         — registrar views/events via Supabase
│   └── portal-upload.service.ts    — upload → OneDrive via Edge Function
└── hooks/
    ├── usePortalProposta.ts        — TanStack query para proposta pública
    └── usePortalTracking.ts        — hook de tracking automático
```

### 2.2 Componentes no Domínio Comercial (reutilizáveis)

```
src/domains/comercial/components/
├── CondicoesPagamento.tsx          — editor de condições de pagamento
├── CondicoesPagamentoView.tsx      — visualização read-only (usado no portal)
└── TrackingPanel.tsx               — painel vendedor "termômetro de interesse"
```

### 2.3 Rota Pública no App.tsx

```tsx
// Fora do ProtectedRoute
<Route path="/p/:token" element={<PortalOrcamentoPage />} />
```

### 2.4 Nova Migration: `012_portal_tracking_pagamento.sql`

---

## 3. Schema do Banco de Dados

### 3.1 Novas Colunas em `propostas`

```sql
-- Token de compartilhamento
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_active BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;
-- Condições de pagamento estruturadas
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT; -- 'pix', 'boleto_vista', 'boleto_parcelado', 'cartao', 'entrada_parcelas', 'prazo_ddl'
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS parcelas_count INTEGER DEFAULT 1;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS entrada_percentual NUMERIC(5,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS prazo_dias INTEGER[]; -- ex: {30,60,90} para boleto 30/60/90
-- Aprovação pelo cliente
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS aprovado_pelo_cliente BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS aprovado_pelo_cliente_at TIMESTAMPTZ;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS comentario_cliente TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS ip_aprovacao INET;
-- OneDrive
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS onedrive_folder_id TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

-- Adicionar 'aprovada_cliente' ao CHECK constraint de status
ALTER TABLE propostas DROP CONSTRAINT IF EXISTS propostas_status_check;
ALTER TABLE propostas ADD CONSTRAINT propostas_status_check
  CHECK (status IN ('rascunho', 'enviada', 'em_revisao', 'aprovada', 'aprovada_cliente', 'recusada', 'expirada', 'convertida'));

-- Índice parcial para lookups de token ativo
CREATE INDEX IF NOT EXISTS idx_propostas_share_token_active
  ON propostas(share_token) WHERE share_token_active = true;
```

### 3.2 Nova Tabela: `proposta_views`

```sql
CREATE TABLE proposta_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  -- Identificação
  session_id TEXT NOT NULL, -- UUID gerado no browser (localStorage)
  ip_address INET,
  user_agent TEXT,
  -- Dispositivo
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  -- Métricas por sessão
  page_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_closed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  -- Scroll tracking
  max_scroll_depth INTEGER DEFAULT 0, -- 0-100%
  -- Interações
  clicked_items JSONB DEFAULT '[]', -- [{item_id, timestamp}]
  downloaded_pdf BOOLEAN DEFAULT false,
  -- Geolocalização aproximada (do IP)
  geo_city TEXT,
  geo_region TEXT,
  geo_country TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proposta_views_proposta ON proposta_views(proposta_id);
CREATE INDEX idx_proposta_views_session ON proposta_views(session_id);
```

### 3.3 Nova Tabela: `proposta_attachments`

```sql
CREATE TABLE proposta_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  -- Arquivo
  nome_arquivo TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes BIGINT,
  -- OneDrive
  onedrive_file_id TEXT,
  onedrive_file_url TEXT,
  onedrive_download_url TEXT,
  -- Supabase Storage fallback (quando OneDrive offline)
  storage_path TEXT,
  storage_url TEXT,
  -- Quem enviou
  uploaded_by_type TEXT NOT NULL DEFAULT 'cliente', -- 'cliente' ou 'vendedor'
  uploaded_by_name TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proposta_attachments_proposta ON proposta_attachments(proposta_id);
```

### 3.4 Segurança — RPCs + RLS

**Princípio**: Nenhuma operação anônima usa UPDATE/INSERT direto nas tabelas. Tudo via RPCs `SECURITY DEFINER` que validam o token e controlam exatamente quais campos são alterados.

```sql
-- RLS: Leitura anônima APENAS pela row com token exato (via RPC)
-- NÃO expor SELECT direto. Usar RPC abaixo.

-- ① RPC: Buscar proposta por token (leitura segura)
CREATE OR REPLACE FUNCTION public.portal_get_proposta(p_token UUID)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id, 'numero', p.numero, 'status', p.status,
    'valor_total', p.total, 'desconto_percentual', p.desconto_percentual,
    'forma_pagamento', p.forma_pagamento, 'parcelas_count', p.parcelas_count,
    'prazo_dias', p.prazo_dias, 'entrada_percentual', p.entrada_percentual,
    'validade', p.validade_dias, 'observacoes', p.observacoes,
    'aprovado_pelo_cliente', p.aprovado_pelo_cliente,
    'cliente', json_build_object('nome_fantasia', c.nome_fantasia, 'contato_nome', c.contato_nome),
    'itens', (SELECT json_agg(json_build_object(
      'id', pi.id, 'descricao', pi.descricao, 'especificacao', pi.especificacao,
      'quantidade', pi.quantidade, 'valor_unitario', pi.valor_unitario,
      'valor_total', pi.valor_total
    )) FROM proposta_itens pi WHERE pi.proposta_id = p.id)
  ) INTO result
  FROM propostas p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.share_token = p_token
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou link expirado';
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ② RPC: Registrar view (INSERT seguro com validação de token)
CREATE OR REPLACE FUNCTION public.portal_register_view(
  p_token UUID, p_session_id TEXT, p_device_type TEXT,
  p_browser TEXT, p_os TEXT, p_geo_city TEXT,
  p_geo_region TEXT, p_geo_country TEXT
)
RETURNS UUID AS $$
DECLARE v_proposta_id UUID; v_view_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  INSERT INTO proposta_views (proposta_id, session_id, ip_address, device_type, browser, os, geo_city, geo_region, geo_country)
  VALUES (v_proposta_id, p_session_id, inet_client_addr(), p_device_type, p_browser, p_os, p_geo_city, p_geo_region, p_geo_country)
  RETURNING id INTO v_view_id;
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ③ RPC: Heartbeat — atualizar duração e scroll (UPDATE seguro, validação de token)
-- NOTA: p_clicked_items deve conter o array COMPLETO acumulado no client-side (não delta)
CREATE OR REPLACE FUNCTION public.portal_heartbeat(
  p_token UUID, p_view_id UUID, p_duration_seconds INTEGER,
  p_max_scroll_depth INTEGER, p_clicked_items JSONB,
  p_downloaded_pdf BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE proposta_views pv SET
    duration_seconds = p_duration_seconds,
    max_scroll_depth = GREATEST(pv.max_scroll_depth, p_max_scroll_depth),
    clicked_items = p_clicked_items,
    downloaded_pdf = COALESCE(pv.downloaded_pdf, false) OR p_downloaded_pdf,
    page_closed_at = now()
  FROM propostas pr
  WHERE pv.id = p_view_id
    AND pv.proposta_id = pr.id
    AND pr.share_token = p_token
    AND pr.share_token_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ④ RPC: Aprovar proposta (UPDATE seguro — só campos de aprovação)
CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token UUID, p_comentario TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE v_proposta_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND aprovado_pelo_cliente = false
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada, já aprovada, ou link expirado';
  END IF;
  UPDATE propostas SET
    aprovado_pelo_cliente = true,
    aprovado_pelo_cliente_at = now(),
    comentario_cliente = p_comentario,
    ip_aprovacao = inet_client_addr(),
    status = 'aprovada_cliente',
    updated_at = now()
  WHERE id = v_proposta_id;
  -- Inserir notificação para o vendedor
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT p.vendedor_id, 'aprovacao_cliente',
    'Cliente aprovou orçamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentários'),
    'proposta', v_proposta_id
  FROM propostas p WHERE p.id = v_proposta_id AND p.vendedor_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ⑤ RPC: Registrar attachment (INSERT seguro)
CREATE OR REPLACE FUNCTION public.portal_register_attachment(
  p_token UUID, p_nome_arquivo TEXT, p_tipo_mime TEXT,
  p_tamanho_bytes BIGINT, p_onedrive_file_id TEXT,
  p_onedrive_file_url TEXT, p_uploaded_by_name TEXT
)
RETURNS UUID AS $$
DECLARE v_proposta_id UUID; v_att_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN RAISE EXCEPTION 'Token inválido ou expirado'; END IF;
  INSERT INTO proposta_attachments (
    proposta_id, nome_arquivo, tipo_mime, tamanho_bytes,
    onedrive_file_id, onedrive_file_url, uploaded_by_type, uploaded_by_name
  ) VALUES (
    v_proposta_id, p_nome_arquivo, p_tipo_mime, p_tamanho_bytes,
    p_onedrive_file_id, p_onedrive_file_url, 'cliente', p_uploaded_by_name
  ) RETURNING id INTO v_att_id;
  RETURN v_att_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS mínimo: bloquear acesso anônimo direto às tabelas.
-- NOTA: Não há policies FOR INSERT/UPDATE porque todos os writes vêm de RPCs
-- SECURITY DEFINER, que bypassam RLS automaticamente. Isso é intencional.
ALTER TABLE proposta_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_attachments ENABLE ROW LEVEL SECURITY;
-- Apenas authenticated users podem ler views/attachments (para o painel do vendedor)
CREATE POLICY "Vendedor lê views" ON proposta_views FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Vendedor lê attachments" ON proposta_attachments FOR SELECT USING (auth.role() = 'authenticated');
```

### 3.5 Nova Tabela: `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL, -- 'aprovacao_cliente', 'novo_pedido', etc.
  titulo TEXT NOT NULL,
  mensagem TEXT,
  entidade_tipo TEXT, -- 'proposta', 'pedido', etc.
  entidade_id UUID,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, lida);

-- RLS: apenas o próprio usuário lê suas notificações
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê próprias notificações" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT não precisa de policy: RPCs SECURITY DEFINER bypassa RLS automaticamente.
-- Não criar policy FOR INSERT = nenhum client direto pode inserir.
```

### 3.6 Status Válidos em `propostas`

Adicionar novo status ao enum existente:

```sql
-- Status flow: rascunho → enviada → aprovada_cliente → aprovada → convertida → cancelada
-- "aprovada_cliente" = cliente aprovou no portal, aguarda confirmação comercial
```

---

## 4. Condições de Pagamento

### 4.1 Tipos Suportados

| Tipo | `forma_pagamento` | Campos usados |
|---|---|---|
| PIX à vista | `pix` | — |
| Boleto à vista | `boleto_vista` | — |
| Boleto parcelado | `boleto_parcelado` | `parcelas_count`, `prazo_dias` (ex: {30,60,90}) |
| Cartão de crédito | `cartao` | `parcelas_count` (até 12x) |
| Entrada + parcelas | `entrada_parcelas` | `entrada_percentual`, `parcelas_count`, `prazo_dias` |
| Prazo DDL (30/60/90) | `prazo_ddl` | `prazo_dias` |

### 4.2 Componente `CondicoesPagamento`

- Dropdown para selecionar tipo
- Campos dinâmicos conforme tipo selecionado
- Preview em tempo real: "3x de R$ 397,97 • 1ª parcela: 30 dias"
- Obrigatório antes de enviar orçamento ao cliente
- Salva na proposta como campos estruturados

### 4.3 Geração Automática de Parcelas

Quando pedido é criado (após aprovação):
- Service `financeiro-automation.service.ts` lê condições de pagamento da proposta
- Gera registros em `parcelas_receber` com datas calculadas
- Exemplo: Boleto 30/60/90 com total R$ 1.193,90 → 3 parcelas de R$ 397,97 com vencimentos D+30, D+60, D+90

---

## 5. Portal Público do Cliente

### 5.1 Fluxo

1. Vendedor clica "Gerar Link" no OrcamentoViewPage
2. Sistema ativa `share_token_active = true` e define `share_token_expires_at` (+30 dias)
3. URL gerada: `crm-croma.vercel.app/p/{share_token}`
4. Vendedor copia/envia por email/WhatsApp
5. Cliente abre o link → vê proposta formatada
6. Cliente pode:
   - Visualizar itens e condições de pagamento
   - Anexar arquivos (arte, logo) → OneDrive
   - Escrever comentários
   - Clicar "Aprovar Orçamento"

### 5.2 Layout do Portal

- **Cabeçalho**: Logo Croma + número da proposta (sem menu de navegação)
- **Saudação**: "Olá, {nome}! Segue sua proposta comercial."
- **Itens**: Lista clean com nome, quantidade, valor unitário, total
- **Condição de pagamento**: Card com detalhes das parcelas
- **Total**: Destaque grande com valor total
- **Upload**: Área drag-and-drop para anexar arquivos
- **Comentários**: Textarea opcional
- **Aprovar**: Botão verde grande

### 5.3 Aprovação

Ao clicar "Aprovar":
1. Grava `aprovado_pelo_cliente = true`, `aprovado_pelo_cliente_at = now()`, `comentario_cliente`, `ip_aprovacao`
2. Faz upload dos arquivos pendentes para OneDrive
3. Mostra tela de confirmação: "Orçamento aprovado com sucesso!"
4. Vendedor recebe notificação (toast no ERP + badge no menu)
5. Status da proposta muda para "aprovada_cliente" (aguarda aprovação comercial interna)

### 5.4 Fluxo de Aprovação Dupla

```
Cliente aprova no link → status = "aprovada_cliente"
                       → vendedor vê notificação no ERP
                       → vendedor clica "Aprovar" internamente → status = "aprovada"
                       → automação gera pedido
```

---

## 6. Tracking Avançado

### 6.1 Coleta de Dados (no portal)

Hook `usePortalTracking` coleta automaticamente:

| Métrica | Como coleta |
|---|---|
| Aberturas | RPC `portal_register_view` ao carregar página → retorna `view_id` |
| Tempo na página | **Heartbeat a cada 30s** via `navigator.sendBeacon` → RPC `portal_heartbeat(token, view_id, ...)` |
| Dispositivo | `navigator.userAgent` parsing (ua-parser-js) |
| Scroll depth | `scroll` event debounced → % do documento visível, enviado no heartbeat |
| Cliques nos itens | `click` event em itens → acumulado em JSONB, enviado no heartbeat |
| Download PDF | `click` event no botão PDF → flag no heartbeat |
| Session ID | `localStorage` UUID (persiste entre reloads, identifica retornos) |
| Fechamento | `visibilitychange` + `beforeunload` → `sendBeacon` final |

**Heartbeat**: `setInterval(30000)` chama `portal_heartbeat` via `sendBeacon` com duração atual, scroll max, cliques acumulados. Garante dados mesmo se tab fechar abruptamente (mobile/desktop).

### 6.2 Painel do Vendedor (TrackingPanel)

Dentro do `OrcamentoViewPage` interno:

- **Termômetro de Interesse**: barra de calor 0-100% baseada em score normalizado
- **Score (normalizado 0-100)**:
  ```
  raw = min(aberturas, 10) × 10 + min(tempo_total_seg, 600) / 6 + max_scroll_depth + (pdf_download ? 20 : 0)
  score = min(raw / 2.3, 100)  // 2.3 = max_raw(230) / 100
  ```
- **Classificação**: Frio (<25), Morno (25-50), Quente (50-75), Muito Quente (>75)
- **Métricas visuais**: Aberturas, tempo total, scroll depth, dispositivo, última view
- **Timeline**: Lista cronológica de todas as visualizações com device/geo
- **Atualização**: Supabase Realtime subscription em `proposta_views` para atualizar em tempo real

### 6.3 Geolocalização

- Resolvida server-side via Edge Function proxy (evita CORS/mixed-content do ip-api.com)
- Usa `ipinfo.io` free tier (HTTPS, 50k/mês) como provider
- Client chama Edge Function `resolve-geo` que retorna city/region/country
- Dados passados ao `portal_register_view` como parâmetros

### 6.4 Notificações para o Vendedor

- RPC `portal_aprovar_proposta` insere registro em tabela `notifications`
- Frontend usa Supabase Realtime subscription em `notifications` (filtro `user_id`)
- Badge no menu "Orçamentos" com contagem de não-lidas
- Toast automático quando nova notificação chega
- Clicar na notificação navega para `OrcamentoViewPage` do orçamento aprovado

---

## 7. OneDrive para Arquivos

### 7.1 Fluxo de Upload

```
Cliente arrasta arquivo no portal
  → Frontend faz upload para Supabase Storage (bucket temporário)
  → Chama Edge Function `onedrive-upload-proposta`
  → Edge Function:
    1. Cria pasta OneDrive: Croma/Clientes/{cliente}/{proposta}/
    2. Faz upload do arquivo para OneDrive via Composio
    3. Salva metadados em `proposta_attachments`
    4. Remove arquivo do bucket temporário
  → Frontend mostra confirmação com link do OneDrive
```

### 7.2 Edge Function: `onedrive-upload-proposta`

Reutiliza padrão de `onedrive-criar-pasta` existente:
- Composio API com `ONE_DRIVE_ONEDRIVE_UPLOAD_FILE`
- Env vars: `COMPOSIO_API_KEY`, `ONEDRIVE_CONNECTED_ACCOUNT_ID`
- Estrutura: `Croma/Clientes/{nome_cliente}/Proposta-{numero}/`

---

## 8. Automação E2E — Triggers

### 8.1 Cadeia de Automação

```
Aprovação Comercial (status = "aprovada")
  ↓ trigger: orcamento.service.ts → converterParaPedido()
Pedido criado (PED-2026-XXXX)
  ↓ trigger: pedido.service.ts → gerarOrdemProducao()
OP criada por item
  ↓ manual: produção avança etapas no Kanban
Todas etapas concluídas
  ↓ trigger: producao.service.ts → finalizarOP()
OP finalizada
  ↓ trigger: financeiro-automation.service.ts → gerarContasReceber()
  ↓ trigger: financeiro-automation.service.ts → gerarParcelas() ← NOVO
  ↓ trigger: fiscal/nfe-creation.service.ts → criarNFeFromPedido()
NF-e gerada
  ↓ trigger: instalacao-criacao.service.ts → criarOrdemInstalacao() (se produto requer)
OS criada
  ↓ futuramente: sync com App de Campo (migration 004 pendente)
```

### 8.2 Novo: Geração Automática de Parcelas

```typescript
// financeiro-automation.service.ts
async function gerarParcelas(pedidoId: string) {
  const pedido = await getPedidoComProposta(pedidoId);
  const { forma_pagamento, parcelas_count, prazo_dias, entrada_percentual } = pedido.proposta;
  const valorTotal = pedido.valor_total;

  // Gerar parcelas conforme condição
  if (forma_pagamento === 'boleto_parcelado') {
    for (let i = 0; i < parcelas_count; i++) {
      await insertParcela({
        conta_receber_id: contaReceberId,
        numero_parcela: i + 1,
        valor: valorTotal / parcelas_count,
        data_vencimento: addDays(now(), prazo_dias[i]),
        status: 'a_vencer'
      });
    }
  }
  // ... outros tipos
}
```

---

## 9. Precificação Real — Banner-Teste

### 9.1 Dados do Produto

| Campo | Valor |
|---|---|
| Nome | Banner-Teste |
| Categoria | campanhas |
| Unidade | m² |

### 9.2 Modelos (3 tamanhos)

| Modelo | Largura | Altura | Área m² | Markup |
|---|---|---|---|---|
| 60x80cm | 60 | 80 | 0.48 | 45% |
| 70x100cm | 70 | 100 | 0.70 | 45% |
| 90x120cm | 90 | 120 | 1.08 | 45% |

### 9.3 Materiais por Modelo

| Material | Buscar no DB | Qtd por unidade | Unidade |
|---|---|---|---|
| Lona 440g | ILIKE '%lona%440%' | = área_m2 | m² |
| Bastão alumínio | ILIKE '%bast%' | 2 | un |
| Ponteiras | ILIKE '%ponteira%' | 4 | un |
| Cordinha | ILIKE '%cord%' | 1 | un |
| Tinta solvente | ILIKE '%tinta%solv%' | = área_m2 × 0.05 | litro |

### 9.4 Processos por Modelo

| Etapa | Tempo (min) | Máquina |
|---|---|---|
| Impressão Digital Solvente | baseado na área ÷ velocidade | Ampla Targa XT 1.80m ou HP Latex 1.60m |
| Acabamento (corte + costura) | 10 | Manual |
| Montagem (bastões + ponteiras + cordinha) | 8 | Manual |
| Conferência | 3 | Visual |

### 9.5 Cálculo Estimado (60x80cm, área 0.48m²)

```
Vmp = (0.48 × R$106) + (2 × R$8) + (4 × R$2) + (1 × R$3) + (0.024 × R$45)
    = 50.88 + 16 + 8 + 3 + 1.08 = R$ 78.96

T = 5 + 10 + 8 + 3 = 26 min
MO = 26 × R$0.94 = R$ 24.44
Vb = (78.96 + 24.44) × 1.12 = R$ 115.81
Vam = 115.81 / 0.81 = R$ 142.98
Vm = 142.98 × 0.45 = R$ 64.34
Vv = 142.98 + 64.34 = R$ 207.32 por unidade
```

---

## 10. Envio do Orçamento

### 10.1 Opções de Envio (OrcamentoViewPage)

| Canal | Implementação |
|---|---|
| **Link** | Ativa `share_token_active`, copia URL para clipboard |
| **PDF** | `html2pdf.js` — renderiza DOM do orçamento formatado para canvas → PDF. Escolhido por simplicidade (sem duplicar layout). Qualidade suficiente para proposta comercial. |
| **Email** | Edge Function `enviar-email-proposta` via **Resend** (free tier 100 emails/dia). Template HTML inline com dados da proposta + botão "Ver Orçamento" com link do portal. |
| **WhatsApp** | Abre `https://wa.me/{telefone}?text={mensagem}` com mensagem pré-formatada incluindo link do portal. |

### 10.2 Edge Function: `enviar-email-proposta`

```typescript
// Env vars: RESEND_API_KEY
// Input: { proposta_id, destinatario_email, destinatario_nome }
// Template: HTML inline com logo Croma, itens, total, botão "Ver Proposta"
// Marca proposta como status="enviada" após envio com sucesso
```

### 10.3 Botões na UI

4 botões no header do OrcamentoViewPage:
- 🔗 Link → ativa share_token, copia URL, toast "Link copiado!"
- 💬 WhatsApp → abre wa.me com mensagem pré-formatada
- 📧 Email → modal: campo email pré-preenchido do cliente, preview, botão enviar
- 📄 PDF → gera e baixa PDF via html2pdf.js

---

## 11. Arquivos Modificados (Resumo)

### Novos
- `src/domains/portal/` — todo o domínio (~10 arquivos)
- `src/domains/comercial/components/CondicoesPagamento.tsx`
- `src/domains/comercial/components/CondicoesPagamentoView.tsx`
- `src/domains/comercial/components/TrackingPanel.tsx`
- `src/hooks/useNotifications.ts` — hook Realtime para notificações
- `src/components/NotificationBadge.tsx` — badge no menu
- `supabase/migrations/012_portal_tracking_pagamento.sql`
- `supabase/functions/onedrive-upload-proposta/index.ts`
- `supabase/functions/enviar-email-proposta/index.ts`
- `supabase/functions/resolve-geo/index.ts`

### Modificados
- `src/App.tsx` — adicionar rota pública `/p/:token`
- `src/domains/comercial/pages/OrcamentoViewPage.tsx` — botões envio + TrackingPanel
- `src/domains/comercial/pages/OrcamentoEditorPage.tsx` — CondicoesPagamento no editor
- `src/domains/comercial/services/orcamento.service.ts` — salvar condições de pagamento
- `src/domains/financeiro/services/financeiro-automation.service.ts` — gerar parcelas automáticas

---

## 12. Edge Cases e Tratamento de Erros

### 12.1 Portal

| Cenário | Tratamento |
|---|---|
| Link expirado | Tela "Esta proposta expirou. Entre em contato com seu vendedor." |
| Link já aprovado | Tela "Esta proposta já foi aprovada em {data}." (read-only, sem botão aprovar) |
| Upload durante aprovação | Desabilitar botão "Aprovar" enquanto uploads estão em progresso |
| Múltiplas pessoas no mesmo link | Cada uma tem session_id diferente no tracking. Primeira aprovação trava. |
| Vendedor regenera link | Desativa token antigo, gera novo. Link antigo mostra "Link inválido." |
| Aprovação dupla | RPC verifica `aprovado_pelo_cliente = false` antes de atualizar. Tentativa repetida retorna erro. |

### 12.2 Arquivos

| Cenário | Tratamento |
|---|---|
| Tamanho máximo | 50MB por arquivo, validado no frontend antes do upload |
| Tipos aceitos | PDF, AI, CDR, EPS, JPG, PNG, TIFF, PSD (validação de extensão + MIME) |
| OneDrive offline | Arquivo fica no Supabase Storage (bucket `proposta-uploads`). Job retry a cada 5 min (3 tentativas). Se falhar, mantém no Storage e notifica vendedor. |
| Upload falha no meio | Frontend mostra erro + botão retry. Arquivo parcial não é registrado em `proposta_attachments`. |

### 12.3 Tracking

| Cenário | Tratamento |
|---|---|
| Tab fecha sem heartbeat | `beforeunload` + `sendBeacon` como fallback. Duração pode ter gap de até 30s. Aceitável. |
| Bot/crawler abre link | User-agent check básico. Se detectado bot, não registra view. |
| Client-side bloqueado (ad blocker) | Tracking é best-effort. Sistema funciona normalmente sem ele. |

---

## 13. Decisões de Design

| Decisão | Escolha | Razão |
|---|---|---|
| App separado vs integrado | Integrado (domínio portal/) | Menos complexidade, mesmo deploy, mesmo DB |
| Auth no portal | Token UUID na URL, sem login | Cliente não tem conta no ERP |
| Segurança DB | RPCs SECURITY DEFINER (não RLS direto) | Controle preciso de quais campos podem ser alterados |
| Storage de arquivos | OneDrive via Composio + fallback Supabase Storage | Infra já existe; fallback garante resiliência |
| Tracking duração | Heartbeat 30s via sendBeacon | Mais confiável que visibilitychange para tab close/mobile |
| Geolocalização | Server-side via Edge Function + ipinfo.io | Evita CORS/mixed-content do ip-api.com free |
| PDF | html2pdf.js (client-side DOM → canvas → PDF) | Simples, sem duplicar layout, qualidade suficiente |
| Email | Resend (free 100/dia) via Edge Function | Sem infra própria de SMTP |
| Notificações | Tabela notifications + Supabase Realtime | Push em tempo real sem polling |
| Aprovação | Dupla (cliente + comercial) | Cliente aprova no link, vendedor confirma no ERP |
| Parcelas | Geradas automaticamente do pedido | Baseado nas condições de pagamento da proposta |
| `parcelas_receber` | Tabela já existe (migration 001, linha 869) | Reutilizar schema existente |
