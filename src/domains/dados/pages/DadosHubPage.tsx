import { Link } from 'react-router-dom';
import { Database, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getAllEntities } from '../configs/index';
import { EntityCard } from '../components/EntityCard';
import { formatDate } from '@/shared/utils/format';

const operationLabel: Record<string, string> = {
  import: 'Importação',
  export: 'Exportação',
  bulk_edit: 'Edição em massa',
};

export default function DadosHubPage() {
  const entities = getAllEntities();

  const { data: recentOps } = useQuery({
    queryKey: ['import-logs-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestão de Dados</h1>
            <p className="text-sm text-slate-500">Importar, exportar e editar dados em massa</p>
          </div>
        </div>
        <Link to="/admin/dados/historico">
          <Button variant="outline" size="sm">
            <History size={14} className="mr-1.5" />
            Histórico
          </Button>
        </Link>
      </div>

      {/* Info banner: recommended import order */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
        <strong>Ordem recomendada de importação:</strong>{' '}
        {entities.map((e, i) => (
          <span key={e.key}>
            {i > 0 && ' → '}
            {e.label}
          </span>
        ))}
      </div>

      {/* Entity cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {entities.map(entity => (
          <EntityCard key={entity.key} entity={entity} />
        ))}
      </div>

      {/* Recent operations */}
      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">Últimas operações</h2>
        {!recentOps || recentOps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <History size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Nenhuma operação registrada ainda</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Operação</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Entidade</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Linhas</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOps.map((op: Record<string, unknown>) => (
                  <tr key={op.id as string} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(op.created_at as string)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {operationLabel[op.operation as string] ?? (op.operation as string)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{op.entity as string}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {op.total_rows as number}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(op.errors as number) > 0 ? (
                        <Badge className="bg-red-100 text-red-600">
                          {op.errors as number} erro{(op.errors as number) !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-600">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
