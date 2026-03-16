// src/domains/dados/components/ValidationReport.tsx
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ValidationError } from '../engine/validators/common';

interface ValidationReportProps {
  errors: ValidationError[];
}

export function ValidationReport({ errors }: ValidationReportProps) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-red-600">
        <AlertCircle size={16} />
        <span>{errors.length} erro{errors.length !== 1 ? 's' : ''} encontrado{errors.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {errors.slice(0, 50).map((err, i) => (
          <Alert key={i} variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              <span className="font-medium">Linha {err.row + 1}</span>
              {err.column && <span className="text-slate-500"> · {err.column}</span>}
              {err.value && <span className="text-slate-500"> = &quot;{err.value}&quot;</span>}
              <span className="block text-red-600">{err.reason}</span>
            </AlertDescription>
          </Alert>
        ))}
        {errors.length > 50 && (
          <p className="text-xs text-slate-400 text-center">
            +{errors.length - 50} erros adicionais
          </p>
        )}
      </div>
    </div>
  );
}
