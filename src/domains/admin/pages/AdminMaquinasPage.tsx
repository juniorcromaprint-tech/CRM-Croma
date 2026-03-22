// ============================================================================
// ADMIN MAQUINAS PAGE — Croma Print ERP/CRM
// Gerenciamento do parque de máquinas (impressão, corte, acabamento)
// Inclui: depreciação, área útil, usinagem CNC
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Settings2,
  Save,
  Edit2,
  Plus,
  Trash2,
  Loader2,
  Cog,
  TrendingDown,
  Wrench,
} from "lucide-react";

import { DepreciacaoCard } from "../components/DepreciacaoCard";
import { UsinagemTab } from "../components/UsinagemTab";

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
  // Novos campos de depreciação
  data_compra: string | null;
  valor_compra: number | null;
  vida_util_meses: number | null;
  saldo_residual_pct: number | null;
  area_util_m: number | null;
  // Campo gerado (readonly)
  depreciacao_mensal?: number | null;
  created_at: string;
  updated_at: string;
}

type MaquinaInsert = Omit<Maquina, "id" | "created_at" | "updated_at" | "depreciacao_mensal">;

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const TIPOS: { value: TipoMaquina; label: string }[] = [
  { value: "impressao", label: "Impressão" },
  { value: "corte", label: "Corte / CNC" },
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

function isCncType(tipo: TipoMaquina): boolean {
  return tipo === "corte";
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
// FORMULÁRIO DE MÁQUINA (Modal)
// ----------------------------------------------------------------------------

interface MaquinaFormData {
  nome: string;
  tipo: TipoMaquina;
  custo_hora: string;
  custo_m2: string;
  ativo: boolean;
  data_compra: string;
  valor_compra: string;
  vida_util_meses: string;
  saldo_residual_pct: string;
  area_util_m: string;
}

function emptyForm(): MaquinaFormData {
  return {
    nome: "",
    tipo: "impressao",
    custo_hora: "",
    custo_m2: "",
    ativo: true,
    data_compra: "",
    valor_compra: "",
    vida_util_meses: "60",
    saldo_residual_pct: "30",
    area_util_m: "",
  };
}

function formFromMaquina(m: Maquina): MaquinaFormData {
  return {
    nome: m.nome,
    tipo: m.tipo,
    custo_hora: m.custo_hora != null ? String(m.custo_hora) : "",
    custo_m2: m.custo_m2 != null ? String(m.custo_m2) : "",
    ativo: m.ativo,
    data_compra: m.data_compra ?? "",
    valor_compra: m.valor_compra != null ? String(m.valor_compra) : "",
    vida_util_meses: m.vida_util_meses != null ? String(m.vida_util_meses) : "60",
    saldo_residual_pct: m.saldo_residual_pct != null ? String(m.saldo_residual_pct) : "30",
    area_util_m: m.area_util_m != null ? String(m.area_util_m) : "",
  };
}

function formToInsert(f: MaquinaFormData): MaquinaInsert {
  return {
    nome: f.nome.trim(),
    tipo: f.tipo,
    custo_hora: f.custo_hora ? parseFloat(f.custo_hora) : null,
    custo_m2: f.custo_m2 ? parseFloat(f.custo_m2) : null,
    ativo: f.ativo,
    data_compra: f.data_compra || null,
    valor_compra: f.valor_compra ? parseFloat(f.valor_compra) : null,
    vida_util_meses: f.vida_util_meses ? parseInt(f.vida_util_meses, 10) : null,
    saldo_residual_pct: f.saldo_residual_pct ? parseFloat(f.saldo_residual_pct) : null,
    area_util_m: f.area_util_m ? parseFloat(f.area_util_m) : null,
  };
}

interface MaquinaDialogProps {
  open: boolean;
  maquina: Maquina | null; // null = nova
  isSaving: boolean;
  onSave: (values: MaquinaInsert & { id?: string }) => void;
  onClose: () => void;
}

function MaquinaDialog({ open, maquina, isSaving, onSave, onClose }: MaquinaDialogProps) {
  const [form, setForm] = useState<MaquinaFormData>(() =>
    maquina ? formFromMaquina(maquina) : emptyForm()
  );

  // Reset form when dialog opens with different machine
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm(maquina ? formFromMaquina(maquina) : emptyForm());
    } else {
      onClose();
    }
  };

  function set(field: keyof MaquinaFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.nome.trim()) {
      showError("Informe o nome da máquina.");
      return;
    }
    const values = formToInsert(form);
    if (maquina) {
      onSave({ ...values, id: maquina.id });
    } else {
      onSave(values);
    }
  }

  const isEditing = !!maquina;
  const title = isEditing ? `Editar — ${maquina!.nome}` : "Nova Máquina";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Cog className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Dados básicos */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Dados básicos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="nome">Nome da máquina *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Ex: Roland DG 160cm"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  value={form.tipo}
                  onChange={(e) => set("tipo", e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ativo">Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    id="ativo"
                    checked={form.ativo}
                    onCheckedChange={(v) => set("ativo", v)}
                  />
                  <span className="text-sm text-slate-600">
                    {form.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custo_hora">Custo/Hora (R$)</Label>
                <Input
                  id="custo_hora"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custo_hora}
                  onChange={(e) => set("custo_hora", e.target.value)}
                  placeholder="Ex: 35,00"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custo_m2">Custo/m² (R$)</Label>
                <Input
                  id="custo_m2"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custo_m2}
                  onChange={(e) => set("custo_m2", e.target.value)}
                  placeholder="Ex: 8,50"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area_util_m">Área útil de impressão (m)</Label>
                <Input
                  id="area_util_m"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.area_util_m}
                  onChange={(e) => set("area_util_m", e.target.value)}
                  placeholder="Ex: 1.60"
                  className="rounded-xl"
                />
                <p className="text-xs text-slate-400">
                  Largura máxima de impressão sem emenda
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dados de depreciação */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Depreciação
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data_compra">Data de compra</Label>
                <Input
                  id="data_compra"
                  type="date"
                  value={form.data_compra}
                  onChange={(e) => set("data_compra", e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_compra">Valor de compra (R$)</Label>
                <Input
                  id="valor_compra"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_compra}
                  onChange={(e) => set("valor_compra", e.target.value)}
                  placeholder="Ex: 45000,00"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vida_util_meses">Vida útil (meses)</Label>
                <Input
                  id="vida_util_meses"
                  type="number"
                  min="1"
                  step="1"
                  value={form.vida_util_meses}
                  onChange={(e) => set("vida_util_meses", e.target.value)}
                  placeholder="60"
                  className="rounded-xl"
                />
                <p className="text-xs text-slate-400">Padrão: 60 meses (5 anos)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saldo_residual_pct">Valor residual (%)</Label>
                <Input
                  id="saldo_residual_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.saldo_residual_pct}
                  onChange={(e) => set("saldo_residual_pct", e.target.value)}
                  placeholder="30"
                  className="rounded-xl"
                />
                <p className="text-xs text-slate-400">
                  % do valor original ao final da vida útil
                </p>
              </div>
            </div>
          </div>

          {/* Card de depreciação atual (só em edição) */}
          {isEditing && maquina && (
            <DepreciacaoCard maquinaId={maquina.id} maquinaNome={maquina.nome} />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Salvar alterações" : "Adicionar máquina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// DETAIL PANEL — Abre ao clicar em uma máquina
// ----------------------------------------------------------------------------

interface MaquinaDetailPanelProps {
  maquina: Maquina;
  onEdit: () => void;
}

function MaquinaDetailPanel({ maquina, onEdit }: MaquinaDetailPanelProps) {
  const showUsinagem = isCncType(maquina.tipo);

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-4">
      <Tabs defaultValue="depreciacao">
        <TabsList className="h-8">
          <TabsTrigger value="depreciacao" className="text-xs gap-1">
            <TrendingDown className="h-3 w-3" />
            Depreciação
          </TabsTrigger>
          {showUsinagem && (
            <TabsTrigger value="usinagem" className="text-xs gap-1">
              <Wrench className="h-3 w-3" />
              Usinagem CNC
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="depreciacao" className="mt-3">
          <DepreciacaoCard maquinaId={maquina.id} maquinaNome={maquina.nome} />
        </TabsContent>

        {showUsinagem && (
          <TabsContent value="usinagem" className="mt-3">
            <UsinagemTab maquinaId={maquina.id} />
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="text-xs h-7"
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Editar dados da máquina
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export function AdminMaquinasPage() {
  const queryClient = useQueryClient();
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // FETCH
  // --------------------------------------------------------------------------

  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["maquinas"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("maquinas")
        .select(
          "id, nome, tipo, custo_hora, custo_m2, ativo, data_compra, valor_compra, vida_util_meses, saldo_residual_pct, area_util_m, depreciacao_mensal, created_at, updated_at"
        )
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
        .insert(values);
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
    mutationFn: async ({ id, ...values }: MaquinaInsert & { id: string }) => {
      const { error } = await (supabase as unknown as any)
        .from("maquinas")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maquinas"] });
      queryClient.invalidateQueries({ queryKey: ["depreciacao-maquina"] });
      setEditingMaquina(null);
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
  // MUTATION — toggle ativo inline
  // --------------------------------------------------------------------------

  const toggleAtivo = (maquina: Maquina, checked: boolean) => {
    updateMutation.mutate({ ...formToInsert(formFromMaquina(maquina)), id: maquina.id, ativo: checked });
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Cog className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parque de Máquinas</h1>
          <p className="text-sm text-slate-500">
            Gerencie máquinas, custos operacionais e depreciação de equipamentos
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
                  Configure custo/hora, custo/m², área útil e depreciação de cada equipamento
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setAddingNew(true)}
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Área útil</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Deprec./mês</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {maquinas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Cog size={40} className="text-slate-300" />
                          <span className="font-semibold text-slate-600">Nenhuma máquina cadastrada</span>
                          <span className="text-xs">Clique em "Nova Máquina" para adicionar o primeiro equipamento.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    maquinas.map((maquina) => (
                      <>
                        <tr
                          key={maquina.id}
                          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer"
                          onClick={() =>
                            setExpandedId(expandedId === maquina.id ? null : maquina.id)
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{maquina.nome}</div>
                            {maquina.data_compra && (
                              <div className="text-xs text-slate-400">
                                Comprado em {new Date(maquina.data_compra).toLocaleDateString("pt-BR")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={tipoBadgeClass(maquina.tipo)}>
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
                            <span className="font-mono tabular-nums text-slate-700 text-xs">
                              {maquina.area_util_m != null
                                ? `${maquina.area_util_m.toFixed(2)} m`
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono tabular-nums text-xs text-orange-600">
                              {maquina.depreciacao_mensal != null
                                ? formatBRL(maquina.depreciacao_mensal)
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={maquina.ativo}
                              onCheckedChange={(checked) => toggleAtivo(maquina, checked)}
                              disabled={updateMutation.isPending}
                            />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingMaquina(maquina)}
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

                        {/* Expanded detail row */}
                        {expandedId === maquina.id && (
                          <tr key={`${maquina.id}-detail`}>
                            <td colSpan={8} className="p-0">
                              <MaquinaDetailPanel
                                maquina={maquina}
                                onEdit={() => setEditingMaquina(maquina)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog — Nova / Editar máquina */}
      <MaquinaDialog
        open={addingNew || editingMaquina !== null}
        maquina={editingMaquina}
        isSaving={insertMutation.isPending || updateMutation.isPending}
        onSave={(values) => {
          if ("id" in values && values.id) {
            const { id, ...rest } = values as MaquinaInsert & { id: string };
            updateMutation.mutate({ ...rest, id });
          } else {
            insertMutation.mutate(values as MaquinaInsert);
          }
        }}
        onClose={() => {
          setAddingNew(false);
          setEditingMaquina(null);
        }}
      />
    </div>
  );
}

export default AdminMaquinasPage;
