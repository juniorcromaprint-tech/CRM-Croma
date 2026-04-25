// src/domains/terceirizacao/components/TerceirizacaoProductCard.tsx

import { ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { brl } from '@/shared/utils/format';
import type { TerceirizacaoItem } from '@/hooks/useTerceirizacaoCatalogo';

// Cores por categoria para o badge
const CATEGORIA_COLORS: Record<string, string> = {
  'Adesivos e Comunicação Visual': 'bg-purple-50 text-purple-700 border-purple-200',
  'Banners e Lona': 'bg-blue-50 text-blue-700 border-blue-200',
  'Impressão Digital': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Brindes e Personalizados': 'bg-amber-50 text-amber-700 border-amber-200',
  'Papelaria': 'bg-green-50 text-green-700 border-green-200',
  'Placas': 'bg-orange-50 text-orange-700 border-orange-200',
};

function badgeClass(cat: string): string {
  return CATEGORIA_COLORS[cat] ?? 'bg-slate-50 text-slate-700 border-slate-200';
}

function markupLabel(markup: number | null): string {
  if (markup == null) return '';
  return `+${Math.round(markup)}%`;
}

interface TerceirizacaoProductCardProps {
  item: TerceirizacaoItem;
  onClick: () => void;
}

export default function TerceirizacaoProductCard({ item, onClick }: TerceirizacaoProductCardProps) {
  const fornecedorNome = item.fornecedores.nome_fantasia ?? item.fornecedores.razao_social;

  const temPreco = item.preco_valor != null && item.preco_valor > 0;
  const temVenda = item.preco_venda != null && item.preco_venda > 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
            {item.nome}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{fornecedorNome}</p>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-300 hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5"
            title="Ver no site da Scan"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Badge categoria */}
      <span
        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border mb-3 ${badgeClass(item.categoria)}`}
      >
        {item.categoria}
      </span>

      {/* Detalhes rápidos */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">
        {item.material && (
          <span className="bg-slate-50 rounded-lg px-2 py-0.5 border border-slate-100">
            {item.material}
          </span>
        )}
        {item.cores && (
          <span className="bg-slate-50 rounded-lg px-2 py-0.5 border border-slate-100">
            {item.cores}
          </span>
        )}
      </div>

      {/* Preços */}
      <div className="border-t border-slate-50 pt-3 mt-auto space-y-1.5">
        {temPreco && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Custo Scan</span>
            <span className="text-xs font-mono text-slate-500">
              {brl(item.preco_valor!)}
              {item.preco_unidade && (
                <span className="text-slate-400">/{item.preco_unidade}</span>
              )}
            </span>
          </div>
        )}
        {temVenda && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Preço Croma</span>
            <div className="flex items-center gap-1.5">
              {item.markup_aplicado != null && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 font-bold text-emerald-700 border-emerald-200 bg-emerald-50 flex items-center gap-0.5"
                >
                  <TrendingUp size={10} />
                  {markupLabel(item.markup_aplicado)}
                </Badge>
              )}
              <span className="text-sm font-bold text-slate-800">
                {brl(item.preco_venda!)}
                {item.preco_unidade && (
                  <span className="text-xs text-slate-400 font-normal">/{item.preco_unidade}</span>
                )}
              </span>
            </div>
          </div>
        )}
        {!temPreco && !temVenda && item.preco_texto && (
          <p className="text-xs text-slate-500 italic">{item.preco_texto}</p>
        )}
      </div>

      {/* Prazo */}
      {item.prazo && (
        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
          <Clock size={11} />
          <span>{item.prazo}</span>
        </div>
      )}
    </div>
  );
}
