// src/domains/terceirizacao/components/TerceirizacaoDetailDrawer.tsx

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { brl, formatDate } from '@/shared/utils/format';
import { ExternalLink, Clock, TrendingUp, Building2, Package, Layers } from 'lucide-react';
import type { TerceirizacaoItem } from '@/hooks/useTerceirizacaoCatalogo';

interface TerceirizacaoDetailDrawerProps {
  item: TerceirizacaoItem | null;
  open: boolean;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}

export default function TerceirizacaoDetailDrawer({
  item,
  open,
  onClose,
}: TerceirizacaoDetailDrawerProps) {
  if (!item) return null;

  const fornecedorNome = item.fornecedores.nome_fantasia ?? item.fornecedores.razao_social;
  const temPreco = item.preco_valor != null && item.preco_valor > 0;
  const temVenda = item.preco_venda != null && item.preco_venda > 0;
  const diferenca =
    temPreco && temVenda ? item.preco_venda! - item.preco_valor! : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-base leading-snug text-slate-800 pr-6">
            {item.nome}
          </SheetTitle>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <Building2 size={12} />
            {fornecedorNome}
          </p>
        </SheetHeader>

        {/* Badge categoria */}
        <Badge variant="outline" className="mb-6 text-xs">
          {item.categoria}
        </Badge>

        {/* Bloco de preços */}
        {(temPreco || temVenda || item.preco_texto) && (
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Precificação
            </h4>
            {temPreco && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Custo Scan</span>
                <span className="text-sm font-mono text-slate-600">
                  {brl(item.preco_valor!)}
                  {item.preco_unidade && <span className="text-slate-400">/{item.preco_unidade}</span>}
                </span>
              </div>
            )}
            {item.markup_aplicado != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Markup aplicado</span>
                <Badge
                  variant="outline"
                  className="text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50 gap-1 flex items-center"
                >
                  <TrendingUp size={11} />
                  +{Math.round(item.markup_aplicado)}%
                </Badge>
              </div>
            )}
            {temVenda && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Preço de Venda</span>
                <span className="text-base font-bold text-blue-700">
                  {brl(item.preco_venda!)}
                  {item.preco_unidade && (
                    <span className="text-xs text-slate-400 font-normal">/{item.preco_unidade}</span>
                  )}
                </span>
              </div>
            )}
            {diferenca != null && diferenca > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-xs text-slate-400">Margem bruta</span>
                <span className="text-xs font-semibold text-emerald-700">
                  {brl(diferenca)}
                  {item.preco_unidade && <span className="font-normal text-emerald-600">/{item.preco_unidade}</span>}
                </span>
              </div>
            )}
            {!temPreco && !temVenda && item.preco_texto && (
              <p className="text-sm text-slate-500 italic">{item.preco_texto}</p>
            )}
            {item.preco_info && (
              <p className="text-xs text-slate-400 italic">{item.preco_info}</p>
            )}
          </div>
        )}

        {/* Especificações técnicas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <Package size={13} />
            Especificações
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Material" value={item.material} />
            <InfoRow label="Cores" value={item.cores} />
            <InfoRow label="Revestimento" value={item.revestimento} />
            <InfoRow label="Acabamento" value={item.acabamento} />
            <InfoRow label="Extras" value={item.extras} />
            <InfoRow label="Unidade" value={item.preco_unidade} />
          </div>
          {item.prazo && (
            <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-50 text-sm text-slate-500">
              <Clock size={13} />
              <span>Prazo: {item.prazo}</span>
            </div>
          )}
        </div>

        {/* Variações / Fases futuras */}
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 mb-6">
          <div className="flex items-center gap-2 text-amber-700">
            <Layers size={14} />
            <span className="text-xs font-medium">
              Faixas de quantidade e variações disponíveis em breve (Fases 2 e 3)
            </span>
          </div>
        </div>

        {/* Rodapé — link externo + captura */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          {item.capturado_em && (
            <span>Capturado em {formatDate(item.capturado_em)}</span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <ExternalLink size={12} />
              Ver no site da Scan
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
