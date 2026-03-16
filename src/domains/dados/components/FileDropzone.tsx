// src/domains/dados/components/FileDropzone.tsx
import { useState, useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
  accept?: string;
}

export function FileDropzone({ onFileSelect, selectedFile, onClear, accept = '.csv,.xlsx' }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <FileText size={20} className="text-blue-600 shrink-0" />
        <span className="text-sm text-slate-700 flex-1">{selectedFile.name}</span>
        {onClear && (
          <Button variant="ghost" size="icon" onClick={onClear} className="h-6 w-6">
            <X size={14} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white'
      }`}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      <Upload size={32} className="mx-auto text-slate-400 mb-3" />
      <p className="text-sm font-medium text-slate-600">Arraste um arquivo aqui ou clique para selecionar</p>
      <p className="text-xs text-slate-400 mt-1">Aceita CSV (.csv) e Excel (.xlsx)</p>
    </div>
  );
}
