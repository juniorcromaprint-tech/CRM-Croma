// src/domains/qualidade/components/OcorrenciaForm.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarOcorrencia } from "../hooks/useOcorrencias";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OcorrenciaFormDefaults {
  pedido_id?: string;
  ordem_producao_id?: string;
  fornecedor_id?: string;
}

interface OcorrenciaFormProps {
  open: boolean;
  onClose: () => void;
  defaults?: OcorrenciaFormDefaults;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: "retrabalho", label: "Retrabalho" },
  { value: "devolucao", label: "Devolução" },
  { value: "erro_producao", label: "Erro de Produção" },
  { value: "erro_instalacao", label: "Erro de Instalação" },
  { value: "divergencia_cliente", label: "Divergência c/ Cliente" },
  { value: "material_defeituoso", label: "Material Defeituoso" },
  { value: "outro", label: "Outro" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const CAUSA_OPTIONS = [
  { value: "material_defeituoso", label: "Material Defeituoso" },
  { value: "erro_operacional", label: "Erro Operacional" },
  { value: "erro_projeto", label: "Erro de Projeto" },
  { value: "instrucao_incorreta", label: "Instrução Incorreta" },
  { value: "outro", label: "Outro" },
];

// ─── Data hooks ──────────────────────────────────────────────────────────────

function usePedidosSelect() {
  return useQuery({
    queryKey: ["pedidos-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select("id, numero")
        .order("numero", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useOrdensProducaoSelect() {
  return useQuery({
    queryKey: ["ordens-producao-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_producao")
        .select("id, numero")
        .order("numero", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useFornecedoresSelect() {
  return useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fornecedores")
        .select("id, nome")
        .order("nome")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OcorrenciaForm({ open, onClose, defaults }: OcorrenciaFormProps) {
  const criarOcorrencia = useCriarOcorrencia();
  const { data: pedidos = [] } = usePedidosSelect();
  const { data: ordensProducao = [] } = useOrdensProducaoSelect();
  const { data: fornecedores = [] } = useFornecedoresSelect();

  const [tipo, setTipo] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [causa, setCausa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pedidoId, setPedidoId] = useState(defaults?.pedido_id ?? "");
  const [ordemProducaoId, setOrdemProducaoId] = useState(defaults?.ordem_producao_id ?? "");
  const [fornecedorId, setFornecedorId] = useState(defaults?.fornecedor_id ?? "");

  function handleClose() {
    setTipo("");
    setPrioridade("media");
    setCausa("");
    setDescricao("");
    setPedidoId(defaults?.pedido_id ?? "");
    setOrdemProducaoId(defaults?.ordem_producao_id ?? "");
    setFornecedorId(defaults?.fornecedor_id ?? "");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !tipo || !prioridade) return;

    await criarOcorrencia.mutateAsync({
      tipo,
      prioridade,
      causa: causa || null,
      descricao: descricao.trim(),
      pedido_id: pedidoId || null,
      ordem_producao_id: ordemProducaoId || null,
      fornecedor_id: fornecedorId || null,
      status: "aberta",
    });

    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Ocorrência</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="oc-descricao">
              Descrição <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="oc-descricao"
              className="rounded-xl resize-none"
              rows={3}
              placeholder="Descreva a ocorrência"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>
                Tipo <span className="text-red-500">*</span>
              </Label>
              <Select value={tipo} onValueChange={setTipo} required>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label>
                Prioridade <span className="text-red-500">*</span>
              </Label>
              <Select value={prioridade} onValueChange={setPrioridade} required>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Causa */}
          <div className="space-y-1.5">
            <Label>Causa (opcional)</Label>
            <Select value={causa} onValueChange={setCausa}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione a causa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Não identificada</SelectItem>
                {CAUSA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vinculações opcionais */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Vinculações (opcional)
            </p>

            {/* Pedido */}
            <div className="space-y-1.5">
              <Label>Pedido</Label>
              <Select value={pedidoId} onValueChange={setPedidoId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {(pedidos as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ordem de Produção */}
            <div className="space-y-1.5">
              <Label>Ordem de Produção</Label>
              <Select value={ordemProducaoId} onValueChange={setOrdemProducaoId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {(ordensProducao as any[]).map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      #{op.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fornecedor */}
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {(fornecedores as any[]).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={handleClose}
              disabled={criarOcorrencia.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
              disabled={criarOcorrencia.isPending || !descricao.trim() || !tipo || !prioridade}
            >
              {criarOcorrencia.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Registrar Ocorrência
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default OcorrenciaForm;
