# Portal do Cliente + Fluxo E2E — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 integrated subsystems — portal público do cliente, tracking avançado, condições de pagamento, upload OneDrive, precificação Banner-Teste, automação E2E — all within the same React app.

**Architecture:** New `src/domains/portal/` domain for public-facing pages. New migration `020_portal_tracking_pagamento.sql` for schema changes (columns, tables, RPCs, RLS). Three new Edge Functions (geo, email, OneDrive upload). Payment conditions integrated into `OrcamentoEditorPage`. Tracking panel into `OrcamentoViewPage`. Notifications via Supabase Realtime.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, Supabase (Postgres + Auth + Realtime + Storage + Edge Functions), TanStack Query v5, html2pdf.js, ua-parser-js, Resend (email), ipinfo.io (geo), Composio (OneDrive).

**Spec:** `docs/superpowers/specs/2026-03-12-portal-cliente-e2e-design.md`

---

## File Structure

### New Files

```
src/domains/portal/
├── pages/PortalOrcamentoPage.tsx        — Public proposal view (no auth required)
├── components/
│   ├── PortalHeader.tsx                 — Clean header with Croma logo + proposal number
│   ├── PortalItemList.tsx               — Item list formatted for client
│   ├── PortalPaymentInfo.tsx            — Payment conditions card (read-only)
│   ├── PortalApproval.tsx               — Approve button + comment textarea
│   ├── PortalFileUpload.tsx             — Drag-and-drop upload → OneDrive
│   └── PortalConfirmation.tsx           — Post-approval confirmation screen
├── services/
│   ├── portal.service.ts                — Fetch proposta by token via RPC
│   ├── tracking.service.ts              — Register views/heartbeat via RPC
│   └── portal-upload.service.ts         — Upload files via Edge Function
└── hooks/
    ├── usePortalProposta.ts             — TanStack query for public proposta
    └── usePortalTracking.ts             — Auto-tracking hook (heartbeat, scroll, clicks)

src/domains/comercial/components/
├── CondicoesPagamento.tsx               — Payment conditions editor (dropdown + dynamic fields)
├── CondicoesPagamentoView.tsx           — Read-only payment display (reused in portal)
├── TrackingPanel.tsx                    — Vendor tracking panel (thermometer + timeline)
└── SharePropostaModal.tsx              — Modal with 4 send options (link, WhatsApp, email, PDF)

src/hooks/useNotifications.ts            — Supabase Realtime subscription for notifications
src/components/NotificationBadge.tsx      — Badge counter in sidebar menu

supabase/migrations/020_portal_tracking_pagamento.sql  — All schema changes
supabase/functions/resolve-geo/index.ts                — IP geolocation proxy
supabase/functions/enviar-email-proposta/index.ts      — Send proposal email via Resend
supabase/functions/onedrive-upload-proposta/index.ts   — Upload file to OneDrive
```

### Modified Files

```
src/App.tsx                                            — Add public route /p/:token
src/domains/comercial/pages/OrcamentoEditorPage.tsx    — Add CondicoesPagamento component
src/domains/comercial/pages/OrcamentoViewPage.tsx      — Add TrackingPanel + SharePropostaModal
src/domains/comercial/services/orcamento.service.ts    — Save structured payment fields
src/domains/financeiro/services/financeiro-automation.service.ts — Generate parcelas from conditions
src/components/layout/Sidebar.tsx                      — Add NotificationBadge
```

---

## Chunk 1: Database Migration + RPCs

### Task 1: Create migration file with schema changes

**Files:**
- Create: `supabase/migrations/020_portal_tracking_pagamento.sql`

- [ ] **Step 1: Create migration file — propostas columns**

```sql
-- 020_portal_tracking_pagamento.sql
-- Portal do Cliente + Tracking + Condições de Pagamento

-- ═══════════════════════════════════════
-- 1. NOVAS COLUNAS EM propostas
-- ═══════════════════════════════════════

-- Token de compartilhamento
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_active BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

-- Condições de pagamento estruturadas
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS parcelas_count INTEGER DEFAULT 1;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS entrada_percentual NUMERIC(5,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS prazo_dias INTEGER[];

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

- [ ] **Step 2: Add proposta_views table**

Append to same file:

```sql
-- ═══════════════════════════════════════
-- 2. NOVA TABELA: proposta_views
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS proposta_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  page_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_closed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  max_scroll_depth INTEGER DEFAULT 0,
  clicked_items JSONB DEFAULT '[]',
  downloaded_pdf BOOLEAN DEFAULT false,
  geo_city TEXT,
  geo_region TEXT,
  geo_country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_views_proposta ON proposta_views(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_views_session ON proposta_views(session_id);
```

- [ ] **Step 3: Add proposta_attachments table**

Append:

```sql
-- ═══════════════════════════════════════
-- 3. NOVA TABELA: proposta_attachments
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS proposta_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes BIGINT,
  onedrive_file_id TEXT,
  onedrive_file_url TEXT,
  onedrive_download_url TEXT,
  storage_path TEXT,
  storage_url TEXT,
  uploaded_by_type TEXT NOT NULL DEFAULT 'cliente',
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_attachments_proposta ON proposta_attachments(proposta_id);
```

- [ ] **Step 4: Add notifications table**

Append:

```sql
-- ═══════════════════════════════════════
-- 4. NOVA TABELA: notifications
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, lida);
```

- [ ] **Step 5: Add RLS policies**

Append:

```sql
-- ═══════════════════════════════════════
-- 5. RLS
-- ═══════════════════════════════════════

-- proposta_views: only authenticated users can read (vendor panel)
-- Writes via SECURITY DEFINER RPCs only
ALTER TABLE proposta_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor lê views" ON proposta_views
  FOR SELECT USING (auth.role() = 'authenticated');

-- proposta_attachments: only authenticated users can read
ALTER TABLE proposta_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor lê attachments" ON proposta_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

-- notifications: user reads own notifications only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê próprias notificações" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT policy: RPCs SECURITY DEFINER bypass RLS
```

- [ ] **Step 6: Add all 5 RPCs**

Append:

```sql
-- ═══════════════════════════════════════
-- 6. RPCs (SECURITY DEFINER)
-- ═══════════════════════════════════════

-- ① Buscar proposta por token
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

-- ② Registrar view
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

-- ③ Heartbeat
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

-- ④ Aprovar proposta
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
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT p.vendedor_id, 'aprovacao_cliente',
    'Cliente aprovou orçamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentários'),
    'proposta', v_proposta_id
  FROM propostas p WHERE p.id = v_proposta_id AND p.vendedor_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ⑤ Registrar attachment
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

-- ═══════════════════════════════════════
-- 7. ENABLE REALTIME
-- ═══════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE proposta_views;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

- [ ] **Step 7: Commit migration**

```bash
git add supabase/migrations/020_portal_tracking_pagamento.sql
git commit -m "feat(db): migration 020 — portal, tracking, pagamento, notifications"
```

---

## Chunk 2: Payment Conditions Components

### Task 2: CondicoesPagamento editor component

**Files:**
- Create: `src/domains/comercial/components/CondicoesPagamento.tsx`

- [ ] **Step 1: Create the component**

This component renders a dropdown for payment type and dynamic fields based on selection. It receives `value` (current state) and `onChange` callback.

```tsx
// src/domains/comercial/components/CondicoesPagamento.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brl } from '@/shared/utils/format';

export interface PaymentConditions {
  forma_pagamento: string;
  parcelas_count: number;
  entrada_percentual: number;
  prazo_dias: number[];
}

interface Props {
  value: PaymentConditions;
  onChange: (v: PaymentConditions) => void;
  valorTotal: number;
}

const TIPOS = [
  { value: 'pix', label: 'PIX à vista' },
  { value: 'boleto_vista', label: 'Boleto à vista' },
  { value: 'boleto_parcelado', label: 'Boleto parcelado' },
  { value: 'cartao', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' },
  { value: 'prazo_ddl', label: 'Prazo DDL (30/60/90)' },
];

export function CondicoesPagamento({ value, onChange, valorTotal }: Props) {
  const update = (partial: Partial<PaymentConditions>) =>
    onChange({ ...value, ...partial });

  // Calculate preview text
  const previewText = buildPreview(value, valorTotal);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Condições de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Forma de Pagamento</Label>
          <Select value={value.forma_pagamento} onValueChange={(v) => {
            const defaults = getDefaults(v);
            onChange({ forma_pagamento: v, ...defaults });
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {TIPOS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic fields based on tipo */}
        {(value.forma_pagamento === 'boleto_parcelado' || value.forma_pagamento === 'cartao') && (
          <div>
            <Label>Número de Parcelas</Label>
            <Input
              type="number" min={2} max={value.forma_pagamento === 'cartao' ? 12 : 24}
              value={value.parcelas_count}
              onChange={(e) => {
                const count = parseInt(e.target.value) || 2;
                const dias = value.forma_pagamento === 'boleto_parcelado'
                  ? Array.from({ length: count }, (_, i) => (i + 1) * 30)
                  : [];
                update({ parcelas_count: count, prazo_dias: dias });
              }}
            />
          </div>
        )}

        {value.forma_pagamento === 'entrada_parcelas' && (
          <>
            <div>
              <Label>Entrada (%)</Label>
              <Input
                type="number" min={10} max={90} step={5}
                value={value.entrada_percentual}
                onChange={(e) => update({ entrada_percentual: parseFloat(e.target.value) || 30 })}
              />
            </div>
            <div>
              <Label>Número de Parcelas</Label>
              <Input
                type="number" min={1} max={24}
                value={value.parcelas_count}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 3;
                  const dias = Array.from({ length: count }, (_, i) => (i + 1) * 30);
                  update({ parcelas_count: count, prazo_dias: dias });
                }}
              />
            </div>
          </>
        )}

        {value.forma_pagamento === 'prazo_ddl' && (
          <div>
            <Label>Prazos (dias)</Label>
            <div className="flex gap-2">
              {(value.prazo_dias || [30, 60, 90]).map((d, i) => (
                <Input
                  key={i} type="number" min={15} max={180} step={15}
                  value={d} className="w-20"
                  onChange={(e) => {
                    const newDias = [...(value.prazo_dias || [30, 60, 90])];
                    newDias[i] = parseInt(e.target.value) || 30;
                    update({ prazo_dias: newDias });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {previewText && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
            {previewText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDefaults(tipo: string): Omit<PaymentConditions, 'forma_pagamento'> {
  switch (tipo) {
    case 'boleto_parcelado': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [30, 60, 90] };
    case 'cartao': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [] };
    case 'entrada_parcelas': return { parcelas_count: 3, entrada_percentual: 30, prazo_dias: [30, 60, 90] };
    case 'prazo_ddl': return { parcelas_count: 3, entrada_percentual: 0, prazo_dias: [30, 60, 90] };
    default: return { parcelas_count: 1, entrada_percentual: 0, prazo_dias: [] };
  }
}

function buildPreview(v: PaymentConditions, total: number): string {
  if (!v.forma_pagamento || total <= 0) return '';
  switch (v.forma_pagamento) {
    case 'pix': return `PIX à vista: ${brl(total)}`;
    case 'boleto_vista': return `Boleto à vista: ${brl(total)}`;
    case 'boleto_parcelado': {
      const parcela = total / v.parcelas_count;
      return `${v.parcelas_count}x de ${brl(parcela)} • Vencimentos: ${(v.prazo_dias || []).join('/')} dias`;
    }
    case 'cartao': return `${v.parcelas_count}x de ${brl(total / v.parcelas_count)} no cartão`;
    case 'entrada_parcelas': {
      const entrada = total * v.entrada_percentual / 100;
      const restante = total - entrada;
      const parcela = restante / v.parcelas_count;
      return `Entrada: ${brl(entrada)} (${v.entrada_percentual}%) + ${v.parcelas_count}x de ${brl(parcela)}`;
    }
    case 'prazo_ddl': {
      const parcela = total / (v.prazo_dias || [30, 60, 90]).length;
      return `${(v.prazo_dias || []).length}x de ${brl(parcela)} • DDL: ${(v.prazo_dias || []).join('/')} dias`;
    }
    default: return '';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/CondicoesPagamento.tsx
git commit -m "feat(comercial): CondicoesPagamento editor component"
```

### Task 3: CondicoesPagamentoView read-only component

**Files:**
- Create: `src/domains/comercial/components/CondicoesPagamentoView.tsx`

- [ ] **Step 1: Create read-only view component**

```tsx
// src/domains/comercial/components/CondicoesPagamentoView.tsx
import { CreditCard } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import type { PaymentConditions } from './CondicoesPagamento';

interface Props {
  conditions: PaymentConditions;
  valorTotal: number;
}

const LABELS: Record<string, string> = {
  pix: 'PIX à vista',
  boleto_vista: 'Boleto à vista',
  boleto_parcelado: 'Boleto parcelado',
  cartao: 'Cartão de crédito',
  entrada_parcelas: 'Entrada + parcelas',
  prazo_ddl: 'Prazo DDL',
};

export function CondicoesPagamentoView({ conditions, valorTotal }: Props) {
  if (!conditions.forma_pagamento) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={18} className="text-slate-500" />
        <h4 className="font-semibold text-sm text-slate-700">Condições de Pagamento</h4>
      </div>
      <p className="text-sm font-medium text-slate-900 mb-1">
        {LABELS[conditions.forma_pagamento] || conditions.forma_pagamento}
      </p>
      {conditions.forma_pagamento === 'entrada_parcelas' && (
        <div className="text-sm text-slate-600 space-y-0.5">
          <p>Entrada: {brl(valorTotal * conditions.entrada_percentual / 100)} ({conditions.entrada_percentual}%)</p>
          <p>{conditions.parcelas_count}x de {brl((valorTotal * (1 - conditions.entrada_percentual / 100)) / conditions.parcelas_count)}</p>
          {conditions.prazo_dias?.length > 0 && (
            <p className="text-slate-400">Vencimentos: {conditions.prazo_dias.join('/')} dias</p>
          )}
        </div>
      )}
      {(conditions.forma_pagamento === 'boleto_parcelado' || conditions.forma_pagamento === 'prazo_ddl') && (
        <div className="text-sm text-slate-600 space-y-0.5">
          <p>{conditions.parcelas_count}x de {brl(valorTotal / conditions.parcelas_count)}</p>
          <p className="text-slate-400">Vencimentos: {(conditions.prazo_dias || []).join('/')} dias</p>
        </div>
      )}
      {conditions.forma_pagamento === 'cartao' && (
        <p className="text-sm text-slate-600">{conditions.parcelas_count}x de {brl(valorTotal / conditions.parcelas_count)}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/CondicoesPagamentoView.tsx
git commit -m "feat(comercial): CondicoesPagamentoView read-only component"
```

### Task 4: Integrate CondicoesPagamento into OrcamentoEditorPage

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- Modify: `src/domains/comercial/services/orcamento.service.ts`

- [ ] **Step 1: Add payment state to OrcamentoEditorPage**

In `OrcamentoEditorPage.tsx`, add state for payment conditions and render the component below the items list (right panel or bottom section). Import `CondicoesPagamento` and add:

```tsx
import { CondicoesPagamento, type PaymentConditions } from '../components/CondicoesPagamento';

// Inside component, add state:
const [paymentConditions, setPaymentConditions] = useState<PaymentConditions>({
  forma_pagamento: orcamento?.forma_pagamento || '',
  parcelas_count: orcamento?.parcelas_count || 1,
  entrada_percentual: orcamento?.entrada_percentual || 0,
  prazo_dias: orcamento?.prazo_dias || [],
});

// In the JSX, add after items section:
<CondicoesPagamento
  value={paymentConditions}
  onChange={setPaymentConditions}
  valorTotal={totalGeral}
/>
```

- [ ] **Step 2: Update save function to include payment fields**

In `orcamento.service.ts`, modify the update function to accept and persist the structured payment fields:

```typescript
// Add to the update payload:
forma_pagamento: data.forma_pagamento,
parcelas_count: data.parcelas_count,
entrada_percentual: data.entrada_percentual,
prazo_dias: data.prazo_dias,
```

- [ ] **Step 3: Verify payment conditions save and load correctly**

Run the dev server, open an orcamento editor, select a payment type, save, reload, verify it persists.

- [ ] **Step 4: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx src/domains/comercial/services/orcamento.service.ts
git commit -m "feat(comercial): integrate CondicoesPagamento into editor + save structured fields"
```

---

## Chunk 3: Portal Domain — Services + Hooks

### Task 5: Portal service (fetch proposta by token)

**Files:**
- Create: `src/domains/portal/services/portal.service.ts`

- [ ] **Step 1: Create portal service**

```tsx
// src/domains/portal/services/portal.service.ts
import { supabase } from '@/integrations/supabase/client';

export interface PortalProposta {
  id: string;
  numero: string;
  status: string;
  valor_total: number;
  desconto_percentual: number;
  forma_pagamento: string;
  parcelas_count: number;
  prazo_dias: number[];
  entrada_percentual: number;
  validade: number;
  observacoes: string;
  aprovado_pelo_cliente: boolean;
  cliente: {
    nome_fantasia: string;
    contato_nome: string;
  };
  itens: Array<{
    id: string;
    descricao: string;
    especificacao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
}

export async function fetchPropostaByToken(token: string): Promise<PortalProposta> {
  const { data, error } = await supabase.rpc('portal_get_proposta', { p_token: token });
  if (error) throw new Error(error.message);
  return data as PortalProposta;
}

export async function aprovarProposta(token: string, comentario?: string): Promise<void> {
  const { error } = await supabase.rpc('portal_aprovar_proposta', {
    p_token: token,
    p_comentario: comentario || null,
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/domains/portal/services src/domains/portal/hooks src/domains/portal/pages src/domains/portal/components
git add src/domains/portal/services/portal.service.ts
git commit -m "feat(portal): portal.service.ts — fetch proposta by token + approve"
```

### Task 6: Tracking service

**Files:**
- Create: `src/domains/portal/services/tracking.service.ts`

- [ ] **Step 1: Create tracking service**

```tsx
// src/domains/portal/services/tracking.service.ts
import { supabase } from '@/integrations/supabase/client';

export async function registerView(params: {
  token: string;
  sessionId: string;
  deviceType: string;
  browser: string;
  os: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('portal_register_view', {
    p_token: params.token,
    p_session_id: params.sessionId,
    p_device_type: params.deviceType,
    p_browser: params.browser,
    p_os: params.os,
    p_geo_city: params.geoCity || null,
    p_geo_region: params.geoRegion || null,
    p_geo_country: params.geoCountry || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function sendHeartbeat(params: {
  token: string;
  viewId: string;
  durationSeconds: number;
  maxScrollDepth: number;
  clickedItems: Array<{ item_id: string; timestamp: number }>;
  downloadedPdf: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('portal_heartbeat', {
    p_token: params.token,
    p_view_id: params.viewId,
    p_duration_seconds: params.durationSeconds,
    p_max_scroll_depth: params.maxScrollDepth,
    p_clicked_items: JSON.stringify(params.clickedItems),
    p_downloaded_pdf: params.downloadedPdf,
  });
  // Heartbeat failures are non-critical — don't throw
  if (error) console.warn('Heartbeat failed:', error.message);
}

export async function resolveGeo(): Promise<{ city: string; region: string; country: string } | null> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-geo`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/portal/services/tracking.service.ts
git commit -m "feat(portal): tracking.service.ts — register view, heartbeat, geo"
```

### Task 7: Upload service

**Files:**
- Create: `src/domains/portal/services/portal-upload.service.ts`

- [ ] **Step 1: Create upload service**

```tsx
// src/domains/portal/services/portal-upload.service.ts
import { supabase } from '@/integrations/supabase/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['pdf', 'ai', 'cdr', 'eps', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'psd'];

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return 'Arquivo muito grande (máx 50MB)';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Tipo não aceito: .${ext}`;
  return null;
}

export async function uploadFileToPortal(params: {
  token: string;
  file: File;
  clientName: string;
}): Promise<{ id: string }> {
  const { token, file, clientName } = params;

  // 1. Upload to Supabase Storage (temporary)
  const path = `portal-uploads/${token}/${Date.now()}-${file.name}`;
  const { error: storageError } = await supabase.storage
    .from('proposta-uploads')
    .upload(path, file);

  if (storageError) throw new Error(`Upload falhou: ${storageError.message}`);

  // 2. Try OneDrive via Edge Function
  let onedriveFileId: string | null = null;
  let onedriveFileUrl: string | null = null;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', token);

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-upload-proposta`,
      {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      onedriveFileId = data.file_id;
      onedriveFileUrl = data.file_url;
    }
  } catch {
    console.warn('OneDrive upload failed, keeping in Storage as fallback');
  }

  // 3. Register attachment via RPC
  const { data, error } = await supabase.rpc('portal_register_attachment', {
    p_token: token,
    p_nome_arquivo: file.name,
    p_tipo_mime: file.type,
    p_tamanho_bytes: file.size,
    p_onedrive_file_id: onedriveFileId,
    p_onedrive_file_url: onedriveFileUrl,
    p_uploaded_by_name: clientName,
  });

  if (error) throw new Error(error.message);
  return { id: data as string };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/portal/services/portal-upload.service.ts
git commit -m "feat(portal): portal-upload.service.ts — upload with OneDrive + Storage fallback"
```

### Task 8: usePortalProposta hook

**Files:**
- Create: `src/domains/portal/hooks/usePortalProposta.ts`

- [ ] **Step 1: Create the hook**

```tsx
// src/domains/portal/hooks/usePortalProposta.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPropostaByToken, aprovarProposta } from '../services/portal.service';
import { showSuccess, showError } from '@/utils/toast';

export function usePortalProposta(token: string) {
  return useQuery({
    queryKey: ['portal-proposta', token],
    queryFn: () => fetchPropostaByToken(token),
    enabled: !!token,
    retry: 1,
    staleTime: 60_000,
  });
}

export function useAprovarProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, comentario }: { token: string; comentario?: string }) =>
      aprovarProposta(token, comentario),
    onSuccess: (_, { token }) => {
      queryClient.invalidateQueries({ queryKey: ['portal-proposta', token] });
      showSuccess('Orçamento aprovado com sucesso!');
    },
    onError: (err: Error) => {
      showError(err.message || 'Erro ao aprovar orçamento');
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/portal/hooks/usePortalProposta.ts
git commit -m "feat(portal): usePortalProposta hook — fetch + approve"
```

### Task 9: usePortalTracking hook

**Files:**
- Create: `src/domains/portal/hooks/usePortalTracking.ts`

- [ ] **Step 1: Create tracking hook with heartbeat**

```tsx
// src/domains/portal/hooks/usePortalTracking.ts
import { useEffect, useRef, useCallback } from 'react';
import { registerView, sendHeartbeat, resolveGeo } from '../services/tracking.service';

function getOrCreateSessionId(): string {
  const key = 'portal_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function parseDevice(): { deviceType: string; browser: string; os: string } {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { deviceType, browser, os };
}

export function usePortalTracking(token: string) {
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const scrollRef = useRef(0);
  const clicksRef = useRef<Array<{ item_id: string; timestamp: number }>>([]);
  const pdfRef = useRef(false);

  // Register view on mount
  useEffect(() => {
    if (!token) return;

    const init = async () => {
      const device = parseDevice();
      const geo = await resolveGeo();

      try {
        const viewId = await registerView({
          token,
          sessionId: getOrCreateSessionId(),
          ...device,
          geoCity: geo?.city,
          geoRegion: geo?.region,
          geoCountry: geo?.country,
        });
        viewIdRef.current = viewId;
      } catch (err) {
        console.warn('Failed to register view:', err);
      }
    };

    init();
  }, [token]);

  // Scroll tracking
  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrollTop / docHeight) * 100);
        scrollRef.current = Math.max(scrollRef.current, pct);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Heartbeat every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendHeartbeat({
        token,
        viewId: viewIdRef.current,
        durationSeconds: duration,
        maxScrollDepth: scrollRef.current,
        clickedItems: clicksRef.current,
        downloadedPdf: pdfRef.current,
      });
    }, 30_000);

    return () => clearInterval(interval);
  }, [token]);

  // Final beacon on unload
  useEffect(() => {
    const flush = () => {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      const body = JSON.stringify({
        p_token: token,
        p_view_id: viewIdRef.current,
        p_duration_seconds: duration,
        p_max_scroll_depth: scrollRef.current,
        p_clicked_items: JSON.stringify(clicksRef.current),
        p_downloaded_pdf: pdfRef.current,
      });
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/portal_heartbeat`,
        new Blob([body], { type: 'application/json' })
      );
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', flush);

    return () => {
      window.removeEventListener('beforeunload', flush);
    };
  }, [token]);

  const trackClick = useCallback((itemId: string) => {
    clicksRef.current.push({ item_id: itemId, timestamp: Date.now() });
  }, []);

  const trackPdfDownload = useCallback(() => {
    pdfRef.current = true;
  }, []);

  return { trackClick, trackPdfDownload };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/portal/hooks/usePortalTracking.ts
git commit -m "feat(portal): usePortalTracking hook — heartbeat, scroll, clicks, beacon"
```

---

## Chunk 4: Portal UI Components + Page

### Task 10: Portal UI components

**Files:**
- Create: `src/domains/portal/components/PortalHeader.tsx`
- Create: `src/domains/portal/components/PortalItemList.tsx`
- Create: `src/domains/portal/components/PortalApproval.tsx`
- Create: `src/domains/portal/components/PortalFileUpload.tsx`
- Create: `src/domains/portal/components/PortalConfirmation.tsx`

- [ ] **Step 1: Create PortalHeader**

Clean header with Croma logo and proposal number, no navigation menu.

```tsx
// src/domains/portal/components/PortalHeader.tsx
interface Props { numero: string }

export function PortalHeader({ numero }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-slate-800">Croma Print</span>
        </div>
        <span className="text-sm text-slate-500">Proposta {numero}</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create PortalItemList**

Formatted item list for the client, with click tracking callback.

```tsx
// src/domains/portal/components/PortalItemList.tsx
import { brl } from '@/shared/utils/format';
import type { PortalProposta } from '../services/portal.service';

interface Props {
  itens: PortalProposta['itens'];
  onItemClick?: (itemId: string) => void;
}

export function PortalItemList({ itens, onItemClick }: Props) {
  if (!itens?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Itens da Proposta</h3>
      {itens.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-2xl border border-slate-200 p-4 cursor-pointer hover:border-blue-300 transition-colors"
          onClick={() => onItemClick?.(item.id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-slate-800">{item.descricao}</p>
              {item.especificacao && (
                <p className="text-sm text-slate-500 mt-0.5">{item.especificacao}</p>
              )}
            </div>
            <p className="font-semibold text-slate-900 whitespace-nowrap ml-4">{brl(item.valor_total)}</p>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>Qtd: {item.quantidade}</span>
            <span>Unit: {brl(item.valor_unitario)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create PortalApproval**

Approve button with optional comment textarea.

```tsx
// src/domains/portal/components/PortalApproval.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';

interface Props {
  onApprove: (comentario?: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function PortalApproval({ onApprove, isLoading, disabled }: Props) {
  const [comentario, setComentario] = useState('');

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Aprovar Orçamento</h3>
      <Textarea
        placeholder="Comentários ou observações (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        className="rounded-xl"
        rows={3}
      />
      <Button
        onClick={() => onApprove(comentario || undefined)}
        disabled={disabled || isLoading}
        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 text-base font-semibold"
      >
        {isLoading ? (
          <><Loader2 className="animate-spin mr-2" size={18} /> Aprovando...</>
        ) : (
          <><Check size={18} className="mr-2" /> Aprovar Orçamento</>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create PortalFileUpload**

Drag-and-drop upload with validation and progress.

```tsx
// src/domains/portal/components/PortalFileUpload.tsx
import { useState, useCallback } from 'react';
import { Upload, FileIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { validateFile, uploadFileToPortal } from '../services/portal-upload.service';
import { showError } from '@/utils/toast';

interface Props {
  token: string;
  clientName: string;
}

interface FileState {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function PortalFileUpload({ token, clientName }: Props) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const validated = newFiles.map(file => {
      const err = validateFile(file);
      return { file, status: err ? 'error' as const : 'pending' as const, error: err || undefined };
    });

    setFiles(prev => [...prev, ...validated]);

    // Auto-upload valid files
    for (const item of validated) {
      if (item.status === 'error') continue;
      setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'uploading' } : f));
      try {
        await uploadFileToPortal({ token, file: item.file, clientName });
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'done' } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'error', error: err.message } : f));
        showError(`Falha ao enviar ${item.file.name}`);
      }
    }
  }, [token, clientName]);

  const removeFile = (file: File) => {
    setFiles(prev => prev.filter(f => f.file !== file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const uploading = files.some(f => f.status === 'uploading');

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Anexar Arquivos</h3>
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">Arraste arquivos aqui ou</p>
        <label className="text-sm text-blue-600 hover:underline cursor-pointer">
          clique para selecionar
          <input
            type="file" multiple className="hidden"
            accept=".pdf,.ai,.cdr,.eps,.jpg,.jpeg,.png,.tiff,.tif,.psd"
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.length) addFiles(selected);
              e.target.value = '';
            }}
          />
        </label>
        <p className="text-xs text-slate-400 mt-1">PDF, AI, CDR, EPS, JPG, PNG, TIFF, PSD — Máx 50MB</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-2 text-sm">
              <FileIcon size={16} className="text-slate-400 shrink-0" />
              <span className="truncate flex-1 text-slate-700">{f.file.name}</span>
              {f.status === 'uploading' && <Loader2 size={16} className="animate-spin text-blue-500" />}
              {f.status === 'done' && <CheckCircle2 size={16} className="text-green-500" />}
              {f.status === 'error' && <span className="text-xs text-red-500">{f.error}</span>}
              {f.status !== 'uploading' && (
                <button onClick={() => removeFile(f.file)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function hasUploadsInProgress(files: FileState[]): boolean {
  return files.some(f => f.status === 'uploading');
}
```

- [ ] **Step 5: Create PortalConfirmation**

```tsx
// src/domains/portal/components/PortalConfirmation.tsx
import { CheckCircle2 } from 'lucide-react';

export function PortalConfirmation() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 size={64} className="text-green-500 mb-4" />
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Orçamento Aprovado!</h2>
      <p className="text-slate-500 max-w-md">
        Sua aprovação foi registrada com sucesso. Nosso time comercial entrará em contato em breve para dar continuidade ao processo.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit all portal components**

```bash
git add src/domains/portal/components/
git commit -m "feat(portal): all portal UI components — header, items, approval, upload, confirmation"
```

### Task 11: PortalOrcamentoPage

**Files:**
- Create: `src/domains/portal/pages/PortalOrcamentoPage.tsx`

- [ ] **Step 1: Create the main portal page**

```tsx
// src/domains/portal/pages/PortalOrcamentoPage.tsx
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { brl } from '@/shared/utils/format';
import { usePortalProposta, useAprovarProposta } from '../hooks/usePortalProposta';
import { usePortalTracking } from '../hooks/usePortalTracking';
import { PortalHeader } from '../components/PortalHeader';
import { PortalItemList } from '../components/PortalItemList';
import { PortalApproval } from '../components/PortalApproval';
import { PortalFileUpload } from '../components/PortalFileUpload';
import { PortalConfirmation } from '../components/PortalConfirmation';
import { CondicoesPagamentoView } from '@/domains/comercial/components/CondicoesPagamentoView';

export default function PortalOrcamentoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: proposta, isLoading, error } = usePortalProposta(token || '');
  const aprovar = useAprovarProposta();
  const { trackClick, trackPdfDownload } = usePortalTracking(token || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-1">Link Inválido</h2>
          <p className="text-slate-500">Esta proposta não foi encontrada ou o link expirou.</p>
        </div>
      </div>
    );
  }

  if (proposta.aprovado_pelo_cliente) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PortalHeader numero={proposta.numero} />
        <PortalConfirmation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader numero={proposta.numero} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Saudação */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Olá, {proposta.cliente.contato_nome || proposta.cliente.nome_fantasia}!
          </h2>
          <p className="text-slate-500">Segue sua proposta comercial.</p>
        </div>

        {/* Itens */}
        <PortalItemList itens={proposta.itens} onItemClick={trackClick} />

        {/* Condições de Pagamento */}
        {proposta.forma_pagamento && (
          <CondicoesPagamentoView
            conditions={{
              forma_pagamento: proposta.forma_pagamento,
              parcelas_count: proposta.parcelas_count,
              entrada_percentual: proposta.entrada_percentual,
              prazo_dias: proposta.prazo_dias,
            }}
            valorTotal={proposta.valor_total}
          />
        )}

        {/* Total */}
        <div className="bg-blue-600 rounded-2xl p-6 text-center text-white">
          <p className="text-sm opacity-80 mb-1">Valor Total</p>
          <p className="text-3xl font-bold">{brl(proposta.valor_total)}</p>
          {proposta.desconto_percentual > 0 && (
            <p className="text-sm opacity-80 mt-1">Desconto de {proposta.desconto_percentual}% aplicado</p>
          )}
        </div>

        {/* Upload */}
        <PortalFileUpload
          token={token || ''}
          clientName={proposta.cliente.contato_nome || proposta.cliente.nome_fantasia}
        />

        {/* Aprovação */}
        <PortalApproval
          onApprove={(comentario) => aprovar.mutate({ token: token || '', comentario })}
          isLoading={aprovar.isPending}
          disabled={false}
        />

        {/* Observações */}
        {proposta.observacoes && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Observações</h4>
            <p className="text-sm text-slate-500 whitespace-pre-wrap">{proposta.observacoes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, import the portal page and add a public route OUTSIDE the `ProtectedRoute` wrapper:

```tsx
// At top of file, add lazy import:
const PortalOrcamentoPage = lazy(() => import('./domains/portal/pages/PortalOrcamentoPage'));

// Add route BEFORE the ProtectedRoute block:
<Route path="/p/:token" element={
  <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
    <PortalOrcamentoPage />
  </Suspense>
} />
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/portal/pages/PortalOrcamentoPage.tsx src/App.tsx
git commit -m "feat(portal): PortalOrcamentoPage + public route /p/:token"
```

---

## Chunk 5: Tracking Panel + Share Modal + Notifications

### Task 12: TrackingPanel (vendor-side thermometer)

**Files:**
- Create: `src/domains/comercial/components/TrackingPanel.tsx`

- [ ] **Step 1: Create TrackingPanel**

```tsx
// src/domains/comercial/components/TrackingPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Clock, MousePointerClick, Smartphone, Monitor, Tablet, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect } from 'react';

interface Props {
  propostaId: string;
}

interface ViewData {
  id: string;
  session_id: string;
  device_type: string;
  browser: string;
  duration_seconds: number;
  max_scroll_depth: number;
  downloaded_pdf: boolean;
  geo_city: string;
  geo_region: string;
  created_at: string;
}

function calcScore(views: ViewData[]): number {
  const totalViews = Math.min(views.length, 10);
  const totalDuration = views.reduce((s, v) => s + (v.duration_seconds || 0), 0);
  const maxScroll = Math.max(...views.map(v => v.max_scroll_depth || 0), 0);
  const hasPdf = views.some(v => v.downloaded_pdf);

  const raw = totalViews * 10 + Math.min(totalDuration, 600) / 6 + maxScroll + (hasPdf ? 20 : 0);
  return Math.min(Math.round(raw / 2.3), 100);
}

function getLabel(score: number): { text: string; color: string } {
  if (score < 25) return { text: 'Frio', color: 'text-blue-500' };
  if (score < 50) return { text: 'Morno', color: 'text-yellow-500' };
  if (score < 75) return { text: 'Quente', color: 'text-orange-500' };
  return { text: 'Muito Quente', color: 'text-red-500' };
}

function getBarColor(score: number): string {
  if (score < 25) return 'bg-blue-500';
  if (score < 50) return 'bg-yellow-500';
  if (score < 75) return 'bg-orange-500';
  return 'bg-red-500';
}

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'mobile') return <Smartphone size={14} />;
  if (type === 'tablet') return <Tablet size={14} />;
  return <Monitor size={14} />;
};

export function TrackingPanel({ propostaId }: Props) {
  const { data: views = [], refetch } = useQuery({
    queryKey: ['proposta-views', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_views')
        .select('*')
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ViewData[];
    },
    enabled: !!propostaId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`views-${propostaId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'proposta_views',
        filter: `proposta_id=eq.${propostaId}`,
      }, () => { refetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [propostaId, refetch]);

  if (views.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h4 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-2">
          <TrendingUp size={16} /> Tracking de Interesse
        </h4>
        <p className="text-sm text-slate-400">Nenhuma visualização ainda.</p>
      </div>
    );
  }

  const score = calcScore(views);
  const label = getLabel(score);
  const totalDuration = views.reduce((s, v) => s + (v.duration_seconds || 0), 0);
  const maxScroll = Math.max(...views.map(v => v.max_scroll_depth || 0));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
        <TrendingUp size={16} /> Tracking de Interesse
      </h4>

      {/* Thermometer */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-sm font-semibold ${label.color}`}>{label.text}</span>
          <span className="text-sm text-slate-500">{score}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <Eye size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{views.length}</p>
          <p className="text-xs text-slate-400">Aberturas</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <Clock size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{Math.round(totalDuration / 60)}min</p>
          <p className="text-xs text-slate-400">Tempo total</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
            <MousePointerClick size={14} />
          </div>
          <p className="text-lg font-bold text-slate-800">{maxScroll}%</p>
          <p className="text-xs text-slate-400">Scroll máx</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Visualizações</h5>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {views.slice(0, 10).map(v => (
            <div key={v.id} className="flex items-center gap-2 text-xs text-slate-500">
              <DeviceIcon type={v.device_type} />
              <span>{v.browser}</span>
              {v.geo_city && <span>• {v.geo_city}/{v.geo_region}</span>}
              <span className="ml-auto">{formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/TrackingPanel.tsx
git commit -m "feat(comercial): TrackingPanel — thermometer + metrics + timeline with Realtime"
```

### Task 13: SharePropostaModal

**Files:**
- Create: `src/domains/comercial/components/SharePropostaModal.tsx`

- [ ] **Step 1: Create SharePropostaModal with 4 send options**

This modal provides Link, WhatsApp, Email, and PDF buttons. Link activates the share_token, copies URL. WhatsApp opens wa.me. Email opens a sub-modal. PDF uses html2pdf.js.

```tsx
// src/domains/comercial/components/SharePropostaModal.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, MessageCircle, Mail, FileText, Copy, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  propostaId: string;
  propostaNumero: string;
  shareToken: string;
  clienteTelefone?: string;
  clienteEmail?: string;
}

export function SharePropostaModal({ open, onClose, propostaId, propostaNumero, shareToken, clienteTelefone, clienteEmail }: Props) {
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(clienteEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const portalUrl = `${window.location.origin}/p/${shareToken}`;

  const activateAndCopy = async () => {
    await supabase.from('propostas').update({
      share_token_active: true,
      share_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'enviada',
    }).eq('id', propostaId);

    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    showSuccess('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = async () => {
    await supabase.from('propostas').update({
      share_token_active: true,
      share_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'enviada',
    }).eq('id', propostaId);

    const msg = encodeURIComponent(
      `Olá! Segue o link da proposta ${propostaNumero} da Croma Print:\n\n${portalUrl}\n\nQualquer dúvida estou à disposição!`
    );
    const phone = (clienteTelefone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const sendEmail = async () => {
    if (!emailTo) return;
    setSendingEmail(true);
    try {
      await supabase.from('propostas').update({
        share_token_active: true,
        share_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'enviada',
      }).eq('id', propostaId);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email-proposta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ proposta_id: propostaId, destinatario_email: emailTo }),
      });
      if (!res.ok) throw new Error('Falha ao enviar email');
      showSuccess('Email enviado!');
      setShowEmailForm(false);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={activateAndCopy}>
            {copied ? <Check size={18} className="text-green-500" /> : <Link2 size={18} />}
            {copied ? 'Link copiado!' : 'Copiar Link'}
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={openWhatsApp}>
            <MessageCircle size={18} className="text-green-600" />
            Enviar por WhatsApp
          </Button>
          {!showEmailForm ? (
            <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => setShowEmailForm(true)}>
              <Mail size={18} className="text-blue-600" />
              Enviar por Email
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="email@cliente.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="rounded-xl"
              />
              <Button onClick={sendEmail} disabled={sendingEmail || !emailTo} className="bg-blue-600 hover:bg-blue-700">
                {sendingEmail ? <Loader2 className="animate-spin" size={16} /> : 'Enviar'}
              </Button>
            </div>
          )}
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => {
            showSuccess('Gerando PDF...');
            // html2pdf.js will be used here — implementation in a later step
            // For now, trigger browser print dialog
            window.print();
          }}>
            <FileText size={18} className="text-red-600" />
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/SharePropostaModal.tsx
git commit -m "feat(comercial): SharePropostaModal — link, WhatsApp, email, PDF"
```

### Task 14: Integrate TrackingPanel + ShareModal into OrcamentoViewPage

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx`

- [ ] **Step 1: Import and render TrackingPanel + ShareModal**

Add imports for `TrackingPanel` and `SharePropostaModal`. Add state for share modal. Render TrackingPanel in the sidebar/right column (or below main content). Add "Enviar" button that opens SharePropostaModal.

```tsx
import { TrackingPanel } from '../components/TrackingPanel';
import { SharePropostaModal } from '../components/SharePropostaModal';
import { CondicoesPagamentoView } from '../components/CondicoesPagamentoView';

// Add state:
const [shareOpen, setShareOpen] = useState(false);

// Add button in header actions:
<Button onClick={() => setShareOpen(true)} className="bg-blue-600 hover:bg-blue-700">
  <Send size={16} className="mr-2" /> Enviar Proposta
</Button>

// Add in sidebar or below content:
<TrackingPanel propostaId={orcamento.id} />

// Add CondicoesPagamentoView if payment conditions exist:
{orcamento.forma_pagamento && (
  <CondicoesPagamentoView
    conditions={{
      forma_pagamento: orcamento.forma_pagamento,
      parcelas_count: orcamento.parcelas_count,
      entrada_percentual: orcamento.entrada_percentual,
      prazo_dias: orcamento.prazo_dias,
    }}
    valorTotal={orcamento.total}
  />
)}

// Add modal:
<SharePropostaModal
  open={shareOpen}
  onClose={() => setShareOpen(false)}
  propostaId={orcamento.id}
  propostaNumero={orcamento.numero}
  shareToken={orcamento.share_token}
  clienteTelefone={orcamento.cliente?.telefone}
  clienteEmail={orcamento.cliente?.email}
/>
```

- [ ] **Step 2: Verify the integration compiles and renders**

Run dev server, navigate to an orcamento view page, verify TrackingPanel and Send button appear.

- [ ] **Step 3: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoViewPage.tsx
git commit -m "feat(comercial): integrate TrackingPanel + ShareModal into OrcamentoViewPage"
```

### Task 15: Notifications hook + badge

**Files:**
- Create: `src/hooks/useNotifications.ts`
- Create: `src/components/NotificationBadge.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (or equivalent layout component)

- [ ] **Step 1: Create useNotifications hook with Realtime**

```tsx
// src/hooks/useNotifications.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { showSuccess } from '@/utils/toast';

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  entidade_tipo: string;
  entidade_id: string;
  lida: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        const n = payload.new as Notification;
        showSuccess(n.titulo);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unreadCount = (query.data || []).filter(n => !n.lida).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ lida: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  return { ...query, unreadCount, markAsRead };
}
```

- [ ] **Step 2: Create NotificationBadge**

```tsx
// src/components/NotificationBadge.tsx
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBadge() {
  const { unreadCount } = useNotifications();
  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
}
```

- [ ] **Step 3: Add NotificationBadge to sidebar menu**

Find the sidebar component (likely `src/components/layout/Sidebar.tsx` or similar) and add the badge next to the "Orçamentos" menu item.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNotifications.ts src/components/NotificationBadge.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: notifications system — Realtime hook + badge in sidebar"
```

---

## Chunk 6: Edge Functions + Automation

### Task 16: resolve-geo Edge Function

**Files:**
- Create: `supabase/functions/resolve-geo/index.ts`

- [ ] **Step 1: Create Edge Function**

```typescript
// supabase/functions/resolve-geo/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || '0.0.0.0';

    // ipinfo.io free tier (50k/month, HTTPS)
    const IPINFO_TOKEN = Deno.env.get('IPINFO_TOKEN') || '';
    const url = IPINFO_TOKEN
      ? `https://ipinfo.io/${clientIp}?token=${IPINFO_TOKEN}`
      : `https://ipinfo.io/${clientIp}/json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('ipinfo.io request failed');
    const data = await res.json();

    return new Response(JSON.stringify({
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ city: '', region: '', country: '' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/resolve-geo/index.ts
git commit -m "feat(edge): resolve-geo Edge Function — ipinfo.io proxy"
```

### Task 17: enviar-email-proposta Edge Function

**Files:**
- Create: `supabase/functions/enviar-email-proposta/index.ts`

- [ ] **Step 1: Create Edge Function using Resend**

```typescript
// supabase/functions/enviar-email-proposta/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposta_id, destinatario_email, destinatario_nome } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch proposta data
    const { data: proposta, error } = await supabase
      .from('propostas')
      .select('numero, total, share_token, cliente:clientes(nome_fantasia, contato_nome)')
      .eq('id', proposta_id)
      .single();

    if (error || !proposta) throw new Error('Proposta não encontrada');

    const portalUrl = `${Deno.env.get('APP_URL') || 'https://crm-croma.vercel.app'}/p/${proposta.share_token}`;
    const clienteName = destinatario_nome || proposta.cliente?.contato_nome || proposta.cliente?.nome_fantasia || 'Cliente';

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'Croma Print <noreply@cromaprint.com.br>',
        to: destinatario_email,
        subject: `Proposta Comercial ${proposta.numero} — Croma Print`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1e40af;">Croma Print</h2>
            <p>Olá, ${clienteName}!</p>
            <p>Segue sua proposta comercial <strong>${proposta.numero}</strong>.</p>
            <p style="text-align:center;margin:32px 0;">
              <a href="${portalUrl}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver Proposta
              </a>
            </p>
            <p style="color:#64748b;font-size:14px;">Qualquer dúvida, entre em contato com seu vendedor.</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      throw new Error(errData.message || 'Resend API error');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/enviar-email-proposta/index.ts
git commit -m "feat(edge): enviar-email-proposta — send proposal email via Resend"
```

### Task 18: onedrive-upload-proposta Edge Function

**Files:**
- Create: `supabase/functions/onedrive-upload-proposta/index.ts`

- [ ] **Step 1: Create Edge Function**

Based on existing `onedrive-criar-pasta` pattern, create upload function using Composio API.

```typescript
// supabase/functions/onedrive-upload-proposta/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const token = formData.get('token') as string;

    if (!file || !token) throw new Error('file and token required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get proposta + client info for folder path
    const { data: proposta } = await supabase
      .from('propostas')
      .select('numero, cliente:clientes(nome_fantasia)')
      .eq('share_token', token)
      .single();

    if (!proposta) throw new Error('Proposta não encontrada');

    const clienteName = proposta.cliente?.nome_fantasia || 'cliente';
    const folderPath = `Croma/Clientes/${clienteName}/Proposta-${proposta.numero}`;

    // Upload to OneDrive via Composio
    const fileBytes = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));

    const composioRes = await fetch('https://backend.composio.dev/api/v2/actions/ONE_DRIVE_ONEDRIVE_UPLOAD_FILE/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('COMPOSIO_API_KEY')!,
      },
      body: JSON.stringify({
        connectedAccountId: Deno.env.get('ONEDRIVE_CONNECTED_ACCOUNT_ID'),
        input: {
          parent_folder_path: folderPath,
          file_name: file.name,
          content: base64Content,
        },
      }),
    });

    if (!composioRes.ok) throw new Error('OneDrive upload failed');
    const result = await composioRes.json();

    const fileId = result?.response_data?.id || '';
    const fileUrl = result?.response_data?.webUrl || '';

    return new Response(JSON.stringify({ file_id: fileId, file_url: fileUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/onedrive-upload-proposta/index.ts
git commit -m "feat(edge): onedrive-upload-proposta — upload client files to OneDrive via Composio"
```

### Task 19: Financial automation — generate parcelas

**Files:**
- Modify: `src/domains/financeiro/services/financeiro-automation.service.ts`

- [ ] **Step 1: Add gerarParcelas function**

Add to the existing file:

```typescript
export async function gerarParcelas(pedidoId: string): Promise<void> {
  // Fetch pedido + proposta payment conditions
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, valor_total, proposta_id, propostas(forma_pagamento, parcelas_count, prazo_dias, entrada_percentual)')
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) throw new Error('Pedido não encontrado');

  const proposta = pedido.propostas;
  if (!proposta?.forma_pagamento) return; // No structured payment conditions

  // Get conta_receber for this pedido
  const { data: conta } = await supabase
    .from('contas_receber')
    .select('id')
    .eq('pedido_id', pedidoId)
    .single();

  if (!conta) return;

  const valorTotal = pedido.valor_total;
  const { forma_pagamento, parcelas_count, prazo_dias, entrada_percentual } = proposta;

  const parcelas: Array<{
    conta_receber_id: string;
    numero_parcela: number;
    valor: number;
    data_vencimento: string;
    status: string;
  }> = [];

  const today = new Date();
  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  };

  if (forma_pagamento === 'pix' || forma_pagamento === 'boleto_vista') {
    parcelas.push({
      conta_receber_id: conta.id,
      numero_parcela: 1,
      valor: valorTotal,
      data_vencimento: addDays(today, forma_pagamento === 'pix' ? 1 : 3),
      status: 'a_vencer',
    });
  } else if (forma_pagamento === 'boleto_parcelado' || forma_pagamento === 'prazo_ddl') {
    const count = prazo_dias?.length || parcelas_count;
    const parcelaValor = valorTotal / count;
    for (let i = 0; i < count; i++) {
      parcelas.push({
        conta_receber_id: conta.id,
        numero_parcela: i + 1,
        valor: parcelaValor,
        data_vencimento: addDays(today, (prazo_dias || [])[i] || (i + 1) * 30),
        status: 'a_vencer',
      });
    }
  } else if (forma_pagamento === 'entrada_parcelas') {
    const entradaValor = valorTotal * (entrada_percentual || 30) / 100;
    const restante = valorTotal - entradaValor;
    const count = parcelas_count || 3;
    // Entrada
    parcelas.push({
      conta_receber_id: conta.id,
      numero_parcela: 0,
      valor: entradaValor,
      data_vencimento: addDays(today, 1),
      status: 'a_vencer',
    });
    // Parcelas restantes
    for (let i = 0; i < count; i++) {
      parcelas.push({
        conta_receber_id: conta.id,
        numero_parcela: i + 1,
        valor: restante / count,
        data_vencimento: addDays(today, (prazo_dias || [])[i] || (i + 1) * 30),
        status: 'a_vencer',
      });
    }
  } else if (forma_pagamento === 'cartao') {
    const count = parcelas_count || 3;
    for (let i = 0; i < count; i++) {
      parcelas.push({
        conta_receber_id: conta.id,
        numero_parcela: i + 1,
        valor: valorTotal / count,
        data_vencimento: addDays(today, (i + 1) * 30),
        status: 'a_vencer',
      });
    }
  }

  if (parcelas.length > 0) {
    const { error: insertError } = await supabase
      .from('parcelas_receber')
      .insert(parcelas);
    if (insertError) throw new Error(`Erro ao gerar parcelas: ${insertError.message}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/financeiro/services/financeiro-automation.service.ts
git commit -m "feat(financeiro): gerarParcelas — auto-generate payment installments from conditions"
```

---

## Chunk 7: Install Dependencies + Final Integration

### Task 20: Install npm dependencies

- [ ] **Step 1: Install html2pdf.js and ua-parser-js**

```bash
npm install html2pdf.js ua-parser-js
npm install -D @types/ua-parser-js
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2pdf.js and ua-parser-js dependencies"
```

### Task 21: Build verification

- [ ] **Step 1: Run build to check for TypeScript errors**

```bash
npx tsc --noEmit
```

Fix any type errors that appear.

- [ ] **Step 2: Run vite build**

```bash
npx vite build
```

Fix any build errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from portal integration"
```

### Task 22: Execute migration on Supabase

- [ ] **Step 1: Copy migration SQL and execute in Supabase SQL Editor**

Open `https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` and paste the contents of `supabase/migrations/020_portal_tracking_pagamento.sql`.

- [ ] **Step 2: Verify tables and RPCs were created**

Run in SQL Editor:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('proposta_views', 'proposta_attachments', 'notifications');
SELECT proname FROM pg_proc WHERE proname LIKE 'portal_%';
```

Expected: 3 tables + 5 functions.

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | Task 1 | Database migration (tables, RPCs, RLS, Realtime) |
| 2 | Tasks 2-4 | Payment conditions (editor + view + integration) |
| 3 | Tasks 5-9 | Portal services + hooks (fetch, tracking, upload) |
| 4 | Tasks 10-11 | Portal UI components + page + route |
| 5 | Tasks 12-15 | Tracking panel + share modal + notifications |
| 6 | Tasks 16-19 | Edge Functions (geo, email, OneDrive) + financial automation |
| 7 | Tasks 20-22 | Dependencies, build verification, migration execution |

**Total:** 22 tasks, ~7 chunks. Tasks within each chunk are sequential. Chunks 2-6 can be parallelized by independent subagents (they share only the migration from Chunk 1).
