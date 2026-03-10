// ============================================================================
// ADMIN PRODUTOS PAGE — Croma Print ERP/CRM
// Catálogo real de produtos e modelos com gestão de preços e dimensões
// ============================================================================

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Layers,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  useProdutos,
  useProdutoModelos,
  type Produto,
  type ProdutoModelo,
} from "../../comercial/hooks/useProdutosModelos";
import { produtoService } from "../../comercial/services/produto.service";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  "banner",
  "adesivo",
  "fachada",
  "placa",
  "letreiro",
  "painel",
  "totem",
  "backdrop",
  "envelopamento",
  "outros",
];

const UNIDADES = ["un", "m²", "ml", "m", "kg", "cx", "pç"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDimensoes(modelo: ProdutoModelo): string {
  if (modelo.largura_cm && modelo.altura_cm) {
    return `${modelo.largura_cm}×${modelo.altura_cm} cm`;
  }
  if (modelo.largura_cm) return `${modelo.largura_cm} cm (larg.)`;
  if (modelo.area_m2) return `${modelo.area_m2.toFixed(3)} m²`;
  return "—";
}

function formatMarkup(valor: number): string {
  return `${valor.toFixed(0)}%`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Formulário de Produto ────────────────────────────────────────────────────

interface ProdutoFormState {
  nome: string;
  categoria: string;
  unidade_padrao: string;
  descricao: string;
}

const EMPTY_PRODUTO_FORM: ProdutoFormState = {
  nome: "",
  categoria: "",
  unidade_padrao: "un",
  descricao: "",
};

interface ProdutoDialogProps {
  open: boolean;
  produto?: Produto | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProdutoDialog({ open, produto, onClose, onSaved }: ProdutoDialogProps) {
  const [form, setForm] = useState<ProdutoFormState>(
    produto
      ? {
          nome: produto.nome,
          categoria: produto.categoria,
          unidade_padrao: produto.unidade_padrao,
          descricao: produto.descricao ?? "",
        }
      : EMPTY_PRODUTO_FORM,
  );
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens with new product
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm(
        produto
          ? {
              nome: produto.nome,
              categoria: produto.categoria,
              unidade_padrao: produto.unidade_padrao,
              descricao: produto.descricao ?? "",
            }
          : EMPTY_PRODUTO_FORM,
      );
    }
  };

  async function handleSubmit() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!form.categoria) {
      toast.error("Selecione uma categoria.");
      return;
    }

    setSaving(true);
    try {
      if (produto?.id) {
        await produtoService.atualizar(produto.id, {
          nome: form.nome.trim(),
          categoria: form.categoria,
          unidade_padrao: form.unidade_padrao,
          descricao: form.descricao.trim() || undefined,
        });
        toast.success("Produto atualizado!");
      } else {
        await produtoService.criar({
          nome: form.nome.trim(),
          categoria: form.categoria,
          unidade_padrao: form.unidade_padrao,
          descricao: form.descricao.trim() || undefined,
        });
        toast.success("Produto criado!");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        handleOpen(v);
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {produto ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              placeholder="Ex: Banner Roll-Up"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {capitalize(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Unidade Padrão</Label>
            <Select
              value={form.unidade_padrao}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, unidade_padrao: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Descrição opcional do produto..."
              value={form.descricao}
              onChange={(e) =>
                setForm((f) => ({ ...f, descricao: e.target.value }))
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : produto ? (
              "Salvar Alterações"
            ) : (
              "Criar Produto"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulário de Modelo ─────────────────────────────────────────────────────

interface ModeloFormState {
  nome: string;
  largura_cm: string;
  altura_cm: string;
  markup_padrao: string;
  margem_minima: string;
  tempo_producao_min: string;
  preco_fixo: string;
}

const EMPTY_MODELO_FORM: ModeloFormState = {
  nome: "",
  largura_cm: "",
  altura_cm: "",
  markup_padrao: "40",
  margem_minima: "20",
  tempo_producao_min: "",
  preco_fixo: "",
};

interface ModeloDialogProps {
  open: boolean;
  produtoId: string;
  produtoNome: string;
  modelo?: ProdutoModelo | null;
  onClose: () => void;
  onSaved: () => void;
}

function ModeloDialog({
  open,
  produtoId,
  produtoNome,
  modelo,
  onClose,
  onSaved,
}: ModeloDialogProps) {
  const [form, setForm] = useState<ModeloFormState>(
    modelo
      ? {
          nome: modelo.nome,
          largura_cm: modelo.largura_cm != null ? String(modelo.largura_cm) : "",
          altura_cm: modelo.altura_cm != null ? String(modelo.altura_cm) : "",
          markup_padrao: String(modelo.markup_padrao),
          margem_minima: String(modelo.margem_minima),
          tempo_producao_min:
            modelo.tempo_producao_min != null
              ? String(modelo.tempo_producao_min)
              : "",
          preco_fixo:
            modelo.preco_fixo != null ? String(modelo.preco_fixo) : "",
        }
      : EMPTY_MODELO_FORM,
  );
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm(
        modelo
          ? {
              nome: modelo.nome,
              largura_cm:
                modelo.largura_cm != null ? String(modelo.largura_cm) : "",
              altura_cm:
                modelo.altura_cm != null ? String(modelo.altura_cm) : "",
              markup_padrao: String(modelo.markup_padrao),
              margem_minima: String(modelo.margem_minima),
              tempo_producao_min:
                modelo.tempo_producao_min != null
                  ? String(modelo.tempo_producao_min)
                  : "",
              preco_fixo:
                modelo.preco_fixo != null ? String(modelo.preco_fixo) : "",
            }
          : EMPTY_MODELO_FORM,
      );
    }
  };

  async function handleSubmit() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }

    const payload = {
      produto_id: produtoId,
      nome: form.nome.trim(),
      largura_cm: form.largura_cm ? parseFloat(form.largura_cm) : undefined,
      altura_cm: form.altura_cm ? parseFloat(form.altura_cm) : undefined,
      markup_padrao: parseFloat(form.markup_padrao) || 40,
      margem_minima: parseFloat(form.margem_minima) || 20,
      tempo_producao_min: form.tempo_producao_min
        ? parseInt(form.tempo_producao_min, 10)
        : undefined,
      preco_fixo: form.preco_fixo ? parseFloat(form.preco_fixo) : undefined,
    };

    setSaving(true);
    try {
      if (modelo?.id) {
        await produtoService.atualizarModelo(modelo.id, payload);
        toast.success("Modelo atualizado!");
      } else {
        await produtoService.criarModelo(payload);
        toast.success("Modelo criado!");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar modelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        handleOpen(v);
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modelo ? "Editar Modelo" : "Novo Modelo"} —{" "}
            <span className="text-slate-500 font-normal">{produtoNome}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do Modelo *</Label>
            <Input
              placeholder="Ex: 60×160cm Padrão"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Largura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ex: 60"
                value={form.largura_cm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, largura_cm: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Altura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ex: 160"
                value={form.altura_cm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, altura_cm: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Markup Padrão (%)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="40"
                value={form.markup_padrao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, markup_padrao: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Margem Mínima (%)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="20"
                value={form.margem_minima}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_minima: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tempo Produção (min)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="Ex: 30"
                value={form.tempo_producao_min}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tempo_producao_min: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                value={form.preco_fixo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preco_fixo: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : modelo ? (
              "Salvar Alterações"
            ) : (
              "Criar Modelo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha de Modelo ──────────────────────────────────────────────────────────

interface ModeloRowProps {
  modelo: ProdutoModelo;
  onEdit: (m: ProdutoModelo) => void;
  onToggle: (m: ProdutoModelo) => void;
  onDelete: (m: ProdutoModelo) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

function ModeloRow({
  modelo,
  onEdit,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: ModeloRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 group transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-700 truncate block">
            {modelo.nome}
          </span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-400">
              {formatDimensoes(modelo)}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-blue-600 font-mono">
              Markup {formatMarkup(modelo.markup_padrao)}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              Mín. {formatMarkup(modelo.margem_minima)}
            </span>
            {modelo.tempo_producao_min != null && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">
                  {modelo.tempo_producao_min} min
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Badge
          variant={modelo.ativo ? "default" : "secondary"}
          className={`text-xs ${
            modelo.ativo
              ? "bg-green-100 text-green-700 hover:bg-green-100"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {modelo.ativo ? "Ativo" : "Inativo"}
        </Badge>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar modelo"
          onClick={() => onEdit(modelo)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title={modelo.ativo ? "Desativar modelo" : "Ativar modelo"}
          onClick={() => onToggle(modelo)}
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : modelo.ativo ? (
            <PowerOff className="h-3 w-3 text-amber-500" />
          ) : (
            <Power className="h-3 w-3 text-green-500" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
          title="Excluir modelo"
          onClick={() => onDelete(modelo)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Card de Produto ──────────────────────────────────────────────────────────

interface ProdutoCardProps {
  produto: Produto;
  onEdit: (p: Produto) => void;
  onToggleStatus: (p: Produto) => void;
  onAddModelo: (p: Produto) => void;
  onEditModelo: (p: Produto, m: ProdutoModelo) => void;
  isTogglingStatus: boolean;
}

function ProdutoCard({
  produto,
  onEdit,
  onToggleStatus,
  onAddModelo,
  onEditModelo,
  isTogglingStatus,
}: ProdutoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [togglingModeloId, setTogglingModeloId] = useState<string | null>(null);
  const [deletingModeloId, setDeletingModeloId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: modelos = [], isLoading: loadingModelos } = useProdutoModelos(
    expanded ? produto.id : undefined,
  );

  async function handleToggleModelo(modelo: ProdutoModelo) {
    setTogglingModeloId(modelo.id);
    try {
      await produtoService.atualizarModelo(modelo.id, {
        ativo: !modelo.ativo,
      });
      queryClient.invalidateQueries({
        queryKey: ["produto_modelos", produto.id],
      });
      toast.success(`Modelo ${!modelo.ativo ? "ativado" : "desativado"}!`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar status do modelo.");
    } finally {
      setTogglingModeloId(null);
    }
  }

  async function handleDeleteModelo(modelo: ProdutoModelo) {
    if (
      !window.confirm(
        `Excluir o modelo "${modelo.nome}"? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setDeletingModeloId(modelo.id);
    try {
      await produtoService.excluirModelo(modelo.id);
      queryClient.invalidateQueries({
        queryKey: ["produto_modelos", produto.id],
      });
      toast.success("Modelo excluído.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir modelo.");
    } finally {
      setDeletingModeloId(null);
    }
  }

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header do produto */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-blue-50 rounded-lg shrink-0">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{produto.nome}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge
                variant="secondary"
                className="text-xs bg-slate-100 text-slate-600 capitalize"
              >
                {produto.categoria}
              </Badge>
              <span className="text-xs text-slate-400">{produto.unidade_padrao}</span>
              {produto.codigo && (
                <span className="text-xs font-mono text-slate-400">
                  #{produto.codigo}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Badge
            variant={produto.ativo ? "default" : "secondary"}
            className={`text-xs ${
              produto.ativo
                ? "bg-green-100 text-green-700 hover:bg-green-100"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {produto.ativo ? "Ativo" : "Inativo"}
          </Badge>

          {/* Botão editar */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Editar produto"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(produto);
            }}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          {/* Botão toggle status */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title={produto.ativo ? "Desativar produto" : "Ativar produto"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(produto);
            }}
            disabled={isTogglingStatus}
          >
            {isTogglingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : produto.ativo ? (
              <PowerOff className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Power className="h-3.5 w-3.5 text-green-500" />
            )}
          </Button>

          {/* Chevron */}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Painel expandido de modelos */}
      {expanded && (
        <>
          <Separator />
          <div className="px-4 py-3 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Modelos
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddModelo(produto);
                }}
              >
                <Plus className="h-3 w-3" />
                Novo Modelo
              </Button>
            </div>

            {loadingModelos ? (
              <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Carregando modelos...</span>
              </div>
            ) : modelos.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhum modelo cadastrado. Clique em "Novo Modelo" para adicionar.
              </p>
            ) : (
              <div className="space-y-0.5">
                {modelos.map((modelo) => (
                  <ModeloRow
                    key={modelo.id}
                    modelo={modelo}
                    onEdit={(m) => onEditModelo(produto, m)}
                    onToggle={handleToggleModelo}
                    onDelete={handleDeleteModelo}
                    isToggling={togglingModeloId === modelo.id}
                    isDeleting={deletingModeloId === modelo.id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function AdminProdutosPage() {
  const queryClient = useQueryClient();

  // A useProdutos do hook original filtra ativo=true, mas para admin queremos
  // ver todos — usamos uma query direta via produtoService.
  const { data: produtos = [], isLoading } = useProdutos();

  // Dialog state
  const [produtoDialog, setProdutoDialog] = useState<{
    open: boolean;
    produto?: Produto | null;
  }>({ open: false });

  const [modeloDialog, setModeloDialog] = useState<{
    open: boolean;
    produto?: Produto | null;
    modelo?: ProdutoModelo | null;
  }>({ open: false });

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Agrupar por categoria ─────────────────────────────────
  const grupos = produtos.reduce<Record<string, Produto[]>>((acc, p) => {
    const cat = p.categoria || "outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const categoriasOrdenadas = Object.keys(grupos).sort();

  // ── Toggle status do produto ──────────────────────────────
  async function handleToggleProduto(produto: Produto) {
    setTogglingId(produto.id);
    try {
      await produtoService.alterarStatus(produto.id, !produto.ativo);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success(`Produto ${!produto.ativo ? "ativado" : "desativado"}!`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar status.");
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Catálogo de Produtos
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie produtos, modelos e parâmetros de precificação
            </p>
          </div>
        </div>

        <Button
          className="bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={() => setProdutoDialog({ open: true, produto: null })}
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <Separator />

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando catálogo...</span>
        </div>
      ) : produtos.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="text-slate-500 font-medium">
              Nenhum produto cadastrado
            </p>
            <p className="text-slate-400 text-sm">
              Clique em "Novo Produto" para começar a construir o catálogo.
            </p>
            <Button
              className="mt-2 bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={() => setProdutoDialog({ open: true, produto: null })}
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {categoriasOrdenadas.map((categoria) => (
            <div key={categoria}>
              {/* Cabeçalho da categoria */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                  {capitalize(categoria)}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {grupos[categoria].length}
                </Badge>
              </div>

              {/* Grid de produtos */}
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
                {grupos[categoria].map((produto) => (
                  <ProdutoCard
                    key={produto.id}
                    produto={produto}
                    onEdit={(p) =>
                      setProdutoDialog({ open: true, produto: p })
                    }
                    onToggleStatus={handleToggleProduto}
                    onAddModelo={(p) =>
                      setModeloDialog({ open: true, produto: p, modelo: null })
                    }
                    onEditModelo={(p, m) =>
                      setModeloDialog({ open: true, produto: p, modelo: m })
                    }
                    isTogglingStatus={togglingId === produto.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ProdutoDialog
        open={produtoDialog.open}
        produto={produtoDialog.produto}
        onClose={() => setProdutoDialog({ open: false })}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["produtos"] })
        }
      />

      {modeloDialog.produto && (
        <ModeloDialog
          open={modeloDialog.open}
          produtoId={modeloDialog.produto.id}
          produtoNome={modeloDialog.produto.nome}
          modelo={modeloDialog.modelo}
          onClose={() => setModeloDialog({ open: false })}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: ["produto_modelos", modeloDialog.produto?.id],
            })
          }
        />
      )}
    </div>
  );
}

export default AdminProdutosPage;
