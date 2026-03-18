import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator,
  BookOpen,
  BarChart3,
  FileText,
  Upload,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDASHistorico, useCalcularDAS } from '../hooks/useDAS';
import { useConfigTributaria } from '../hooks/useConfigTributaria';
import { DASStatsCards } from '../components/DASStatsCards';
import { AlertasTributarios } from '../components/AlertasTributarios';
import { gerarAlertas } from '../services/das-simples.service';
import { brl, formatDate } from '@/shared/utils/format';

function currentMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ContabilidadeDashboardPage() {
  const currentMonth = currentMonthDate();
  const { data: dasHistorico = [], isLoading: dasLoading } = useDASHistorico(new Date().getFullYear());
  const { data: configTrib } = useConfigTributaria();
  const calcularDAS = useCalcularDAS();

  const ultimoDAS = dasHistorico[0] ?? null;

  const alertas = ultimoDAS && configTrib
    ? gerarAlertas(
        {
          competencia: ultimoDAS.competencia,
          receita_bruta_mes: ultimoDAS.receita_bruta_mes,
          rbt12: ultimoDAS.rbt12,
          folha_pagamento_12m: ultimoDAS.folha_pagamento_12m,
          fator_r: ultimoDAS.fator_r,
          anexo: ultimoDAS.anexo,
          faixa: ultimoDAS.faixa,
          aliquota_nominal: ultimoDAS.aliquota_nominal,
          deducao: ultimoDAS.deducao,
          aliquota_efetiva: ultimoDAS.aliquota_efetiva,
          valor_das: ultimoDAS.valor_das,
          data_vencimento: ultimoDAS.data_vencimento,
        },
        configTrib.pro_labore_mensal
      )
    : [];

  const acoes = [
    {
      label: 'DAS / Simples',
      desc: 'Calcular imposto do mês',
      icon: Calculator,
      href: '/contabilidade/das',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Extrato Bancário',
      desc: 'Importar OFX e classificar',
      icon: Upload,
      href: '/contabilidade/extrato-bancario',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Lançamentos',
      desc: 'Partida dobrada manual',
      icon: BookOpen,
      href: '/contabilidade/lancamentos',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Balancete',
      desc: 'Conferir débitos x créditos',
      icon: BarChart3,
      href: '/contabilidade/balancete',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: 'Razão Contábil',
      desc: 'Histórico por conta',
      icon: FileText,
      href: '/contabilidade/razao',
      color: 'bg-slate-50 text-slate-600',
    },
    {
      label: 'DEFIS',
      desc: 'Relatório anual do Simples',
      icon: FileText,
      href: '/contabilidade/defis',
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contabilidade</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Módulo contábil autônomo — Simples Nacional
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => calcularDAS.mutate(currentMonth)}
          disabled={calcularDAS.isPending}
        >
          <RefreshCw size={14} className={calcularDAS.isPending ? 'animate-spin' : ''} />
          Recalcular DAS
        </Button>
      </div>

      {/* Cards DAS */}
      <DASStatsCards apuracao={ultimoDAS} />

      {/* Alertas tributários */}
      {alertas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Alertas Tributários</h2>
          <AlertasTributarios alertas={alertas} />
        </div>
      )}

      {/* Ações rápidas */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Módulos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {acoes.map((acao) => (
            <Link key={acao.href} to={acao.href}>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-3 group">
                <div className={`w-10 h-10 rounded-xl ${acao.color} flex items-center justify-center flex-shrink-0`}>
                  <acao.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-700">{acao.label}</p>
                  <p className="text-xs text-slate-400 truncate">{acao.desc}</p>
                </div>
                <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-blue-400 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Histórico DAS */}
      {dasHistorico.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Histórico DAS — {new Date().getFullYear()}</h2>
            <Link to="/contabilidade/das" className="text-xs text-blue-600 hover:underline">
              Ver tudo
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="px-5 py-3 text-left font-medium">Competência</th>
                  <th className="px-5 py-3 text-right font-medium">Receita</th>
                  <th className="px-5 py-3 text-right font-medium">Alíquota</th>
                  <th className="px-5 py-3 text-right font-medium">DAS</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dasHistorico.slice(0, 6).map((das) => (
                  <tr key={das.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">
                      {formatDate(das.competencia)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {brl(das.receita_bruta_mes)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {(das.aliquota_efetiva * 100).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">
                      {brl(das.valor_das)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        das.status === 'pago'
                          ? 'bg-green-100 text-green-700'
                          : das.status === 'conferido'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {das.status === 'pago' ? 'Pago' : das.status === 'conferido' ? 'Conferido' : 'Calculado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!dasLoading && dasHistorico.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calculator size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum DAS calculado ainda</h3>
          <p className="text-sm text-slate-400 mt-1">
            Clique em "Recalcular DAS" para calcular o imposto do mês atual
          </p>
          <Button
            className="mt-4 bg-blue-600 hover:bg-blue-700"
            onClick={() => calcularDAS.mutate(currentMonth)}
            disabled={calcularDAS.isPending}
          >
            Calcular DAS do Mês
          </Button>
        </div>
      )}
    </div>
  );
}
