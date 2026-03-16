// src/domains/admin/components/AIModelsTab.tsx

import { useState } from 'react';
import { Plus, Trash2, Check, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { showSuccess } from '@/utils/toast';
import { useAIModels } from '@/domains/ai/hooks/useAIModels';

export default function AIModelsTab() {
  const { models, defaultModel, addModel, removeModel, setDefaultModel } = useAIModels();
  const [newSlug, setNewSlug] = useState('');
  const [newLabel, setNewLabel] = useState('');

  async function handleAdd() {
    if (!newSlug.trim()) return;
    await addModel.mutateAsync({ slug: newSlug, label: newLabel || undefined });
    setNewSlug('');
    setNewLabel('');
    showSuccess('Modelo adicionado');
  }

  async function handleRemove(slug: string) {
    await removeModel.mutateAsync(slug);
    showSuccess('Modelo removido');
  }

  async function handleSetDefault(slug: string) {
    await setDefaultModel.mutateAsync(slug);
    showSuccess('Modelo padrão atualizado');
  }

  return (
    <div className="space-y-6">
      {/* Default Model */}
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain size={18} className="text-blue-600" />
            Modelo Padrão
          </CardTitle>
          <CardDescription>
            Usado em todas as análises de IA quando nenhum modelo específico é selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select value={defaultModel} onValueChange={handleSetDefault}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecionar modelo padrão" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    <span className="flex items-center gap-2">
                      {m.label}
                      {m.free && <span className="text-xs text-green-600">(Free)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Model List */}
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Modelos Disponíveis</CardTitle>
          <CardDescription>
            Lista de modelos OpenRouter disponíveis para seleção. Ex:{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">google/gemini-2.5-flash-lite:free</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Modelo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Slug</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">Tipo</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">Padrão</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {models.map((m, idx) => (
                  <tr key={m.slug} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{m.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.slug}</td>
                    <td className="px-4 py-3 text-center">
                      {m.free ? (
                        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                          Free
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          Pago
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {defaultModel === m.slug && <Check size={16} className="mx-auto text-blue-600" />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(m.slug)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        disabled={removeModel.isPending}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* Add Model */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Adicionar Modelo</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Slug (ex: google/gemini-2.5-flash:free)"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="rounded-xl flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Input
                placeholder="Nome (opcional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="rounded-xl w-40"
              />
              <Button
                onClick={handleAdd}
                disabled={!newSlug.trim() || addModel.isPending}
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={16} />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
