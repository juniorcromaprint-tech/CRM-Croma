// ============================================================================
// AvisosManager — Croma Print ERP/CRM
// Gerenciamento do Quadro de Avisos Internos (CRUD admin)
// ============================================================================

import { useState, useMemo } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDate } from '@/shared/utils/format';
import { useAvisosList, useDeleteAviso, type Aviso } from '../hooks/useAvisos';
import AvisoFormDialog from './AvisoFormDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

type AvisoStatus = 'ativo' | 'expirado' | 'futuro';

function getStatus(aviso: Aviso): AvisoStatus {
  const now = new Date();
  const inicio = new Date(aviso.data_inicio);
  const fim = aviso.data_fim ? new Date(aviso.data_fim) : null;

  if (aviso.fixo) return 'ativo';
  if (inicio > now) return 'futuro';
  if (fim && fim < now) return 'expirado';
  return 'ativo';
}

const STATUS_LABELS: Record<AvisoStatus, string> = {
  ativo: 'Ativo',
  expirado: 'Expirado',
  futuro: 'Agendado',
};

const STATUS_VARIANT: Record<AvisoStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ativo: 'default',
  expirado: 'secondary',
  futuro: 'outline',
};

const GRUPO_LABELS: Record<string, string> = {
  admin: 'Admin',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  producao: 'Produção',
  gerente: 'Gerente',
  instalador: 'Instalador',
};

function GruposBadges({ grupos }: { grupos: string[] }) {
  if (!grupos || grupos.length === 0) {
    return <span className="text-xs text-slate-400 italic">Todos</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {grupos.map((g) => (
        <span
          key={g}
          className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5"
        >
          {GRUPO_LABELS[g] ?? g}
        </span>
      ))}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface AvisoRowProps {
  aviso: Aviso;
  onEdit: (aviso: Aviso) => void;
  onDelete: (id: string) => void;
}

function AvisoRow({ aviso, onEdit, onDelete }: AvisoRowProps) {
  const status = getStatus(aviso);
  const isAlerta = aviso.tipo === 'alerta';

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isAlerta ? (
            <AlertTriangle size={15} className="text-red-500 shrink-0" />
          ) : (
            <Info size={15} className="text-blue-500 shrink-0" />
          )}
          <Badge variant={isAlerta ? 'destructive' : 'default'} className="text-xs">
            {isAlerta ? 'Alerta' : 'Aviso'}
          </Badge>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]" title={aviso.titulo}>
          {aviso.titulo}
        </p>
        <p className="text-xs text-slate-400 truncate max-w-[200px]" title={aviso.mensagem}>
          {aviso.mensagem}
        </p>
      </td>
      <td className="px-4 py-3">
        <GruposBadges grupos={aviso.grupo_destino} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatDate(aviso.data_inicio)}
        {aviso.data_fim && (
          <span> → {formatDate(aviso.data_fim)}</span>
        )}
        {aviso.fixo && (
          <span className="ml-1 text-slate-400">(permanente)</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[status]}>
          {STATUS_LABELS[status]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(aviso)}
            className="h-8 w-8 text-slate-500 hover:text-blue-600"
            title="Editar"
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(aviso.id)}
            className="h-8 w-8 text-slate-500 hover:text-red-600"
            title="Excluir"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AvisosManager() {
  const { data: avisos = [], isLoading } = useAvisosList();
  const deleteMutation = useDeleteAviso();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterTipo, setFilterTipo] = useState<'todos' | 'aviso' | 'alerta'>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | AvisoStatus>('todos');

  const filtered = useMemo(() => {
    return avisos.filter((a) => {
      if (filterTipo !== 'todos' && a.tipo !== filterTipo) return false;
      if (filterStatus !== 'todos' && getStatus(a) !== filterStatus) return false;
      return true;
    });
  }, [avisos, filterTipo, filterStatus]);

  const handleEdit = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingAviso(null);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingAviso(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Megaphone size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Quadro de Avisos</h1>
            <p className="text-sm text-slate-400">Comunicados internos para a equipe</p>
          </div>
        </div>
        <Button
          onClick={handleNew}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl"
        >
          <Plus size={16} className="mr-2" />
          Novo Aviso
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as typeof filterTipo)}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="aviso">Aviso</SelectItem>
            <SelectItem value="alerta">Alerta</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="futuro">Agendado</SelectItem>
            <SelectItem value="expirado">Expirado</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-slate-400 ml-auto">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum aviso encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">
              Clique em "Novo Aviso" para criar o primeiro comunicado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Título / Mensagem</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Grupos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Vigência</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((aviso) => (
                  <AvisoRow
                    key={aviso.id}
                    aviso={aviso}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form dialog */}
      <AvisoFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        aviso={editingAviso}
      />

      {/* Delete confirm */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O aviso será removido permanentemente do quadro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
