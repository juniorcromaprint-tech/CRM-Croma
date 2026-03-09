import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { brl, formatDate } from '@/shared/utils/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileBadge, Search, Filter, RefreshCw, XCircle, FileDown, FileText,
  Send, Loader2, AlertTriangle, CheckCircle2, Clock, Eye, RotateCcw
} from 'lucide-react';
import { useFiscalDocumentos, useEmitirNFe, useCancelarNFe } from '../hooks/useFiscal';
import { StatusFiscalBadge } from '../components/StatusFiscalBadge';

export default function FiscalDocumentosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [cancelarDoc, setCancelarDoc] = useState<any>(null);
  const [justificativa, setJustificativa] = useState('');
  const [baixandoXml, setBaixandoXml] = useState<string | null>(null);
  const [baixandoPdf, setBaixandoPdf] = useState<string | null>(null);
  const [detalheDoc, setDetalheDoc] = useState<any>(null);

  const { data: documentos = [], isLoading, refetch } = useFiscalDocumentos(
    filterStatus !== 'todos' ? { status: filterStatus } : undefined
  );
  const emitirMutation = useEmitirNFe();
  const cancelarMutation = useCancelarNFe();

  const filtered = (documentos as any[]).filter((d: any) => {
    const q = search.toLowerCase();
    return !q
      || d.clientes?.razao_social?.toLowerCase().includes(q)
      || d.clientes?.nome_fantasia?.toLowerCase().includes(q)
      || d.pedidos?.numero?.toLowerCase().includes(q)
      || String(d.numero ?? '').includes(q)
      || (d.chave_acesso ?? '').includes(q);
  });

  const kpis = {
    total: (documentos as any[]).length,
    autorizados: (documentos as any[]).filter((d: any) => d.status === 'autorizado').length,
    rejeitados: (documentos as any[]).filter((d: any) => d.status === 'rejeitado').length,
    pendentes: (documentos as any[]).filter((d: any) => ['rascunho', 'apto', 'emitindo'].includes(d.status)).length,
    valorTotal: (documentos as any[]).filter((d: any) => d.status === 'autorizado').reduce((s: number, d: any) => s + (d.valor_total ?? 0), 0),
  };

  const handleEmitir = async (doc: any) => {
    if (!confirm(`Emitir NF-e para ${doc.clientes?.razao_social}?\nValor: ${brl(doc.valor_total)}\nAmbiente: ${doc.fiscal_ambientes?.tipo === 'producao' ? '🔴 PRODUÇÃO' : '🟡 Homologação'}`)) return;
    await emitirMutation.mutateAsync(doc.id);
    refetch();
  };

  const handleCancelar = async () => {
    if (!cancelarDoc || justificativa.length < 15) return showError('Justificativa mínima: 15 caracteres');
    await cancelarMutation.mutateAsync({ documentoId: cancelarDoc.id, justificativa });
    setCancelarDoc(null);
    setJustificativa('');
    refetch();
  };

  const handleBaixarXml = async (doc: any) => {
    setBaixandoXml(doc.id);
    try {
      const { data: xmlRecord } = await supabase
        .from('fiscal_xmls').select('storage_path')
        .eq('fiscal_documento_id', doc.id).eq('tipo_arquivo', 'xml_autorizado').single();
      if (xmlRecord?.storage_path) {
        const { data: url } = await supabase.storage.from('fiscal-xmls').createSignedUrl(xmlRecord.storage_path, 3600);
        if (url?.signedUrl) { window.open(url.signedUrl, '_blank'); showSuccess('XML disponível para download!'); }
        else showError('Erro ao gerar URL do XML');
      } else {
        showError('XML não encontrado. A NF-e pode ter sido emitida sem salvar XML.');
      }
    } catch { showError('Erro ao acessar XML'); } finally { setBaixandoXml(null); }
  };

  const handleBaixarPdf = async (doc: any) => {
    setBaixandoPdf(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-gerar-danfe', { body: { documento_id: doc.id } });
      if (error || !(data as any)?.ok) return showError((data as any)?.mensagem ?? 'Erro ao gerar DANFE');
      window.open((data as any).pdf_url, '_blank');
      showSuccess('DANFE gerado!');
    } catch { showError('Erro ao gerar DANFE'); } finally { setBaixandoPdf(null); }
  };

  const handleReprocessar = async (doc: any) => {
    if (!confirm(`Reprocessar NF-e rejeitada?\nPedido: ${doc.pedidos?.numero}`)) return;
    await emitirMutation.mutateAsync(doc.id);
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileBadge className="w-7 h-7 text-indigo-600" /> Documentos Fiscais
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gestão completa de NF-e — emissão, consulta, cancelamento</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total NF-e', value: kpis.total, icon: FileBadge, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Autorizadas', value: kpis.autorizados, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Rejeitadas', value: kpis.rejeitados, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Pendentes', value: kpis.pendentes, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Valor Autorizado', value: brl(kpis.valorTotal), icon: FileText, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} border rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar por cliente, pedido, chave, número..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-52">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="rascunho">📝 Rascunho</SelectItem>
            <SelectItem value="apto">✅ Apto</SelectItem>
            <SelectItem value="emitindo">⏳ Emitindo</SelectItem>
            <SelectItem value="autorizado">🟢 Autorizado</SelectItem>
            <SelectItem value="rejeitado">❌ Rejeitado</SelectItem>
            <SelectItem value="cancelado">🚫 Cancelado</SelectItem>
            <SelectItem value="erro_transmissao">💥 Erro Transmissão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>NF-e / Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Status Fiscal</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <FileBadge className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhum documento fiscal encontrado</p>
                  {filterStatus !== 'todos' && <p className="text-xs mt-1">Tente remover o filtro de status</p>}
                </TableCell>
              </TableRow>
            ) : filtered.map((doc: any) => (
              <TableRow key={doc.id} className="hover:bg-slate-50/50 group">
                <TableCell>
                  <div className="font-mono text-sm font-semibold text-slate-800">
                    {doc.numero ? `NF-e ${doc.numero}` : <span className="text-slate-400 font-normal italic">Pendente</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Pedido: {doc.pedidos?.numero ?? '---'}</div>
                  {doc.protocolo && <div className="text-[10px] text-slate-300 font-mono truncate max-w-[120px]" title={doc.protocolo}>Prot: {doc.protocolo.slice(-8)}</div>}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm text-slate-800">{doc.clientes?.nome_fantasia ?? doc.clientes?.razao_social ?? '---'}</div>
                  {doc.clientes?.nome_fantasia && <div className="text-xs text-slate-400">{doc.clientes.razao_social}</div>}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${doc.fiscal_ambientes?.tipo === 'producao' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                    {doc.fiscal_ambientes?.tipo === 'producao' ? '🟢 Produção' : '🟡 Homologação'}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold text-slate-800">{brl(doc.valor_total)}</TableCell>
                <TableCell className="text-sm text-slate-500">{doc.data_emissao ? formatDate(doc.data_emissao) : <span className="text-slate-300">---</span>}</TableCell>
                <TableCell>
                  <StatusFiscalBadge status={doc.status} />
                  {doc.mensagem_erro && (
                    <p className="text-[10px] text-red-500 mt-1 max-w-[180px] truncate" title={doc.mensagem_erro}>
                      ⚠ {doc.mensagem_erro}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {['rascunho', 'apto'].includes(doc.status) && (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-2" onClick={() => handleEmitir(doc)} disabled={emitirMutation.isPending}>
                        {emitirMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        <span className="ml-1 text-xs">Emitir</span>
                      </Button>
                    )}
                    {doc.status === 'rejeitado' && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-amber-600 hover:bg-amber-50" onClick={() => handleReprocessar(doc)} title="Reprocessar">
                        <RotateCcw className="w-3 h-3" />
                        <span className="ml-1 text-xs">Reprocessar</span>
                      </Button>
                    )}
                    {doc.status === 'autorizado' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleBaixarXml(doc)} disabled={baixandoXml === doc.id} title="Baixar XML">
                          {baixandoXml === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleBaixarPdf(doc)} disabled={baixandoPdf === doc.id} title="DANFE/PDF">
                          {baixandoPdf === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-red-500 hover:bg-red-50" onClick={() => setCancelarDoc(doc)} title="Cancelar NF-e">
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Cancelamento */}
      <Dialog open={!!cancelarDoc} onOpenChange={(o) => { if (!o) { setCancelarDoc(null); setJustificativa(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" /> Cancelar NF-e
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <strong>⚠️ Ação irreversível!</strong> O cancelamento será transmitido à SEFAZ.
            </div>
            {cancelarDoc && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-slate-500">Pedido:</span> <strong>{cancelarDoc.pedidos?.numero}</strong></p>
                <p><span className="text-slate-500">Cliente:</span> <strong>{cancelarDoc.clientes?.razao_social}</strong></p>
                <p><span className="text-slate-500">Valor:</span> <strong>{brl(cancelarDoc.valor_total)}</strong></p>
                {cancelarDoc.numero && <p><span className="text-slate-500">NF-e:</span> <strong>{cancelarDoc.numero}</strong></p>}
              </div>
            )}
            <div>
              <Label>Justificativa do cancelamento <span className="text-red-500">*</span></Label>
              <Textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Mínimo 15 caracteres. Descreva o motivo do cancelamento..."
                rows={4}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{justificativa.length} / 255 (mín. 15)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelarDoc(null); setJustificativa(''); }}>Voltar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCancelar}
              disabled={justificativa.length < 15 || cancelarMutation.isPending}
            >
              {cancelarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
