/**
 * ComposicaoEditor.tsx
 * Editor visual da composição BOM (Bill of Materials) de um modelo de produto.
 * Permite adicionar/remover materiais e processos produtivos.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Loader2, Package, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { brl } from '@/shared/utils/format';
import {
  useModeloBOM,
  useUpsertModeloMaterial,
  useRemoveModeloMaterial,
  useUpsertModeloProcesso,
  useRemoveModeloProcesso,
} from '../hooks/useCatalogo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComposicaoEditorProps {
  modeloId: string;
}

interface MaterialSelectItem {
  id: string;
  nome: string;
  codigo: string;
  preco_medio: number | null;
  unidade_medida: string | null;
}

// ---------------------------------------------------------------------------
// Seção Materiais
// ---------------------------------------------------------------------------

function MateriaisSection({ modeloId }: { modeloId: string }) {
  const { data: bom, isLoading } = useModeloBOM(modeloId);
  const upsertMaterial = useUpsertModeloMaterial();
  const removeMaterial = useRemoveModeloMaterial();

  const [materialId, setMaterialId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [desperdicio, setDesperdicio] = useState('0');

  // Lista de materiais disponíveis para o Select
  const { data: materiaisDisponiveis = [] } = useQuery<MaterialSelectItem[]>({
    queryKey: ['materiais-select'],
    queryFn: async () => {
      const db = supabase as unknown as any;
      const { data } = await db
        .from('materiais')
        .select('id, nome, codigo, preco_medio, unidade_medida')
        .eq('ativo', true)
        .order('nome')
        .limit(500);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const materiais = (bom as any)?.modelo_materiais ?? [];

  function calcularCusto(item: any): number {
    const custo = item.custo_unitario ?? item.materiais?.preco_medio ?? 0;
    const qtd = item.quantidade_por_unidade ?? 0;
    const desp = item.percentual_desperdicio ?? 0;
    return custo * qtd * (1 + desp / 100);
  }

  async function handleAdicionar() {
    if (!materialId || !quantidade) return;
    await upsertMaterial.mutateAsync({
      modelo_id: modeloId,
      material_id: materialId,
      quantidade_por_unidade: parseFloat(quantidade),
      percentual_desperdicio: parseFloat(desperdicio) || 0,
    });
    setMaterialId('');
    setQuantidade('');
    setDesperdicio('0');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package size={18} className="text-blue-600" />
        <h3 className="font-semibold text-slate-700">Materiais</h3>
        <Badge variant="secondary">{materiais.length}</Badge>
      </div>

      {/* Lista de materiais existentes */}
      {materiais.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Package size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Nenhum material adicionado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1fr_80px_80px_100px_40px] gap-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>Material</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Desperd.%</span>
            <span className="text-right">Custo Est.</span>
            <span />
          </div>

          {materiais.map((item: any) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_80px_80px_100px_40px] gap-2 items-center bg-slate-50 rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {item.materiais?.nome ?? '—'}
                </p>
                <p className="text-xs text-slate-400">{item.materiais?.codigo ?? ''}</p>
              </div>
              <span className="text-sm text-slate-600 text-right">
                {item.quantidade_por_unidade}
              </span>
              <span className="text-sm text-slate-600 text-right">
                {item.percentual_desperdicio ?? 0}%
              </span>
              <span className="text-sm font-medium text-slate-700 text-right">
                {brl(calcularCusto(item))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                disabled={removeMaterial.isPending}
                onClick={() => removeMaterial.mutate({ id: item.id, modeloId })}
              >
                {removeMaterial.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de adição */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-3 border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Adicionar material
        </p>
        <div className="grid grid-cols-[1fr_100px_100px] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Material</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger className="rounded-xl h-9 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {materiaisDisponiveis.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                    {m.preco_medio ? ` — ${brl(m.preco_medio)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="rounded-xl h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desperdício %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              placeholder="0"
              value={desperdicio}
              onChange={(e) => setDesperdicio(e.target.value)}
              className="rounded-xl h-9 text-sm"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 rounded-xl"
          disabled={!materialId || !quantidade || upsertMaterial.isPending}
          onClick={handleAdicionar}
        >
          {upsertMaterial.isPending ? (
            <Loader2 size={14} className="animate-spin mr-1.5" />
          ) : (
            <Plus size={14} className="mr-1.5" />
          )}
          Adicionar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção Processos
// ---------------------------------------------------------------------------

function ProcessosSection({ modeloId }: { modeloId: string }) {
  const { data: bom, isLoading } = useModeloBOM(modeloId);
  const upsertProcesso = useUpsertModeloProcesso();
  const removeProcesso = useRemoveModeloProcesso();

  const [etapa, setEtapa] = useState('');
  const [tempoMin, setTempoMin] = useState('');

  const processos = (bom as any)?.modelo_processos ?? [];

  async function handleAdicionar() {
    if (!etapa || !tempoMin) return;
    await upsertProcesso.mutateAsync({
      modelo_id: modeloId,
      etapa,
      tempo_por_unidade_min: parseFloat(tempoMin),
    });
    setEtapa('');
    setTempoMin('');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-amber-500" />
        <h3 className="font-semibold text-slate-700">Processos Produtivos</h3>
        <Badge variant="secondary">{processos.length}</Badge>
      </div>

      {/* Lista de processos existentes */}
      {processos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Cpu size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Nenhum processo adicionado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_100px_40px] gap-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>Etapa</span>
            <span className="text-right">Tempo (min)</span>
            <span />
          </div>

          {processos.map((item: any) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_100px_40px] gap-2 items-center bg-slate-50 rounded-xl px-3 py-2"
            >
              <p className="text-sm font-medium text-slate-700 truncate">{item.etapa}</p>
              <span className="text-sm text-slate-600 text-right">
                {item.tempo_por_unidade_min}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                disabled={removeProcesso.isPending}
                onClick={() => removeProcesso.mutate({ id: item.id, modeloId })}
              >
                {removeProcesso.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de adição */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-3 border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Adicionar processo
        </p>
        <div className="grid grid-cols-[1fr_140px] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome da Etapa</Label>
            <Input
              type="text"
              placeholder="Ex: Impressão, Laminação..."
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              className="rounded-xl h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tempo (min)</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              value={tempoMin}
              onChange={(e) => setTempoMin(e.target.value)}
              className="rounded-xl h-9 text-sm"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 rounded-xl text-white"
          disabled={!etapa || !tempoMin || upsertProcesso.isPending}
          onClick={handleAdicionar}
        >
          {upsertProcesso.isPending ? (
            <Loader2 size={14} className="animate-spin mr-1.5" />
          ) : (
            <Plus size={14} className="mr-1.5" />
          )}
          Adicionar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ComposicaoEditor({ modeloId }: ComposicaoEditorProps) {
  return (
    <div className="space-y-8">
      <MateriaisSection modeloId={modeloId} />
      <div className="border-t border-slate-200" />
      <ProcessosSection modeloId={modeloId} />
    </div>
  );
}

export default ComposicaoEditor;
