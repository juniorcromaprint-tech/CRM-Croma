// ============================================================================
// AUTOMAÇÃO PAGE — Croma Print ERP/CRM
// Dashboard de automação: cobranças, fila produção, transições, regras
// Fase 3 — Automação de Fluxo
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Banknote,
  Factory,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Send,
  Mail,
  MessageSquare,
  Shield,
  Activity,
} from "lucide-react";
import { brl, formatDate } from "@/shared/utils/format";
import { showSuccess, showError } from "@/utils/toast";

// ── Types ────────────────────────────────────────────────────────────

interface CobrancaRecord {
  id: string;
  cliente_nome: string;
  nivel: number;
  canal: string;
  status: string;
  dias_atraso: number;
  valor_original: number;
  saldo: number;
  data_vencimento: string;
  pedido_numero: string | null;
  enviado_em: string | null;
  created_at: string;
  erro_mensagem: string | null;
}

interface RuleStatus {
  id: string;
  modulo: string;
  tipo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  prioridade: number;
  last_run: string | null;
  run_count: number;
  last_error: string | null;
}

interface FilaProducao {
  id: string;
  numero: string;
  status: string;
  prioridade: number;
  maquina_nome: string | null;
  setor_atual: string | null;
  pedido_numero: string | null;
  cliente_nome: string | null;
  prazo_interno: string | null;
  atrasada: boolean;
  dias_restantes: number;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  tempo_estimado_min: number | null;
}

interface SystemEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  created_at: string;
}

// ── Queries ──────────────────────────────────────────────────────────

function useCobrancas() {
  return useQuery({
    queryKey: ["automacao-cobrancas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_automacao_cobrancas" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CobrancaRecord[];
    },
    refetchInterval: 60_000,
  });
}

function useRulesStatus() {
  return useQuery({
    queryKey: ["automacao-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_automacao_rules_status" as any)
        .select("*")
        .order("modulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RuleStatus[];
    },
    refetchInterval: 60_000,
  });
}

function useFilaProducao() {
  return useQuery({
    queryKey: ["automacao-fila-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_fila_producao" as any)
        .select("*")
        .in("status", ["pendente", "criada", "liberada", "em_producao"])
        .limit(30);
      if (error) throw error;
      return (data ?? []) as FilaProducao[];
    },
    refetchInterval: 60_000,
  });
}

function useRecentEvents() {
  return useQuery({
    queryKey: ["automacao-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SystemEvent[];
    },
    refetchInterval: 30_000,
  });
}

// ── Page Component ───────────────────────────────────────────────────

export default function AutomacaoPage() {
  const cobrancas = useCobrancas();
  const rules = useRulesStatus();
  const fila = useFilaProducao();
  const events = useRecentEvents();
  const [triggerLoading, setTriggerLoading] = useState(false);

  const triggerCron = async () => {
    setTriggerLoading(true);
    try {
      const { error } = await supabase.functions.invoke("agent-cron-loop");
      if (error) throw error;
      showSuccess("Cron executado com sucesso");
      cobrancas.refetch();
      rules.refetch();
      events.refetch();
    } catch (err) {
      showError("Erro ao executar cron: " + (err as Error).message);
    } finally {
      setTriggerLoading(false);
    }
  };

  const activeRules = rules.data?.filter(r => r.ativo) ?? [];
  const lastCronEvent = events.data?.find(e => e.event_type === "cron_loop_executed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot size={28} className="text-blue-600" />
            Central de Automação
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Motor de regras, cobranças automáticas, PCP e transições
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastCronEvent && (
            <span className="text-xs text-slate-400">
              Último cron:{" "}
              {formatDistanceToNow(new Date(lastCronEvent.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          )}
          <Button
            onClick={triggerCron}
            disabled={triggerLoading}
            variant="outline"
            size="sm"
          >
            {triggerLoading ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <RefreshCw size={16} className="mr-2" />
            )}
            Executar agora
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          icon={<Shield size={20} className="text-blue-500" />}
          label="Regras ativas"
          value={`${activeRules.length}`}
          sub={`${activeRules.filter(r => r.last_run).length} executadas`}
        />
        <KPICard
          icon={<Banknote size={20} className="text-amber-500" />}
          label="Cobranças (7d)"
          value={String(cobrancas.data?.filter(c =>
            new Date(c.created_at) > new Date(Date.now() - 7 * 86400000)
          ).length ?? 0)}
          sub={`${cobrancas.data?.filter(c => c.status === "enviado").length ?? 0} enviadas`}
        />
        <KPICard
          icon={<Factory size={20} className="text-indigo-500" />}
          label="OPs na fila"
          value={String(fila.data?.length ?? 0)}
          sub={`${fila.data?.filter(f => f.atrasada).length ?? 0} atrasadas`}
        />
        <KPICard
          icon={<Activity size={20} className="text-green-500" />}
          label="Eventos (24h)"
          value={String(
            events.data?.filter(e =>
              new Date(e.created_at) > new Date(Date.now() - 86400000)
            ).length ?? 0
          )}
          sub="system events"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cobrancas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cobrancas" className="gap-1">
            <Banknote size={14} /> Cobranças
          </TabsTrigger>
          <TabsTrigger value="producao" className="gap-1">
            <Factory size={14} /> Fila Produção
          </TabsTrigger>
          <TabsTrigger value="eventos" className="gap-1">
            <ArrowRightLeft size={14} /> Eventos
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-1">
            <Bot size={14} /> Regras
          </TabsTrigger>
        </TabsList>

        {/* ── Cobranças ── */}
        <TabsContent value="cobrancas">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Cobranças Automáticas</CardTitle>
            </CardHeader>
            <CardContent>
              {cobrancas.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : !cobrancas.data?.length ? (
                <EmptyState
                  icon={<Banknote size={40} className="text-slate-300" />}
                  title="Nenhuma cobrança registrada"
                  desc="As cobranças automáticas aparecerão aqui quando houver títulos vencidos"
                />
              ) : (
                <div className="space-y-3">
                  {cobrancas.data.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <NivelBadge nivel={c.nivel} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {c.cliente_nome}
                          </p>
                          <p className="text-xs text-slate-500">
                            {brl(c.saldo || c.valor_original)} · Vencido há{" "}
                            {c.dias_atraso}d
                            {c.pedido_numero && ` · Pedido ${c.pedido_numero}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <CanalIcon canal={c.canal} />
                        <StatusBadge status={c.status} />
                        <span className="text-xs text-slate-400">
                          {c.enviado_em
                            ? formatDistanceToNow(new Date(c.enviado_em), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fila Produção ── */}
        <TabsContent value="producao">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Fila de Produção (PCP)</CardTitle>
            </CardHeader>
            <CardContent>
              {fila.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : !fila.data?.length ? (
                <EmptyState
                  icon={<Factory size={40} className="text-slate-300" />}
                  title="Nenhuma OP na fila"
                  desc="As ordens de produção sequenciadas aparecerão aqui"
                />
              ) : (
                <div className="space-y-3">
                  {fila.data.map((op, idx) => (
                    <div
                      key={op.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        op.atrasada
                          ? "bg-red-50 border-red-200"
                          : op.dias_restantes <= 3
                          ? "bg-amber-50 border-amber-200"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-slate-400 w-6 text-center">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {op.numero}
                            {op.cliente_nome && ` — ${op.cliente_nome}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {op.maquina_nome ?? "Sem máquina"} ·{" "}
                            {op.setor_atual ?? "—"} ·{" "}
                            {op.tempo_estimado_min
                              ? `${Math.round(op.tempo_estimado_min / 60)}h`
                              : "—"}
                            {op.pedido_numero && ` · Ped. ${op.pedido_numero}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {op.atrasada ? (
                          <Badge variant="destructive" className="text-xs">
                            Atrasada
                          </Badge>
                        ) : op.dias_restantes <= 3 ? (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">
                            {op.dias_restantes}d
                          </Badge>
                        ) : op.prazo_interno ? (
                          <Badge variant="secondary" className="text-xs">
                            {op.dias_restantes}d
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-xs">
                          P{op.prioridade ?? 0}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Eventos ── */}
        <TabsContent value="eventos">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Eventos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {events.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : !events.data?.length ? (
                <EmptyState
                  icon={<ArrowRightLeft size={40} className="text-slate-300" />}
                  title="Nenhum evento registrado"
                  desc="Eventos de automação aparecerão aqui"
                />
              ) : (
                <div className="space-y-2">
                  {events.data.map(e => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg"
                    >
                      <EventIcon type={e.event_type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">
                            {formatEventType(e.event_type)}
                          </span>
                          {e.payload?.pedido_numero &&
                            ` · Pedido ${e.payload.pedido_numero}`}
                          {e.payload?.cliente_nome &&
                            ` · ${e.payload.cliente_nome}`}
                          {e.payload?.rule_name &&
                            ` · ${e.payload.rule_name}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(e.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}{" "}
                          · {e.entity_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Regras ── */}
        <TabsContent value="regras">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Agent Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {rules.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.data?.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            r.ativo ? "bg-green-500" : "bg-slate-300"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {r.nome}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {r.descricao}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {r.modulo}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {r.run_count}×
                        </span>
                        {r.last_run ? (
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(r.last_run), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">nunca</span>
                        )}
                        {r.last_error && (
                          <AlertTriangle
                            size={14}
                            className="text-red-400"
                            title={r.last_error}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function KPICard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500">{label}</span></div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function NivelBadge({ nivel }: { nivel: number }) {
  const config: Record<number, { label: string; cls: string }> = {
    1: { label: "D+1", cls: "bg-green-100 text-green-700" },
    2: { label: "D+3", cls: "bg-yellow-100 text-yellow-700" },
    3: { label: "D+7", cls: "bg-orange-100 text-orange-700" },
    4: { label: "D+15", cls: "bg-red-100 text-red-700" },
    5: { label: "D+30", cls: "bg-red-200 text-red-800" },
  };
  const c = config[nivel] ?? { label: `N${nivel}`, cls: "bg-slate-100 text-slate-600" };
  return <Badge className={`${c.cls} text-xs`}>{c.label}</Badge>;
}

function CanalIcon({ canal }: { canal: string }) {
  if (canal === "whatsapp") return <MessageSquare size={14} className="text-green-500" />;
  if (canal === "email") return <Mail size={14} className="text-blue-500" />;
  if (canal === "telegram") return <Send size={14} className="text-sky-500" />;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "enviado") return <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle2 size={10} className="mr-1" />Enviado</Badge>;
  if (status === "erro") return <Badge variant="destructive" className="text-xs"><XCircle size={10} className="mr-1" />Erro</Badge>;
  return <Badge variant="secondary" className="text-xs"><Clock size={10} className="mr-1" />{status}</Badge>;
}

function EventIcon({ type }: { type: string }) {
  if (type.includes("production")) return <Factory size={16} className="text-indigo-400 mt-0.5" />;
  if (type.includes("installation")) return <ArrowRightLeft size={16} className="text-emerald-400 mt-0.5" />;
  if (type.includes("payment")) return <Banknote size={16} className="text-amber-400 mt-0.5" />;
  if (type.includes("rule")) return <Bot size={16} className="text-blue-400 mt-0.5" />;
  if (type.includes("cron")) return <RefreshCw size={16} className="text-slate-400 mt-0.5" />;
  if (type.includes("alert")) return <AlertTriangle size={16} className="text-orange-400 mt-0.5" />;
  return <Activity size={16} className="text-slate-400 mt-0.5" />;
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    cron_loop_executed: "Cron executado",
    rule_executed: "Regra executada",
    alert_generated: "Alerta gerado",
    production_completed_transition: "Produção concluída",
    installation_order_auto_created: "OI criada automaticamente",
    production_completed: "Produção finalizada",
    payment_received: "Pagamento recebido",
    daily_summary: "Resumo diário",
    daily_closing: "Fechamento diário",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div className="mx-auto mb-3">{icon}</div>
      <h3 className="font-semibold text-slate-600">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </div>
  );
}
