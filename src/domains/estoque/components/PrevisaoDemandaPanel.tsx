import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  PackageSearch, Loader2, ShoppingCart, BarChart3,
  ArrowRight, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrevisaoDemanda, type MaterialForecast } from '../hooks/usePrevisaoDemanda';

const URGENCIA_CONFIG = {
  critico: { label: 'Crítico', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  atencao: { label: 'Atenção', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  ok:      { label: 'OK',      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
};

const TENDENCIA_ICON = {
  crescente: <TrendingUp size={14} className="text-red-500" />,
  estavel: <Minus size={14} className="text-slate-400" />,
  decrescente: <TrendingDown size={14} className="text-emerald-500" />,
};

function ForecastRow({ item }: { item: MaterialForecast }) {
  const cfg = URGENCIA_CONFIG[item.urgencia];

  return (
    <div className={`flex items-center gap-4 px-5 py-3 ${cfg.bg} border-b ${cfg.border} last:border-b-0`}>
      {/* Material */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{item.nome}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>Disp: {item.disponivel} {item.unidade}</span>
          {item.reservado > 0 && <span>Res: {item.reservado}</span>}
          <span>Mín: {item.estoque_minimo}</span>
        </div>
      </div>

      {/* Tendência */}
      <div className="w-16 hidden sm:flex items-center gap-1">
        {TENDENCIA_ICON[item.tendencia]}
        <span className="text-xs text-slate-500 capitalize">{item.tendencia === 'crescente' ? '↑' : item.tendencia === 'decrescente' ? '↓' : '—'}</span>
      </div>

      {/* Dias cobertura */}
      <div className="w-20 text-center hidden md:block">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
          <Calendar size={11} />
          {item.dias_cobertura > 900 ? '∞' : `${item.dias_cobertura}d`}
        </span>
      </div>

      {/* Consumo previsto */}
      <div className="w-24 text-right hidden lg:block">
        <p className="text-sm text-slate-600">{item.consumo_previsto_periodo.toFixed(1)}</p>
        <p className="text-xs text-slate-400">previsto</p>
      </div>

      {/* Pipeline */}
      <div className="w-20 text-right hidden xl:block">
        {item.pipeline_demanda > 0 ? (
          <p className="text-sm text-blue-600">{item.pipeline_demanda.toFixed(1)}</p>
        ) : (
          <p className="text-sm text-slate-300">—</p>
        )}
      </div>

      {/* Sugestão compra */}
      <div className="w-28 text-right">
        {item.sugestao_compra > 0 ? (
          <div className="flex items-center justify-end gap-1">
            <ShoppingCart size={14} className={cfg.text} />
            <span className={`text-sm font-semibold ${cfg.text}`}>
              {item.sugestao_compra.toFixed(1)} {item.unidade}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}

export default function PrevisaoDemandaPanel() {
  const [periodo, setPeriodo] = useState('30');
  const previsao = usePrevisaoDemanda();

  const handleGerar = () => {
    previsao.mutate(parseInt(periodo, 10));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <BarChart3 size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">Previsão de Demanda</h3>
            <p className="text-xs text-slate-400">Análise baseada em consumo histórico + pipeline de vendas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-32 h-9 rounded-xl text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleGerar}
            disabled={previsao.isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2 h-9 rounded-xl"
          >
            {previsao.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PackageSearch size={14} />
            )}
            {previsao.isPending ? 'Analisando...' : 'Gerar Previsão'}
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      {previsao.data?.resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{previsao.data.resumo.criticos}</p>
            <p className="text-xs text-slate-500">Críticos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{previsao.data.resumo.atencao}</p>
            <p className="text-xs text-slate-500">Atenção</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{previsao.data.resumo.ok}</p>
            <p className="text-xs text-slate-500">OK</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-700">{previsao.data.resumo.total_analisados}</p>
            <p className="text-xs text-slate-500">Analisados</p>
          </div>
        </div>
      )}

      {/* Column headers */}
      {previsao.data?.materiais && previsao.data.materiais.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <div className="flex-1">Material</div>
          <div className="w-16 hidden sm:block">Tend.</div>
          <div className="w-20 text-center hidden md:block">Cobertura</div>
          <div className="w-24 text-right hidden lg:block">Consumo Prev.</div>
          <div className="w-20 text-right hidden xl:block">Pipeline</div>
          <div className="w-28 text-right">Comprar</div>
        </div>
      )}

      {/* Results */}
      {previsao.isPending ? (
        <div className="p-12 text-center">
          <Loader2 size={32} className="mx-auto text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-slate-500">Analisando consumo e pipeline...</p>
        </div>
      ) : previsao.data?.materiais && previsao.data.materiais.length > 0 ? (
        <div className="max-h-[500px] overflow-y-auto">
          {previsao.data.materiais.map((item) => (
            <ForecastRow key={item.material_id} item={item} />
          ))}
        </div>
      ) : !previsao.data ? (
        <div className="p-12 text-center">
          <PackageSearch size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Previsão de Demanda</h3>
          <p className="text-sm text-slate-400 mt-1">
            Clique em &quot;Gerar Previsão&quot; para analisar a demanda futura de materiais
          </p>
        </div>
      ) : (
        <div className="p-12 text-center">
          <PackageSearch size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Sem dados suficientes</h3>
          <p className="text-sm text-slate-400 mt-1">Registre movimentações de estoque para gerar previsões</p>
        </div>
      )}
    </div>
  );
}
