// ============================================================================
// ADMIN / IA HEALTH — observabilidade da IA da Croma
// Sprint de Estabilização 2026-04-24 — ETAPA 3
// Mostra saúde do cron, regras, cobranças, ponte MCP, memory layer, WhatsApp
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  Zap,
} from "lucide-react";

interface IaHealth {
  cron_last_run: string | null;
  cron_duration_ms: number | null;
  cron_rules_processed: number | null;
  cron_actions_success: number | null;
  cron_actions_failed: number | null;
  cron_rules_skipped: number | null;
  cron_minutos_atras: string | null;
  rules_24h_total: number;
  rule_dominante: string | null;
  rule_maior_volume: number;
  loop_anormal_vermelho: boolean;
  loop_anormal_amarelo: boolean;
  cobrancas_7d: number;
  cobrancas_enviadas_7d: number;
  cobrancas_total: number;
  ponte_requests_total: number;
  ponte_requests_pending: number;
  ponte_responses_total: number;
  ponte_ultimo_request: string | null;
  funcoes_usadas_30d: number;
  total_chamadas_30d: number;
  padroes_total: number;
  padroes_confiaveis: number;
  memory_ultimo_update: string | null;
  conversas_ativas: number;
  msgs_recebidas_7d: number;
  wpp_ultima_msg: string | null;
  computed_at: string;
}

interface EdgeUso {
  function_name: string;
  chamadas_30d: number;
  erros_30d: number;
  custo_usd_30d: number;
  ultima_chamada: string;
}

interface RuleExec {
  rule_name: string;
  action_type: string | null;
  modulo: string;
  execucoes: number;
  saude_loop: "verde" | "amarelo" | "vermelho";
}

function fmtAgo(iso: string | null): string {
  if (!iso) return "nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <Badge
      className={
        ok
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
          : "bg-red-100 text-red-700 hover:bg-red-100"
      }
    >
      {ok ? <CheckCircle2 size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
      {label}
    </Badge>
  );
}

export default function AdminIaHealthPage() {
  // Health consolidado
  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ["vw_ia_health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_ia_health" as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as IaHealth;
    },
    refetchInterval: 30_000,
  });

  // Uso por Edge Function
  const { data: edgeUso } = useQuery({
    queryKey: ["vw_ia_health_edge_uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_ia_health_edge_uso" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as EdgeUso[];
    },
    refetchInterval: 30_000,
  });

  // Execuções de regras 24h
  const { data: rules24h } = useQuery({
    queryKey: ["vw_ia_health_rules_24h"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_ia_health_rules_24h" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as RuleExec[];
    },
    refetchInterval: 30_000,
  });

  if (loadingHealth) {
    return (
      <div className="p-8 text-slate-500">Carregando saúde da IA…</div>
    );
  }

  if (!health) {
    return (
      <div className="p-8 text-red-600">
        Não foi possível carregar <code>vw_ia_health</code>.
      </div>
    );
  }

  const cronMinAgo = Number(health.cron_minutos_atras ?? 0);
  const cronHealthy = cronMinAgo < 60; // cron deveria rodar a cada 30min; >60min = problema
  const ponteAtiva = (health.ponte_responses_total ?? 0) > 0;
  const wppMinAgo = health.wpp_ultima_msg
    ? (Date.now() - new Date(health.wpp_ultima_msg).getTime()) / 60000
    : null;
  const wppAtivo = wppMinAgo !== null && wppMinAgo < 60 * 24 * 3; // 3 dias

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600" /> Saúde da IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Observabilidade dos agentes, motor de regras e ponte MCP. Atualizado
            {" "}
            {fmtAgo(health.computed_at)}.
          </p>
        </div>
      </div>

      {/* Status overall */}
      <div className="flex flex-wrap gap-2">
        <StatusPill ok={cronHealthy} label={`Cron ${cronHealthy ? "saudável" : "atrasado"}`} />
        <StatusPill ok={!health.loop_anormal_vermelho} label={health.loop_anormal_vermelho ? "Loop anormal" : "Sem loops"} />
        <StatusPill ok={health.cobrancas_enviadas_7d > 0 || health.cobrancas_total > 0} label={`${health.cobrancas_enviadas_7d} cobranças 7d`} />
        <StatusPill ok={ponteAtiva} label={ponteAtiva ? "Ponte MCP ativa" : "Ponte MCP dormida"} />
        <StatusPill ok={wppAtivo} label={wppAtivo ? "WhatsApp ativo" : "WhatsApp sem tráfego"} />
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cron */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Zap size={16} className="text-blue-600" /> Último cron
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtAgo(health.cron_last_run)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {health.cron_duration_ms ? `${(health.cron_duration_ms / 1000).toFixed(1)}s` : "—"} ·
              {" "}{health.cron_rules_processed ?? 0} regras processadas
            </div>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Sucesso:</span><span className="font-semibold text-emerald-600">{health.cron_actions_success ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Falhas:</span><span className={`font-semibold ${(health.cron_actions_failed ?? 0) > 0 ? "text-red-600" : "text-slate-400"}`}>{health.cron_actions_failed ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Skipped (dedup):</span><span className="font-semibold text-slate-700">{health.cron_rules_skipped ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Regras 24h */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Bot size={16} className="text-blue-600" /> Regras 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.rules_24h_total}</div>
            <div className="text-xs text-slate-500 mt-1">
              tipos distintos executados
            </div>
            <div className="mt-3 text-xs">
              <div className="text-slate-500">Mais disparada:</div>
              <div className="font-mono text-slate-700 truncate">{health.rule_dominante ?? "—"}</div>
              <div className="mt-1">
                <Badge
                  className={
                    health.loop_anormal_vermelho
                      ? "bg-red-100 text-red-700"
                      : health.loop_anormal_amarelo
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }
                >
                  {health.rule_maior_volume} execs
                  {health.loop_anormal_vermelho && " · LOOP"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cobranças 7d */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <DollarSign size={16} className="text-blue-600" /> Cobranças 7d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.cobrancas_7d}</div>
            <div className="text-xs text-slate-500 mt-1">
              geradas nos últimos 7 dias
            </div>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Enviadas:</span><span className="font-semibold text-emerald-600">{health.cobrancas_enviadas_7d}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total (história):</span><span className="font-semibold text-slate-700">{health.cobrancas_total}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Ponte MCP */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Brain size={16} className="text-blue-600" /> Ponte MCP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.ponte_requests_total}</div>
            <div className="text-xs text-slate-500 mt-1">
              requests na história
            </div>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Pending:</span><span className="font-semibold">{health.ponte_requests_pending}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Responses:</span><span className={`font-semibold ${ponteAtiva ? "text-emerald-600" : "text-red-600"}`}>{health.ponte_responses_total}</span></div>
              <div className="text-slate-400 italic text-[10px]">Último: {fmtAgo(health.ponte_ultimo_request)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Edge Functions 30d */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Zap size={16} className="text-blue-600" /> Edge Functions 30d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.total_chamadas_30d}</div>
            <div className="text-xs text-slate-500 mt-1">
              chamadas registradas em ai_logs
            </div>
            <div className="mt-3 text-xs">
              <span className="text-slate-500">Funções distintas:</span>{" "}
              <span className="font-semibold">{health.funcoes_usadas_30d}</span>
            </div>
          </CardContent>
        </Card>

        {/* Memory Layer */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Brain size={16} className="text-blue-600" /> Memory Layer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.padroes_total}</div>
            <div className="text-xs text-slate-500 mt-1">
              padrões detectados · {health.padroes_confiaveis} confiáveis (≥50)
            </div>
            <div className="mt-3 text-xs">
              <span className="text-slate-500">Último update:</span>{" "}
              <span className="font-semibold">{fmtAgo(health.memory_ultimo_update)}</span>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-600" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.msgs_recebidas_7d}</div>
            <div className="text-xs text-slate-500 mt-1">
              mensagens recebidas 7d
            </div>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Conversas ativas:</span><span className="font-semibold">{health.conversas_ativas}</span></div>
              <div className="text-slate-400 italic text-[10px]">Última msg: {fmtAgo(health.wpp_ultima_msg)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="rounded-2xl bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Clock size={16} className="text-blue-600" /> Status geral
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-1">
            <div>{cronHealthy ? "✓" : "⚠"} Cron rodou há {cronMinAgo.toFixed(0)}min</div>
            <div>{health.cron_actions_failed === 0 ? "✓" : "⚠"} Sem ações falhas</div>
            <div>{!health.loop_anormal_vermelho ? "✓" : "⚠"} Sem loops anormais</div>
            <div>{health.cobrancas_total > 0 ? "✓" : "○"} Cobranças saindo</div>
            <div>{ponteAtiva ? "✓" : "○"} Ponte MCP processando</div>
            <div>{wppAtivo ? "✓" : "○"} WhatsApp com tráfego</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Uso por Edge Function */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={16} className="text-blue-600" /> Uso das Edge Functions IA (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(edgeUso?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-500 italic">
              Nenhum registro em ai_logs nos últimos 30 dias. Edge Functions de IA estão ociosas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 font-medium">Função</th>
                    <th className="text-right py-2 font-medium">Chamadas</th>
                    <th className="text-right py-2 font-medium">Erros</th>
                    <th className="text-right py-2 font-medium">Custo USD</th>
                    <th className="text-left py-2 font-medium pl-4">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeUso?.map((e) => (
                    <tr key={e.function_name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs text-slate-700">{e.function_name}</td>
                      <td className="text-right py-2 tabular-nums">{e.chamadas_30d}</td>
                      <td className={`text-right py-2 tabular-nums ${e.erros_30d > 0 ? "text-red-600" : "text-slate-400"}`}>{e.erros_30d}</td>
                      <td className="text-right py-2 tabular-nums text-slate-600">${e.custo_usd_30d.toFixed(4)}</td>
                      <td className="py-2 pl-4 text-xs text-slate-500">{fmtAgo(e.ultima_chamada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execuções de regras (24h) */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot size={16} className="text-blue-600" /> Regras executadas nas últimas 24h
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(rules24h?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-500 italic">Nenhuma regra executou nas últimas 24h.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 font-medium">Regra</th>
                    <th className="text-left py-2 font-medium">Módulo</th>
                    <th className="text-left py-2 font-medium">Ação</th>
                    <th className="text-right py-2 font-medium">Execuções</th>
                    <th className="text-left py-2 font-medium pl-4">Saúde</th>
                  </tr>
                </thead>
                <tbody>
                  {rules24h?.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs">{r.rule_name}</td>
                      <td className="py-2 text-slate-600">{r.modulo}</td>
                      <td className="py-2 text-slate-500 text-xs">{r.action_type ?? "—"}</td>
                      <td className="text-right py-2 tabular-nums font-semibold">{r.execucoes}</td>
                      <td className="py-2 pl-4">
                        <Badge
                          className={
                            r.saude_loop === "vermelho"
                              ? "bg-red-100 text-red-700"
                              : r.saude_loop === "amarelo"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }
                        >
                          {r.saude_loop === "vermelho" ? "Loop!" : r.saude_loop === "amarelo" ? "Alto volume" : "OK"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
