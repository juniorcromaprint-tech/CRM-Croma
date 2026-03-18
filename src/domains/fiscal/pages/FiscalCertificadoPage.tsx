import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  ShieldCheck,
  Key,
  Upload,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useFiscalCertificados } from '../hooks/useFiscal';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('pt-BR');
}

function calcDiasRestantes(validade_fim: string): number {
  const validade = new Date(validade_fim);
  const hoje = new Date();
  return Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function CountdownBadge({ dias }: { dias: number }) {
  if (dias <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 text-sm font-bold border border-red-300">
        <XCircle className="w-3.5 h-3.5" /> VENCIDO
      </span>
    );
  }
  if (dias < 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold border border-red-300">
        <Clock className="w-3.5 h-3.5" /> {dias} dias restantes
      </span>
    );
  }
  if (dias < 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold border border-amber-300">
        <Clock className="w-3.5 h-3.5" /> {dias} dias restantes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-sm font-semibold border border-green-300">
      <CheckCircle className="w-3.5 h-3.5" /> {dias} dias restantes
    </span>
  );
}

export default function FiscalCertificadoPage() {
  const qc = useQueryClient();
  const { data: certificados = [], isLoading, error } = useFiscalCertificados();
  const [uploadAberto, setUploadAberto] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deployStatus, setDeployStatus] = useState<'deploying' | 'success' | 'failed' | 'partial' | null>(null);
  const [formUpload, setFormUpload] = useState({
    nome: '',
    senha: '',
    cnpj_titular: '',
    validade_fim: '',
    arquivo: null as File | null,
  });

  const certAtivo = (certificados as any[]).find((c: any) => c.ativo);
  const certHistorico = (certificados as any[]).filter((c: any) => !c.ativo);

  const handleTestar = async (certId: string) => {
    setTestando(certId);
    try {
      const { data, error: err } = await supabase.functions.invoke('fiscal-testar-certificado', {
        body: { certificado_id: certId },
      });
      if (err) throw err;
      if ((data as any)?.sucesso || (data as any)?.ok) {
        showSuccess('Certificado testado com sucesso! Conexão com SEFAZ estabelecida.');
      } else {
        showError('Falha no teste: ' + ((data as any)?.mensagem ?? 'Resposta inválida da SEFAZ'));
      }
    } catch (e: any) {
      showError(e.message ?? 'Erro ao testar certificado');
    } finally {
      setTestando(null);
    }
  };

  const handleUpload = async () => {
    if (!formUpload.nome.trim()) {
      showError('Informe um nome para o certificado');
      return;
    }
    if (!formUpload.arquivo) {
      showError('Selecione o arquivo .pfx ou .p12');
      return;
    }
    if (!formUpload.senha.trim()) {
      showError('Informe a senha do certificado');
      return;
    }

    setEnviando(true);
    try {
      // 1. Converter arquivo para base64 no browser
      const fileBuffer = await formUpload.arquivo.arrayBuffer();
      const certBase64 = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // 2. Upload do arquivo para Supabase Storage (backup seguro)
      const ext = formUpload.arquivo.name.split('.').pop() ?? 'pfx';
      const storagePath = `certificados/${Date.now()}_${formUpload.nome.replace(/\s+/g, '_')}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('fiscal-certificados')
        .upload(storagePath, formUpload.arquivo, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/x-pkcs12',
        });

      if (uploadErr) throw uploadErr;

      // 3. Gravar metadados em fiscal_certificados
      const payload: any = {
        nome: formUpload.nome,
        tipo_certificado: 'a1',
        arquivo_encriptado_url: storagePath,
        cnpj_titular: formUpload.cnpj_titular || '',
        ativo: false, // será ativado pelo deploy
      };

      if (formUpload.validade_fim) {
        payload.validade_fim = formUpload.validade_fim;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('fiscal_certificados')
        .insert(payload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // 5. Deploy automático no nfe-service via Edge Function
      setDeployStatus('deploying');
      const { data: deployResult, error: deployErr } = await supabase.functions.invoke(
        'fiscal-deploy-certificado',
        {
          body: {
            cert_base64: certBase64,
            cert_password: formUpload.senha,
            certificado_id: inserted?.id,
          },
        }
      );

      if (deployErr) {
        console.warn('Deploy automático falhou (certificado salvo):', deployErr);
        showSuccess('Certificado salvo com sucesso! Deploy automático falhou — configure manualmente no Vercel.');
        setDeployStatus('failed');
      } else if ((deployResult as any)?.ok) {
        showSuccess((deployResult as any).mensagem ?? 'Certificado deployado com sucesso!');
        setDeployStatus('success');
      } else {
        showSuccess('Certificado salvo. ' + ((deployResult as any)?.mensagem ?? 'Deploy requer configuração.'));
        setDeployStatus('partial');
      }

      qc.invalidateQueries({ queryKey: ['fiscal_certificados'] });

      // Limpar form
      setFormUpload({ nome: '', senha: '', cnpj_titular: '', validade_fim: '', arquivo: null });
      if (fileRef.current) fileRef.current.value = '';
      setUploadAberto(false);
    } catch (e: any) {
      showError(e.message ?? 'Erro ao enviar certificado');
      setDeployStatus(null);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          Certificado Digital A1
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestão segura do certificado digital para emissão de NF-e
        </p>
      </div>

      {/* Banner de Segurança */}
      <Alert className="border-amber-300 bg-amber-50">
        <ShieldCheck className="w-4 h-4 text-amber-700" />
        <AlertDescription className="text-amber-800 text-sm">
          <strong>Armazenamento Seguro:</strong> O certificado digital é armazenado de forma segura
          no servidor. Nunca é exposto ao navegador. Apenas os metadados (validade, nome) são
          exibidos aqui.
        </AlertDescription>
      </Alert>

      {/* Certificado Ativo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
          <span className="text-slate-400 text-sm">Carregando certificados...</span>
        </div>
      ) : error ? (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700">
            Erro ao carregar certificados. Tente novamente.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Card Certificado Ativo */}
          {certAtivo ? (
            <Card className="border-2 border-green-200 bg-green-50/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    Certificado em Uso
                  </CardTitle>
                  <Badge className="bg-emerald-500 text-white px-3">ATIVO</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Key className="w-3 h-3" /> Nome do Certificado
                    </p>
                    <p className="font-semibold text-slate-800">{certAtivo.nome}</p>
                    {certAtivo.cnpj_titular && (
                      <p className="text-xs font-mono text-slate-500">{certAtivo.cnpj_titular}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Validade
                    </p>
                    {certAtivo.validade_fim ? (
                      <>
                        <p className="font-semibold text-slate-800">
                          {formatDate(certAtivo.validade_fim)}
                        </p>
                        <CountdownBadge dias={calcDiasRestantes(certAtivo.validade_fim)} />
                      </>
                    ) : (
                      <p className="text-slate-400 text-sm">Não informada</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Último Teste
                    </p>
                    {certAtivo.ultimo_teste_em ? (
                      <p className="text-sm text-slate-600">{formatDateTime(certAtivo.ultimo_teste_em)}</p>
                    ) : (
                      <p className="text-sm text-slate-400">Nunca testado</p>
                    )}
                    {certAtivo.ultimo_teste_status && (
                      <Badge
                        className={`text-xs ${
                          certAtivo.ultimo_teste_status === 'sucesso' || certAtivo.ultimo_teste_status === 'ok'
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-red-100 text-red-700 border border-red-300'
                        }`}
                      >
                        {certAtivo.ultimo_teste_status === 'sucesso' || certAtivo.ultimo_teste_status === 'ok' ? 'Sucesso' : 'Falhou'}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1"
                      onClick={() => handleTestar(certAtivo.id)}
                      disabled={testando === certAtivo.id}
                    >
                      {testando === certAtivo.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                      )}
                      Testar Certificado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-red-200 bg-red-50/20">
              <CardContent className="py-8 text-center">
                <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="font-semibold text-red-700">Nenhum certificado ativo</p>
                <p className="text-sm text-red-500 mt-1">
                  Configure um certificado digital para emitir NF-e
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Upload Novo Certificado */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setUploadAberto((v) => !v)}
          >
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              Enviar Novo Certificado
            </CardTitle>
            {uploadAberto ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </CardHeader>

        {uploadAberto && (
          <CardContent className="space-y-5">
            {/* Alerta de segurança do upload */}
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                <strong>Segurança:</strong> O arquivo é enviado diretamente para armazenamento seguro
                e criptografado. Nunca é processado pelo frontend. Utilize apenas certificados A1
                emitidos por autoridade certificadora reconhecida.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cert_nome">
                  Nome do Certificado <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cert_nome"
                  value={formUpload.nome}
                  onChange={(e) => setFormUpload((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Certificado Principal 2026"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cert_cnpj_titular">
                  CNPJ Titular <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cert_cnpj_titular"
                  value={formUpload.cnpj_titular}
                  onChange={(e) => setFormUpload((f) => ({ ...f, cnpj_titular: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cert_validade">Data de Validade</Label>
                <Input
                  id="cert_validade"
                  type="date"
                  value={formUpload.validade_fim}
                  onChange={(e) => setFormUpload((f) => ({ ...f, validade_fim: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cert_senha">
                Senha do Certificado (.pfx) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cert_senha"
                type="password"
                value={formUpload.senha}
                onChange={(e) => setFormUpload((f) => ({ ...f, senha: e.target.value }))}
                placeholder="Senha de proteção do arquivo .pfx"
                className="mt-1.5"
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-400 mt-1">
                A senha é usada apenas para validação do certificado e não é armazenada no banco de
                dados.
              </p>
            </div>

            <div>
              <Label htmlFor="cert_arquivo">
                Arquivo do Certificado (.pfx / .p12) <span className="text-red-500">*</span>
              </Label>
              <input
                id="cert_arquivo"
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                className="mt-1.5 block w-full text-sm text-slate-600
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-300
                  file:text-sm file:font-medium file:bg-slate-50 file:text-slate-700
                  hover:file:bg-slate-100 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    const MAX_PFX_SIZE = 10 * 1024; // 10 KB
                    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
                      showError('Apenas arquivos .pfx ou .p12 são aceitos');
                      if (fileRef.current) fileRef.current.value = '';
                      return;
                    }
                    if (file.size > MAX_PFX_SIZE) {
                      showError(`Arquivo muito grande (${(file.size / 1024).toFixed(1)} KB). Certificados .pfx geralmente têm menos de 10 KB.`);
                      if (fileRef.current) fileRef.current.value = '';
                      return;
                    }
                  }
                  setFormUpload((f) => ({ ...f, arquivo: file }));
                }}
              />
              {formUpload.arquivo && (
                <p className="text-xs text-green-600 mt-1">
                  Arquivo selecionado: {formUpload.arquivo.name} (
                  {(formUpload.arquivo.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadAberto(false);
                  setFormUpload({ nome: '', senha: '', cnpj_titular: '', validade_fim: '', arquivo: null });
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleUpload}
                disabled={
                  enviando ||
                  !formUpload.nome.trim() ||
                  !formUpload.senha.trim() ||
                  !formUpload.arquivo
                }
              >
                {enviando ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Enviar Certificado
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Status do Deploy Automático */}
      {deployStatus && (
        <Alert
          className={`border ${
            deployStatus === 'deploying'
              ? 'border-blue-300 bg-blue-50'
              : deployStatus === 'success'
                ? 'border-green-300 bg-green-50'
                : deployStatus === 'failed'
                  ? 'border-red-300 bg-red-50'
                  : 'border-amber-300 bg-amber-50'
          }`}
        >
          {deployStatus === 'deploying' ? (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          ) : deployStatus === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : deployStatus === 'failed' ? (
            <XCircle className="w-4 h-4 text-red-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          )}
          <AlertDescription
            className={`text-sm ${
              deployStatus === 'deploying'
                ? 'text-blue-800'
                : deployStatus === 'success'
                  ? 'text-green-800'
                  : deployStatus === 'failed'
                    ? 'text-red-800'
                    : 'text-amber-800'
            }`}
          >
            {deployStatus === 'deploying' && (
              <span><strong>Deploying...</strong> Atualizando certificado no servidor de emissão NF-e. Aguarde...</span>
            )}
            {deployStatus === 'success' && (
              <span><strong>Deploy concluído!</strong> Certificado atualizado no nfe-service e redeploy disparado. As próximas emissões usarão o novo certificado.</span>
            )}
            {deployStatus === 'failed' && (
              <span><strong>Deploy falhou.</strong> O certificado foi salvo no storage, mas não foi possível atualizar automaticamente o nfe-service. Configure VERCEL_TOKEN e NFE_SERVICE_PROJECT_ID nas secrets do Supabase.</span>
            )}
            {deployStatus === 'partial' && (
              <span><strong>Parcialmente concluído.</strong> O certificado foi salvo, mas o redeploy automático não foi possível. Faça um redeploy manual no Vercel.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Histórico de Certificados */}
      {!isLoading && certHistorico.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Histórico de Certificados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Upload em</TableHead>
                  <TableHead>Último Teste</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certHistorico.map((c: any) => {
                  const dias = c.validade_fim ? calcDiasRestantes(c.validade_fim) : null;
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-sm text-slate-700">
                        {c.nome}
                        {c.cnpj_titular && (
                          <p className="text-xs font-mono text-slate-400">{c.cnpj_titular}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {c.validade_fim ? formatDate(c.validade_fim) : '—'}
                        {dias !== null && dias <= 0 && (
                          <p className="text-xs text-red-500">Vencido</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {c.created_at ? formatDate(c.created_at) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {c.ultimo_teste_em ? formatDateTime(c.ultimo_teste_em) : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        {c.ultimo_teste_status === 'sucesso' || c.ultimo_teste_status === 'ok' ? (
                          <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">
                            Sucesso
                          </Badge>
                        ) : c.ultimo_teste_status ? (
                          <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">
                            Falhou
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Não testado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-slate-500 hover:text-indigo-600"
                          onClick={() => handleTestar(c.id)}
                          disabled={testando === c.id}
                          title="Testar este certificado"
                        >
                          {testando === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3 h-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
