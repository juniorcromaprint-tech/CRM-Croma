import React, { useState, useMemo } from 'react'
import {
  Plus, Search, FileText, Trash2, Loader2,
  TrendingUp, CheckCircle2, Clock, DollarSign, ShoppingCart,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  usePropostas, useCriarProposta, useExcluirProposta, useConverterPropostaEmPedido,
} from '../hooks/usePropostas'
import type { PropostaStatus, Proposta } from '../hooks/usePropostas'
import { brl } from '@/shared/utils/format'
import { showSuccess } from '@/utils/toast'
import { useAuth } from '@/contexts/AuthContext'

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PropostaStatus, { label: string; cls: string }> = {
  rascunho:      { label: 'Rascunho',       cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  enviada:       { label: 'Enviada',        cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  em_negociacao: { label: 'Em negociação',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  aprovada:      { label: 'Aprovada',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  recusada:      { label: 'Recusada',       cls: 'bg-red-100 text-red-700 border-red-200' },
  expirada:      { label: 'Expirada',       cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PropostasPage() {
  const navigate = useNavigate()
  const { profile, can } = useAuth()
  const isAdmin = !profile?.role || profile.role === 'admin'
  const canCriar = can('comercial', 'criar')
  const canExcluir = can('comercial', 'excluir')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PropostaStatus | 'todos'>('todos')

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formTitulo, setFormTitulo] = useState('')
  const [formCliente, setFormCliente] = useState('')
  const [formValor, setFormValor] = useState('')
  const [formProb, setFormProb] = useState('50')
  const [formDesc, setFormDesc] = useState('')

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  // Converter em pedido state
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; propostaId: string | null; proposta: Proposta | null }>({ open: false, propostaId: null, proposta: null })

  // Queries
  const filtros = useMemo(() => ({
    search: search || undefined,
    status: statusFilter,
  }), [search, statusFilter])

  const { data: propostas = [], isLoading } = usePropostas(filtros)
  const { data: todos = [] } = usePropostas()
  const criar = useCriarProposta()
  const excluir = useExcluirProposta()
  const converter = useConverterPropostaEmPedido()

  // KPIs
  const kpis = useMemo(() => {
    const total = todos.length
    const emNegociacao = todos.filter((p) => p.status === 'em_negociacao').length
    const aprovadas = todos.filter((p) => p.status === 'aprovada').length
    const valorTotal = todos.reduce((acc, p) => acc + (p.valor_estimado ?? 0), 0)
    return { total, emNegociacao, aprovadas, valorTotal }
  }, [todos])

  function handleConverter(p: Proposta) {
    setConfirmDialog({ open: true, propostaId: p.id, proposta: p })
  }

  function handleConverterConfirm() {
    const p = confirmDialog.proposta
    if (!p) return
    setConfirmDialog({ open: false, propostaId: null, proposta: null })
    setConvertingId(p.id)
    converter.mutate(
      { id: p.id, cliente_id: p.cliente_id, valor_estimado: p.valor_estimado ?? 0 },
      {
        onSuccess: (pedido) => {
          setConvertingId(null)
          showSuccess(`Pedido ${pedido.numero ?? ''} criado com sucesso!`)
          navigate(`/pedidos/${pedido.id}`)
        },
        onSettled: () => setConvertingId(null),
      },
    )
  }

  function resetForm() {
    setFormTitulo('')
    setFormCliente('')
    setFormValor('')
    setFormProb('50')
    setFormDesc('')
  }

  function handleCriar() {
    if (!formTitulo.trim()) return
    criar.mutate(
      {
        titulo: formTitulo.trim(),
        cliente_id: formCliente.trim() || undefined,
        valor_estimado: formValor ? parseFloat(formValor) : undefined,
        probabilidade: formProb ? parseInt(formProb, 10) : undefined,
        descricao: formDesc.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetForm()
          setIsCreateOpen(false)
        },
      }
    )
  }

  function handleExcluir() {
    if (deleteId) {
      excluir.mutate({ id: deleteId, userId: profile?.id }, {
        onSuccess: () => setDeleteId(null),
      })
    }
  }

  const canDelete = (status: PropostaStatus) =>
    ['rascunho', 'recusada', 'expirada'].includes(status)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Propostas</h1>
          <p className="text-slate-500 mt-1">Gerencie oportunidades comerciais no pipeline de vendas</p>
        </div>
        {canCriar && (
          <Button
            onClick={() => { resetForm(); setIsCreateOpen(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
          >
            <Plus size={20} className="mr-2" /> Nova Proposta
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '...' : kpis.total}</p>
              <p className="text-xs text-slate-500">Total de propostas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '...' : kpis.emNegociacao}</p>
              <p className="text-xs text-slate-500">Em negociação</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '...' : kpis.aprovadas}</p>
              <p className="text-xs text-slate-500">Aprovadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 leading-tight">{isLoading ? '...' : brl(kpis.valorTotal)}</p>
              <p className="text-xs text-slate-500">Valor estimado total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PropostaStatus | 'todos')}>
          <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : propostas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={48} className="text-slate-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Nenhuma proposta encontrada</h2>
          <p className="text-slate-400 mt-2 max-w-sm">
            {search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros de busca'
              : 'Crie sua primeira proposta para começar'}
          </p>
          {canCriar && !search && statusFilter === 'todos' && (
            <Button
              onClick={() => { resetForm(); setIsCreateOpen(true) }}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus size={16} className="mr-2" /> Nova Proposta
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Número</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Título</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor Est.</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Prob.%</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propostas.map((p) => {
                  const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.rascunho
                  const clienteNome = p.clientes?.nome_fantasia || p.clientes?.razao_social || '—'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-mono font-medium text-slate-600">{p.numero ?? '—'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{p.titulo}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm text-slate-600 truncate max-w-[160px]">{clienteNome}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-bold tabular-nums text-slate-800">{brl(p.valor_estimado)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-sm tabular-nums text-slate-600">{p.probabilidade}%</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.status === 'aprovada' && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 px-2 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs font-medium gap-1"
                              onClick={() => handleConverter(p)}
                              disabled={convertingId === p.id || converter.isPending}
                              title="Converter em pedido"
                            >
                              {convertingId === p.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <ShoppingCart size={13} />}
                              Converter em Pedido
                            </Button>
                          )}
                          {canExcluir && (canDelete(p.status) || isAdmin) && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setDeleteId(p.id); setDeleteName(p.titulo) }}
                              title={canDelete(p.status) ? 'Excluir' : 'Excluir (Admin)'}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {propostas.map((p) => {
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.rascunho
              const clienteNome = p.clientes?.nome_fantasia || p.clientes?.razao_social || '—'
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{p.numero ?? '—'}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sc.cls}`}>{sc.label}</span>
                      </div>
                      <p className="font-semibold text-slate-800">{p.titulo}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{clienteNome}</p>
                      {p.status === 'aprovada' && (
                        <Button
                          variant="outline" size="sm"
                          className="mt-2 h-7 px-2 rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs font-medium gap-1"
                          onClick={() => handleConverter(p)}
                          disabled={convertingId === p.id || converter.isPending}
                        >
                          {convertingId === p.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <ShoppingCart size={12} />}
                          Converter em Pedido
                        </Button>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums text-slate-800">{brl(p.valor_estimado)}</p>
                      <p className="text-xs text-slate-400">{p.probabilidade}%</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { resetForm() } setIsCreateOpen(open) }}>
        <DialogContent className="rounded-2xl max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Nova Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título <span className="text-red-500">*</span></Label>
              <Input
                id="titulo"
                placeholder="Ex: Proposta de banner para loja X"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                placeholder="Nome do cliente (opcional)"
                value={formCliente}
                onChange={(e) => setFormCliente(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="valor">Valor estimado (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0,00"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prob">Probabilidade (%)</Label>
                <Input
                  id="prob"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="50"
                  value={formProb}
                  onChange={(e) => setFormProb(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                placeholder="Descrição da proposta..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { resetForm(); setIsCreateOpen(false) }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={!formTitulo.trim() || criar.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {criar.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Criar Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm converter dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, propostaId: null, proposta: null })}>
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Converter em Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja criar um pedido a partir desta proposta? Um pedido será gerado com os itens da proposta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConverterConfirm}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              Converter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Proposta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteName}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluir.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {excluir.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
