import { useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtratoUploadProps {
  onFile: (file: File) => void;
  isLoading?: boolean;
}

export function ExtratoUpload({ onFile, isLoading }: ExtratoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // reset para permitir reimportar o mesmo arquivo
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-blue-300 transition-colors cursor-pointer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ofx,.OFX"
        className="hidden"
        onChange={handleChange}
      />
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
        {isLoading ? (
          <Upload size={24} className="text-blue-500 animate-bounce" />
        ) : (
          <FileText size={24} className="text-blue-500" />
        )}
      </div>
      <h3 className="font-semibold text-slate-600 mb-1">
        {isLoading ? 'Importando...' : 'Importar Extrato OFX'}
      </h3>
      <p className="text-sm text-slate-400 mb-4">
        Arraste o arquivo .OFX aqui ou clique para selecionar
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
      >
        Selecionar arquivo
      </Button>
      <p className="text-xs text-slate-300 mt-3">Suporte: Itaú OFX 2.0</p>
    </div>
  );
}
