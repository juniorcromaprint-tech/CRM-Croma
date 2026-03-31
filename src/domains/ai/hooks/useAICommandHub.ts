// src/domains/ai/hooks/useAICommandHub.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Agent definitions ────────────────────────────────────────────────────────

export interface AgentDef {
  id: string;
  nome: string;
  descricao: string;
  functions: string[];
  icon: string;
  cor: string;
}

export const AGENTES: AgentDef[] = [
  {
    id: 'comercial',
    nome: 'Comercial',
    descricao: 'Qualifica leads, compõe mensagens, analisa inteligência comercial',
    functions: ['ai-qualificar-lead', 'ai-compor-mensagem', 'ai-inteligencia-comercial'],
    icon: 'Users',
    cor: 'blue',
  },
  {
    id: 'orcamentista',
    nome: 'Orçamentista',
    descricao: 'Detecta intenção de compra, gera e analisa orçamentos com motor Mubisys',
    functions: ['ai-detectar-intencao-orcamento', 'ai-gerar-orcamento', 'ai-analisar-orcamento'],
    icon: 'FileText',
    cor: 'violet',
  },
  {
    id: 'pcp',
    nome: 'PCP',
    descricao: 'Sequencia produção e gera briefings',
    functions: ['ai-sequenciar-producao', 'ai-briefing-producao'],
    icon: 'Settings2',
    cor: 'orange',
  },
  {
    id: 'campo',
    nome: 'Campo',
    descricao: 'Analisa fotos de instalação em campo',
    functions: ['ai-analisar-foto-instalacao'],
    icon: 'Camera',
    cor: 'green',
  },
  {
    id: 'financeiro',
    nome: 'Financeiro',
    descricao: 'Classifica extrato e realiza conciliação bancária',
    functions: ['ai-classificar-extrato', 'ai-conciliar-bancario'],
    icon: 'DollarSign',
    cor: 'emerald',
  },
  {
    id: 'executivo',
    nome: 'Executivo',
    descricao: 'Gera insights diários e detecta problemas no sistema',
    functions: ['ai-insights-diarios', 'ai-detectar-problemas'],
    icon: 'BarChart2',
    cor: 'red',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentStats {
  agente: AgentDef;
  ultima_execucao: string | null;
  total_execucoes: number;
  custo_acumulado: number;
  taxa_sucesso: number;
}

export interface CostByMonth {
  mes: string;
  custo: number;
  execucoes: number;
}

export interface AICommandHubData {
  agentes: AgentStats[];
  custo_total: number;
  custo_por_mes: CostByMonth[];
  total_execucoes: number;
  taxa_sucesso_geral: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAICommandHub() {
  return useQuery({
    queryKey: ['ai-command-hub'],
    queryFn: async (): Promise<AICommandHubData> => {
      // Fetch all logs for stats (last 90 days)
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: logs, error } = await supabase
        .from('ai_logs')
        .select('function_name, status, cost_usd, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = logs ?? [];

      // ── Per-agent stats ──────────────────────────────────────────────────
      const agentes: AgentStats[] = AGENTES.map((agente) => {
        const agentRows = rows.filter((r) => agente.functions.includes(r.function_name));
        const custo = agentRows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
        const successes = agentRows.filter((r) => r.status === 'success').length;
        const sorted = agentRows.slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
          agente,
          ultima_execucao: sorted[0]?.created_at ?? null,
          total_execucoes: agentRows.length,
          custo_acumulado: custo,
          taxa_sucesso: agentRows.length > 0 ? (successes / agentRows.length) * 100 : 0,
        };
      });

      // ── Cost by month ────────────────────────────────────────────────────
      const byMonth = new Map<string, { custo: number; execucoes: number }>();
      for (const row of rows) {
        const mes = row.created_at.slice(0, 7); // "2026-03"
        const cur = byMonth.get(mes) ?? { custo: 0, execucoes: 0 };
        byMonth.set(mes, {
          custo: cur.custo + (row.cost_usd ?? 0),
          execucoes: cur.execucoes + 1,
        });
      }
      const custo_por_mes: CostByMonth[] = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, v]) => ({ mes, ...v }));

      // ── Totals ───────────────────────────────────────────────────────────
      const custo_total = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
      const sucesses_total = rows.filter((r) => r.status === 'success').length;
      const taxa_sucesso_geral = rows.length > 0 ? (sucesses_total / rows.length) * 100 : 0;

      return {
        agentes,
        custo_total,
        custo_por_mes,
        total_execucoes: rows.length,
        taxa_sucesso_geral,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
