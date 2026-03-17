import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookOpen,
  Search,
  Download,
  Eye,
  Filter,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useFiscalAuditLogs } from '../hooks/useFiscal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR');
}

const ACAO_CONFIG: Record<string, { label: string; className: string }> = {
  emissao: { label: 'Emissão', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  cancelamento: { label: 'Cancelamento', className: 'bg-red-100 text-red-700 border-red-400' },
  consulta: { label: 'Consulta', className: 'bg-slate-100 text-slate-600 border-slate-300' },
  configuracao: { label: 'Configuração', className: 'bg-purple-100 text-purple-700 border-purple-300' },
  certificado: { label: 'Certificado', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  validacao: { label: 'Validação', className: 'bg-teal-100 text-teal-700 border-teal-300' },
  erro: { label: 'Erro', className: 'bg-red-100 text-red-700 border-red-400' },
};

function AcaoBadge({ acao }: { acao: string }) {
  const cfg = ACAO_CONFIG[acao] ?? {
    label: acao,
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function AmbienbadBadge({ ambiente }: { ambiente: string }) {
  if (!ambiente) return <span className="text-slate-300 text-xs">—</span>;
  const isPrd =
    ambiente.includes('producao') ||
    ambiente.includes('PRD') ||
    ambiente.includes('prod');
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
        isPrd
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-blue-100 text-blue-700 border border-blue-300'
      }`}
    >
      {isPrd ? 'PRD' : 'HML'}
    </span>
  );
}

function JsonViewer({ value }: { value: any }) {
  if (!value) return <span className="text-slate-400 text-xs">Sem dados</span>;
  let str: string;
  try {
    str = JSON.stringify(value, null, 2);
  } catch {
    str = String(value);
  }
  return (
    <pre className="bg-slate-950 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-80 font-mono whitespace-pre-wrap break-all">
      <code>{str}</code>
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Exportar CSV
// ---------------------------------------------------------------------------

function exportarCSV(rows: any[]) {
  const headers = [
    'Data/Hora',
    'Usuário',
    'Ação',
    'Documento',
    'Chave Acesso',
    'Ambiente',
    'IP Origem',
  ];
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((r: any) => [
    escape(formatDateTime(r.created_at)),
    escape(r.profiles?.nome_completo ?? r.usuario_nome ?? 'Sistema'),
    escape(r.acao ?? r.tipo_acao ?? ''),
    escape(r.numero_nfe ?? r.documento_numero ?? ''),
    escape(r.chave_acesso ?? ''),
    escape(r.ambiente ?? ''),
    escape(r.ip_origem ?? ''),
  ].join(';'));
  const csv = [headers.join(';'), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_fiscal_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function FiscalAuditoriaPage() {
  const { data: logs = [], isLoading, error } = useFiscalAuditLogs();

  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [detalheLog, setDetalheLog] = useState<any>(null);

  // Filtrar logs no cliente
  const logsFiltrados = useMemo(() => {
    const logsArr = logs as any[];
    return logsArr.filter((log: any) => {
      // Filtro texto
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const usuario = (log.profiles?.nome_completo ?? log.usuario_nome ?? '').toLowerCase();
        const acao = (log.acao ?? log.tipo_acao ?? '').toLowerCase();
        const documento =
          String(log.numero_nfe ?? log.documento_numero ?? '').toLowerCase();
        const chave = (log.chave_acesso ?? '').toLowerCase();
        if (
          !usuario.includes(q) &&
          !acao.includes(q) &&
          !documento.includes(q) &&
          !chave.includes(q)
        ) {
          return false;
        }
      }

      // Filtro ação
      if (filtroAcao !== 'todos') {
        const logAcao = log.acao ?? log.tipo_acao ?? '';
        if (!logAcao.includes(filtroAcao)) return false;
      }

      // Filtro data inicial
      if (dataInicio) {
        const logDate = new Date(log.created_at);
        const inicio = new Date(dataInicio + 'T00:00:00');
        if (logDate < inicio) return false;
      }

      // Filtro data final
      if (dataFim) {
        const logDate = new Date(log.created_at);
        const fim = new Date(dataFim + 'T23:59:59');
        if (logDate > fim) return false;
      }

      return true;
    });
  }, [logs, busca, filtroAcao, dataInicio, dataFim]);

  // KPIs do período filtrado
  const kpis = useMemo(() => {
    const arr = logsFiltrados as any[];
    return {
      total: arr.length,
      emissoes: arr.filter((l: any) =>
        (l.acao ?? l.tipo_acao ?? '').includes('emissao')
      ).length,
      cancelamentos: arr.filter((l: any) =>
        (l.acao ?? l.tipo_acao ?? '').includes('cancelamento')
      ).length,
      erros: arr.filter((l: any) => {
        const a = l.acao ?? l.tipo_acao ?? '';
        return a.includes('erro') || a.includes('error') || a.includes('falha');
      }).length,
    };
  }, [logsFiltrados]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            Auditoria Fiscal
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registro completo de todas as operações do módulo fiscal
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportarCSV(logsFiltrados as any[])}
          disabled={logsFiltrados.length === 0}
        >
          <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          {logsFiltrados.length > 0 && (
            <span className="ml-1.5 text-xs text-slate-400">({logsFiltrados.length})</span>
          )}
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por usuário, documento, ação, chave..."
            className="pl-9"
          />
        </div>
        <div>
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Filtrar ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ações</SelectItem>
              <SelectItem value="emissao">Emissão</SelectItem>
              <SelectItem value="cancelamento">Cancelamento</SelectItem>
              <SelectItem value="consulta">Consulta</SelectItem>
              <SelectItem value="configuracao">Configuração</SelectItem>
              <SelectItem value="certificado">Certificado</SelectItem>
              <SelectItem value="validacao">Validação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="text-sm"
              title="Data inicial"
            />
          </div>
          <div className="flex-1">
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="text-sm"
              title="Data final"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total de logs',
            value: kpis.total,
            icon: Activity,
            color: 'text-slate-700',
            bg: 'bg-slate-50 border-slate-200',
          },
          {
            label: 'Emissões',
            value: kpis.emissoes,
            icon: BookOpen,
            color: 'text-blue-700',
            bg: 'bg-blue-50 border-blue-200',
          },
          {
            label: 'Cancelamentos',
            value: kpis.cancelamentos,
            icon: Calendar,
            color: 'text-red-600',
            bg: 'bg-red-50 border-red-200',
          },
          {
            label: 'Erros',
            value: kpis.erros,
            icon: AlertTriangle,
            color: 'text-amber-700',
            bg: 'bg-amber-50 border-amber-200',
          },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} border rounded-xl p-3 flex items-center gap-3`}>
            <k.icon className={`w-8 h-8 ${k.color} opacity-70 flex-shrink-0`} />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela de Logs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
          <span className="text-slate-400 text-sm">Carregando logs de auditoria...</span>
        </div>
      ) : error ? (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700">
            Erro ao carregar logs de auditoria. Tente novamente.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Data/Hora</TableHead>
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
                <TableHead className="text-xs">Documento</TableHead>
                <TableHead className="text-xs">Ambiente</TableHead>
                <TableHead className="text-xs text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logsFiltrados as any[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhum log encontrado para os filtros aplicados</p>
                    {(busca || filtroAcao !== 'todos' || dataInicio || dataFim) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs text-indigo-600"
                        onClick={() => {
                          setBusca('');
                          setFiltroAcao('todos');
                          setDataInicio('');
                          setDataFim('');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                (logsFiltrados as any[]).map((log: any) => {
                  const acao = log.acao ?? log.tipo_acao ?? '';
                  const usuario =
                    log.profiles?.nome_completo ?? log.usuario_nome ?? 'Sistema';
                  const documento =
                    log.numero_nfe ??
                    log.documento_numero ??
                    (log.chave_acesso ? log.chave_acesso.slice(-12) + '...' : null);
                  const ambiente = log.ambiente ?? log.fiscal_ambientes?.tipo ?? '';
                  const temDetalhes =
                    log.dados_entrada || log.dados_resultado || log.ip_origem;

                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs font-mono text-slate-600 whitespace-nowrap">
                        {log.created_at ? formatDateTime(log.created_at) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <span className="text-xs text-slate-700 max-w-[120px] truncate" title={usuario}>
                            {usuario}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <AcaoBadge acao={acao} />
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {documento ? (
                          <span title={log.chave_acesso ?? documento}>{documento}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AmbienbadBadge ambiente={ambiente} />
                      </TableCell>
                      <TableCell className="text-right">
                        {temDetalhes && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                            onClick={() => setDetalheLog(log)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {(logsFiltrados as any[]).length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Exibindo {(logsFiltrados as any[]).length} de {(logs as any[]).length} registros
              </p>
              {(logs as any[]).length >= 500 && (
                <p className="text-xs text-amber-600">
                  Exibindo até 500 registros mais recentes. Use filtros de data para resultados
                  específicos.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialog de Detalhes */}
      <Dialog open={!!detalheLog} onOpenChange={(o) => { if (!o) setDetalheLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Eye className="w-5 h-5 text-indigo-600" />
              Detalhes do Log de Auditoria
            </DialogTitle>
          </DialogHeader>

          {detalheLog && (
            <div className="space-y-4">
              {/* Metadados */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Data/Hora</p>
                  <p className="font-mono text-slate-800">
                    {formatDateTime(detalheLog.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Usuário</p>
                  <p className="text-slate-800">
                    {detalheLog.profiles?.nome_completo ??
                      detalheLog.usuario_nome ??
                      'Sistema'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Ação</p>
                  <AcaoBadge acao={detalheLog.acao ?? detalheLog.tipo_acao ?? ''} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">IP Origem</p>
                  <p className="font-mono text-slate-600 text-sm">
                    {detalheLog.ip_origem ?? '—'}
                  </p>
                </div>
                {detalheLog.chave_acesso && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 uppercase mb-1">Chave de Acesso</p>
                    <p className="font-mono text-slate-700 text-xs break-all">
                      {detalheLog.chave_acesso}
                    </p>
                  </div>
                )}
              </div>

              {/* Dados de Entrada */}
              {detalheLog.dados_entrada && (
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
                    Dados de Entrada
                  </Label>
                  <JsonViewer value={detalheLog.dados_entrada} />
                </div>
              )}

              {/* Dados de Resultado */}
              {detalheLog.dados_resultado && (
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
                    Dados do Resultado
                  </Label>
                  <JsonViewer value={detalheLog.dados_resultado} />
                </div>
              )}

              {/* Sem dados adicionais */}
              {!detalheLog.dados_entrada && !detalheLog.dados_resultado && (
                <p className="text-slate-400 text-sm text-center py-4">
                  Nenhum dado adicional registrado para esta operação.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
