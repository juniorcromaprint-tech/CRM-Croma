import { useState } from 'react';
import { Save, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { EntityConfig } from '../configs/entity-registry';

interface BulkActionBarProps {
  selectedCount: number;
  editCount: number;
  entity: EntityConfig;
  onSaveAll: () => void;
  onDiscard: () => void;
  onApplyBulkAction: (field: string, value: unknown) => void;
  isSaving: boolean;
  isApplying: boolean;
}

export function BulkActionBar({
  selectedCount, editCount, entity, onSaveAll, onDiscard, onApplyBulkAction, isSaving, isApplying,
}: BulkActionBarProps) {
  const [pendingAction, setPendingAction] = useState<{ field: string; label: string; type: string; options?: string[] } | null>(null);
  const [pendingValue, setPendingValue] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0 && editCount === 0) return null;

  const handleApply = () => {
    if (!pendingAction) return;
    const value = pendingAction.type === 'boolean'
      ? pendingValue === 'true'
      : pendingAction.type === 'number'
      ? parseFloat(pendingValue)
      : pendingValue;
    onApplyBulkAction(pendingAction.field, value);
    setPendingAction(null);
    setPendingValue('');
    setShowConfirm(false);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg px-6 py-3 flex items-center gap-3">
        {selectedCount > 0 && (
          <span className="text-sm font-medium text-slate-600">
            {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
          </span>
        )}
        {editCount > 0 && (
          <span className="text-sm font-medium text-amber-600">
            {editCount} alteraç{editCount !== 1 ? 'ões' : 'ão'} pendente{editCount !== 1 ? 's' : ''}
          </span>
        )}

        <div className="flex-1" />

        {selectedCount > 0 && entity.bulkActions && entity.bulkActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isApplying}>
                Alterar campo <ChevronDown size={12} className="ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {entity.bulkActions.map(action => (
                <DropdownMenuItem
                  key={action.field}
                  onClick={() => { setPendingAction(action); setShowConfirm(true); }}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {editCount > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={onDiscard} disabled={isSaving}>
              <Trash2 size={14} className="mr-1.5" />
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={onSaveAll}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save size={14} className="mr-1.5" />
              {isSaving ? 'Salvando...' : 'Salvar tudo'}
            </Button>
          </>
        )}
      </div>

      {/* Bulk action value dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Aplicar para {selectedCount} registro{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            {pendingAction?.type === 'select' && pendingAction.options ? (
              <select
                value={pendingValue}
                onChange={e => setPendingValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {pendingAction.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : pendingAction?.type === 'boolean' ? (
              <select
                value={pendingValue}
                onChange={e => setPendingValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            ) : (
              <Input
                type={pendingAction?.type === 'number' ? 'number' : 'text'}
                value={pendingValue}
                onChange={e => setPendingValue(e.target.value)}
                placeholder="Novo valor..."
                className="rounded-xl"
              />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingAction(null); setPendingValue(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApply}
              disabled={!pendingValue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
