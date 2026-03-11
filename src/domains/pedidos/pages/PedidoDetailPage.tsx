import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderOpen, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePedido } from '../hooks/usePedidos'
import { useCriarPastaOneDrive } from '../hooks/useOneDrive'
import { brl } from '@/shared/utils/format'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho:                { label: 'Rascunho',               cls: 'bg-slate-100 text-slate-600' },
  aguardando_aprovacao:    { label: 'Aguard. Aprovação',      cls: 'bg-amber-100 text-amber-700' },
  aprovado:                { label: 'Aprovado',               cls: 'bg-blue-100 text-blue-700' },
  em_producao:             { label: 'Em Produção',            cls: 'bg-orange-100 text-orange-700' },
  produzido:               { label: 'Produzido',              cls: 'bg-teal-100 text-teal-700' },
  aguardando_instalacao:   { label: 'Aguard. Instalação',     cls: 'bg-purple-100 text-purple-700' },
  em_instalacao:           { label: 'Em Instalação',          cls: 'bg-indigo-100 text-indigo-700' },
  parcialmente_concluido:  { label: 'Parcial.',               cls: 'bg-yellow-100 text-yellow-700' },
  concluido:               { label: 'Concluído',              cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:               { label: 'Cancelado',              cls: 'bg-red-100 text-red-700' },
}

export default function PedidoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: pedido, isLoading } = usePedido(id)
  const criarPasta = useCriarPastaOneDrive()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <p className="text-slate-500">Pedido não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/pedidos')}>Voltar</Button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[pedido.status] ?? STATUS_CONFIG.rascunho
  const clienteNome = pedido.clientes?.nome_fantasia || pedido.clientes?.razao_social || '—'

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pedidos')} className="rounded-xl">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{pedido.numero}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
          </div>
          <p className="text-slate-500 mt-0.5">{clienteNome}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-800">{brl(pedido.valor_total)}</p>
          <p className="text-xs text-slate-500">Valor total</p>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="rounded-xl">
          <TabsTrigger value="dados" className="rounded-lg">Dados</TabsTrigger>
          <TabsTrigger value="arquivos" className="rounded-lg">📁 Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Número</p>
                <p className="font-semibold text-slate-800">{pedido.numero}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="font-semibold text-slate-800">{sc.label}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Prioridade</p>
                <p className="font-semibold text-slate-800 capitalize">{pedido.prioridade}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Entrega</p>
                <p className="font-semibold text-slate-800">
                  {pedido.data_prometida
                    ? new Date(pedido.data_prometida).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>
            {pedido.observacoes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Observações</p>
                <p className="text-slate-700 text-sm">{pedido.observacoes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="arquivos" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {(pedido as Record<string, unknown>).onedrive_folder_url ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <FolderOpen size={24} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">Pasta OneDrive vinculada</p>
                    <p className="text-xs text-slate-500 truncate">
                      {String((pedido as Record<string, unknown>).onedrive_folder_url)}
                    </p>
                  </div>
                  <a
                    href={String((pedido as Record<string, unknown>).onedrive_folder_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="rounded-xl gap-2 shrink-0">
                      <ExternalLink size={15} /> Abrir no OneDrive
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12">
                <FolderOpen size={48} className="text-slate-200" />
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Pasta OneDrive não criada</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Crie uma pasta no OneDrive para armazenar os arquivos deste pedido
                  </p>
                </div>
                <Button
                  onClick={() => criarPasta.mutate(pedido.id)}
                  disabled={criarPasta.isPending}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {criarPasta.isPending
                    ? <Loader2 size={16} className="animate-spin" />
                    : <FolderOpen size={16} />}
                  Criar Pasta no OneDrive
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
