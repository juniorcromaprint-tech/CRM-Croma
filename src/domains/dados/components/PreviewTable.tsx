// src/domains/dados/components/PreviewTable.tsx
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type RowStatus = 'insert' | 'update' | 'skip' | 'error';

interface PreviewRow {
  rowNum: number;
  status: RowStatus;
  data: Record<string, unknown>;
  errorMsg?: string;
}

interface PreviewTableProps {
  rows: PreviewRow[];
  columns: string[];
  maxRows?: number;
}

const statusBadge: Record<RowStatus, React.ReactElement> = {
  insert: <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Inserir</Badge>,
  update: <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Atualizar</Badge>,
  skip: <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Ignorar</Badge>,
  error: <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Erro</Badge>,
};

export function PreviewTable({ rows, columns, maxRows = 100 }: PreviewTableProps) {
  const displayRows = rows.slice(0, maxRows);
  const displayCols = columns.slice(0, 6); // Show max 6 columns to avoid overflow

  return (
    <div className="rounded-xl border border-slate-200 overflow-auto max-h-80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="w-24">Status</TableHead>
            {displayCols.map(col => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row) => (
            <TableRow key={row.rowNum} className={row.status === 'error' ? 'bg-red-50' : ''}>
              <TableCell className="text-xs text-slate-400">{row.rowNum}</TableCell>
              <TableCell>{statusBadge[row.status]}</TableCell>
              {displayCols.map(col => (
                <TableCell key={col} className="text-sm max-w-32 truncate">
                  {String(row.data[col] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > maxRows && (
        <p className="text-xs text-slate-400 text-center py-2">
          Mostrando {maxRows} de {rows.length} linhas
        </p>
      )}
    </div>
  );
}
