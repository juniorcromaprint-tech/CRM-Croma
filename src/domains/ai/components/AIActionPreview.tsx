import { ArrowRight } from 'lucide-react';
import { brl } from '@/shared/utils/format';

interface AIActionPreviewProps {
  valorAtual: unknown;
  valorSugerido: unknown;
  tipo: string;
}

export default function AIActionPreview({ valorAtual, valorSugerido, tipo }: AIActionPreviewProps) {
  const rows = buildDiffRows(valorAtual, valorSugerido, tipo);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 text-xs bg-slate-50">
      <div className="grid grid-cols-[1fr_24px_1fr] bg-slate-100 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
        <div className="px-3 py-1.5">Antes</div>
        <div />
        <div className="px-3 py-1.5">Depois</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_24px_1fr] border-t border-slate-200 items-center">
          <div className="px-3 py-2 text-slate-400 line-through">
            {row.before}
          </div>
          <div className="flex justify-center">
            <ArrowRight size={10} className="text-slate-300" />
          </div>
          <div className="px-3 py-2 text-emerald-600 font-semibold">
            {row.after}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildDiffRows(atual: unknown, sugerido: unknown, tipo: string) {
  const rows: { before: string; after: string }[] = [];
  const a = atual as Record<string, unknown> | null;
  const s = sugerido as Record<string, unknown>;

  if (!s) return rows;

  if (tipo === 'preco' || tipo === 'ajustar_quantidade') {
    const field = tipo === 'preco' ? 'preco' : 'quantidade';
    const formatFn = tipo === 'preco' ? (v: number) => brl(v) : (v: number) => String(v);
    rows.push({
      before: a?.[field] != null ? formatFn(a[field] as number) : '—',
      after: formatFn(s[field] as number),
    });
  } else if (tipo === 'trocar_material' || tipo === 'adicionar_material') {
    rows.push({
      before: (a?.nome as string) ?? '—',
      after: s.nome as string,
    });
    if (s.preco != null) {
      rows.push({
        before: a?.preco != null ? brl(a.preco as number) : '—',
        after: brl(s.preco as number),
      });
    }
  } else if (tipo === 'aplicar_desconto') {
    rows.push({
      before: a?.desconto != null ? `${a.desconto}%` : '0%',
      after: `${s.desconto}%`,
    });
  } else {
    const nome = (s.nome as string) ?? (s.descricao as string);
    const valor = (s.valor as number) ?? (s.preco as number);
    if (nome) rows.push({ before: '—', after: nome });
    if (valor != null) rows.push({ before: '—', after: brl(valor) });
  }

  return rows;
}
