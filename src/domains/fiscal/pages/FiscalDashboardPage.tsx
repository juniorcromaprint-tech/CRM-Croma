import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileBadge,
  Settings,
  ListOrdered,
} from 'lucide-react';
import { useFiscalDocumentos } from '../hooks/useFiscal';
import { StatusFiscalBadge } from '../components/StatusFiscalBadge';
import { brl, formatDate } from '@/shared/utils/format';
import QueryErrorState from '@/shared/components/QueryErrorState';

export default function FiscalDashboardPage() {
  const navigate = useNavigate();

  // KPIs — buscar documentos do mês atual
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesStr = inicioMes.toISOString();

  const { data: docsMes = [], isLoading: loadingDocs, isError: isErrorDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['fiscal_dashboard_docs_mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_documentos')
        .select('id, status, valor_total, chave_acesso, created_at')
        .gte('created_at', inicioMesStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Alertas — certificados
  const { data: certificados = [], isLoading: loadingCerts } = useQuery({
    queryKey: ['fiscal_dashboard_certificados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_certificados')
        .select('id, nome, validade_fim, ativo')
        .eq('ativo', true);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Alertas — fila travada
  const { data: filasTravadas = [], isLoading: loadingFila } = useQuery({
    queryKey: ['fiscal_dashboard_fila_travada'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_filas_emissao')
        .select('id, tentativas, status, created_at')
        .gte('tentativas', 3);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Documentos recentes
  const { data: documentosRecentes = [], isLoading: loadingRecentes } = useFiscalDocumentos();

  const docsMesArr = docsMes as any[];
  const kpis = {
    total: docsMesArr.length,
    autorizados: docsMesArr.filter((d: any) => d.status === 'autorizado').length,
    rejeitados: docsMesArr.filter((d: any) => d.status === 'rejeitado').length,
    pendentes: docsMesArr.filter((d: any) => ['rascunho', 'emitindo', 'validando'].includes(d.status)).length,
    valorAutorizado: docsMesArr
      .filter((d: any) => d.status === 'autorizado' && d.chave_acesso)
      .reduce((s: number, d: any) => s + (d.valor_total ?? 0), 0),
  };

  // Calcular certificados vencendo em < 30 dias
  const hoje = new Date();
  const certVencendo = (certificados as any[]).filter((c: any) => {
    if (!c.validade_fim) return false;
    const validade = new Date(c.validade_fim);
    const diffDias = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diffDias < 30;
  });

  // Documentos rejeitados sem resolução
  const docsRejeitados = docsMesArr.filter((d: any) => d.status === 'rejeitado');

  const alertas = [
    ...certVencendo.map((c: any) => {
      const validade = new Date(c.validade_fim);
      const dias = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return {
        tipo: 'certificado',
        msg: `Certificado "${c.nome}" vence em ${dias} dia(s) (${formatDate(c.validade_fim)})`,
        severity: dias <= 7 ? 'critico' : 'aviso',
      };
    }),
    ...docsRejeitados.slice(0, 3).map((_d: any) => ({
      tipo: 'rejeitado',
      msg: `${docsRejeitados.length} documento(s) com status "rejeitado" aguardando resolução neste mês`,
      severity: 'aviso',
    })).slice(0, 1),
    ...(filasTravadas as any[]).length > 0
      ? [{
          tipo: 'fila',
          msg: `${(filasTravadas as any[]).length} item(ns) na fila de emissão com 3+ tentativas falhas`,
          severity: 'critico',
        }]
      : [],
  ];

  const recentesSlice = (documentosRecentes as any[]).slice(0, 10);

  const isLoading = loadingDocs || loadingCerts || loadingFila;

  if (isErrorDocs) {
    return <QueryErrorState onRetry={refetchDocs} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Dashboard Fiscal
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão geral do módulo NF-e — competência{' '}
            {inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/fiscal/configuracao')}>
            <Settings className="w-4 h-4 mr-1" /> Configurações
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate('/fiscal/documentos')}>
            <FileBadge className="w-4 h-4 mr-1" /> Ver Documentos
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta, i) => (
            <Alert
              key={i}
              className={`border ${
                alerta.severity === 'critico'
                  ? 'border-red-300 bg-red-50'
                  : 'border-amber-300 bg-amber-50'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${
                  alerta.severity === 'critico' ? 'text-red-600' : 'text-amber-600'
                }`}
              />
              <AlertDescription
                className={`text-sm ${
                  alerta.severity === 'critico' ? 'text-red-800' : 'text-amber-800'
                }`}
              >
                <strong>{alerta.severity === 'critico' ? 'Atenção Imediata: ' : 'Aviso: '}</strong>
                {alerta.msg}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPIs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-400 text-sm">Carregando indicadores...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            {
              label: 'Total no Mês',
              value: kpis.total,
              icon: Receipt,
              color: 'text-slate-700',
              bg: 'bg-slate-50 border-slate-200',
            },
            {
              label: 'Autorizadas',
              value: kpis.autorizados,
              icon: CheckCircle,
              color: 'text-green-700',
              bg: 'bg-green-50 border-green-200',
            },
            {
              label: 'Rejeitadas',
              value: kpis.rejeitados,
              icon: XCircle,
              color: 'text-red-600',
              bg: 'bg-red-50 border-red-200',
            },
            {
              label: 'Pendentes',
              value: kpis.pendentes,
              icon: Clock,
              color: 'text-amber-600',
              bg: 'bg-amber-50 border-amber-200',
            },
            {
              label: 'Valor Autorizado',
              value: brl(kpis.valorAutorizado),
              icon: TrendingUp,
              color: 'text-indigo-700',
              bg: 'bg-indigo-50 border-indigo-200',
            },
          ].map((k) => (
            <Card key={k.label} className={`${k.bg} border shadow-sm`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</p>
                </div>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documentos Recentes + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documentos Recentes */}
        <div className="lg:col-span-2">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Documentos Recentes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:text-indigo-700 text-xs"
                  onClick={() => navigate('/fiscal/documentos')}
                >
                  Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRecentes ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : recentesSlice.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum documento emitido ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Número</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs">Emitido em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentesSlice.map((doc: any) => (
                      <TableRow key={doc.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-mono text-xs font-semibold text-slate-700">
                          {doc.numero ? `NF-e ${doc.numero}` : (
                            <span className="text-slate-400 italic font-normal">Rascunho</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 max-w-[140px] truncate">
                          {doc.clientes?.nome_fantasia ?? doc.clientes?.razao_social ?? '---'}
                        </TableCell>
                        <TableCell>
                          <StatusFiscalBadge status={doc.status} size="sm" />
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold text-slate-800">
                          {brl(doc.valor_total ?? 0)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {doc.data_emissao
                            ? formatDate(doc.data_emissao)
                            : doc.created_at
                            ? formatDate(doc.created_at)
                            : '---'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between text-sm hover:bg-indigo-50 hover:border-indigo-300"
                onClick={() => navigate('/fiscal/documentos')}
              >
                <div className="flex items-center gap-2">
                  <FileBadge className="w-4 h-4 text-indigo-500" />
                  Documentos Fiscais
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between text-sm hover:bg-amber-50 hover:border-amber-300"
                onClick={() => navigate('/fiscal/fila')}
              >
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-amber-500" />
                  Fila de Emissão
                  {(filasTravadas as any[]).length > 0 && (
                    <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                      {(filasTravadas as any[]).length}
                    </Badge>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between text-sm hover:bg-slate-50"
                onClick={() => navigate('/fiscal/configuracao')}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  Configurações Fiscais
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </CardContent>
          </Card>

          {/* Status do Certificado */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">Certificado Digital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingCerts ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                </div>
              ) : (certificados as any[]).filter((c: any) => c.ativo).length === 0 ? (
                <div className="text-sm text-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Nenhum certificado ativo
                </div>
              ) : (
                (certificados as any[])
                  .filter((c: any) => c.ativo)
                  .map((c: any) => {
                    const validade = new Date(c.validade_fim);
                    const dias = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                    const cor =
                      dias > 60
                        ? 'text-green-600'
                        : dias > 30
                        ? 'text-amber-600'
                        : 'text-red-600';
                    return (
                      <div key={c.id} className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">{c.nome}</p>
                        <p className={`text-xs ${cor} font-semibold`}>
                          {dias > 0 ? `Vence em ${dias} dias` : 'VENCIDO'}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(c.validade_fim)}</p>
                      </div>
                    );
                  })
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-indigo-600"
                onClick={() => navigate('/fiscal/certificado')}
              >
                Gerenciar certificado <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
