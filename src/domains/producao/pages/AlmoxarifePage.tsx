import { useState } from 'react'
import { Package2, Loader2, RotateCcw, ArrowUpFromLine } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useFerramentas,
  useCheckouts,
  useCheckoutFerramenta,
  useDevolverFerramenta,
  type Ferramenta,
  type CheckoutAlmoxarife,
} from '@/domains/producao/hooks/useAlmoxarife'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function FerramentasSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function HistoricoSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckoutDialog — confirma retirada de ferramenta
// ---------------------------------------------------------------------------

interface CheckoutDialogProps {
  ferramenta: Ferramenta | null
  onClose: () => void
}

function CheckoutDialog({ ferramenta, onClose }: CheckoutDialogProps) {
  const { profile } = useAuth()
  const [obs, setObs] = useState('')
  const checkout = useCheckoutFerramenta()

  function handleConfirm() {
    if (!ferramenta) return
    checkout.mutate(
      {
        ferramenta_id: ferramenta.id,
        usuario_id: profile?.id,
        observacoes: obs.trim() || undefined,
      },
      { onSuccess: () => { setObs(''); onClose() } }
    )
  }

  return (
    <Dialog open={!!ferramenta} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Retirar Ferramenta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Ferramenta: <span className="font-medium text-foreground">{ferramenta?.nome}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="obs-checkout">Observações (opcional)</Label>
            <Textarea
              id="obs-checkout"
              placeholder="Ex: Uso na OS #1234, devolução prevista amanhã..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={checkout.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={checkout.isPending}>
            {checkout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Retirada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// FerramentaCard
// ---------------------------------------------------------------------------

interface FerramentaCardProps {
  ferramenta: Ferramenta
  onRetirar: (f: Ferramenta) => void
  checkouts: CheckoutAlmoxarife[]
}

function FerramentaCard({ ferramenta, onRetirar, checkouts }: FerramentaCardProps) {
  const activeCheckout = checkouts.find(
    (c) => c.ferramenta_id === ferramenta.id && c.retorno_em === null
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-slate-900 leading-tight">
          {ferramenta.nome}
        </span>
        {ferramenta.em_uso ? (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
            Em uso
          </Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
            Disponível
          </Badge>
        )}
      </div>

      {/* Descrição */}
      {ferramenta.descricao && (
        <p className="text-xs text-muted-foreground line-clamp-2">{ferramenta.descricao}</p>
      )}

      {/* Info de uso */}
      {ferramenta.em_uso && activeCheckout && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 space-y-0.5">
          {activeCheckout.pedidos?.numero && (
            <p>Pedido: <span className="font-medium">#{activeCheckout.pedidos.numero}</span></p>
          )}
          {activeCheckout.profiles?.full_name && (
            <p>Usuário: <span className="font-medium">{activeCheckout.profiles.full_name}</span></p>
          )}
          <p>Saída: {formatDateTime(activeCheckout.saida_em)}</p>
        </div>
      )}

      {/* Action */}
      {!ferramenta.em_uso && (
        <Button
          size="sm"
          variant="outline"
          className="mt-auto w-full"
          onClick={() => onRetirar(ferramenta)}
        >
          <ArrowUpFromLine className="mr-2 h-3.5 w-3.5" />
          Retirar
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HistoricoTable
// ---------------------------------------------------------------------------

interface HistoricoTableProps {
  checkouts: CheckoutAlmoxarife[]
  ferramentas: Ferramenta[]
}

function HistoricoTable({ checkouts, ferramentas }: HistoricoTableProps) {
  const devolver = useDevolverFerramenta()

  function handleDevolver(c: CheckoutAlmoxarife) {
    const ferramenta = ferramentas.find((f) => f.id === c.ferramenta_id)
    if (!ferramenta) return
    devolver.mutate({ checkoutId: c.id, ferramentaId: c.ferramenta_id })
  }

  if (checkouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Package2 className="h-10 w-10 opacity-30" />
        <p className="text-sm">Nenhum histórico de checkout.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ferramenta</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Pedido</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Saída</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Retorno</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {checkouts.map((c) => {
              const ferramenta = ferramentas.find((f) => f.id === c.ferramenta_id)
              const pendente = c.retorno_em === null && ferramenta?.em_uso === true

              return (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.ferramentas?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.pedidos?.numero ? `#${c.pedidos.numero}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDateTime(c.saida_em)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.retorno_em ? (
                      <span className="text-slate-600">{formatDateTime(c.retorno_em)}</span>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        Em campo
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pendente && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={devolver.isPending}
                        onClick={() => handleDevolver(c)}
                      >
                        {devolver.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Devolver
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AlmoxarifePage
// ---------------------------------------------------------------------------

export default function AlmoxarifePage() {
  const [selectedFerramenta, setSelectedFerramenta] = useState<Ferramenta | null>(null)

  const { data: ferramentas = [], isLoading: loadingFerramentas } = useFerramentas()
  const { data: checkouts = [], isLoading: loadingCheckouts } = useCheckouts()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-50 rounded-xl">
          <Package2 className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Almoxarife</h1>
          <p className="text-sm text-muted-foreground">
            Controle de ferramentas e veículos por ordem de serviço
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ferramentas">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ---- Ferramentas tab ---- */}
        <TabsContent value="ferramentas" className="mt-4">
          {loadingFerramentas ? (
            <FerramentasSkeleton />
          ) : ferramentas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma ferramenta cadastrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ferramentas.map((f) => (
                <FerramentaCard
                  key={f.id}
                  ferramenta={f}
                  checkouts={checkouts}
                  onRetirar={setSelectedFerramenta}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Histórico tab ---- */}
        <TabsContent value="historico" className="mt-4">
          {loadingCheckouts ? (
            <HistoricoSkeleton />
          ) : (
            <HistoricoTable checkouts={checkouts} ferramentas={ferramentas} />
          )}
        </TabsContent>
      </Tabs>

      {/* Checkout dialog */}
      <CheckoutDialog
        ferramenta={selectedFerramenta}
        onClose={() => setSelectedFerramenta(null)}
      />
    </div>
  )
}
