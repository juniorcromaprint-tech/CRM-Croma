// ============================================================================
// AvisoFormDialog — Croma Print ERP/CRM
// Dialog de criação/edição de avisos do quadro interno
// ============================================================================

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCreateAviso, useUpdateAviso, type Aviso, type AvisoInput } from '../hooks/useAvisos';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  titulo: z.string().min(1, 'Título obrigatório').max(120),
  mensagem: z.string().min(1, 'Mensagem obrigatória').max(1000),
  tipo: z.enum(['aviso', 'alerta']),
  grupo_destino: z.array(z.string()),
  data_inicio: z.string().min(1, 'Data de início obrigatória'),
  data_fim: z.string().nullable(),
  fixo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── Constants ─────────────────────────────────────────────────────────────────

const GRUPOS = [
  { value: 'admin', label: 'Administração' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'producao', label: 'Produção' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'instalador', label: 'Instalador' },
] as const;

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function toIso(date: string): string {
  if (!date) return new Date().toISOString();
  return new Date(date).toISOString();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AvisoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aviso?: Aviso | null;
}

export default function AvisoFormDialog({ open, onOpenChange, aviso }: AvisoFormDialogProps) {
  const createMutation = useCreateAviso();
  const updateMutation = useUpdateAviso();
  const isEditing = Boolean(aviso);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      titulo: '',
      mensagem: '',
      tipo: 'aviso',
      grupo_destino: [],
      data_inicio: new Date().toISOString().slice(0, 10),
      data_fim: null,
      fixo: false,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (aviso) {
      reset({
        titulo: aviso.titulo,
        mensagem: aviso.mensagem,
        tipo: aviso.tipo,
        grupo_destino: aviso.grupo_destino ?? [],
        data_inicio: toDateInputValue(aviso.data_inicio),
        data_fim: toDateInputValue(aviso.data_fim),
        fixo: aviso.fixo,
      });
    } else {
      reset({
        titulo: '',
        mensagem: '',
        tipo: 'aviso',
        grupo_destino: [],
        data_inicio: new Date().toISOString().slice(0, 10),
        data_fim: null,
        fixo: false,
      });
    }
  }, [aviso, reset, open]);

  const gruposSelected = watch('grupo_destino');

  const handleGroupToggle = (value: string, checked: boolean) => {
    const current = gruposSelected ?? [];
    if (checked) {
      setValue('grupo_destino', [...current, value]);
    } else {
      setValue('grupo_destino', current.filter((g) => g !== value));
    }
  };

  const onSubmit = async (values: FormValues) => {
    const input: AvisoInput = {
      ...values,
      data_inicio: toIso(values.data_inicio),
      data_fim: values.data_fim ? toIso(values.data_fim) : null,
    };

    if (isEditing && aviso) {
      await updateMutation.mutateAsync({ id: aviso.id, input });
    } else {
      await createMutation.mutateAsync(input);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ex: Reunião de equipe amanhã"
              className="rounded-xl"
              {...register('titulo')}
            />
            {errors.titulo && (
              <p className="text-xs text-red-500">{errors.titulo.message}</p>
            )}
          </div>

          {/* Mensagem */}
          <div className="space-y-1.5">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              placeholder="Detalhe o aviso para a equipe..."
              className="rounded-xl resize-none"
              rows={3}
              {...register('mensagem')}
            />
            {errors.mensagem && (
              <p className="text-xs text-red-500">{errors.mensagem.message}</p>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aviso">Aviso (azul)</SelectItem>
                    <SelectItem value="alerta">Alerta (vermelho)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Grupos de destino */}
          <div className="space-y-2">
            <Label>Grupos de destino <span className="text-slate-400 font-normal">(vazio = todos)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {GRUPOS.map((grupo) => (
                <label
                  key={grupo.value}
                  className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
                >
                  <Checkbox
                    checked={(gruposSelected ?? []).includes(grupo.value)}
                    onCheckedChange={(checked) =>
                      handleGroupToggle(grupo.value, Boolean(checked))
                    }
                  />
                  {grupo.label}
                </label>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data_inicio">Data de início</Label>
              <Input
                id="data_inicio"
                type="date"
                className="rounded-xl"
                {...register('data_inicio')}
              />
              {errors.data_inicio && (
                <p className="text-xs text-red-500">{errors.data_inicio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_fim">Data de término <span className="text-slate-400 font-normal">(opcional)</span></Label>
              <Input
                id="data_fim"
                type="date"
                className="rounded-xl"
                {...register('data_fim')}
              />
            </div>
          </div>

          {/* Fixo */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Aviso permanente</p>
              <p className="text-xs text-slate-400">Exibido sempre, independente da data de término</p>
            </div>
            <Controller
              control={control}
              name="fixo"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isPending}
            >
              {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
              {isEditing ? 'Salvar alterações' : 'Criar aviso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
