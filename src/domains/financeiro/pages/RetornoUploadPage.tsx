// ============================================================================
// RetornoUploadPage — Upload e processamento de retornos CNAB 400
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import { FileInput, Upload, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { brl } from '@/shared/utils/format';
import { parseRetornoFile } from '../services/cnab400-retorno.service';
import { processarRetorno } from '../services/retorno-processor.service';
import RetornoPreview from '../components/RetornoPreview';
import type { RetornoParseado } from '../services/cnab400-retorno.service';
import type { ProcessamentoResult } from '../services/retorno-processor.service';

export default function RetornoUploadPage() {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseado, setParseado] = useState<RetornoParseado | null>(null);
  const [resultado, setResultado] = useState<ProcessamentoResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseRetornoFile(text);
        setFileContent(text);
        setFileName(file.name);
        setParseado(parsed);
        setResultado(null);
        showSuccess(`Arquivo "${file.name}" carregado com sucesso`);
      } catch (err) {
        showError((err as Error).message || 'Erro ao ler arquivo de retorno');
        setFileContent(null);
        setParseado(null);
      }
    };
    reader.onerror = () => {
      showError('Erro ao ler o arquivo');
    };
    reader.readAsText(file, 'latin1');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleProcessar = useCallback(async () => {
    if (!fileContent) return;
    setProcessing(true);
    try {
      const result = await processarRetorno(fileContent);
      setResultado(result);
      showSuccess(`Retorno processado: ${result.baixados} título(s) baixado(s)`);
    } catch (err) {
      showError((err as Error).message || 'Erro ao processar retorno');
    } finally {
      setProcessing(false);
    }
  }, [fileContent]);

  const handleReset = useCallback(() => {
    setFileContent(null);
    setFileName(null);
    setParseado(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
          <FileInput size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Retornos Bancários</h1>
          <p className="text-sm text-slate-500">Upload e processamento de arquivos CNAB 400</p>
        </div>
      </div>

      {/* Upload Zone */}
      {!parseado && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-600 mb-1">
            Arraste o arquivo de retorno aqui
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Formatos aceitos: .ret, .RET (CNAB 400 Itaú)
          </p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => inputRef.current?.click()}
          >
            Selecionar Arquivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".ret,.RET"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Preview */}
      {parseado && !resultado && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileInput size={16} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleReset}
              >
                Trocar Arquivo
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={handleProcessar}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  'Processar Retorno'
                )}
              </Button>
            </div>
          </div>

          <RetornoPreview data={parseado} />
        </div>
      )}

      {/* Results */}
      {resultado && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Resultado do Processamento</h2>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={handleReset}
            >
              Novo Upload
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Baixados */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Baixados</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                {resultado.baixados}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                de {resultado.total} liquidações
              </p>
            </div>

            {/* Não encontrados */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Não encontrados</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {resultado.naoEncontrados.length}
              </p>
              {resultado.naoEncontrados.length > 0 && (
                <p className="text-xs text-amber-600 mt-1 truncate" title={resultado.naoEncontrados.join(', ')}>
                  {resultado.naoEncontrados.slice(0, 3).join(', ')}
                  {resultado.naoEncontrados.length > 3 && '...'}
                </p>
              )}
            </div>

            {/* Erros */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={18} className="text-red-600" />
                <span className="text-sm font-medium text-red-700">Erros</span>
              </div>
              <p className="text-2xl font-bold text-red-700 tabular-nums">
                {resultado.erros.length}
              </p>
              {resultado.erros.length > 0 && (
                <p className="text-xs text-red-600 mt-1 truncate" title={resultado.erros.join(', ')}>
                  {resultado.erros[0]}
                </p>
              )}
            </div>
          </div>

          {/* Show preview below results */}
          {parseado && <RetornoPreview data={parseado} />}
        </div>
      )}
    </div>
  );
}
