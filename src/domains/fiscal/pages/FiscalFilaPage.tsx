import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { brl, formatDate } from '@/shared/utils/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { List, RefreshCw, Loader2, RotateCcw, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useFiscalFila } from '../hooks/useFiscal';

const FILA_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: { label: '⏳ Pendente', className: 'bg-slate-100 text-slate-600' },
  processando: { label: '🔄 Processando', className: 'bg-blue-100 text-blue-700 animate-pulse' },
  aguardando_retorno: { label: '⌛ Aguardando', className: 'bg-amber-100 text-amber-700' },
  sucesso: { label: '✅ Sucesso', className: 'bg-green-100 text-green-700' },
  falha: { label: '❌ Falha', className: 'bg-red-100 text-red-700' },
  cancelado: { label: '🚫 Cancelado', className: 'bg-gray-100 text-gray-500' },
};

export default function FiscalFilaPage() {
  const qc = useQueryClient();
  const { data: fila = [], isLoading, refetch } = useFiscalFila();

  const handleSincronizar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-sync-status', { body: {} });
      if (error) throw error;
      showSuccess(`Sincronizado! ${(data as any)?.processados ?? 0} documentos atualizados`);
      qc.invalidateQueries({ queryKey: ['fiscal_filas_emissao'] });
      qc.invalidateQueries({ queryKey: ['fiscal_documentos'] });
    } catch (err: any) {
      showError(err.message ?? 'Erro ao sincronizar');
    }
  };

  const kpis = {
    total: (fila as any[]).length,
    pendentes: (fila as any[]).filter((f: any) => f.status_fila === 'pendente').length,
    processando: (fila as any[]).filter((f: any) => ['processando', 'aguardando_retorno'].includes(f.status_fila)).length,
    sucesso: (fila as any[]).filter((f: any) => f.status_fila === 'sucesso').length,
    falha: (fila as any[]).filter((f: any) => f.status_fila === 'falha').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <List className="w-7 h-7 text-indigo-600" /> Fila de Emissão
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitoramento da fila de processamento de NF-e · Atualiza a cada 15s</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSincronizar}>
            <RotateCcw className="w-4 h-4 mr-1" /> Sincronizar Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: kpis.total, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Pendentes', value: kpis.pendentes, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Processando', value: kpis.processando, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Sucesso', value: kpis.sucesso, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Com Falha', value: kpis.falha, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border rounded-xl p-3`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Documento</TableHead>
              <TableHead>Cliente / Pedido</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status Fila</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Últ. Erro</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
            ) : (fila as any[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <List className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Fila vazia — nenhum documento em processamento</p>
                </TableCell>
              </TableRow>
            ) : (fila as any[]).map((item: any) => {
              const cfg = FILA_STATUS_CONFIG[item.status_fila] ?? { label: item.status_fila, className: 'bg-slate-100 text-slate-600' };
              return (
                <TableRow key={item.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono text-xs text-slate-500">{item.fiscal_documento_id?.slice(-8).toUpperCase()}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{item.fiscal_documentos?.clientes?.razao_social ?? '---'}</div>
                    <div className="text-xs text-slate-400">Pedido: {item.fiscal_documentos?.pedidos?.numero ?? '---'}</div>
                  </TableCell>
                  <TableCell className="font-semibold">{brl(item.fiscal_documentos?.valor_total ?? 0)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-mono ${item.tentativas > 2 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.tentativas}x</span>
                  </TableCell>
                  <TableCell>
                    {item.ultimo_erro ? (
                      <span className="text-xs text-red-500 max-w-[200px] truncate block" title={item.ultimo_erro}>{item.ultimo_erro}</span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{formatDate(item.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
