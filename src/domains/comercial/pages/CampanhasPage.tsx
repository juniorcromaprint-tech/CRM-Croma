import { useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { brl } from '@/shared/utils/format'
import {
  useCampanhas, useCriarCampanha, useExcluirCampanha,
  type CampanhaOrigem, type CampanhaStatus,
} from '../hooks/useCampanhas'

// ─── Badge configs ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<CampanhaStatus, { label: string; cls: string }> = {
  ativa:      { label: 'Ativa',      cls: 'bg-emerald-100 text-emerald-700' },
  pausada:    { label: 'Pausada',    cls: 'bg-amber-100 text-amber-700' },
  encerrada:  { label: 'Encerrada', cls: 'bg-slate-100 text-slate-600' },
}

const ORIGEM_CFG: Record<CampanhaOrigem, { label: string; cls: string }> = {
  google_ads: { label: 'Google Ads', cls: 'bg-blue-100 text-blue-700' },
  instagram:  { label: 'Instagram',  cls: 'bg-pink-100 text-pink-700' },
  facebook:   { label: 'Facebook',   cls: 'bg-indigo-100 text-indigo-700' },
  email:      { label: 'E-mail',     cls: 'bg-teal-100 text-teal-700' },
  whatsapp:   { label: 'WhatsApp',   cls: 'bg-green-100 text-green-700' },
  outro:      { label: 'Outro',      cls: 'bg-slate-100 text-slate-600' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Default form state ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: '',
  descricao: '',
  origem: 'outro' as CampanhaOrigem,
  status: 'ativa' as CampanhaStatus,
  orcamento: '',
  inicio: '',
  fim: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const { profile } = useAuth()
  const isAdmin = !profile?.role || profile.role === 'admin'

  const { data: campanhas = [], isLoading } = useCampanhas()
  const criar = useCriarCampanha()
  const excluir = useExcluirCampanha()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalAtivas    = campanhas.filter(c => c.status === 'ativa').length
  const totalLeads     = campanhas.reduce((s, c) => s + c.leads_gerados, 0)
  const totalConv      = campanhas.reduce((s, c) => s + c.conversoes, 0)
  const taxaConv       = totalLeads > 0 ? Math.round((totalConv / totalLeads) * 100) : 0
  const investimento   = campanhas.reduce((s, c) => s + Number(c.orcamento), 0)

  // ── Form helpers ──────────────────────────────────────────────────────────
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleClose() {
    setOpen(false)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.nome || !form.inicio) return
    await criar.mutateAsync({
      nome: form.nome,
      descricao: form.descricao || null,
      origem: form.origem,
      status: form.status,
      orcamento: Number(form.orcamento) || 0,
      inicio: form.inicio,
      fim: form.fim || null,
    })
    handleClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <Megaphone size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Campanhas</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gestão de campanhas de marketing</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> Nova Campanha
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Ativas</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{totalAtivas}</p>
          <p className="text-xs text-slate-400 mt-1">campanhas em execução</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leads Gerados</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{totalLeads.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-slate-400 mt-1">total acumulado</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Taxa de Conversão</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{taxaConv}%</p>
          <p className="text-xs text-slate-400 mt-1">{totalConv} conversões</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Investimento Total</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{brl(investimento)}</p>
          <p className="text-xs text-slate-400 mt-1">orçamento alocado</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : campanhas.length === 0 ? (
          <div className="p-14 text-center">
            <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhuma campanha cadastrada</h3>
            <p className="text-sm text-slate-400 mt-1">Clique em "Nova Campanha" para começar</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Nome</TableHead>
                <TableHead className="font-semibold text-slate-700">Origem</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Leads</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Conversão</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Período</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Orçamento</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map(c => {
                const convPct = c.leads_gerados > 0
                  ? Math.round((c.conversoes / c.leads_gerados) * 100)
                  : 0
                return (
                  <TableRow key={c.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <div className="font-medium text-slate-800">{c.nome}</div>
                      {c.descricao && (
                        <div className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                          {c.descricao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge {...ORIGEM_CFG[c.origem]} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-700">
                      {c.leads_gerados.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${convPct >= 10 ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {convPct}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge {...STATUS_CFG[c.status]} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {fmtDate(c.inicio)}
                      {c.fim ? ` → ${fmtDate(c.fim)}` : ' → em andamento'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-700">
                      {brl(Number(c.orcamento))}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                          disabled={excluir.isPending && deletingId === c.id}
                          onClick={() => {
                            setDeletingId(c.id)
                            excluir.mutate(c.id, { onSettled: () => setDeletingId(null) })
                          }}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Nova Campanha Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                placeholder="Ex: Black Friday 2026"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                placeholder="Objetivo e detalhes da campanha..."
                rows={2}
              />
            </div>

            {/* Origem + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={form.origem} onValueChange={v => set('origem', v as CampanhaOrigem)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORIGEM_CFG) as CampanhaOrigem[]).map(k => (
                      <SelectItem key={k} value={k}>{ORIGEM_CFG[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v as CampanhaStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_CFG) as CampanhaStatus[]).map(k => (
                      <SelectItem key={k} value={k}>{STATUS_CFG[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Orçamento */}
            <div>
              <Label htmlFor="orcamento">Orçamento (R$)</Label>
              <Input
                id="orcamento"
                type="number"
                min={0}
                step={0.01}
                value={form.orcamento}
                onChange={e => set('orcamento', e.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Início + Fim */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inicio">Início *</Label>
                <Input
                  id="inicio"
                  type="date"
                  value={form.inicio}
                  onChange={e => set('inicio', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fim">Fim</Label>
                <Input
                  id="fim"
                  type="date"
                  value={form.fim}
                  onChange={e => set('fim', e.target.value)}
                  min={form.inicio || undefined}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.nome || !form.inicio || criar.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {criar.isPending ? 'Salvando...' : 'Criar Campanha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
