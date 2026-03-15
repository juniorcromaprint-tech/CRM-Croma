// src/domains/compras/components/FornecedorForm.tsx

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Building2, Loader2, Plus } from "lucide-react";
import { useCriarFornecedor, useAtualizarFornecedor } from "../hooks/useFornecedores";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface FornecedorFormData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  contato_nome: string;
  categorias: string[];
  lead_time_dias: string;
  condicao_pagamento: string;
  observacoes: string;
  ativo: boolean;
}

interface FornecedorFormProps {
  open: boolean;
  onClose: () => void;
  fornecedor?: Record<string, any> | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS_FORNECEDOR = [
  { value: "vinil", label: "Vinil" },
  { value: "lona", label: "Lona" },
  { value: "acm", label: "ACM" },
  { value: "tinta", label: "Tinta" },
  { value: "ferragem", label: "Ferragem" },
  { value: "acrilico", label: "Acrílico" },
  { value: "mdf", label: "MDF" },
  { value: "led", label: "LED" },
  { value: "outros", label: "Outros" },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function FornecedorForm({ open, onClose, fornecedor }: FornecedorFormProps) {
  const isEditing = !!fornecedor;

  const criarFornecedor = useCriarFornecedor();
  const atualizarFornecedor = useAtualizarFornecedor();

  const isPending = criarFornecedor.isPending || atualizarFornecedor.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FornecedorFormData>({
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      telefone: "",
      email: "",
      contato_nome: "",
      categorias: [],
      lead_time_dias: "",
      condicao_pagamento: "",
      observacoes: "",
      ativo: true,
    },
  });

  // Preenche o form ao abrir para edição
  useEffect(() => {
    if (open) {
      if (fornecedor) {
        reset({
          razao_social: fornecedor.razao_social ?? "",
          nome_fantasia: fornecedor.nome_fantasia ?? "",
          cnpj: fornecedor.cnpj ?? "",
          telefone: fornecedor.telefone ?? "",
          email: fornecedor.email ?? "",
          contato_nome: fornecedor.contato_nome ?? "",
          categorias: fornecedor.categorias ?? [],
          lead_time_dias: fornecedor.lead_time_dias ? String(fornecedor.lead_time_dias) : "",
          condicao_pagamento: fornecedor.condicao_pagamento ?? "",
          observacoes: fornecedor.observacoes ?? "",
          ativo: fornecedor.ativo ?? true,
        });
      } else {
        reset({
          razao_social: "",
          nome_fantasia: "",
          cnpj: "",
          telefone: "",
          email: "",
          contato_nome: "",
          categorias: [],
          lead_time_dias: "",
          condicao_pagamento: "",
          observacoes: "",
          ativo: true,
        });
      }
    }
  }, [open, fornecedor, reset]);

  const categoriasSelecionadas = watch("categorias");

  function toggleCategoria(cat: string) {
    const current = categoriasSelecionadas ?? [];
    setValue(
      "categorias",
      current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat]
    );
  }

  async function onSubmit(data: FornecedorFormData) {
    const payload = {
      razao_social: data.razao_social.trim(),
      nome_fantasia: data.nome_fantasia.trim() || null,
      cnpj: data.cnpj.trim() || null,
      telefone: data.telefone.trim() || null,
      email: data.email.trim() || null,
      contato_nome: data.contato_nome.trim() || null,
      categorias: data.categorias.length > 0 ? data.categorias : null,
      lead_time_dias: data.lead_time_dias ? parseInt(data.lead_time_dias, 10) : null,
      condicao_pagamento: data.condicao_pagamento.trim() || null,
      observacoes: data.observacoes.trim() || null,
      ativo: data.ativo,
    };

    if (isEditing && fornecedor?.id) {
      await atualizarFornecedor.mutateAsync({ id: fornecedor.id, dados: payload });
    } else {
      await criarFornecedor.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={22} className="text-blue-600" />
            {isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
          {/* Razão Social + Nome Fantasia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
                Razão Social <span className="text-red-500">*</span>
              </Label>
              <Input
                {...register("razao_social", { required: true })}
                placeholder="Razão social do fornecedor"
                className={`rounded-xl border-slate-200 ${errors.razao_social ? "border-red-400" : ""}`}
              />
              {errors.razao_social && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Nome Fantasia</Label>
              <Input
                {...register("nome_fantasia")}
                placeholder="Nome fantasia"
                className="rounded-xl border-slate-200"
              />
            </div>
          </div>

          {/* CNPJ + Telefone + E-mail */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">CNPJ</Label>
              <Input
                {...register("cnpj")}
                placeholder="00.000.000/0000-00"
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Telefone</Label>
              <Input
                {...register("telefone")}
                placeholder="(00) 00000-0000"
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">E-mail</Label>
              <Input
                {...register("email")}
                type="email"
                placeholder="contato@fornecedor.com"
                className="rounded-xl border-slate-200"
              />
            </div>
          </div>

          {/* Contato + Lead Time + Condição de Pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Nome do Contato</Label>
              <Input
                {...register("contato_nome")}
                placeholder="Nome do contato"
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Lead Time (dias)</Label>
              <Input
                {...register("lead_time_dias")}
                type="number"
                min={0}
                placeholder="Ex: 7"
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Condição de Pagamento</Label>
              <Input
                {...register("condicao_pagamento")}
                placeholder="Ex: 30/60/90 dias"
                className="rounded-xl border-slate-200"
              />
            </div>
          </div>

          {/* Categorias */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Categorias</Label>
            <div className="flex flex-wrap gap-3">
              {CATEGORIAS_FORNECEDOR.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={categoriasSelecionadas?.includes(cat.value) ?? false}
                    onCheckedChange={() => toggleCategoria(cat.value)}
                  />
                  <span className="text-sm text-slate-700">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ativo (apenas na edição) */}
          {isEditing && (
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="ativo"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="switch-ativo"
                  />
                )}
              />
              <Label htmlFor="switch-ativo" className="text-slate-700 font-medium cursor-pointer">
                Fornecedor ativo
              </Label>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Observações</Label>
            <Textarea
              {...register("observacoes")}
              placeholder="Informações adicionais sobre o fornecedor..."
              className="rounded-xl border-slate-200 min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                "Salvar Alterações"
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
