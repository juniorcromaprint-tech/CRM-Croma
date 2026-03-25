// src/domains/dados/pages/ImportEntityPage.tsx

import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, AlertCircle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEntity } from '../configs/index';
import { ImportWizard } from '../components/ImportWizard';

export default function ImportEntityPage() {
  const { entityKey } = useParams<{ entityKey: string }>();
  const navigate = useNavigate();

  const entity = entityKey ? getEntity(entityKey) : undefined;

  // Fallback: entity not found
  if (!entity) {
    return (
      <div className="space-y-4">
        <Link to="/admin/dados">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft size={14} className="mr-1.5" />
            Gestão de Dados
          </Button>
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Entidade não encontrada</h3>
          <p className="text-sm text-slate-400 mt-1">
            A entidade <code className="bg-slate-100 px-1 rounded">{entityKey}</code> não está
            registrada.
          </p>
          <Link to="/admin/dados">
            <Button variant="outline" size="sm" className="mt-4 rounded-xl">
              Voltar para Gestão de Dados
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const IconComponent = (Icons as Record<string, unknown>)[entity.icon] as
    | React.ComponentType<{ size?: number; className?: string }>
    | undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/admin/dados">
          <Button variant="ghost" size="sm" className="rounded-xl h-8 px-2 text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} className="mr-1" />
            Gestão de Dados
          </Button>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-medium">Importar {entity.labelPlural}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 rounded-2xl p-3">
          {IconComponent ? (
            <IconComponent size={22} className="text-blue-600" />
          ) : (
            <Database size={22} className="text-blue-600" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importar {entity.labelPlural}</h1>
          <p className="text-sm text-slate-500">
            Faça upload de um arquivo CSV ou XLSX para importar registros em massa
          </p>
        </div>
      </div>

      {/* Import Wizard */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <ImportWizard
          entityKey={entity.key}
          onClose={() => navigate('/admin/dados')}
        />
      </div>
    </div>
  );
}
