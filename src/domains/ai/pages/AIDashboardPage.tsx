// src/domains/ai/pages/AIDashboardPage.tsx

import { Link } from 'react-router-dom';
import {
  Bot,
  AlertTriangle,
  CheckCircle,
  Zap,
  FileText,
  User,
  Package,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAlertasAI } from '../hooks/useAlertasAI';
import { useAIModels } from '../hooks/useAIModels';
import ProblemasPanel from '../components/ProblemasPanel';

export default function AIDashboardPage() {
  const { data: alertas = [] } = useAlertasAI();
  const { models, defaultModel } = useAIModels();

  const alta = alertas.filter((a) => a.severidade === 'alta').length;
  const media = alertas.filter((a) => a.severidade === 'media').length;
  const baixa = alertas.filter((a) => a.severidade === 'baixa').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Inteligência Artificial</h1>
            <p className="text-sm text-slate-500">Análises automatizadas e ações inteligentes</p>
          </div>
        </div>
        <Link to="/agente/config">
          <Button variant="outline" size="sm" className="rounded-xl">
            <Settings size={14} className="mr-1.5" />
            Configurar modelos
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Alertas críticos"
          value={alta}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-500"
          sub={alta > 0 ? 'Requer atenção' : 'Tudo ok'}
          subColor={alta > 0 ? 'text-red-500' : 'text-green-500'}
        />
        <KpiCard
          label="Alertas médios"
          value={media}
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          iconColor="text-amber-500"
          sub={media > 0 ? 'Em monitoramento' : 'Sem alertas'}
          subColor="text-slate-400"
        />
        <KpiCard
          label="Informativos"
          value={baixa}
          icon={CheckCircle}
          iconBg="bg-blue-100"
          iconColor="text-blue-500"
          sub="Baixa prioridade"
          subColor="text-slate-400"
        />
        <KpiCard
          label="Modelos ativos"
          value={models.length}
          icon={Zap}
          iconBg="bg-purple-100"
          iconColor="text-purple-500"
          sub={defaultModel.split('/').pop() ?? '—'}
          subColor="text-slate-400"
        />
      </div>

      {/* Main content: ProblemasPanel + Feature cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProblemasPanel />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Funcionalidades IA
          </p>
          <FeatureCard
            icon={FileText}
            title="Analisar Orçamento"
            description="Detecta inconsistências de preço, materiais faltantes e sugere ajustes automáticos."
            href="/orcamentos"
            linkLabel="Ir para Orçamentos"
          />
          <FeatureCard
            icon={User}
            title="Resumo do Cliente"
            description="Gera perfil de compra, risco e sugestão de abordagem com base no histórico."
            href="/clientes"
            linkLabel="Ir para Clientes"
          />
          <FeatureCard
            icon={Package}
            title="Briefing de Produção"
            description="Consolida medidas, materiais e acabamentos em briefing estruturado para a fábrica."
            href="/producao"
            linkLabel="Ir para Produção"
          />
          <FeatureCard
            icon={TrendingUp}
            title="Composição de Produto"
            description="Sugere modelo, materiais e processos com base nas especificações do item."
            href="/orcamentos"
            linkLabel="Abrir Orçamento"
          />
        </div>
      </div>

      {/* Models section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">Modelos configurados</h3>
          <Link to="/agente/config">
            <Button variant="ghost" size="sm" className="rounded-xl text-xs text-slate-500 h-7">
              Gerenciar
            </Button>
          </Link>
        </div>
        {models.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum modelo configurado</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {models.map((model) => (
              <div
                key={model.slug}
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5"
              >
                <span className="text-sm text-slate-700">{model.label}</span>
                {model.slug === defaultModel && (
                  <Badge className="bg-blue-100 text-blue-600 text-xs h-4">Padrão</Badge>
                )}
                {model.free && (
                  <Badge className="bg-green-100 text-green-600 text-xs h-4">Free</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        <p className={`text-xs mt-0.5 truncate ${subColor}`}>{sub}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <div className="bg-blue-50 rounded-xl p-2 shrink-0">
          <Icon size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-700 text-sm">{title}</h4>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
          <Link to={href}>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 h-6 text-xs text-blue-600 hover:text-blue-700 px-0 hover:bg-transparent"
            >
              {linkLabel} →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
