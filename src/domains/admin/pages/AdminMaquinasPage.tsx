// ============================================================================
// ADMIN MAQUINAS PAGE — Croma Print ERP/CRM
// Gerenciamento do parque de máquinas (impressão, corte, acabamento)
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Settings2,
  Save,
  Edit2,
  Plus,
  Trash2,
  Loader2,
  Cog,
} from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

type TipoMaquina = "impressao" | "corte" | "acabamento" | "outro";

interface Maquina {
  id: string;
  nome: string;
  tipo: TipoMaquina;
  custo_hora: number | null;
  custo_m2: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

type MaquinaInsert = Omit<Maquina, "id" | "created_at" | "updated_at">;

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const TIPOS: { value: TipoMaquina; label: string }[] = [
  { value: "impressao", label: "Impressão" },
  { value: "corte", label: "Corte" },
  { value: "acabamento", label: "Acabamento" },
  { value: "outro", label: "Outro" },
];

function tipoLabel(tipo: TipoMaquina): string {
  return TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoBadgeClass(tipo: TipoMaquina): string {
  switch (tipo) {
    case "impressao":
      return "bg-blue-50 text-blue-700 hover:bg-blue-100";
    case "corte":
      return "bg-orange-50 text-orange-700 hover:bg-orange-100";
    case "acabamento":
      return "bg-purple-50 text-purple-700 hover:bg-purple-100";
    default:
      return "bg-slate-100 text-slate-600 hover:bg-slate-200";
  }
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

// ----------------------------------------------------------------------------
// NOVA MAQUINA FORM (inline row)
// ----------------------------------------------------------------------------

interface NovaMaquinaFormProps {
  onSave: (values: MaquinaInsert) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function NovaMaquinaForm({ onSave, onCancel, isSaving }: NovaMaquinaFormProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoMaquina>("impressao");
  const [custoHora, setCustoHora] = useState("");
  const [custoM2, setCustoM2] = useState("");
  const [ativo, setAtivo] = useState(true);

  function handleSubmit() {
    if (!nome.trim()) {
      showError("Informe o nome da máquina.");
      return;
    }
    onSave({
      nome: nome.trim(),
      tipo,
      custo_hora: custoHora ? parseFloat(custoHora) : null,
      custo_m2: custoM2 ? parseFloat(custoM2) : null,
      ativo,
    });
  }

  return (
    <tr className="bg-blue-50/50">
      <td className="px-4 py-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Roland DG 160cm"
          className="h-9"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMaquina)}
          className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={custoHora}
          onChange={(e) => setCustoHora(e.target.value)}
          placeholder="35.00"
          className="h-9 w-28"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={custoM2}
          onChange={(e) => setCustoM2(e.target.value)}
          placeholder="8.50"
          className="h-9 w-28"
        />
      </td>
      <td className="px-4 py-2">
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// EDIT ROW (inline)
// ----------------------------------------------------------------------------

interface EditMaquinaRowProps {
  maquina: Maquina;
  onSave: (values: Partial<Maquina> & { id: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditMaquinaRow({ maquina, onSave, onCancel, isSaving }: EditMaquinaRowProps) {
  const [nome, setNome] = useState(maquina.nome);
  const [tipo, setTipo] = useState<TipoMaquina>(maquina.tipo);
  const [custoHora, setCustoHora] = useState(
    maquina.custo_hora != null ? String(maquina.custo_hora) : ""
  );
  const [custoM2, setCustoM2] = useState(
    maquina.custo_m2 != null ? String(maquina.custo_m2) : ""
  );
  const [ativo, setAtivo] = useState(maquina.ativo);

  function handleSubmit() {
    onSave({
      id: maquina.id,
      nome: nome.trim() || maquina.nome,
      tipo,
      custo_hora: custoHora ? parseFloat(custoHora) : null,
      custo_m2: custoM2 ? parseFloat(custoM2) : null,
      ativo,
    });
  }

  return (
    <tr className="bg-amber-50/40">
      <td className="px-4 py-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-9"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMaquina)}
          className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={custoHora}
          onChange={(e) => setCustoHora(e.target.value)}
          placeholder="—"
          className="h-9 w-28"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          value={custoM2}
          onChange={(e) => setCustoM2(e.target.value)}
          placeholder="—"
          className="h-9 w-28"
        />
      </td>
      <td className="px-4 py-2">
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export function AdminMaquinasPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // --------------------------------------------------------------------------
  // FETCH
  // --------------------------------------------------------------------------

  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["maquinas"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("maquinas")
        .select("id, nome, tipo, custo_hora, custo_m2, ativo, created_at, updated_at")
        .order("nome");
      if (error) throw error;
      return (data || []) as Maquina[];
    },
  });

  // --------------------------------------------------------------------------
  // MUTATION — inserir
  // --------------------------------------------------------------------------

  const insertMutation = useMutation({
    mutationFn: async (values: MaquinaInsert) => {
      const { error } = await (supabase as unknown as any)
        .from("maquinas")
        .insert({
          nome: values.nome,
          tipo: values.tipo,
          custo_hora: values.custo_hora ?? null,
          custo_m2: values.custo_m2 ?? null,
          ativo: values.ativo,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maquinas"] });
      setAddingNew(false);
      showSuccess("Máquina adicionada!");
    },
    onError: () => showError("Erro ao adicionar máquina."),
  });

  // --------------------------------------------------------------------------
  // MUTATION — atualizar
  // --------------------------------------------------------------------------

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: Partial<Maquina> & { id: string }) => {
      const { error } = await (supabase as unknown as any)
        .from("maquinas")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maquinas"] });
      setEditingId(null);
      showSuccess("Máquina atualizada!");
    },
    onError: () => showError("Erro ao atualizar máquina."),
  });

  // --------------------------------------------------------------------------
  // MUTATION — excluir
  // --------------------------------------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as any)
        .from("maquinas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maquinas"] });
      showSuccess("Máquina removida.");
    },
    onError: () => showError("Erro ao remover máquina."),
  });

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Cog className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parque de Máquinas</h1>
          <p className="text-sm text-slate-500">
            Gerencie as máquinas de produção e seus custos operacionais
          </p>
        </div>
      </div>

      <Separator />

      {/* Table card */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-slate-800">Máquinas Cadastradas</CardTitle>
                <CardDescription>
                  Configure custo/hora e custo/m² para cada equipamento
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddingNew(true);
                setEditingId(null);
              }}
              disabled={addingNew}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Máquina
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando máquinas...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo/Hora</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo/m²</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Nova máquina row */}
                  {addingNew && (
                    <NovaMaquinaForm
                      onSave={(values) => insertMutation.mutate(values)}
                      onCancel={() => setAddingNew(false)}
                      isSaving={insertMutation.isPending}
                    />
                  )}

                  {maquinas.length === 0 && !addingNew ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Cog size={40} className="text-slate-300" />
                          <span className="font-semibold text-slate-600">Nenhuma máquina cadastrada</span>
                          <span className="text-xs">Clique em "Nova Máquina" para adicionar o primeiro equipamento.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    maquinas.map((maquina) =>
                      editingId === maquina.id ? (
                        <EditMaquinaRow
                          key={maquina.id}
                          maquina={maquina}
                          onSave={(values) => updateMutation.mutate(values)}
                          onCancel={() => setEditingId(null)}
                          isSaving={updateMutation.isPending}
                        />
                      ) : (
                        <tr
                          key={maquina.id}
                          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{maquina.nome}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={tipoBadgeClass(maquina.tipo)}
                            >
                              {tipoLabel(maquina.tipo)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono tabular-nums text-slate-700 text-xs">
                              {maquina.custo_hora != null ? formatBRL(maquina.custo_hora) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono tabular-nums text-slate-700 text-xs">
                              {maquina.custo_m2 != null ? formatBRL(maquina.custo_m2) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Switch
                              checked={maquina.ativo}
                              onCheckedChange={(checked) =>
                                updateMutation.mutate({ id: maquina.id, ativo: checked })
                              }
                              disabled={updateMutation.isPending}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(maquina.id);
                                  setAddingNew(false);
                                }}
                                className="h-8 w-8 p-0"
                                title="Editar"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteMutation.mutate(maquina.id)}
                                disabled={deleteMutation.isPending}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:border-red-300"
                                title="Remover"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminMaquinasPage;
