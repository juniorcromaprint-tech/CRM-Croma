// src/domains/terceirizacao/components/TerceirizacaoDetailDrawer.tsx

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { brl, formatDate } from '@/shared/utils/format';
import {
  ExternalLink,
  Clock,
  TrendingUp,
  Building2,
  Package,
  Layers,
  Table2,
} from 'lucide-react';
import type {
  TerceirizacaoItem,
  TerceirizacaoVariacao,
  TerceirizacaoVariacaoTipo,
} from '@/hooks/useTerceirizacaoCatalogo';
import {
  useTerceirizacaoFaixas,
  useTerceirizacaoVariacoes,
} from '@/hooks/useTerceirizacaoCatalogo';

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

// Tabela de faixas (Fase 2)
function FaixasTable({
  catalogoId,
  markupAplicado,
}: {
  catalogoId: string;
  markupAplicado: number | null;
}) {
  const { data: faixas = [], isLoading } = useTerceirizacaoFaixas(catalogoId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (faixas.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic mt-2">
        Faixas de quantidade ainda não capturadas para este produto.
      </p>
    );
  }

  const markup = markupAplicado ?? 40;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left pb-2 font-medium">A partir de</th>
            <th className="text-right pb-2 font-medium">Custo Scan</th>
            <th className="text-right pb-2 font-medium">Preço Venda</th>
          </tr>
        </thead>
        <tbody>
          {faixas.map((f, idx) => {
            const precoVenda = Math.round(f.preco_unitario * (1 + markup / 100) * 100) / 100;
            return (
              <tr
                key={f.id}
                className={`border-b border-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <td className="py-2 text-slate-600">
                  {f.qtd_min === 1 ? '1 unidade' : `${f.qtd_min} unidades`}
                </td>
                <td className="py-2 text-right font-mono text-slate-500 text-xs">
                  {brl(f.preco_unitario)}
                </td>
                <td className="py-2 text-right font-bold text-blue-700">
                  {brl(precoVenda)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        Markup de +{Math.round(markup)}% aplicado · Preços por unidade
      </p>
    </div>
  );
}

// Variacoes (Fase 3)
const TIPO_LABEL: Record<TerceirizacaoVariacaoTipo, string> = {
  cor: 'Cores',
  revestimento: 'Revestimentos',
  opcao: 'Opções',
  outro: 'Outras variações',
};

const TIPO_ORDEM: TerceirizacaoVariacaoTipo[] = ['cor', 'revestimento', 'opcao', 'outro'];

const TIPO_CHIP_STYLE: Record<TerceirizacaoVariacaoTipo, string> = {
  cor: 'border-rose-200 bg-rose-50 text-rose-700',
  revestimento: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  opcao: 'border-sky-200 bg-sky-50 text-sky-700',
  outro: 'border-slate-200 bg-slate-50 text-slate-600',
};

function agruparVariacoes(variacoes: TerceirizacaoVariacao[]) {
  const grupos = new Map<TerceirizacaoVariacaoTipo, TerceirizacaoVariacao[]>();
  for (const v of variacoes) {
    const tipo = (v.tipo ?? 'outro') as TerceirizacaoVariacaoTipo;
    const lista = grupos.get(tipo) ?? [];
    lista.push(v);
    grupos.set(tipo, lista);
  }
  return TIPO_ORDEM
    .filter((t) => grupos.has(t))
    .map((t) => ({ tipo: t, itens: grupos.get(t)! }));
}

function VariacoesChips({ catalogoId }: { catalogoId: string }) {
  const { data: variacoes = [], isLoading } = useTerceirizacaoVariacoes(catalogoId);

  if (isLoading) {
    return (
      <div className="animate-pulse mt-2 space-y-3">
        {[1, 2].map((i) => (
          <div key={i}>
            <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
            <div className="flex gap-1.5">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-6 w-16 bg-slate-100 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variacoes.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic mt-2">
        Nenhuma variação capturada para este produto.
      </p>
    );
  }

  const grupos = agruparVariacoes(variacoes);

  return (
    <div className="mt-2 space-y-4">
      {grupos.map(({ tipo, itens }) => (
        <div key={tipo}>
          <p className="text-xs font-medium text-slate-500 mb-1.5">
            {TIPO_LABEL[tipo]}
            <span className="text-slate-400 font-normal ml-1">({itens.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {itens.map((v) => (
              <span
                key={v.id}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TIPO_CHIP_STYLE[tipo]}`}
                title={v.valor_id}
              >
                {v.rotulo}
              </span>
            ))}
          </div>
        </div>
      ))}
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
  const temFaixas = item.preco_unidade === 'cada';

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

        <Badge variant="outline" className="mb-6 text-xs">
          {item.categoria}
        </Badge>

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

        {temFaixas && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Table2 size={13} />
              Faixas de Quantidade
            </h4>
            <FaixasTable
              catalogoId={item.id}
              markupAplicado={item.markup_aplicado}
            />
          </div>
        )}

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

        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Layers size={13} />
            Variações Disponíveis
          </h4>
          <VariacoesChips catalogoId={item.id} />
        </div>

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
