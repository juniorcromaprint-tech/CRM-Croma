import { useState, useEffect } from 'react';
import { Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BulkActionBar } from './BulkActionBar';
import { useBulkEdit } from '../hooks/useBulkEdit';
import type { EntityConfig } from '../configs/entity-registry';

const PAGE_SIZE = 50;

interface DataGridProps {
  data: Record<string, unknown>[];
  entity: EntityConfig;
  queryKey: string[];
  isLoading?: boolean;
}

export function DataGrid({ data, entity, queryKey, isLoading }: DataGridProps) {
  const [page, setPage] = useState(0);
  const {
    isEditMode, setIsEditMode, selectedIds, editedCells,
    setCellValue, toggleSelect, selectAll, clearSelection,
    discardAll, saveAll, applyBulkAction, isSaving, isApplying, hasEdits, selectedCount,
  } = useBulkEdit(entity.table, queryKey);

  const editableCols = entity.columns.filter(c => c.key !== 'id' && c.editable !== false);
  const displayCols = editableCols.slice(0, 8); // Show max 8 cols

  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!hasEdits) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasEdits]);

  const getCellValue = (row: Record<string, unknown>, col: string, rowId: string) => {
    if (editedCells.has(rowId) && editedCells.get(rowId)!.has(col)) {
      return editedCells.get(rowId)!.get(col);
    }
    return row[col];
  };

  const isEdited = (rowId: string, col: string) =>
    editedCells.has(rowId) && editedCells.get(rowId)!.has(col);

  const renderCell = (row: Record<string, unknown>, col: typeof displayCols[0], rowId: string) => {
    const value = getCellValue(row, col.key, rowId);
    if (!isEditMode) {
      return (
        <span className="text-sm">
          {col.type === 'boolean' ? (value ? 'Sim' : 'Não') : String(value ?? '')}
        </span>
      );
    }

    const cellClass = isEdited(rowId, col.key)
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200';

    if (col.type === 'select' && col.options) {
      return (
        <select
          value={String(value ?? '')}
          onChange={e => setCellValue(rowId, col.key, e.target.value)}
          className={`w-full rounded-xl border px-2 py-1 text-sm ${cellClass}`}
        >
          <option value=""></option>
          {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    if (col.type === 'boolean') {
      return (
        <select
          value={value ? 'true' : 'false'}
          onChange={e => setCellValue(rowId, col.key, e.target.value === 'true')}
          className={`w-full rounded-xl border px-2 py-1 text-sm ${cellClass}`}
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    }

    return (
      <Input
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        value={String(value ?? '')}
        onChange={e => setCellValue(rowId, col.key, e.target.value)}
        className={`h-7 text-sm rounded-xl ${cellClass}`}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-slate-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{data.length} registros</span>
        <Button
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            if (isEditMode && hasEdits) {
              if (!confirm('Descartar alterações?')) return;
              discardAll();
            }
            setIsEditMode(!isEditMode);
          }}
          className={isEditMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Edit2 size={14} className="mr-1.5" />
          {isEditMode ? 'Sair do modo edição' : 'Editar'}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isEditMode && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === pageData.length && pageData.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) selectAll(pageData.map(r => String(r.id)));
                      else clearSelection();
                    }}
                  />
                </TableHead>
              )}
              {displayCols.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((row) => {
              const rowId = String(row.id);
              return (
                <TableRow key={rowId} className={selectedIds.has(rowId) ? 'bg-blue-50' : ''}>
                  {isEditMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(rowId)}
                        onCheckedChange={() => toggleSelect(rowId)}
                      />
                    </TableCell>
                  )}
                  {displayCols.map(col => (
                    <TableCell key={col.key} className="py-1">
                      {renderCell(row, col, rowId)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* BulkActionBar */}
      <BulkActionBar
        selectedCount={selectedCount}
        editCount={editedCells.size}
        entity={entity}
        onSaveAll={saveAll}
        onDiscard={discardAll}
        onApplyBulkAction={applyBulkAction}
        isSaving={isSaving}
        isApplying={isApplying}
      />
    </div>
  );
}
