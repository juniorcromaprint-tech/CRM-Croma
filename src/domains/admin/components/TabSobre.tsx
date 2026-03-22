// src/domains/admin/components/TabSobre.tsx

import { Link } from "react-router-dom";
import { DEFAULT_PRICING_CONFIG } from "@/shared/services/pricing-engine";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { Info, Webhook, ArrowRight } from "lucide-react";

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export default function TabSobre() {
  return (
    <div className="space-y-4">
      {/* Quick links to other admin sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          to="/admin/webhooks"
          className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Webhook size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Webhooks</p>
            <p className="text-xs text-slate-400 mt-0.5">Integrações externas via HTTP</p>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
        </Link>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-slate-800">Sistema de Precificação Mubisys</CardTitle>
          </div>
          <CardDescription>Custeio Direto — 9 Passos para o Preço de Venda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-slate-600">
          <p>
            O motor de precificação da Croma Print utiliza o método de custeio direto Mubisys,
            que calcula o preço de venda em 9 etapas sequenciais partindo dos custos reais
            de matéria-prima e mão de obra.
          </p>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800">Os 9 Passos do Cálculo</h3>
            <ol className="space-y-2.5 list-none">
              {[
                {
                  step: 1,
                  title: "Levantamento de Matéria-Prima (Vmp)",
                  desc: "Somatório do custo de todos os materiais utilizados na produção.",
                  formula: "Vmp = Σ (quantidade × preço unitário)",
                },
                {
                  step: 2,
                  title: "Levantamento de Tempo Produtivo (T)",
                  desc: "Somatório do tempo em minutos de cada etapa de produção.",
                  formula: "T = Σ tempos das etapas (minutos)",
                },
                {
                  step: 3,
                  title: "Percentual de Custos Fixos (P%)",
                  desc: "Percentual que os custos fixos representam em relação ao faturamento.",
                  formula: "P% = ((C – CP) × 100) / F",
                },
                {
                  step: 4,
                  title: "Custo por Minuto (Cm)",
                  desc: "Custo da mão de obra por minuto de produção.",
                  formula: "Cm = (Fp / Qf) / horasMes / 60",
                },
                {
                  step: 5,
                  title: "Percentual de Vendas (Pv)",
                  desc: "Soma de todos os percentuais incidentes sobre a venda.",
                  formula: "Pv = (comissão + impostos + juros) / 100",
                },
                {
                  step: 6,
                  title: "Custo Base (Vb)",
                  desc: "Custo total do produto incluindo matéria-prima, mão de obra e custos fixos rateados.",
                  formula: "Vb = (Vmp + MO) × (1 + P%/100)",
                },
                {
                  step: 7,
                  title: "Valor Antes do Markup (Vam)",
                  desc: "Incorpora os custos de venda ao preço mínimo.",
                  formula: "Vam = Vb / (1 – Pv)",
                },
                {
                  step: 8,
                  title: "Valor do Markup (Vm)",
                  desc: "Parcela de lucro aplicada sobre o valor antes do markup.",
                  formula: "Vm = (Vam × Pm%) / (1 – Pv)",
                },
                {
                  step: 9,
                  title: "Preço Final de Venda (Vv)",
                  desc: "Preço de venda ao cliente, com toda a margem e custos incorporados.",
                  formula: "Vv = Vam + Vm",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-700">{item.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block font-mono">
                      {item.formula}
                    </code>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Legenda das Variáveis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["F", "Faturamento médio mensal"],
                ["C", "Custo operacional total"],
                ["CP", "Custo produtivo (folha da produção)"],
                ["Fp", "Folha de pagamento produtiva"],
                ["Qf", "Quantidade de funcionários produtivos"],
                ["MO", "Mão de obra (T × Cm)"],
                ["Pm%", "Percentual de markup desejado"],
              ].map(([code, desc]) => (
                <div key={code} className="flex items-baseline gap-2 text-xs">
                  <code className="font-mono font-bold text-blue-700 w-8 flex-shrink-0">{code}</code>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Referência de Configuração Padrão (Croma Print)</p>
            <div className="grid grid-cols-2 gap-1 mt-2">
              <span>Faturamento médio:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.faturamentoMedio)}</span>
              <span>Custo operacional:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.custoOperacional)}</span>
              <span>Custo produtivo:</span>
              <span className="font-mono">{formatBRL(DEFAULT_PRICING_CONFIG.custoProdutivo)}</span>
              <span>Funcionários produtivos:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.qtdFuncionarios}</span>
              <span>Horas/mês:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.horasMes}h</span>
              <span>Comissão:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualComissao}%</span>
              <span>Impostos:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualImpostos}%</span>
              <span>Juros:</span>
              <span className="font-mono">{DEFAULT_PRICING_CONFIG.percentualJuros}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
