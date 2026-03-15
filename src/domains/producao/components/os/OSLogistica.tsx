import { Truck, MapPin, Calendar } from 'lucide-react';
import { formatDate } from '@/shared/utils/format';
import type { OSCliente } from '../../types/ordem-servico';

interface OSLogisticaProps {
  dataPrometida: string | null;
  cliente: OSCliente;
  observacoes?: string | null;
}

function buildEnderecoEntrega(c: OSCliente): string {
  const parts = [
    c.endereco,
    c.numero,
    c.complemento,
    c.bairro,
    c.cep ? `CEP: ${c.cep}` : null,
    c.cidade,
    c.estado,
  ].filter(Boolean);
  return parts.join(', ');
}

export function OSLogistica({ dataPrometida, cliente, observacoes }: OSLogisticaProps) {
  const endereco = buildEnderecoEntrega(cliente);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Logística / Entrega
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Truck size={16} className="text-slate-400" />
          <span>Entrega / Instalação</span>
        </div>
        {dataPrometida && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={16} className="text-slate-400" />
            <span>Previsão: <strong>{formatDate(dataPrometida)}</strong></span>
          </div>
        )}
      </div>
      {endereco && (
        <div className="flex items-start gap-2 text-sm text-slate-600 mt-2">
          <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
          {endereco}
        </div>
      )}
    </div>
  );
}
