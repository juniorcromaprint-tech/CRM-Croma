// ============================================================================
// CockpitExecutivoPage — Croma Print ERP/CRM
// Cockpit executivo em tempo real — métricas consolidadas, alertas IA e timeline
// ============================================================================

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/shared/utils/format";
import {
  Crown, DollarSign, TrendingUp, AlertTriangle, Factory, Clock,
  RefreshCw, Loader2, AlertCircle, CheckCircle, Info, Zap
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

// Tipos
interface CockpitData {
  faturado_hoje: number;
  pipeline_ativo: number;
  vencidos_count: number;
  vencidos_valor: number;
  receita_mes: number;
  a_receber_7d: number;
  a_pagar_7d: number;
  ops_abertas: number;
  ops_atrasadas: number;
  leads_novos_7d: number;
  propostas_7d: number;
  cobrancas_7d: number;
  eventos_7d: number;
}

interface TimelineEvent {
  id: string;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown> | null;
  descricao_formatada: string;
}

interface AutomacaoRule {
  id: string;
  nome: string;
  modulo: string;
  ativo: boolean;
  last_run: string | null;
  run_count: number;
  last_error: string | null;
}

interface AlertEvent {
  id: string;
  created_at: string;
  event_type: string;
  payload: {
    severity?: "critical" | "warning" | "info";
    message?: string;
  };
}

// Formatador de moeda
const formatMoney = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Calcular tempo relativo
const getRelativeTime = (date: string): string => {
  const now = new Date();
  const eventDate = new Date(date);
  const diff = now.getTime() - eventDate.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
};

// Cores de severidade para alertas
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case "critical": return "bg-red-500";
    case "warning": return "bg-yellow-500";
    case "info": return "bg-green-500";
    default: return "bg-gray-500";
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "critical": return <AlertCircle size={16} />;
    case "warning": return <AlertTriangle size={16} />;
    case "info": return <CheckCircle size={16} />;
    default: return <Info size={16} />;
  }
};

export default function CockpitExecutivoPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState("");
  const META_RECEITA = 110000;

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setCurrentDate(formatter.format(new Date()));
  }, []);

  // Query: Cockpit Executivo
  const { data: cockpit, isLoading: loadingCockpit } = useQuery({
    queryKey: ["cockpit-executivo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cockpit_executivo" as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as CockpitData;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Query: Timeline
  const { data: timeline } = useQuery({
    queryKey: ["cockpit-timeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cockpit_timeline" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Query: Automação Rules
  const { data: automacaoRules } = useQuery({
    queryKey: ["automacao-rules-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_automacao_rules_status" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as AutomacaoRule[];
    },
    refetchInterval: 120000,
    staleTime: 60000,
  });

  // Query: Alertas
  const { data: alertas } = useQuery({
    queryKey: ["cockpit-alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_events")
        .select("*")
        .eq("event_type", "alert_generated")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as AlertEvent[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cockpit-executivo"] });
    queryClient.invalidateQueries({ queryKey: ["cockpit-timeline"] });
    queryClient.invalidateQueries({ queryKey: ["automacao-rules-status"] });
    queryClient.invalidateQueries({ queryKey: ["cockpit-alertas"] });
  };

  if (loadingCockpit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const receita = cockpit?.receita_mes || 0;
  const percentualReceitaMes = (receita / META_RECEITA) * 100;
  const saldoProjetado = (cockpit?.a_receber_7d || 0) - (cockpit?.a_pagar_7d || 0);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Crown size={32} className="text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cockpit Executivo</h1>
            <p className="text-sm text-slate-600 capitalize">{currentDate}</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <RefreshCw size={20} />
        </Button>
      </div>

      {/* Section 1: Pulso do Dia (4 KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Faturado Hoje */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                Faturado Hoje
              </CardTitle>
              <DollarSign
                size={20}
                className={cockpit?.faturado_hoje ? "text-green-600" : "text-slate-400"}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatMoney(cockpit?.faturado_hoje || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Pipeline Ativo */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                Pipeline Ativo
              </CardTitle>
              <TrendingUp size={20} className="text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatMoney(cockpit?.pipeline_ativo || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Vencidos */}
        <Card
          className={`rounded-2xl ${
            cockpit?.vencidos_count ? "border-red-200 bg-red-50" : ""
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                Vencidos
              </CardTitle>
              <AlertTriangle
                size={20}
                className={
                  cockpit?.vencidos_count ? "text-red-600" : "text-slate-400"
                }
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {cockpit?.vencidos_count || 0}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {formatMoney(cockpit?.vencidos_valor || 0)}
            </p>
          </CardContent>
        </Card>

        {/* OPs em Produção */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                OPs em Produção
              </CardTitle>
              <Factory size={20} className="text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {cockpit?.ops_abertas || 0}
            </p>
            {cockpit?.ops_atrasadas ? (
              <p className="text-xs text-red-600 mt-1">
                {cockpit.ops_atrasadas} atrasadas
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Seções principais */}
      <Tabs defaultValue="financeiro" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
        </TabsList>

        {/* Tab: Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Receita do Mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">
                    {formatMoney(receita)} / {formatMoney(META_RECEITA)}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {percentualReceitaMes.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentualReceitaMes, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">
                  A Receber (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatMoney(cockpit?.a_receber_7d || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">
                  A Pagar (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatMoney(cockpit?.a_pagar_7d || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">
                  Saldo Projetado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    saldoProjetado >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatMoney(saldoProjetado)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Produção */}
        <TabsContent value="producao" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory size={20} />
                  OPs Abertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-blue-600">
                  {cockpit?.ops_abertas || 0}
                </p>
              </CardContent>
            </Card>

            <Card
              className={`rounded-2xl ${
                cockpit?.ops_atrasadas ? "border-red-200 bg-red-50" : ""
              }`}
            >
              <CardHeader>
                <CardTitle className="text-slate-600">OPs Atrasadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-4xl font-bold ${
                    cockpit?.ops_atrasadas ? "text-red-600" : "text-slate-400"
                  }`}
                >
                  {cockpit?.ops_atrasadas || 0}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Comercial */}
        <TabsContent value="comercial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Leads Novos (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {cockpit?.leads_novos_7d || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Propostas (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {cockpit?.propostas_7d || 0}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Automação */}
        <TabsContent value="automacao" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Cobranças (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {cockpit?.cobrancas_7d || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Eventos (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {cockpit?.eventos_7d || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {automacaoRules && automacaoRules.length > 0 ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={20} />
                  Regras Ativas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {automacaoRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{rule.nome}</p>
                      <p className="text-xs text-slate-500">{rule.modulo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {rule.ativo ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600">
                          Inativa
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Section: Alertas IA */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle size={20} className="text-red-600" />
            Alertas de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas && alertas.length > 0 ? (
            <div className="space-y-3">
              {alertas.map((alert) => {
                const severity = (alert.payload?.severity as string) || "info";
                const message = (alert.payload?.message as string) || "Alerta do sistema";
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl"
                  >
                    <div
                      className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getSeverityColor(
                        severity
                      )}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 break-words">
                        {message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {getRelativeTime(alert.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm text-slate-600">Sem alertas críticos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section: Timeline */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} />
            Timeline de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline && timeline.length > 0 ? (
            <div className="space-y-2">
              {timeline.map((event, idx) => (
                <div key={event.id} className="relative pb-4">
                  {idx < (timeline.length - 1) && (
                    <div className="absolute left-1.5 top-7 bottom-0 w-0.5 bg-slate-200" />
                  )}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium text-slate-900 break-words">
                          {event.descricao_formatada}
                        </p>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {getRelativeTime(event.created_at)}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {event.event_type}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-600">Nenhum evento registrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
