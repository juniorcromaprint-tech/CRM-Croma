import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, ArrowRight, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePedidosParaExpedicao, useLiberarExpedicao } from '../hooks/useExpedicao';
import { brl, formatDate } from '@/shared/utils/format';

export default function ExpedicaoPage() {
  const { data: pedidos = [], isLoading } = usePedidosParaExpedicao();
  const liberar = useLiberarExpedicao();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expedição</h1>
          <p className="text-slate-500 text-sm mt-1">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} aguardando liberação
          </p>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum pedido para expedição</h3>
          <p className="text-sm text-slate-400 mt-1">
            Pedidos produzidos aparecerão aqui para liberação
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Cliente</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Prometido</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const nome = p.clientes?.nome_fantasia || p.clientes?.razao_social || '—';
                const isAtrasado =
                  p.data_prometida &&
                  p.data_prometida < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/pedidos/${p.id}`} className="text-blue-600 hover:underline font-medium text-sm">
                        {p.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{nome}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right font-medium">
                      {brl(p.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.data_prometida ? (
                        <span className={isAtrasado ? 'text-red-600 font-medium' : 'text-slate-600'}>
                          {formatDate(p.data_prometida)}
                          {isAtrasado && ' (atrasado)'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={
                          p.status === 'produzido'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-purple-100 text-purple-700'
                        }
                      >
                        {p.status === 'produzido' ? 'Produzido' : 'Aguard. Instalação'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                            disabled={liberar.isPending}
                          >
                            Liberar <ArrowRight size={14} className="ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => liberar.mutate({ pedidoId: p.id, tipo: 'instalacao', version: p.version })}
                          >
                            <MapPin size={14} className="mr-2" /> Enviar p/ Instalação
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => liberar.mutate({ pedidoId: p.id, tipo: 'retirada', version: p.version })}
                          >
                            <Package size={14} className="mr-2" /> Retirada pelo Cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => liberar.mutate({ pedidoId: p.id, tipo: 'envio', version: p.version })}
                          >
                            <Truck size={14} className="mr-2" /> Enviar por Transportadora
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
