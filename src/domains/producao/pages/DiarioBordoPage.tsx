import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Plus, Loader2 } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { brl } from '@/shared/utils/format'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useDiarioBordo,
  useRegistrarManutencao,
  type ManutencaoTipo,
} from '../hooks/useDiarioBordo'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIPO_CONFIG: Record<
  ManutencaoTipo,
  { label: string; className: string }
> = {
  preventiva: {
    label: 'Preventiva',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  corretiva: {
    label: 'Corretiva',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  limpeza: {
    label: 'Limpeza',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  calibracao: {
    label: 'Calibração',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
}

interface Ferramenta {
  id: string
  nome: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '—'
  // dateStr from DB may be 'YYYY-MM-DD' or ISO timestamp
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

function formatDateTimeBR(isoStr: string): string {
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TipoBadge({ tipo }: { tipo: ManutencaoTipo }) {
  const cfg = TIPO_CONFIG[tipo]
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DiarioBordoPage() {
  const { profile } = useAuth()

  // Filter state
  const [selectedFerramenta, setSelectedFerramenta] = useState<string>('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formFerramenta, setFormFerramenta] = useState<string>('')
  const [formTipo, setFormTipo] = useState<ManutencaoTipo>('preventiva')
  const [formDescricao, setFormDescricao] = useState('')
  const [formCusto, setFormCusto] = useState<string>('')
  const [formProxima, setFormProxima] = useState<string>('')

  // Queries
  const feramentasQuery = useQuery({
    queryKey: ['ferramentas_list'],
    queryFn: async (): Promise<Ferramenta[]> => {
      const { data, error } = await supabase
        .from('ferramentas')
        .select('id, nome')
        .order('nome')
      if (error) throw new Error(error.message)
      return (data ?? []) as Ferramenta[]
    },
    staleTime: 1000 * 60 * 5,
  })

  const ferramentas = feramentasQuery.data ?? []

  const { data: entries = [], isLoading } = useDiarioBordo(
    selectedFerramenta || undefined
  )

  const registrar = useRegistrarManutencao()

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function openDialog() {
    setFormFerramenta('')
    setFormTipo('preventiva')
    setFormDescricao('')
    setFormCusto('')
    setFormProxima('')
    setDialogOpen(true)
  }

  function handleSave() {
    if (!formFerramenta || !formDescricao.trim()) return

    const payload: Parameters<typeof registrar.mutate>[0] = {
      ferramenta_id: formFerramenta,
      tipo: formTipo,
      descricao: formDescricao.trim(),
    }

    if (profile?.id) payload.realizado_por = profile.id
    if (formCusto !== '') payload.custo = parseFloat(formCusto)
    if (formProxima !== '') payload.proxima_manutencao = formProxima

    registrar.mutate(payload, {
      onSuccess: () => setDialogOpen(false),
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-xl">
            <BookOpen className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Diário de Bordo
            </h1>
            <p className="text-sm text-slate-500">
              Registro de manutenção de equipamentos
            </p>
          </div>
        </div>
        <Button onClick={openDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Registrar Manutenção
        </Button>
      </div>

      {/* Equipment filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Filtrar por equipamento:
          </Label>
          <Select
            value={selectedFerramenta || "__all__"}
            onValueChange={(v) => setSelectedFerramenta(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Todos os equipamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os equipamentos</SelectItem>
              {ferramentas.filter((f) => f.id).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFerramenta && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFerramenta('')}
              className="text-slate-500"
            >
              Limpar filtro
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">Carregando...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <BookOpen className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum registro encontrado.</p>
            <p className="text-xs mt-1">
              Clique em "Registrar Manutenção" para adicionar o primeiro.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-600">Equipamento</TableHead>
                <TableHead className="font-semibold text-slate-600">Descrição</TableHead>
                <TableHead className="font-semibold text-slate-600">Realizado por</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Custo</TableHead>
                <TableHead className="font-semibold text-slate-600">Próxima Manutenção</TableHead>
                <TableHead className="font-semibold text-slate-600">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <TipoBadge tipo={entry.tipo} />
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {entry.ferramentas?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-slate-600 max-w-xs">
                    <span className="line-clamp-2">{entry.descricao}</span>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {entry.profiles?.full_name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-slate-700">
                    {entry.custo != null ? brl(entry.custo) : '—'}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {formatDateBR(entry.proxima_manutencao)}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {formatDateTimeBR(entry.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: Registrar Manutenção */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-600" />
              Registrar Manutenção
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Equipamento */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Equipamento <span className="text-red-500">*</span>
              </Label>
              <Select value={formFerramenta} onValueChange={setFormFerramenta}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {ferramentas.filter((f) => f.id).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Tipo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formTipo}
                onValueChange={(v) => setFormTipo(v as ManutencaoTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(TIPO_CONFIG) as [
                      ManutencaoTipo,
                      { label: string; className: string },
                    ][]
                  ).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Descrição <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descreva a manutenção realizada..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Custo + Próxima manutenção side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Custo (R$){' '}
                  <span className="text-slate-400 font-normal">opcional</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCusto}
                  onChange={(e) => setFormCusto(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Próxima Manutenção{' '}
                  <span className="text-slate-400 font-normal">opcional</span>
                </Label>
                <Input
                  type="date"
                  value={formProxima}
                  onChange={(e) => setFormProxima(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={registrar.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formFerramenta ||
                !formDescricao.trim() ||
                registrar.isPending
              }
              className="gap-2"
            >
              {registrar.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
