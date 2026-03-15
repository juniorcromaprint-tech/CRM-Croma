import { Ruler, Package, Paintbrush, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OSItem } from '../../types/ordem-servico';
import { OP_STATUS_COLORS } from '../../types/ordem-servico';
import { OSMateriaisTable } from './OSMateriaisTable';

interface OSItemCardProps {
  item: OSItem;
  index: number;
}

function formatDimensao(cm: number | null): string {
  if (!cm) return '-';
  return (cm / 100).toFixed(3);
}

export function OSItemCard({ item, index }: OSItemCardProps) {
  const opStatus = item.op_status ? OP_STATUS_COLORS[item.op_status] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
            {index + 1}
          </span>
          <div>
            <h4 className="font-semibold text-slate-800">{item.descricao}</h4>
            {item.modelo_nome && (
              <p className="text-sm text-slate-500">{item.produto_nome} — {item.modelo_nome}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.op_numero && opStatus && (
            <Badge className={`${opStatus.bg} ${opStatus.text} text-xs`}>
              {item.op_numero}
            </Badge>
          )}
          <span className="text-sm font-semibold text-slate-600">
            Qtd: {item.quantidade} {item.unidade}
          </span>
        </div>
      </div>

      {/* Dimensões e acabamento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {(item.largura_cm || item.altura_cm) && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Ruler size={14} className="text-slate-400" />
            {formatDimensao(item.largura_cm)} x {formatDimensao(item.altura_cm)} m
          </div>
        )}
        {item.area_m2 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Package size={14} className="text-slate-400" />
            {item.area_m2.toFixed(3)} m²
          </div>
        )}
        {item.acabamentos.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600 col-span-2">
            <Paintbrush size={14} className="text-slate-400" />
            {item.acabamentos.join(', ')}
          </div>
        )}
      </div>

      {/* Especificação / instruções */}
      {item.especificacao && (
        <p className="text-sm text-slate-500 mt-2 italic">{item.especificacao}</p>
      )}
      {item.instrucoes && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Instruções:</strong> {item.instrucoes}
        </div>
      )}

      {/* Arte preview */}
      {item.arte_url && (
        <div className="mt-3 flex items-center gap-2">
          <Image size={14} className="text-slate-400" />
          <a href={item.arte_url} target="_blank" rel="noopener noreferrer"
             className="text-sm text-blue-600 hover:underline">
            Ver arte
          </a>
        </div>
      )}

      {/* Materiais */}
      <OSMateriaisTable materiais={item.materiais} />
    </div>
  );
}
