// ============================================================================
// WEBHOOKS PAGE — Configuração de webhooks para eventos do sistema
// Rota: /admin/webhooks
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Webhook,
  Plus,
  Trash2,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ToggleLeft,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookConfig {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  secret: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENTOS_DISPONIVEIS = [
  { value: 'pedido.criado', label: 'Pedido criado', group: 'Pedidos' },
  { value: 'pedido.concluido', label: 'Pedido concluído', group: 'Pedidos' },
  { value: 'pedido.cancelado', label: 'Pedido cancelado', group: 'Pedidos' },
  { value: 'proposta.aprovada', label: 'Proposta aprovada', group: 'Propostas' },
  { value: 'proposta.criada', label: 'Proposta criada', group: 'Propostas' },
  { value: 'pagamento.recebido', label: 'Pagamento recebido', group: 'Financeiro' },
  { value: 'lead.criado', label: 'Lead criado', group: 'Comercial' },
];

const QUERY_KEY = 'webhook-configs';

// ─── Hook ────────────────────────────────────────────────────────────────────

function useWebhooks() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WebhookConfig[];
    },
  });
}

function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('webhook_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      showSuccess('Webhook removido');
    },
    onError: () => showError('Erro ao remover webhook'),
  });
}

function useToggleWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from('webhook_configs')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: () => showError('Erro ao atualizar webhook'),
  });
}

function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<WebhookConfig, 'id' | 'created_at'>) => {
      const { error } = await (supabase as any)
        .from('webhook_configs')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      showSuccess('Webhook criado com sucesso!');
    },
    onError: () => showError('Erro ao criar webhook'),
  });
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  nome: string;
  url: string;
  eventos: string[];
  secret: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: '',
  url: '',
  eventos: [],
  secret: '',
  ativo: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname;
    const maskedPath = path.length > 15 ? path.slice(0, 8) + '…' + path.slice(-5) : path;
    return `${u.protocol}//${host}${maskedPath}`;
  } catch {
    return url.slice(0, 30) + (url.length > 30 ? '…' : '');
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { data: webhooks = [], isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const toggleWebhook = useToggleWebhook();

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'error'>>({});

  const handleCreate = async () => {
    if (!form.nome.trim()) { showError('Informe o nome do webhook'); return; }
    if (!form.url.trim()) { showError('Informe a URL do webhook'); return; }
    try { new URL(form.url); } catch { showError('URL inválida'); return; }
    if (form.eventos.length === 0) { showError('Selecione pelo menos um evento'); return; }

    await createWebhook.mutateAsync({
      nome: form.nome.trim(),
      url: form.url.trim(),
      eventos: form.eventos,
      ativo: form.ativo,
      secret: form.secret.trim() || null,
    });
    setForm(EMPTY_FORM);
    setShowDialog(false);
  };

  const handleTest = async (webhook: WebhookConfig) => {
    setTestingId(webhook.id);
    try {
      const payload = {
        evento: 'teste',
        webhook_id: webhook.id,
        timestamp: new Date().toISOString(),
        dados: { mensagem: 'Teste de webhook — Croma Print ERP', source: 'crm-croma.vercel.app' },
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        headers['X-Webhook-Secret'] = webhook.secret;
      }

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setTestResults((prev) => ({ ...prev, [webhook.id]: 'ok' }));
        showSuccess(`Webhook testado com sucesso! Status: ${res.status}`);
      } else {
        setTestResults((prev) => ({ ...prev, [webhook.id]: 'error' }));
        showError(`Webhook retornou status ${res.status}`);
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [webhook.id]: 'error' }));
      showError('Não foi possível alcançar a URL do webhook');
    } finally {
      setTestingId(null);
      // Limpar resultado após 5s
      setTimeout(() => {
        setTestResults((prev) => {
          const n = { ...prev };
          delete n[webhook.id];
          return n;
        });
      }, 5000);
    }
  };

  const toggleEvento = (evento: string) => {
    setForm((f) => ({
      ...f,
      eventos: f.eventos.includes(evento)
        ? f.eventos.filter((e) => e !== evento)
        : [...f.eventos, evento],
    }));
  };

  // Group events by category
  const grupos = Array.from(new Set(EVENTOS_DISPONIVEIS.map((e) => e.group)));

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Webhook size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Webhooks</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure destinos externos para eventos do sistema
            </p>
          </div>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
          onClick={() => { setForm(EMPTY_FORM); setShowDialog(true); }}
        >
          <Plus size={16} /> Novo Webhook
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Webhook size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum webhook configurado</h3>
          <p className="text-sm text-slate-400 mt-1">
            Crie um webhook para receber notificações de eventos do sistema em sistemas externos.
          </p>
          <Button
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
            onClick={() => { setForm(EMPTY_FORM); setShowDialog(true); }}
          >
            <Plus size={14} /> Criar primeiro webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <Card key={wh.id} className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Nome + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{wh.nome}</p>
                      <Badge
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          wh.ativo
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {wh.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {testResults[wh.id] === 'ok' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 size={12} /> Teste OK
                        </span>
                      )}
                      {testResults[wh.id] === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <XCircle size={12} /> Falhou
                        </span>
                      )}
                    </div>

                    {/* URL mascarada */}
                    <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                      {maskUrl(wh.url)}
                    </p>

                    {/* Eventos */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {wh.eventos.map((ev) => (
                        <Badge
                          key={ev}
                          variant="secondary"
                          className="text-xs h-5 bg-blue-50 text-blue-700 border-blue-200 px-2"
                        >
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle ativo/inativo */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      title={wh.ativo ? 'Desativar' : 'Ativar'}
                      onClick={() => toggleWebhook.mutate({ id: wh.id, ativo: !wh.ativo })}
                    >
                      <ToggleLeft size={15} className={wh.ativo ? 'text-emerald-600' : 'text-slate-400'} />
                    </Button>

                    {/* Testar */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-8 gap-1.5 text-xs"
                      disabled={testingId === wh.id || !wh.ativo}
                      onClick={() => handleTest(wh)}
                    >
                      {testingId === wh.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Testar
                    </Button>

                    {/* Remover */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50"
                      title="Remover webhook"
                      onClick={() => {
                        if (confirm(`Remover webhook "${wh.nome}"?`)) {
                          deleteWebhook.mutate(wh.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog — criar webhook */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook size={18} className="text-blue-600" />
              Novo Webhook
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: ERP Externo, CRM HubSpot, Slack notificações"
                className="rounded-xl"
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label className="text-sm">URL *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://seu-sistema.com/webhook/croma"
                className="rounded-xl font-mono text-sm"
              />
            </div>

            {/* Secret */}
            <div className="space-y-1.5">
              <Label className="text-sm">Secret (opcional)</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={form.secret}
                  onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                  placeholder="Token secreto enviado no header X-Webhook-Secret"
                  className="rounded-xl pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Eventos */}
            <div className="space-y-2">
              <Label className="text-sm">Eventos *</Label>
              <Card className="rounded-xl border-slate-200">
                <CardContent className="p-4 space-y-4">
                  {grupos.map((grupo) => (
                    <div key={grupo}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {grupo}
                      </p>
                      <div className="space-y-2">
                        {EVENTOS_DISPONIVEIS.filter((e) => e.group === grupo).map((ev) => (
                          <div key={ev.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`ev-${ev.value}`}
                              checked={form.eventos.includes(ev.value)}
                              onCheckedChange={() => toggleEvento(ev.value)}
                            />
                            <label
                              htmlFor={`ev-${ev.value}`}
                              className="text-sm text-slate-700 cursor-pointer select-none"
                            >
                              {ev.label}
                              <span className="ml-1.5 text-xs text-slate-400 font-mono">
                                ({ev.value})
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: !!v }))}
              />
              <label htmlFor="ativo" className="text-sm text-slate-700 cursor-pointer select-none">
                Ativar webhook imediatamente
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
              onClick={handleCreate}
              disabled={createWebhook.isPending}
            >
              {createWebhook.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
