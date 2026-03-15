import { User, FileText, AlertTriangle } from 'lucide-react';

interface OSResumoOperacionalProps {
  vendedorNome: string | null;
  pedidoNumero: string;
  observacoes: string | null;
  prioridade: string | number;
}

export function OSResumoOperacional({
  vendedorNome, pedidoNumero, observacoes, prioridade,
}: OSResumoOperacionalProps) {
  const isUrgente = String(prioridade) === 'urgente' || String(prioridade) === '2';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Resumo Operacional
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {vendedorNome && (
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <User size={12} /> Vendedor
            </div>
            <p className="text-sm font-medium text-slate-700">{vendedorNome}</p>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <FileText size={12} /> Pedido
          </div>
          <p className="text-sm font-medium text-slate-700">#{pedidoNumero}</p>
        </div>
      </div>

      {observacoes && (
        <div className={`mt-3 p-3 rounded-xl text-sm ${isUrgente ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} />
            <span className="font-semibold">Observações</span>
          </div>
          {observacoes}
        </div>
      )}
    </div>
  );
}
