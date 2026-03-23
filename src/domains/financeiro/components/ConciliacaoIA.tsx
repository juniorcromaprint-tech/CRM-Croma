import { useState, useCallback, useRef } from 'react';
import {
  Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeftRight, FileText, Zap, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { brl, formatDate } from '@/shared/utils/format';
import { showSuccess, showError } from '@/utils/toast';
import { parseOFX } from '@/domains/contabilidade/services/ofx-parser.service';

interface Transacao {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'credito' | 'debito';
}

interface MatchResult {
  transacao: Transacao;
  match: {
    tabela: 'contas_receber' | 'contas_pagar' | null;
    registro_id: string | null;
    descricao: string | null;
    valor_sistema: number | null;
    cliente_fornecedor: string | null;
  } | null;
  confianca: number;
  motivo: string;
  auto_conciliado: boolean;
}

interface Resumo {
  total: number;
  com_match: number;
  sem_match: number;
  auto_conciliados: number;
  alta_confianca: number;
  media_confianca: number;
}

function confiancaColor(c: number) {
  if (c >= 0.8) return 'bg-emerald-100 text-emerald-700';
  if (c >= 0.5) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function confiancaLabel(c: number) {
  if (c >= 0.9) return 'Alta';
  if (c >= 0.7) return 'Boa';
  if (c >= 0.5) return 'Média';
  if (c >= 0.2) return 'Baixa';
  return '—';
}

export default function ConciliacaoIA() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File parsing (OFX or CSV) ────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      let parsed: Transacao[] = [];

      if (file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.ofc')) {
        // OFX format
        try {
          const ofxResult = parseOFX(text);
          parsed = ofxResult.transactions.map(tx => ({
            data: tx.date,
            descricao: tx.memo || tx.name || '',
            valor: tx.amount,
            tipo: tx.amount >= 0 ? 'credito' as const : 'debito' as const,
          }));
        } catch {
          showError('Erro ao parsear arquivo OFX');
          return;
        }
      } else {
        // CSV format (data;descricao;valor)
        const sep = text.includes(';') ? ';' : ',';
        const lines = text.trim().split('\n').slice(1);
        parsed = lines
          .map(line => {
            const parts = line.split(sep);
            const valor = parseFloat((parts[2]?.trim() ?? '0').replace(',', '.'));
            return {
              data: parts[0]?.trim() ?? '',
              descricao: parts[1]?.trim() ?? '',
              valor,
              tipo: (valor >= 0 ? 'credito' : 'debito') as 'credito' | 'debito',
            };
          })
          .filter(r => !isNaN(r.valor));
      }

      if (parsed.length === 0) {
        showError('Nenhuma transação encontrada no arquivo');
        return;
      }

      setTransacoes(parsed);
      setResults(null);
      setResumo(null);
    };

    reader.readAsText(file, 'UTF-8');
  }, []);

  // ── Call AI conciliation ─────────────────────────────────────────────
  const handleConciliar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-conciliar-bancario', {
        body: { transacoes, auto_conciliar: true },
      });

      if (error) throw error;

      setResults(data.matches ?? []);
      setResumo(data.resumo ?? null);

      const auto = data.resumo?.auto_conciliados ?? 0;
      if (auto > 0) {
        showSuccess(`${auto} transaç${auto > 1 ? 'ões' : 'ão'} conciliada${auto > 1 ? 's' : ''} automaticamente`);
      }
    } catch (err) {
      showError(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Manual approve ───────────────────────────────────────────────────
  const handleAprovar = async (idx: number) => {
    const item = results?.[idx];
    if (!item?.match?.registro_id) return;

    try {
      if (item.match.tabela === 'contas_receber') {
        const newSaldo = Math.max(0, (item.match.valor_sistema ?? 0) - Math.abs(item.transacao.valor));
        await supabase
          .from('contas_receber')
          .update({
            saldo: newSaldo,
            status: newSaldo <= 0.01 ? 'paga' : 'a_vencer',
            data_pagamento: newSaldo <= 0.01 ? item.transacao.data : null,
            observacoes_pagamento: `Conciliado: ${item.transacao.descricao}`,
          })
          .eq('id', item.match.registro_id);
      } else {
        await supabase
          .from('contas_pagar')
          .update({
            status: 'paga',
            data_pagamento: item.transacao.data,
            observacoes: `Conciliado: ${item.transacao.descricao}`,
          })
          .eq('id', item.match.registro_id);
      }

      // Update UI
      setResults(prev => prev?.map((r, i) =>
        i === idx ? { ...r, auto_conciliado: true } : r
      ) ?? null);
      showSuccess('Conciliado com sucesso');
    } catch {
      showError('Erro ao conciliar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!transacoes.length && (
        <div
          className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Upload size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Importar Extrato Bancário</h3>
          <p className="text-sm text-slate-400 mt-1">
            Arraste um arquivo <strong>OFX</strong> ou <strong>CSV</strong> aqui
          </p>
          <p className="text-xs text-slate-300 mt-2">CSV: data;descricao;valor (cabeçalho na primeira linha)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".ofx,.ofc,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* File loaded bar */}
      {transacoes.length > 0 && !results && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-blue-500" />
              <div>
                <p className="font-medium text-slate-700">{fileName}</p>
                <p className="text-sm text-slate-400">{transacoes.length} transações importadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => { setTransacoes([]); setFileName(''); }}>
                Trocar arquivo
              </Button>
              <Button
                onClick={handleConciliar}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {loading ? 'Conciliando...' : 'Conciliar com IA'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results summary */}
      {resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{resumo.total}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{resumo.auto_conciliados}</p>
            <p className="text-xs text-emerald-600">Auto-conciliados</p>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{resumo.alta_confianca}</p>
            <p className="text-xs text-blue-600">Alta confiança</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{resumo.com_match - resumo.auto_conciliados}</p>
            <p className="text-xs text-amber-600">Aguardando</p>
          </div>
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{resumo.sem_match}</p>
            <p className="text-xs text-slate-400">Sem match</p>
          </div>
        </div>
      )}

      {/* Match results table */}
      {results && results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <ArrowLeftRight size={16} />
              Resultados da Conciliação
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setTransacoes([]); setResults(null); setResumo(null); setFileName(''); }}
            >
              Nova importação
            </Button>
          </div>

          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase">
            <div className="col-span-3">Extrato</div>
            <div className="col-span-1 text-right">Valor</div>
            <div className="col-span-3">Match Sistema</div>
            <div className="col-span-1 text-right">Valor Sist.</div>
            <div className="col-span-1 text-center">Confiança</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Ação</div>
          </div>

          {/* Rows */}
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
            {results.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-slate-50 text-sm">
                {/* Extrato */}
                <div className="col-span-3 min-w-0">
                  <p className="text-slate-700 truncate">{r.transacao.descricao}</p>
                  <p className="text-xs text-slate-400">{r.transacao.data}</p>
                </div>

                {/* Valor extrato */}
                <div className={`col-span-1 text-right font-mono text-xs ${r.transacao.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {brl(r.transacao.valor)}
                </div>

                {/* Match */}
                <div className="col-span-3 min-w-0">
                  {r.match ? (
                    <>
                      <p className="text-slate-700 truncate">{r.match.descricao}</p>
                      <p className="text-xs text-slate-400">
                        {r.match.cliente_fornecedor ?? r.match.tabela === 'contas_receber' ? 'Receber' : 'Pagar'}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-300 text-xs">Sem correspondência</span>
                  )}
                </div>

                {/* Valor sistema */}
                <div className="col-span-1 text-right font-mono text-xs text-slate-500">
                  {r.match?.valor_sistema ? brl(r.match.valor_sistema) : '—'}
                </div>

                {/* Confiança */}
                <div className="col-span-1 text-center">
                  {r.match ? (
                    <Badge className={`text-xs ${confiancaColor(r.confianca)}`}>
                      {Math.round(r.confianca * 100)}%
                    </Badge>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-1">
                  {r.auto_conciliado ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : r.match ? (
                    <AlertTriangle size={16} className="text-amber-400" />
                  ) : (
                    <XCircle size={16} className="text-slate-300" />
                  )}
                </div>

                {/* Ação */}
                <div className="col-span-2 text-right">
                  {!r.auto_conciliado && r.match && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleAprovar(idx)}
                    >
                      <CheckCircle2 size={12} />
                      Aprovar
                    </Button>
                  )}
                  {r.auto_conciliado && (
                    <span className="text-xs text-emerald-600">Conciliado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 size={32} className="mx-auto text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-slate-500">Analisando transações e buscando correspondências...</p>
        </div>
      )}
    </div>
  );
}
