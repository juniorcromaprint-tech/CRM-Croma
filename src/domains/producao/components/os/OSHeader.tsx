import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Hash, MapPin } from 'lucide-react';
import { formatDate } from '@/shared/utils/format';
import { OS_STATUS_COLORS, OP_STATUS_COLORS } from '../../types/ordem-servico';

interface OSHeaderProps {
  numero: string;
  status: string;
  prioridade: string | number;
  dataPrometida: string | null;
  aprovadoEm: string | null;
  createdAt?: string;
  referencia?: string | null;
  pedidoNumero?: string;
  orcamentoNumero?: string;
  mode: 'pedido' | 'op';
}

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
  '0': 'Normal',
  '1': 'Alta',
  '2': 'Urgente',
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-600',
  alta: 'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
  '0': 'bg-blue-100 text-blue-600',
  '1': 'bg-amber-100 text-amber-700',
  '2': 'bg-red-100 text-red-700',
};

export function OSHeader({
  numero, status, prioridade, dataPrometida, aprovadoEm,
  createdAt, referencia, pedidoNumero, orcamentoNumero, mode,
}: OSHeaderProps) {
  const statusMap = mode === 'pedido' ? OS_STATUS_COLORS : OP_STATUS_COLORS;
  const statusConfig = statusMap[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  const prioridadeKey = String(prioridade);

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">
            {mode === 'pedido' ? 'Ordem de Serviço' : 'OS da Produção'} #{numero}
          </h1>
          <Badge className={`${statusConfig.bg} ${statusConfig.text} text-sm px-3 py-1`}>
            {statusConfig.label}
          </Badge>
          {prioridadeKey !== 'normal' && prioridadeKey !== '0' && (
            <Badge className={`${PRIORIDADE_COLORS[prioridadeKey] || ''} text-sm px-3 py-1`}>
              {PRIORIDADE_LABELS[prioridadeKey] || prioridadeKey}
            </Badge>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {dataPrometida && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Calendar size={14} /> Entrega
            </div>
            <p className="font-semibold text-slate-800">{formatDate(dataPrometida)}</p>
          </div>
        )}
        {aprovadoEm && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Clock size={14} /> Aprovação
            </div>
            <p className="font-semibold text-slate-800">{formatDate(aprovadoEm)}</p>
          </div>
        )}
        {referencia && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <MapPin size={14} /> Referência
            </div>
            <p className="font-semibold text-slate-800">{referencia}</p>
          </div>
        )}
        {pedidoNumero && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Hash size={14} /> Pedido
            </div>
            <p className="font-semibold text-slate-800">#{pedidoNumero}</p>
          </div>
        )}
      </div>
    </div>
  );
}
