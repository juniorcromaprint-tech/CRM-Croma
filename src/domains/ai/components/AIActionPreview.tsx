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
    <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 text-xs">
      <div className="grid grid-cols-2 bg-slate-100 text-slate-500 font-medium">
        <div className="px-3 py-1.5 border-r border-slate-200">ANTES</div>
        <div className="px-3 py-1.5">DEPOIS</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 border-t border-slate-100">
          <div className="px-3 py-1.5 border-r border-slate-100 text-slate-400 line-through">
            {row.before}
          </div>
          <div className="px-3 py-1.5 text-slate-800 font-medium">
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
    if (s.nome) rows.push({ before: '—', after: s.nome as string });
    if (s.valor != null) rows.push({ before: '—', after: brl(s.valor as number) });
  }

  return rows;
}
