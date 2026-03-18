import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLancamentos, useCreateLancamento, useContasAnaliticas } from '../hooks/useLancamentos';
import { brl, formatDate } from '@/shared/utils/format';
import type { OrigemTipo } from '../types/contabilidade.types';

const ORIGEM_LABELS: Record<OrigemTipo, string> = {
  conta_receber: 'Conta a Receber',
  conta_pagar: 'Conta a Pagar',
  extrato: 'Extrato',
  manual: 'Manual',
  das: 'DAS',
  pro_labore: 'Pró-labore',
};

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function LancamentosPage() {
  const [page, setPage] = useState(1);
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(today());
  const [origemFiltro, setOrigemFiltro] = useState<OrigemTipo | ''>('');
  const [novoDialog, setNovoDialog] = useState(false);

  const [form, setForm] = useState({
    data_lancamento: today(),
    data_competencia: firstDayOfMonth(),
    conta_debito_id: '',
    conta_credito_id: '',
    valor: '',
    historico: '',
  });

  const { data, isLoading } = useLancamentos({
    dataInicio,
    dataFim,
    origemTipo: origemFiltro || undefined,
    page,
    pageSize: 50,
  });

  const { data: contas = [] } = useContasAnaliticas();
  const createLancamento = useCreateLancamento();

  const lancamentos = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 50);

  function handleSubmit() {
    if (!form.conta_debito_id || !form.conta_credito_id || !form.valor || !form.historico) return;
    createLancamento.mutate(
      {
        ...form,
        valor: parseFloat(form.valor),
        origem_tipo: 'manual',
      },
      {
        onSuccess: () => {
          setNovoDialog(false);
          setForm({
            data_lancamento: today(),
            data_competencia: firstDayOfMonth(),
            conta_debito_id: '',
            conta_credito_id: '',
            valor: '',
            historico: '',
          });
        },
      }
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lançamentos Contábeis</h1>
          <p className="text-sm text-slate-500 mt-0.5">Partida dobrada — todos os lançamentos</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={() => setNovoDialog(true)}
        >
          <Plus size={16} />
          Novo Lançamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4 items-end flex-wrap">
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Data início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
            className="rounded-xl w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Data fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
            className="rounded-xl w-40"
          />
        </div>
        <div className="w-48">
          <Label className="text-xs text-slate-500 mb-1.5 block">Origem</Label>
          <Select value={origemFiltro} onValueChange={(v) => { setOrigemFiltro(v as OrigemTipo | ''); setPage(1); }}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {(Object.keys(ORIGEM_LABELS) as OrigemTipo[]).map(k => (
                <SelectItem key={k} value={k}>{ORIGEM_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} lançamento{total !== 1 ? 's' : ''}</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : lancamentos.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum lançamento no período</h3>
            <p className="text-sm text-slate-400 mt-1">
              Importe um extrato bancário ou crie um lançamento manual
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="px-4 py-3 text-left font-medium">Nº</th>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Histórico</th>
                    <th className="px-4 py-3 text-left font-medium">Débito</th>
                    <th className="px-4 py-3 text-left font-medium">Crédito</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-center font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lancamentos.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        #{l.numero_lancamento}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(l.data_lancamento)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {l.historico}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {l.conta_debito?.codigo} — {l.conta_debito?.nome}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {l.conta_credito?.codigo} — {l.conta_credito?.nome}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {brl(l.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                          {ORIGEM_LABELS[l.origem_tipo]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog novo lançamento */}
      <Dialog open={novoDialog} onOpenChange={setNovoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              Novo Lançamento Manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Data do Lançamento</Label>
                <Input
                  type="date"
                  value={form.data_lancamento}
                  onChange={(e) => setForm(f => ({ ...f, data_lancamento: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Data de Competência</Label>
                <Input
                  type="date"
                  value={form.data_competencia}
                  onChange={(e) => setForm(f => ({ ...f, data_competencia: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Conta a Débito</Label>
              <Select
                value={form.conta_debito_id}
                onValueChange={(v) => setForm(f => ({ ...f, conta_debito_id: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Conta a Crédito</Label>
              <Select
                value={form.conta_credito_id}
                onValueChange={(v) => setForm(f => ({ ...f, conta_credito_id: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Valor (R$)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Histórico</Label>
              <Textarea
                placeholder="Descrição do lançamento..."
                value={form.historico}
                onChange={(e) => setForm(f => ({ ...f, historico: e.target.value }))}
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoDialog(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={
                createLancamento.isPending ||
                !form.conta_debito_id ||
                !form.conta_credito_id ||
                !form.valor ||
                !form.historico
              }
            >
              Salvar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
