// src/domains/dados/components/ImportWizard.tsx
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileDropzone } from './FileDropzone';
import { PreviewTable } from './PreviewTable';
import { ValidationReport } from './ValidationReport';
import { useImport } from '../hooks/useImport';

interface ImportWizardProps {
  entityKey: string;
  onClose?: () => void;
}

const stepLabels = ['Arquivo', 'Validação', 'Confirmação', 'Resultado'];

export function ImportWizard({ entityKey, onClose }: ImportWizardProps) {
  const {
    step, file, headers, rawRows, validationErrors,
    inserts, updates, isProcessing, entity, setFile, importMutation, reset,
  } = useImport(entityKey);

  if (!entity) return null;

  const handleConfirm = () => {
    importMutation.mutate();
  };

  const previewRows = [
    ...inserts.map((row, i) => ({ rowNum: i + 1, status: 'insert' as const, data: row as Record<string, unknown> })),
    ...updates.map((row, i) => ({ rowNum: inserts.length + i + 1, status: 'update' as const, data: row as Record<string, unknown> })),
    ...validationErrors.map(err => ({
      rowNum: err.row + 1,
      status: 'error' as const,
      data: rawRows[err.row] ?? {},
      errorMsg: err.reason,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          {stepLabels.map((label, i) => (
            <span key={i} className={step >= i + 1 ? 'text-blue-600 font-medium' : ''}>
              {label}
            </span>
          ))}
        </div>
        <Progress value={(step / 4) * 100} className="h-2" />
      </div>

      {/* Step 1: File upload */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Selecione o arquivo para importar</h3>
          <FileDropzone
            onFileSelect={setFile}
            selectedFile={file}
            onClear={() => setFile(null as unknown as File)}
          />
          {isProcessing && <p className="text-sm text-slate-500 text-center">Lendo arquivo...</p>}
        </div>
      )}

      {/* Step 2: Validation */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">
            {validationErrors.length > 0 ? 'Erros encontrados' : `${rawRows.length} linhas lidas`}
          </h3>
          <ValidationReport errors={validationErrors} />
          {validationErrors.length === 0 && rawRows.length > 0 && (
            <p className="text-sm text-green-600">✓ Todas as linhas são válidas</p>
          )}
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Confirmar importação</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">{inserts.length} para inserir</span>
            <span className="text-amber-600">{updates.length} para atualizar</span>
          </div>
          <PreviewTable rows={previewRows} columns={headers.slice(0, 6)} />
          <Button
            onClick={handleConfirm}
            disabled={importMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {importMutation.isPending ? 'Importando...' : 'Confirmar Importação'}
          </Button>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 4 && (
        <div className="text-center space-y-4">
          <CheckCircle size={48} className="mx-auto text-green-500" />
          <h3 className="font-semibold text-slate-700">Importação concluída!</h3>
          <div className="flex gap-4 justify-center text-sm">
            <span className="text-green-600">{inserts.length} inseridos</span>
            <span className="text-amber-600">{updates.length} atualizados</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              Importar mais
            </Button>
            {onClose && (
              <Button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
