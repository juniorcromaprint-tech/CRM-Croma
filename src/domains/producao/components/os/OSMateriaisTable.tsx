import type { OSMaterial } from '../../types/ordem-servico';

interface OSMateriaisTableProps {
  materiais: OSMaterial[];
}

export function OSMateriaisTable({ materiais }: OSMateriaisTableProps) {
  if (materiais.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Matéria-prima</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left py-1 font-medium">Material</th>
            <th className="text-center py-1 font-medium w-16">Unid</th>
            <th className="text-right py-1 font-medium w-24">Consumo</th>
          </tr>
        </thead>
        <tbody>
          {materiais.map((m) => (
            <tr key={m.id} className="border-b border-slate-50">
              <td className="py-1.5 text-slate-700">{m.nome}</td>
              <td className="py-1.5 text-center text-slate-500">{m.unidade}</td>
              <td className="py-1.5 text-right font-mono text-slate-700">
                {m.quantidade_prevista.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
