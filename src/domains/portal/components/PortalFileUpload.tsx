// src/domains/portal/components/PortalFileUpload.tsx
import { useState, useCallback } from 'react';
import { Upload, FileIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
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

    // Auto-upload valid files
    for (const item of validated) {
      if (item.status === 'error') continue;
      setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'uploading' } : f));
      try {
        await uploadFileToPortal({ token, file: item.file, clientName });
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: 'done' } : f));
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
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Anexar Arquivos</h3>
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">Arraste arquivos aqui ou</p>
        <label className="text-sm text-blue-600 hover:underline cursor-pointer">
          clique para selecionar
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
        <p className="text-xs text-slate-400 mt-1">PDF, AI, CDR, EPS, JPG, PNG, TIFF, PSD — Máx 50MB</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-2 text-sm">
              <FileIcon size={16} className="text-slate-400 shrink-0" />
              <span className="truncate flex-1 text-slate-700">{f.file.name}</span>
              {f.status === 'uploading' && <Loader2 size={16} className="animate-spin text-blue-500" />}
              {f.status === 'done' && <CheckCircle2 size={16} className="text-green-500" />}
              {f.status === 'error' && <span className="text-xs text-red-500">{f.error}</span>}
              {f.status !== 'uploading' && (
                <button onClick={() => removeFile(f.file)} className="text-slate-400 hover:text-slate-600">
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
