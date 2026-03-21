// ============================================================================
// OS ARQUIVO PARA PRODUÇÃO — Upload de arte/arquivo para o chão de fábrica
// Exibe link da arte aprovada + campo de observações + upload de arquivo
// ============================================================================

import { useState, useRef } from 'react';
import { Upload, FileText, ExternalLink, Loader2, Image, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface OSArquivoProducaoProps {
  opId: string;
  arteUrl?: string | null;          // arte aprovada pelo cliente (do pedido_item)
  instrucoes?: string | null;       // instruções existentes do item
}

const ALLOWED_EXT = '.jpg,.jpeg,.png,.gif,.pdf,.ai,.eps';
const MAX_SIZE_MB = 50;

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

export function OSArquivoProducao({ opId, arteUrl, instrucoes }: OSArquivoProducaoProps) {
  const [obs, setObs] = useState(instrucoes ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [savedObs, setSavedObs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSaveObs = async () => {
    try {
      const { error } = await (supabase as any)
        .from('ordens_producao')
        .update({ observacoes: obs || null })
        .eq('id', opId);
      if (error) throw error;
      setSavedObs(true);
      showSuccess('Observações salvas!');
      setTimeout(() => setSavedObs(false), 2000);
    } catch {
      showError('Erro ao salvar observações');
    }
  };

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showError(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      const path = `${opId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('producao-arquivos')
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('producao-arquivos')
        .getPublicUrl(path);

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, url: urlData.publicUrl, size: file.size },
      ]);
      showSuccess(`Arquivo "${file.name}" enviado com sucesso!`);
    } catch (err: any) {
      showError(err?.message ?? 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Arquivo para Produção
      </h3>

      {/* Arte aprovada pelo cliente */}
      {arteUrl ? (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Image size={16} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-600 font-medium">Arte aprovada pelo cliente</p>
            <p className="text-xs text-blue-800 truncate mt-0.5">{arteUrl.split('/').pop()}</p>
          </div>
          <a
            href={arteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors flex-shrink-0"
          >
            <ExternalLink size={13} /> Abrir
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
          <FileText size={14} />
          <span>Nenhuma arte aprovada vinculada a este item</span>
        </div>
      )}

      {/* Observações de produção */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">
          Observações de Produção
        </Label>
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex: Usar vinil fosco 3M, corte a laser. Conferir pantone C 286..."
          className="rounded-xl min-h-[80px] text-sm resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 gap-1.5 text-xs"
            onClick={handleSaveObs}
          >
            {savedObs ? (
              <><Check size={12} className="text-emerald-600" /> Salvo</>
            ) : (
              <>Salvar observações</>
            )}
          </Button>
        </div>
      </div>

      {/* Upload de arquivo de produção */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">
          Upload de Arquivo de Produção
        </Label>
        <p className="text-xs text-slate-400">
          JPG, PNG, PDF, AI, EPS — máximo {MAX_SIZE_MB}MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXT}
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-blue-500" />
          ) : (
            <Upload size={20} />
          )}
          <span className="text-xs font-medium">
            {uploading ? 'Enviando...' : 'Clique para selecionar arquivo'}
          </span>
        </button>

        {/* Arquivos enviados nesta sessão */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {uploadedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"
              >
                <FileText size={14} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-emerald-800 truncate">{f.name}</p>
                  <p className="text-xs text-emerald-600">{formatBytes(f.size)}</p>
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-800 transition-colors flex-shrink-0"
                >
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
