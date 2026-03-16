import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useImportHistory } from '../hooks/useImportHistory';
import { getAllEntities } from '../configs/index';
import { formatDate } from '@/shared/utils/format';

const operationLabel: Record<string, string> = {
  import: 'Importação',
  export: 'Exportação',
  bulk_edit: 'Edição em massa',
};

const operationColor: Record<string, string> = {
  import: 'bg-blue-100 text-blue-700',
  export: 'bg-green-100 text-green-700',
  bulk_edit: 'bg-purple-100 text-purple-700',
};

function parseErrorDetails(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON
    }
  }
  return [];
}

export default function ImportHistoricoPage() {
  const { rows, total, isLoading, filters, setFilters, page, setPage, totalPages } = useImportHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const entities = getAllEntities();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/dados">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ArrowLeft size={14} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Histórico de Operações</h1>
          <p className="text-sm text-slate-500">{total} registro{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.entity ?? ''}
          onValueChange={v => { setFilters(f => ({ ...f, entity: v || undefined })); setPage(0); }}
        >
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Todas as entidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as entidades</SelectItem>
            {entities.map(e => (
              <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.operation ?? ''}
          onValueChange={v => {
            setFilters(f => ({ ...f, operation: (v || undefined) as 'import' | 'export' | 'bulk_edit' | undefined }));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Todas as operações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as operações</SelectItem>
            <SelectItem value="import">Importação</SelectItem>
            <SelectItem value="export">Exportação</SelectItem>
            <SelectItem value="bulk_edit">Edição em massa</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center text-sm text-slate-500">
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value || undefined })); setPage(0); }}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <span>até</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value || undefined })); setPage(0); }}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Carregando...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <History size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma operação encontrada</h3>
          <p className="text-sm text-slate-400 mt-1">Altere os filtros ou faça uma importação</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Operação</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Entidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Arquivo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Inseridos</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Atualizados</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Erros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op: Record<string, unknown>) => {
                const id = String(op.id);
                const isExpanded = expandedId === id;
                const errors = parseErrorDetails(op.error_details);
                return (
                  <>
                    <tr
                      key={id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {errors.length > 0
                          ? (isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)
                          : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(String(op.created_at ?? ''))}</td>
                      <td className="px-4 py-3">
                        <Badge className={operationColor[String(op.operation)] ?? ''}>
                          {operationLabel[String(op.operation)] ?? String(op.operation)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{String(op.entity ?? '')}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{String(op.filename ?? '—')}</td>
                      <td className="px-4 py-3 text-right">{String(op.total_rows ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{String(op.inserted ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{String(op.updated ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(op.errors) > 0
                          ? <span className="text-red-600 font-medium">{String(op.errors)}</span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                    </tr>
                    {isExpanded && errors.length > 0 && (
                      <tr key={`${id}-detail`}>
                        <td colSpan={9} className="px-6 py-3 bg-red-50 border-b border-slate-100">
                          <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                            <p className="font-medium text-red-700 mb-1">Detalhes dos erros:</p>
                            {errors.slice(0, 20).map((err: unknown, i: number) => (
                              <div key={i} className="text-red-600">
                                {JSON.stringify(err)}
                              </div>
                            ))}
                            {errors.length > 20 && (
                              <p className="text-red-400">+{errors.length - 20} erros adicionais</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
