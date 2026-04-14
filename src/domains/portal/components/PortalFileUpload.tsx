// src/domains/portal/components/PortalFileUpload.tsx
import { useState, useCallback } from 'react';
import { Upload, FileIcon, X, Loader2, CheckCircle2, Paperclip } from 'lucide-react';
import { validateFile, uploadFileToPortal } from '../services/portal-upload.service';
import { showError } from '@/utils/toast';

interface Props {
  token: string;
  clientName: string;
}

interface FileState {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function PortalFileUpload({ token, clientName }: Props) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const validated = newFiles.map(file => {
      const err = validateFile(file);
      return { file, status: err ? 'error' as const : 'pending' as const, error: err || undefined };
    });

    setFiles(prev => [...prev, ...validated]);

    for (const item of validated) {
      if (item.status === 'error') continue;
      setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'uploading' } : f));
      try {
        const result = await uploadFileToPortal({ token, file: item.file, clientName });
        setFiles(prev => prev.map(f =>
          f.file === item.file ? { ...f, status: 'done', previewUrl: result.previewUrl ?? null } : f
        ));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'error', error: msg } : f));
        showError(`Falha ao enviar ${item.file.name}`);
      }
    }
  }, [token, clientName]);

  const removeFile = (file: File) => {
    setFiles(prev => prev.filter(f => f.file !== file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip size={18} className="text-blue-600" />
        <h3 className="font-semibold text-slate-800">Anexar Arquivos</h3>
        <span className="text-xs text-slate-400">(opcional)</span>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-200 ${
          dragOver
            ? 'border-blue-400 bg-blue-50 scale-[1.01]'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <Upload size={22} className="text-blue-500" />
        </div>
        <p className="text-sm font-medium text-slate-600 mb-1">
          Arraste seus arquivos aqui
        </p>
        <p className="text-xs text-slate-400 mb-3">ou</p>
        <label className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors">
          Selecionar arquivos
          <input
            type="file" multiple className="hidden"
            accept=".pdf,.ai,.cdr,.eps,.jpg,.jpeg,.png,.tiff,.tif,.psd"
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.length) addFiles(selected);
              e.target.value = '';
            }}
          />
        </label>
        <p className="text-xs text-slate-400 mt-3">
          PDF, AI, CDR, EPS, JPG, PNG, TIFF, PSD — Arquivos de alta qualidade
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 text-sm">
              {f.status === 'done' && f.previewUrl ? (
                <a
                  href={f.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-slate-200 hover:ring-2 hover:ring-blue-300 transition-shadow"
                  title="Abrir prévia"
                >
                  <img src={f.previewUrl} alt={f.file.name} className="w-full h-full object-cover" />
                </a>
              ) : (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  f.status === 'done' ? 'bg-green-100' : f.status === 'error' ? 'bg-red-100' : 'bg-slate-100'
                }`}>
                  {f.status === 'done' ? (
                    <CheckCircle2 size={16} className="text-green-600" />
                  ) : f.status === 'uploading' ? (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  ) : f.status === 'error' ? (
                    <X size={16} className="text-red-500" />
                  ) : (
                    <FileIcon size={16} className="text-slate-400" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-slate-700">{f.file.name}</p>
                <p className="text-xs text-slate-400">
                  {f.status === 'error' ? (
                    <span className="text-red-500">{f.error}</span>
                  ) : (
                    formatFileSize(f.file.size)
                  )}
                </p>
              </div>
              {f.status !== 'uploading' && (
                <button
                  onClick={() => removeFile(f.file)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
