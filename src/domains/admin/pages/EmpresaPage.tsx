import React from 'react';
import { Building2 } from 'lucide-react';
import TabEmpresas from '@/domains/fiscal/components/TabEmpresas';

export default function EmpresaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          Cadastro da Empresa
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Dados da empresa utilizados em notas fiscais, orçamentos, relatórios e documentos
        </p>
      </div>
      <TabEmpresas />
    </div>
  );
}
