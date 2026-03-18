import { useState } from 'react';
import { Upload, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useImportacoes,
  useImportarOFX,
  useExtratoItens,
  useClassificarItem,
  useIgnorarItem,
  useClassificarComIA,
  useGerarLancamentos,
} from '../hooks/useExtratoBancario';
import { useContasAnaliticas } from '../hooks/useLancamentos';
import { ExtratoUpload } from '../components/ExtratoUpload';
import { ExtratoRevisaoTable } from '../components/ExtratoRevisaoTable';
import { formatDate } from '@/shared/utils/format';
import type { ExtratoImportacao } from '../types/contabilidade.types';

const STATUS_LABELS = {
  importado: 'Importado',
  classificando: 'Classificando',
  classificado: 'Classificado',
  lancado: 'Lançado',
};

const STATUS_COLORS = {
  importado: 'bg-amber-100 text-amber-700',
  classificando: 'bg-blue-100 text-blue-700',
  classificado: 'bg-purple-100 text-purple-700',
  lancado: 'bg-green-100 text-green-700',
};

export default function ExtratoBancarioPage() {
  const [selectedImportacao, setSelectedImportacao] = useState<ExtratoImportacao | null>(null);

  const { data: importacoes = [], isLoading } = useImportacoes();
  const { data: contas = [] } = useContasAnaliticas();
  const importarOFX = useImportarOFX();
  const { data: itens = [] } = useExtratoItens(selectedImportacao?.id ?? '');
  const classificarItem = useClassificarItem();
  const ignorarItem = useIgnorarItem();
  const classificarIA = useClassificarComIA();
  const gerarLancamentos = useGerarLancamentos();

  function handleFile(file: File) {
    importarOFX.mutate(file, {
      onSuccess: ({ importacao }) => setSelectedImportacao(importacao),
    });
  }

  if (selectedImportacao) {
    return (
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setSelectedImportacao(null)}
          >
            <ChevronLeft size={14} />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{selectedImportacao.arquivo_nome}</h1>
            <p className="text-sm text-slate-500">
              {selectedImportacao.banco} — {selectedImportacao.total_registros} transações
              {selectedImportacao.data_inicio && ` — ${formatDate(selectedImportacao.data_inicio)} até ${formatDate(selectedImportacao.data_fim ?? '')}`}
            </p>
          </div>
          <span className={`ml-auto inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedImportacao.status]}`}>
            {STATUS_LABELS[selectedImportacao.status]}
          </span>
        </div>

        <ExtratoRevisaoTable
          itens={itens}
          contas={contas ?? []}
          onClassificar={(itemId, contaPlanoId) =>
            classificarItem.mutate({ itemId, contaPlanoId })
          }
          onIgnorar={(itemId) => ignorarItem.mutate(itemId)}
          onClassificarIA={() => classificarIA.mutate(itens)}
          onGerarLancamentos={() =>
            gerarLancamentos.mutate(selectedImportacao.id, {
              onSuccess: () => setSelectedImportacao(null),
            })
          }
          isClassificandoIA={classificarIA.isPending}
          isGerando={gerarLancamentos.isPending}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Extrato Bancário</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importar OFX → classificar contas → gerar lançamentos
        </p>
      </div>

      {/* Upload */}
      <ExtratoUpload onFile={handleFile} isLoading={importarOFX.isPending} />

      {/* Lista de importações */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : importacoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Upload size={32} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum extrato importado</h3>
          <p className="text-sm text-slate-400 mt-1">
            Importe um arquivo OFX do seu banco acima
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">Extratos importados</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {importacoes.map((imp) => (
              <div
                key={imp.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedImportacao(imp)}
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">{imp.arquivo_nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {imp.banco}
                    {imp.conta && ` — Conta ${imp.conta}`}
                    {imp.data_inicio && ` — ${formatDate(imp.data_inicio)} a ${formatDate(imp.data_fim ?? '')}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {imp.total_registros} transações
                  </p>
                  <p className="text-xs text-slate-400">
                    {imp.total_classificados} classificadas
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[imp.status]}`}>
                  {STATUS_LABELS[imp.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
