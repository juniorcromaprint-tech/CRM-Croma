import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Server,
  FileDigit,
  ListChecks,
  Edit2,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldCheck,
  FlaskConical,
  ArrowRightLeft,
} from 'lucide-react';
import {
  useFiscalAmbientes,
  useFiscalSeries,
  useFiscalRegras,
  useAlternarAmbienteFiscal,
} from '../hooks/useFiscal';

// ---------------------------------------------------------------------------
// Tab Ambientes
// ---------------------------------------------------------------------------

function TabAmbientes() {
  const qc = useQueryClient();
  const { data: ambientes = [], isLoading, error } = useFiscalAmbientes();
  const [editando, setEditando] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const alternarAmbiente = useAlternarAmbienteFiscal();
  const [confirmProd, setConfirmProd] = useState(false);
  const [pendingAmbienteId, setPendingAmbienteId] = useState<string | null>(null);

  const [formAmb, setFormAmb] = useState({
    cnpj_emitente: '',
    razao_social_emitente: '',
    ie_emitente: '',
    im_emitente: '',
    crt: 1 as number,
    logradouro: '',
    numero_endereco: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
    cep: '',
    codigo_municipio_ibge: '',
    telefone_emitente: '',
    ativo: true,
  });

  const abrirEdicao = (amb: any) => {
    setEditando(amb);
    setFormAmb({
      cnpj_emitente: amb.cnpj_emitente ?? '',
      razao_social_emitente: amb.razao_social_emitente ?? '',
      ie_emitente: amb.ie_emitente ?? '',
      im_emitente: amb.im_emitente ?? '',
      crt: amb.crt ?? 1,
      logradouro: amb.logradouro ?? '',
      numero_endereco: amb.numero_endereco ?? '',
      complemento: amb.complemento ?? '',
      bairro: amb.bairro ?? '',
      municipio: amb.municipio ?? '',
      uf: amb.uf ?? '',
      cep: amb.cep ?? '',
      codigo_municipio_ibge: amb.codigo_municipio_ibge ?? '',
      telefone_emitente: amb.telefone_emitente ?? '',
      ativo: amb.ativo ?? false,
    });
  };

  const salvarAmbiente = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      const { error: err } = await supabase
        .from('fiscal_ambientes')
        .update({
          cnpj_emitente: formAmb.cnpj_emitente || null,
          razao_social_emitente: formAmb.razao_social_emitente || null,
          ie_emitente: formAmb.ie_emitente || null,
          im_emitente: formAmb.im_emitente || null,
          crt: formAmb.crt,
          logradouro: formAmb.logradouro || null,
          numero_endereco: formAmb.numero_endereco || null,
          complemento: formAmb.complemento || null,
          bairro: formAmb.bairro || null,
          municipio: formAmb.municipio || null,
          uf: formAmb.uf || null,
          cep: formAmb.cep || null,
          codigo_municipio_ibge: formAmb.codigo_municipio_ibge || null,
          telefone_emitente: formAmb.telefone_emitente || null,
          ativo: formAmb.ativo,
        })
        .eq('id', editando.id);
      if (err) throw err;
      showSuccess('Ambiente fiscal atualizado!');
      qc.invalidateQueries({ queryKey: ['fiscal_ambientes'] });
      setEditando(null);
    } catch (e: any) {
      showError(e.message ?? 'Erro ao salvar ambiente');
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-400 text-sm">Carregando ambientes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-700">
          Erro ao carregar ambientes fiscais.
        </AlertDescription>
      </Alert>
    );
  }

  const ambienteAtivo = (ambientes as any[]).find((a: any) => a.ativo);
  const ambienteAtivoIsHml =
    ambienteAtivo &&
    ambienteAtivo.tipo !== 'producao' &&
    ambienteAtivo.tipo !== 'NFE_PRD';

  const handleToggleAmbiente = (ambId: string, isProd: boolean) => {
    if (isProd) {
      setPendingAmbienteId(ambId);
      setConfirmProd(true);
    } else {
      alternarAmbiente.mutate(ambId);
    }
  };

  const confirmarMudancaProd = () => {
    if (pendingAmbienteId) {
      alternarAmbiente.mutate(pendingAmbienteId);
    }
    setConfirmProd(false);
    setPendingAmbienteId(null);
  };

  return (
    <>
      {/* Seletor de Ambiente Ativo */}
      <Card className="border-2 border-slate-200 mb-4">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Ambiente Ativo para Emissão</p>
                <p className="text-xs text-slate-500">
                  Selecione em qual ambiente as NF-e serão emitidas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(ambientes as any[]).map((amb: any) => {
                const isProd = amb.tipo === 'producao' || amb.tipo === 'NFE_PRD';
                const isActive = amb.ativo;
                return (
                  <Button
                    key={amb.id}
                    size="sm"
                    disabled={isActive || alternarAmbiente.isPending}
                    onClick={() => handleToggleAmbiente(amb.id, isProd)}
                    className={`h-9 px-4 text-sm font-medium transition-all ${
                      isActive
                        ? isProd
                          ? 'bg-green-600 hover:bg-green-600 text-white shadow-md cursor-default'
                          : 'bg-amber-500 hover:bg-amber-500 text-white shadow-md cursor-default'
                        : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {isProd ? (
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                    ) : (
                      <FlaskConical className="w-4 h-4 mr-1.5" />
                    )}
                    {isProd ? 'Produção' : 'Homologação'}
                    {isActive && <CheckCircle className="w-3.5 h-3.5 ml-1.5" />}
                  </Button>
                );
              })}
              {alternarAmbiente.isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner de aviso quando o ambiente ativo é homologação */}
      {ambienteAtivoIsHml && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-400 bg-amber-50 text-amber-800 font-semibold text-sm mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <span>
            AMBIENTE: HOMOLOGAÇÃO — NF-e não tem validade fiscal. Documentos emitidos em
            homologação{' '}
            <strong>não possuem valor jurídico</strong>. Mude para Produção antes de emitir
            documentos reais.
          </span>
        </div>
      )}

      {/* Confirmação antes de mudar para Produção */}
      <AlertDialog open={confirmProd} onOpenChange={setConfirmProd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldCheck className="w-5 h-5" />
              Ativar Ambiente de Produção?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 space-y-2">
              <p>
                Ao mudar para <strong>Produção</strong>, todas as NF-e emitidas terão{' '}
                <strong>validade fiscal real</strong> e serão enviadas à SEFAZ oficial.
              </p>
              <p className="text-red-600 font-medium">
                Documentos emitidos em produção NÃO podem ser desfeitos — apenas cancelados dentro
                do prazo legal (24h).
              </p>
              <p>Certifique-se de que todos os dados do emitente e certificado digital estão corretos.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarMudancaProd}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Sim, ativar Produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(ambientes as any[]).map((amb: any) => {
          const isProd = amb.tipo === 'producao' || amb.tipo === 'NFE_PRD';
          return (
            <Card
              key={amb.id}
              className={`border-2 ${
                isProd
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-blue-200 bg-blue-50/30'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-800">
                    {amb.nome ?? (isProd ? 'Produção' : 'Homologação')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs ${
                        isProd
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-blue-100 text-blue-700 border border-blue-300'
                      }`}
                    >
                      {isProd ? 'Produção' : 'Homologação'}
                    </Badge>
                    {amb.ativo && (
                      <Badge className="bg-emerald-500 text-white text-xs px-2">ATIVO</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">CNPJ Emitente</p>
                  <p className="text-sm font-mono text-slate-800">{amb.cnpj_emitente ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Razão Social</p>
                  <p className="text-sm text-slate-800">{amb.razao_social_emitente ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {amb.ativo ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" /> Habilitado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <XCircle className="w-3 h-3" /> Desabilitado
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 px-3 text-xs"
                    onClick={() => abrirEdicao(amb)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog Editar Ambiente */}
      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Editar Ambiente: {editando?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">

            {/* Seção: Identificação Fiscal */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Identificação Fiscal
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cnpj_emitente">CNPJ Emitente</Label>
                    <Input
                      id="cnpj_emitente"
                      value={formAmb.cnpj_emitente}
                      onChange={(e) => setFormAmb((f) => ({ ...f, cnpj_emitente: e.target.value }))}
                      placeholder="00.000.000/0001-00"
                      className="mt-1.5 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ie_emitente">Inscrição Estadual (IE)</Label>
                    <Input
                      id="ie_emitente"
                      value={formAmb.ie_emitente}
                      onChange={(e) => setFormAmb((f) => ({ ...f, ie_emitente: e.target.value }))}
                      placeholder="000.000.000.000"
                      className="mt-1.5 rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="razao_social_emitente">Razão Social</Label>
                  <Input
                    id="razao_social_emitente"
                    value={formAmb.razao_social_emitente}
                    onChange={(e) => setFormAmb((f) => ({ ...f, razao_social_emitente: e.target.value }))}
                    placeholder="Razão social da empresa emissora"
                    className="mt-1.5 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="im_emitente">Inscrição Municipal (IM)</Label>
                    <Input
                      id="im_emitente"
                      value={formAmb.im_emitente}
                      onChange={(e) => setFormAmb((f) => ({ ...f, im_emitente: e.target.value }))}
                      placeholder="Opcional"
                      className="mt-1.5 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="crt_amb">Regime Tributário (CRT)</Label>
                    <Select
                      value={String(formAmb.crt)}
                      onValueChange={(v) => setFormAmb((f) => ({ ...f, crt: Number(v) }))}
                    >
                      <SelectTrigger className="mt-1.5 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Simples Nacional</SelectItem>
                        <SelectItem value="2">2 — Simples Nacional — Excesso Sublimite</SelectItem>
                        <SelectItem value="3">3 — Regime Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção: Endereço */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Endereço
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="logradouro_amb">Logradouro</Label>
                    <Input
                      id="logradouro_amb"
                      value={formAmb.logradouro}
                      onChange={(e) => setFormAmb((f) => ({ ...f, logradouro: e.target.value }))}
                      placeholder="Rua, Avenida..."
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_endereco_amb">Número</Label>
                    <Input
                      id="numero_endereco_amb"
                      value={formAmb.numero_endereco}
                      onChange={(e) => setFormAmb((f) => ({ ...f, numero_endereco: e.target.value }))}
                      placeholder="123"
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="complemento_amb">Complemento</Label>
                    <Input
                      id="complemento_amb"
                      value={formAmb.complemento}
                      onChange={(e) => setFormAmb((f) => ({ ...f, complemento: e.target.value }))}
                      placeholder="Sala, Andar... (opcional)"
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bairro_amb">Bairro</Label>
                    <Input
                      id="bairro_amb"
                      value={formAmb.bairro}
                      onChange={(e) => setFormAmb((f) => ({ ...f, bairro: e.target.value }))}
                      placeholder="Bairro"
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label htmlFor="municipio_amb">Município</Label>
                    <Input
                      id="municipio_amb"
                      value={formAmb.municipio}
                      onChange={(e) => setFormAmb((f) => ({ ...f, municipio: e.target.value }))}
                      placeholder="São Paulo"
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="uf_amb">UF</Label>
                    <Input
                      id="uf_amb"
                      value={formAmb.uf}
                      onChange={(e) => setFormAmb((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="SP"
                      maxLength={2}
                      className="mt-1.5 rounded-xl font-mono uppercase"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cep_amb">CEP</Label>
                    <Input
                      id="cep_amb"
                      value={formAmb.cep}
                      onChange={(e) => setFormAmb((f) => ({ ...f, cep: e.target.value }))}
                      placeholder="00000-000"
                      className="mt-1.5 rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ibge_amb">Código IBGE do Município (7 dígitos)</Label>
                  <Input
                    id="ibge_amb"
                    value={formAmb.codigo_municipio_ibge}
                    onChange={(e) => setFormAmb((f) => ({ ...f, codigo_municipio_ibge: e.target.value }))}
                    placeholder="3550308"
                    maxLength={7}
                    className="mt-1.5 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Contato */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Contato
              </h3>
              <div>
                <Label htmlFor="telefone_emitente_amb">Telefone</Label>
                <Input
                  id="telefone_emitente_amb"
                  value={formAmb.telefone_emitente}
                  onChange={(e) => setFormAmb((f) => ({ ...f, telefone_emitente: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="mt-1.5 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="ativo_amb"
                checked={formAmb.ativo}
                onChange={(e) => setFormAmb((f) => ({ ...f, ativo: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600"
              />
              <Label htmlFor="ativo_amb" className="cursor-pointer">
                Ambiente ativo (habilitado para emissão)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={salvarAmbiente}
              disabled={salvando}
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab Séries
// ---------------------------------------------------------------------------

function TabSeries() {
  const qc = useQueryClient();
  const { data: series = [], isLoading, error } = useFiscalSeries();
  const { data: ambientes = [] } = useFiscalAmbientes();
  const [novaSerieOpen, setNovaSerieOpen] = useState(false);
  const [editandoSerie, setEditandoSerie] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  const formVazio = {
    serie: '',
    tipo_documento: 'NF-e',
    ambiente_id: '',
  };
  const [formSerie, setFormSerie] = useState(formVazio);

  const abrirNova = () => {
    setFormSerie(formVazio);
    setEditandoSerie(null);
    setNovaSerieOpen(true);
  };

  const abrirEdicao = (s: any) => {
    setFormSerie({
      serie: String(s.serie ?? ''),
      tipo_documento: s.tipo_documento ?? 'NF-e',
      ambiente_id: s.ambiente_id ?? '',
    });
    setEditandoSerie(s);
    setNovaSerieOpen(true);
  };

  const salvarSerie = async () => {
    setSalvando(true);
    try {
      const payload = {
        serie: Number(formSerie.serie),
        tipo_documento: formSerie.tipo_documento,
        ambiente_id: formSerie.ambiente_id || null,
      };
      let err;
      if (editandoSerie) {
        ({ error: err } = await supabase
          .from('fiscal_series')
          .update(payload)
          .eq('id', editandoSerie.id));
      } else {
        ({ error: err } = await supabase.from('fiscal_series').insert(payload));
      }
      if (err) throw err;
      showSuccess(editandoSerie ? 'Série atualizada!' : 'Série criada com sucesso!');
      qc.invalidateQueries({ queryKey: ['fiscal_series'] });
      setNovaSerieOpen(false);
    } catch (e: any) {
      showError(e.message ?? 'Erro ao salvar série');
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-400 text-sm">Carregando séries...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-700">Erro ao carregar séries fiscais.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={abrirNova}>
          <Plus className="w-4 h-4 mr-1" /> Nova Série
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Série</TableHead>
              <TableHead>Tipo Doc.</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead className="text-right">Próx. Número</TableHead>
              <TableHead className="text-right">Último Número</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(series as any[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                  <FileDigit className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma série configurada</p>
                </TableCell>
              </TableRow>
            ) : (
              (series as any[]).map((s: any) => (
                <TableRow key={s.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-mono font-bold text-slate-800">{s.serie}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{s.tipo_documento}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {s.fiscal_ambientes?.nome ?? '—'}
                    {s.fiscal_ambientes?.tipo && (
                      <span
                        className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                          s.fiscal_ambientes.tipo === 'producao'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {s.fiscal_ambientes.tipo === 'producao' ? 'PRD' : 'HML'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {s.numero_atual ?? 1}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-500">
                    {s.ultimo_numero ?? '—'}
                  </TableCell>
                  <TableCell>
                    {s.ativo !== false ? (
                      <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => abrirEdicao(s)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Nova/Editar Série */}
      <Dialog open={novaSerieOpen} onOpenChange={(o) => { if (!o) setNovaSerieOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDigit className="w-5 h-5 text-indigo-600" />
              {editandoSerie ? 'Editar Série' : 'Nova Série Fiscal'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="serie_num">Número da Série</Label>
              <Input
                id="serie_num"
                type="number"
                min={1}
                value={formSerie.serie}
                onChange={(e) => setFormSerie((f) => ({ ...f, serie: e.target.value }))}
                placeholder="Ex: 1"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="tipo_doc">Tipo de Documento</Label>
              <Select
                value={formSerie.tipo_documento}
                onValueChange={(v) => setFormSerie((f) => ({ ...f, tipo_documento: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NF-e">NF-e (Nota Fiscal Eletrônica)</SelectItem>
                  <SelectItem value="NFS-e">NFS-e (Nota de Serviço Eletrônica)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ambiente_serie">Ambiente</Label>
              <Select
                value={formSerie.ambiente_id}
                onValueChange={(v) => setFormSerie((f) => ({ ...f, ambiente_id: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o ambiente..." />
                </SelectTrigger>
                <SelectContent>
                  {(ambientes as any[]).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} ({a.tipo === 'producao' ? 'Produção' : 'Homologação'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaSerieOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={salvarSerie}
              disabled={salvando || !formSerie.serie}
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editandoSerie ? 'Salvar' : 'Criar Série'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab Regras de Operação
// ---------------------------------------------------------------------------

function TabRegras() {
  const qc = useQueryClient();
  const { data: regras = [], isLoading, error } = useFiscalRegras();
  const [novaRegraOpen, setNovaRegraOpen] = useState(false);
  const [editandoRegra, setEditandoRegra] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  const formVazio = {
    nome: '',
    descricao: '',
    cfop_padrao: '',
    cst_icms: '',
    csosn: '',
    finalidade: '1',
    destino_operacao: '1',
    prioridade: 5,
    ativo: true,
  };
  const [formRegra, setFormRegra] = useState(formVazio);

  const abrirNova = () => {
    setFormRegra(formVazio);
    setEditandoRegra(null);
    setNovaRegraOpen(true);
  };

  const abrirEdicao = (r: any) => {
    setFormRegra({
      nome: r.nome ?? '',
      descricao: r.descricao ?? '',
      cfop_padrao: r.cfop_padrao ?? '',
      cst_icms: r.cst_icms ?? '',
      csosn: r.csosn ?? '',
      finalidade: String(r.finalidade ?? '1'),
      destino_operacao: String(r.destino_operacao ?? '1'),
      prioridade: r.prioridade_regra ?? r.prioridade ?? 5,
      ativo: r.ativo ?? true,
    });
    setEditandoRegra(r);
    setNovaRegraOpen(true);
  };

  const salvarRegra = async () => {
    if (!formRegra.nome.trim()) {
      showError('O nome da regra é obrigatório');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: formRegra.nome,
        descricao: formRegra.descricao || null,
        cfop_padrao: formRegra.cfop_padrao || null,
        cst_icms: formRegra.cst_icms || null,
        csosn: formRegra.csosn || null,
        finalidade: Number(formRegra.finalidade),
        destino_operacao: Number(formRegra.destino_operacao),
        prioridade_regra: Number(formRegra.prioridade),
        ativo: formRegra.ativo,
      };
      let err;
      if (editandoRegra) {
        ({ error: err } = await supabase
          .from('fiscal_regras_operacao')
          .update(payload)
          .eq('id', editandoRegra.id));
      } else {
        ({ error: err } = await supabase.from('fiscal_regras_operacao').insert(payload));
      }
      if (err) throw err;
      showSuccess(editandoRegra ? 'Regra atualizada!' : 'Regra criada com sucesso!');
      qc.invalidateQueries({ queryKey: ['fiscal_regras_operacao'] });
      setNovaRegraOpen(false);
    } catch (e: any) {
      showError(e.message ?? 'Erro ao salvar regra');
    } finally {
      setSalvando(false);
    }
  };

  const FINALIDADE_LABEL: Record<string, string> = {
    '1': 'Normal',
    '2': 'Complementar',
    '3': 'Ajuste',
    '4': 'Devolução',
  };

  const DESTINO_LABEL: Record<string, string> = {
    '1': 'Interna',
    '2': 'Interestadual',
    '3': 'Exterior',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-400 text-sm">Carregando regras...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-700">Erro ao carregar regras de operação.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={abrirNova}>
          <Plus className="w-4 h-4 mr-1" /> Nova Regra
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nome</TableHead>
              <TableHead>CFOP Padrão</TableHead>
              <TableHead>CST/CSOSN</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead className="text-right">Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(regras as any[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                  <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma regra de operação configurada</p>
                </TableCell>
              </TableRow>
            ) : (
              (regras as any[]).map((r: any) => (
                <TableRow key={r.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <p className="font-medium text-sm text-slate-800">{r.nome}</p>
                    {r.descricao && (
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{r.descricao}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.cfop_padrao ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {r.cst_icms ? `CST: ${r.cst_icms}` : ''}
                    {r.csosn ? `CSOSN: ${r.csosn}` : ''}
                    {!r.cst_icms && !r.csosn ? '—' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {DESTINO_LABEL[String(r.destino_operacao)] ?? r.destino_operacao ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.prioridade_regra ?? r.prioridade ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.ativo ? (
                      <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirEdicao(r)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Nova/Editar Regra */}
      <Dialog open={novaRegraOpen} onOpenChange={(o) => { if (!o) setNovaRegraOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              {editandoRegra ? 'Editar Regra de Operação' : 'Nova Regra de Operação'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="regra_nome">Nome da Regra <span className="text-red-500">*</span></Label>
              <Input
                id="regra_nome"
                value={formRegra.nome}
                onChange={(e) => setFormRegra((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Venda Interna Simples Nacional"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="regra_desc">Descrição</Label>
              <Textarea
                id="regra_desc"
                value={formRegra.descricao}
                onChange={(e) => setFormRegra((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva quando esta regra se aplica..."
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cfop">CFOP Padrão</Label>
                <Input
                  id="cfop"
                  value={formRegra.cfop_padrao}
                  onChange={(e) => setFormRegra((f) => ({ ...f, cfop_padrao: e.target.value }))}
                  placeholder="Ex: 5102"
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="cst_icms">CST ICMS</Label>
                <Input
                  id="cst_icms"
                  value={formRegra.cst_icms}
                  onChange={(e) => setFormRegra((f) => ({ ...f, cst_icms: e.target.value }))}
                  placeholder="Ex: 000"
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="csosn">CSOSN</Label>
                <Input
                  id="csosn"
                  value={formRegra.csosn}
                  onChange={(e) => setFormRegra((f) => ({ ...f, csosn: e.target.value }))}
                  placeholder="Ex: 102"
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="prioridade_r">Prioridade</Label>
                <Input
                  id="prioridade_r"
                  type="number"
                  min={1}
                  max={100}
                  value={formRegra.prioridade}
                  onChange={(e) =>
                    setFormRegra((f) => ({ ...f, prioridade: Number(e.target.value) }))
                  }
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Finalidade</Label>
                <Select
                  value={formRegra.finalidade}
                  onValueChange={(v) => setFormRegra((f) => ({ ...f, finalidade: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Normal</SelectItem>
                    <SelectItem value="2">2 — Complementar</SelectItem>
                    <SelectItem value="3">3 — Ajuste</SelectItem>
                    <SelectItem value="4">4 — Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destino Operação</Label>
                <Select
                  value={formRegra.destino_operacao}
                  onValueChange={(v) => setFormRegra((f) => ({ ...f, destino_operacao: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Interna</SelectItem>
                    <SelectItem value="2">2 — Interestadual</SelectItem>
                    <SelectItem value="3">3 — Exterior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="regra_ativo"
                checked={formRegra.ativo}
                onChange={(e) => setFormRegra((f) => ({ ...f, ativo: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600"
              />
              <Label htmlFor="regra_ativo" className="cursor-pointer">
                Regra ativa (aplicada automaticamente)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaRegraOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={salvarRegra}
              disabled={salvando || !formRegra.nome.trim()}
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editandoRegra ? 'Salvar' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function FiscalConfiguracaoPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-600" />
          Configurações Fiscais
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerencie ambientes, séries e regras de operação da NF-e
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ambientes">
        <TabsList className="border-b bg-transparent h-auto p-0 mb-6">
          <TabsTrigger
            value="ambientes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-transparent pb-2 text-sm font-medium"
          >
            <Server className="w-4 h-4 mr-1.5" />
            Ambientes
          </TabsTrigger>
          <TabsTrigger
            value="series"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-transparent pb-2 text-sm font-medium"
          >
            <FileDigit className="w-4 h-4 mr-1.5" />
            Séries
          </TabsTrigger>
          <TabsTrigger
            value="regras"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-transparent pb-2 text-sm font-medium"
          >
            <ListChecks className="w-4 h-4 mr-1.5" />
            Regras de Operação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ambientes">
          <TabAmbientes />
        </TabsContent>

        <TabsContent value="series">
          <TabSeries />
        </TabsContent>

        <TabsContent value="regras">
          <TabRegras />
        </TabsContent>
      </Tabs>
    </div>
  );
}
