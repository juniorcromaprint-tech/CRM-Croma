// ─── Boletos Page ────────────────────────────────────────────────────────────
// Croma Print ERP — Gestão de boletos, remessas e retornos bancários
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  FileDown,
  MoreVertical,
  Send,
  XCircle,
  CheckCircle2,
  Receipt,
  Upload,
  ArrowRightLeft,
} from 'lucide-react';

import { brl, formatDate, formatDateTime } from '@/shared/utils/format';
import { showError } from '@/utils/toast';

import BoletoStatusBadge from '../components/BoletoStatusBadge';
import RemessaStatusBadge from '../components/RemessaStatusBadge';
import BoletoStatsCards from '../components/BoletoStatsCards';
import BoletoFormDialog from '../components/BoletoFormDialog';
import GerarRemessaDialog from '../components/GerarRemessaDialog';
import type { BoletoStatus, BankSlip, BoletoFilters } from '../types/boleto.types';
import type { BankSlipFormData } from '../schemas/boleto.schemas';
import {
  useBoletos,
  useBoletoStats,
  useCreateBoleto,
  useEmitirBoleto,
  useMarcarProntoRemessa,
  useCancelBoleto,
  useRemessas,
  useGerarRemessa,
  useDownloadRemessa,
  useMarcarRemessaEnviada,
} from '../hooks/useBoletos';

// ─── Boletos Tab ────────────────────────────────────────────────────────────

function BoletosTab() {
  const [filters, setFilters] = useState<BoletoFilters>({});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showRemessa, setShowRemessa] = useState(false);

  const { data: boletos, isLoading } = useBoletos(filters);
  const { data: stats, isLoading: statsLoading } = useBoletoStats();
  const createBoleto = useCreateBoleto();
  const emitirBoleto = useEmitirBoleto();
  const marcarPronto = useMarcarProntoRemessa();
  const cancelBoleto = useCancelBoleto();
  const gerarRemessa = useGerarRemessa();

  const filtered = useMemo(() => {
    if (!boletos) return [];
    if (!search) return boletos;
    const q = search.toLowerCase();
    return boletos.filter(
      (b) =>
        b.sacado_nome.toLowerCase().includes(q) ||
        b.nosso_numero.includes(q) ||
        (b.clientes?.nome_fantasia ?? '').toLowerCase().includes(q) ||
        (b.clientes?.razao_social ?? '').toLowerCase().includes(q),
    );
  }, [boletos, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((b) => b.id)));
    }
  };

  const selectedSlips = filtered.filter((b) => selected.has(b.id));
  const canMarcarPronto = selectedSlips.every((b) => b.status === 'emitido');
  const canGerarRemessa = selectedSlips.every((b) => b.status === 'pronto_remessa');

  const handleCreateBoleto = (data: BankSlipFormData) => {
    createBoleto.mutate(data, { onSuccess: () => setShowForm(false) });
  };

  const handleGerarRemessa = (bankAccountId: string, slipIds: string[]) => {
    gerarRemessa.mutate(
      { bankAccountId, slipIds },
      {
        onSuccess: () => {
          setShowRemessa(false);
          setSelected(new Set());
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <BoletoStatsCards data={stats} isLoading={statsLoading} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome, nosso número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, status: v === 'all' ? undefined : (v as BoletoStatus) }))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="emitido">Emitido</SelectItem>
            <SelectItem value="pronto_remessa">Pronto Remessa</SelectItem>
            <SelectItem value="remetido">Remetido</SelectItem>
            <SelectItem value="registrado">Registrado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        {/* Ações em lote */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{selected.size} selecionado(s)</span>
            {canMarcarPronto && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => marcarPronto.mutate([...selected], { onSuccess: () => setSelected(new Set()) })}
                disabled={marcarPronto.isPending}
              >
                <Send size={14} className="mr-1" /> Marcar Pronto
              </Button>
            )}
            {canGerarRemessa && (
              <Button
                size="sm"
                onClick={() => setShowRemessa(true)}
              >
                <FileDown size={14} className="mr-1" /> Gerar Remessa
              </Button>
            )}
          </div>
        )}

        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1" /> Novo Boleto
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Carregando boletos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum boleto encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">Crie seu primeiro boleto para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="p-3 text-left font-medium text-slate-600">Sacado</th>
                  <th className="p-3 text-left font-medium text-slate-600">Nosso Nº</th>
                  <th className="p-3 text-left font-medium text-slate-600">Valor</th>
                  <th className="p-3 text-left font-medium text-slate-600">Vencimento</th>
                  <th className="p-3 text-left font-medium text-slate-600">Status</th>
                  <th className="p-3 text-left font-medium text-slate-600">Pedido</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((slip) => (
                  <tr key={slip.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(slip.id)}
                        onCheckedChange={() => toggleSelect(slip.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-700">
                        {slip.clientes?.nome_fantasia || slip.clientes?.razao_social || slip.sacado_nome}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{slip.nosso_numero}</td>
                    <td className="p-3 font-semibold">{brl(Number(slip.valor_nominal))}</td>
                    <td className="p-3 text-slate-600">{formatDate(slip.data_vencimento)}</td>
                    <td className="p-3">
                      <BoletoStatusBadge status={slip.status} />
                    </td>
                    <td className="p-3 text-slate-500">{slip.pedidos?.numero ?? '—'}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {slip.status === 'rascunho' && (
                            <DropdownMenuItem onClick={() => emitirBoleto.mutate(slip.id)}>
                              <CheckCircle2 size={14} className="mr-2" /> Emitir
                            </DropdownMenuItem>
                          )}
                          {slip.status === 'emitido' && (
                            <DropdownMenuItem onClick={() => marcarPronto.mutate([slip.id])}>
                              <Send size={14} className="mr-2" /> Pronto Remessa
                            </DropdownMenuItem>
                          )}
                          {['rascunho', 'emitido', 'pronto_remessa'].includes(slip.status) && (
                            <DropdownMenuItem
                              onClick={() => cancelBoleto.mutate(slip.id)}
                              className="text-red-600"
                            >
                              <XCircle size={14} className="mr-2" /> Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BoletoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleCreateBoleto}
        isSubmitting={createBoleto.isPending}
      />

      <GerarRemessaDialog
        open={showRemessa}
        onOpenChange={setShowRemessa}
        selectedSlips={selectedSlips}
        onConfirm={handleGerarRemessa}
        isSubmitting={gerarRemessa.isPending}
      />
    </div>
  );
}

// ─── Remessas Tab ───────────────────────────────────────────────────────────

function RemessasTab() {
  const { data: remessas, isLoading } = useRemessas();
  const downloadRemessa = useDownloadRemessa();
  const marcarEnviada = useMarcarRemessaEnviada();

  if (isLoading) {
    return <div className="p-12 text-center text-slate-400">Carregando remessas...</div>;
  }

  if (!remessas?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <FileDown size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhuma remessa gerada</h3>
        <p className="text-sm text-slate-400 mt-1">
          Selecione boletos prontos na aba Boletos e gere uma remessa
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-left font-medium text-slate-600">Arquivo</th>
              <th className="p-3 text-left font-medium text-slate-600">Conta</th>
              <th className="p-3 text-left font-medium text-slate-600">Seq.</th>
              <th className="p-3 text-left font-medium text-slate-600">Boletos</th>
              <th className="p-3 text-left font-medium text-slate-600">Valor Total</th>
              <th className="p-3 text-left font-medium text-slate-600">Status</th>
              <th className="p-3 text-left font-medium text-slate-600">Gerado em</th>
              <th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {remessas.map((rem) => (
              <tr key={rem.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-700">{rem.arquivo_nome}</td>
                <td className="p-3 text-slate-600">
                  {rem.bank_accounts?.nome ?? '—'}
                </td>
                <td className="p-3 text-slate-600">{rem.numero_sequencial}</td>
                <td className="p-3 text-slate-600">{rem.total_registros}</td>
                <td className="p-3 font-semibold">{brl(Number(rem.valor_total))}</td>
                <td className="p-3">
                  <RemessaStatusBadge status={rem.status} />
                </td>
                <td className="p-3 text-slate-500">{formatDateTime(rem.gerado_em)}</td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => downloadRemessa.mutate(rem.id)}>
                        <FileDown size={14} className="mr-2" /> Baixar Arquivo
                      </DropdownMenuItem>
                      {(rem.status === 'gerado' || rem.status === 'baixado') && (
                        <DropdownMenuItem onClick={() => marcarEnviada.mutate(rem.id)}>
                          <Send size={14} className="mr-2" /> Marcar como Enviada
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Retornos Tab (placeholder) ─────────────────────────────────────────────

function RetornosTab() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <Upload size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">Importação de Retorno</h3>
      <p className="text-sm text-slate-400 mt-1">
        Em breve: importação de arquivos de retorno bancário (CNAB 400) para baixa automática
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function BoletosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Boletos e Remessas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de boletos bancários e arquivos de remessa CNAB 400
          </p>
        </div>
      </div>

      <Tabs defaultValue="boletos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="boletos" className="gap-1.5">
            <Receipt size={14} /> Boletos
          </TabsTrigger>
          <TabsTrigger value="remessas" className="gap-1.5">
            <FileDown size={14} /> Remessas
          </TabsTrigger>
          <TabsTrigger value="retornos" className="gap-1.5">
            <ArrowRightLeft size={14} /> Retornos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="boletos">
          <BoletosTab />
        </TabsContent>
        <TabsContent value="remessas">
          <RemessasTab />
        </TabsContent>
        <TabsContent value="retornos">
          <RetornosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
