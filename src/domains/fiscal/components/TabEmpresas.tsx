import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Building2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  useEmpresas,
  useSalvarEmpresa,
  useExcluirEmpresa,
  type Empresa,
} from '../hooks/useEmpresas';

const EMPTY_FORM: Omit<Empresa, 'id' | 'created_at' | 'updated_at'> = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  ie: '',
  im: '',
  crt: 1,
  logradouro: '',
  numero_endereco: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  cep: '',
  codigo_municipio_ibge: '',
  telefone: '',
  logo_url: '',
  ativa: true,
};

export default function TabEmpresas() {
  const { data: empresas = [], isLoading, error } = useEmpresas();
  const salvarEmpresa = useSalvarEmpresa();
  const excluirEmpresa = useExcluirEmpresa();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const abrirNova = () => {
    setEditandoId(null);
    setForm({ ...EMPTY_FORM });
    setDialogAberto(true);
  };

  const abrirEdicao = (emp: Empresa) => {
    setEditandoId(emp.id);
    setForm({
      razao_social: emp.razao_social ?? '',
      nome_fantasia: emp.nome_fantasia ?? '',
      cnpj: emp.cnpj ?? '',
      ie: emp.ie ?? '',
      im: emp.im ?? '',
      crt: emp.crt ?? 1,
      logradouro: emp.logradouro ?? '',
      numero_endereco: emp.numero_endereco ?? '',
      complemento: emp.complemento ?? '',
      bairro: emp.bairro ?? '',
      municipio: emp.municipio ?? '',
      uf: emp.uf ?? '',
      cep: emp.cep ?? '',
      codigo_municipio_ibge: emp.codigo_municipio_ibge ?? '',
      telefone: emp.telefone ?? '',
      logo_url: emp.logo_url ?? '',
      ativa: emp.ativa,
    });
    setDialogAberto(true);
  };

  const handleSalvar = () => {
    if (!form.razao_social.trim()) return;
    if (!form.cnpj.trim()) return;
    salvarEmpresa.mutate(
      { ...form, ...(editandoId ? { id: editandoId } : {}) },
      { onSuccess: () => setDialogAberto(false) }
    );
  };

  const handleExcluir = () => {
    if (!confirmExcluir) return;
    excluirEmpresa.mutate(confirmExcluir, {
      onSuccess: () => setConfirmExcluir(null),
    });
  };

  const setField = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-400 text-sm">Carregando empresas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-700">
          Erro ao carregar empresas. A migration 065 foi executada?
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Header + botão nova empresa */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">
            {empresas.length === 0
              ? 'Nenhuma empresa cadastrada'
              : empresas.length === 1
                ? '1 empresa — emissão automática (sem perguntar)'
                : `${empresas.length} empresas — o sistema perguntará por qual emitir`}
          </p>
        </div>
        <Button onClick={abrirNova} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Empresa
        </Button>
      </div>

      {/* Lista de empresas */}
      {empresas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma empresa cadastrada</h3>
          <p className="text-sm text-slate-400 mt-1">
            Cadastre sua primeira empresa para emitir NF-e
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {empresas.map((emp) => (
            <Card
              key={emp.id}
              className={`border-2 ${
                emp.ativa ? 'border-green-200 bg-green-50/20' : 'border-slate-200 bg-slate-50/30 opacity-60'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    {emp.nome_fantasia || emp.razao_social}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {emp.ativa ? (
                      <Badge className="bg-emerald-500 text-white text-xs px-2">
                        <CheckCircle className="w-3 h-3 mr-1" /> Ativa
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <XCircle className="w-3 h-3 mr-1" /> Inativa
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">CNPJ</p>
                <p className="text-sm font-mono text-slate-800">{emp.cnpj}</p>

                {emp.razao_social && emp.nome_fantasia && (
                  <>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-2">Razão Social</p>
                    <p className="text-sm text-slate-700">{emp.razao_social}</p>
                  </>
                )}

                {emp.municipio && emp.uf && (
                  <p className="text-xs text-slate-500 mt-1">
                    {emp.municipio}/{emp.uf}
                    {emp.crt === 1 && ' — Simples Nacional'}
                    {emp.crt === 3 && ' — Regime Normal'}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() => abrirEdicao(emp)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setConfirmExcluir(emp.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Criar/Editar Empresa */}
      <Dialog open={dialogAberto} onOpenChange={(o) => { if (!o) setDialogAberto(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              {editandoId ? 'Editar Empresa' : 'Nova Empresa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">

            {/* Identificação */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Razão Social <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.razao_social}
                    onChange={(e) => setField('razao_social', e.target.value)}
                    placeholder="Razão social completa"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={form.nome_fantasia ?? ''}
                    onChange={(e) => setField('nome_fantasia', e.target.value)}
                    placeholder="Nome fantasia"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>CNPJ <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setField('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>CRT</Label>
                  <Select
                    value={String(form.crt)}
                    onValueChange={(v) => setField('crt', Number(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Simples Nacional</SelectItem>
                      <SelectItem value="2">2 — Simples Excesso Sublimite</SelectItem>
                      <SelectItem value="3">3 — Regime Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={form.ie ?? ''}
                    onChange={(e) => setField('ie', e.target.value)}
                    placeholder="IE"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>Inscrição Municipal</Label>
                  <Input
                    value={form.im ?? ''}
                    onChange={(e) => setField('im', e.target.value)}
                    placeholder="IM"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Endereço
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={form.logradouro ?? ''}
                    onChange={(e) => setField('logradouro', e.target.value)}
                    placeholder="Rua, Av, etc."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.numero_endereco ?? ''}
                    onChange={(e) => setField('numero_endereco', e.target.value)}
                    placeholder="Nº"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={form.complemento ?? ''}
                    onChange={(e) => setField('complemento', e.target.value)}
                    placeholder="Sala, Andar"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro ?? ''}
                    onChange={(e) => setField('bairro', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Município</Label>
                  <Input
                    value={form.municipio ?? ''}
                    onChange={(e) => setField('municipio', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input
                    value={form.uf ?? ''}
                    onChange={(e) => setField('uf', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={form.cep ?? ''}
                    onChange={(e) => setField('cep', e.target.value)}
                    placeholder="00000-000"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>Cód. IBGE Município</Label>
                  <Input
                    value={form.codigo_municipio_ibge ?? ''}
                    onChange={(e) => setField('codigo_municipio_ibge', e.target.value)}
                    placeholder="7 dígitos"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">
                Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone ?? ''}
                    onChange={(e) => setField('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativa}
                      onChange={(e) => setField('ativa', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Empresa ativa</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSalvar}
              disabled={
                salvarEmpresa.isPending ||
                !form.razao_social.trim() ||
                !form.cnpj.trim()
              }
            >
              {salvarEmpresa.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {editandoId ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmExcluir} onOpenChange={(o) => { if (!o) setConfirmExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Excluir empresa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Esta ação não pode ser desfeita. Empresas com documentos fiscais emitidos não podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={excluirEmpresa.isPending}
            >
              {excluirEmpresa.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
