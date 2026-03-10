// ============================================================================
// TEMPLATES PAGE
// Gestao de templates reutilizaveis de orcamento
// ============================================================================

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Search, FileText, Trash2, Edit, Loader2,
  LayoutTemplate, ArrowLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useTemplates,
  useCriarTemplate,
  useExcluirTemplate,
  type OrcamentoTemplate,
  type TemplateItem,
} from "../hooks/useTemplates";
import { normalizeSearch } from "@/shared/utils/format";

export default function TemplatesPage() {
  const { data: templates = [], isLoading, isError } = useTemplates();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = normalizeSearch(search);
    return templates.filter(
      (t) =>
        normalizeSearch(t.nome).includes(q) ||
        normalizeSearch(t.descricao ?? "").includes(q) ||
        normalizeSearch(t.categoria ?? "").includes(q),
    );
  }, [templates, search]);

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/orcamentos">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Templates de Orcamento</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Modelos reutilizaveis para criar orcamentos rapidamente
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 gap-2"
        >
          <Plus size={16} /> Novo Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar templates..."
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <LayoutTemplate size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-sm">
            Templates serao disponibilizados quando a tabela for criada no banco de dados.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Execute a migration 006_orcamento_module.sql para habilitar esta funcionalidade.
          </p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-sm">
            {search.trim()
              ? "Nenhum template encontrado para essa busca"
              : "Nenhum template cadastrado ainda"}
          </p>
          {!search.trim() && (
            <p className="text-slate-400 text-xs mt-2">
              Crie seu primeiro template ou salve um orcamento existente como template.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isExpanded={expandedId === template.id}
              onToggle={() => setExpandedId(expandedId === template.id ? null : template.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateTemplateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isExpanded,
  onToggle,
}: {
  template: OrcamentoTemplate;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const excluir = useExcluirTemplate();

  return (
    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FileText size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{template.nome}</p>
          {template.descricao && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{template.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {template.categoria && (
            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
              {template.categoria}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
            {template.itens?.length ?? 0} itens
          </Badge>
          <span className="text-slate-300">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          {template.itens && template.itens.length > 0 ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Descricao</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Qtd</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Dimensoes</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Markup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {template.itens.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <p className="text-slate-700">{item.descricao}</p>
                        {item.especificacao && (
                          <p className="text-xs text-slate-400">{item.especificacao}</p>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600">{item.quantidade}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-500 text-xs">
                        {item.largura_cm && item.altura_cm
                          ? `${item.largura_cm}x${item.altura_cm}cm`
                          : "---"}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600">{item.markup_percentual}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">Nenhum item no template</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-red-600 hover:bg-red-50 gap-1.5"
              onClick={() => excluir.mutate(template.id)}
              disabled={excluir.isPending}
            >
              <Trash2 size={14} /> Excluir
            </Button>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Criado em {new Date(template.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Create Template Modal ────────────────────────────────────────────────────

function CreateTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const criar = useCriarTemplate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");

  const handleCreate = async () => {
    if (!nome.trim()) return;

    await criar.mutateAsync({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria: categoria.trim() || null,
      itens: [], // Sera preenchido quando itens forem adicionados
    });

    setNome("");
    setDescricao("");
    setCategoria("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="tmpl-nome">Nome *</Label>
            <Input
              id="tmpl-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Banner Padrao Lona 440g"
              className="mt-1.5 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="tmpl-desc">Descricao</Label>
            <Textarea
              id="tmpl-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes do template..."
              className="mt-1.5 rounded-xl min-h-[60px]"
            />
          </div>
          <div>
            <Label htmlFor="tmpl-cat">Categoria</Label>
            <Input
              id="tmpl-cat"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Comunicacao Visual, PDV, Fachadas"
              className="mt-1.5 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!nome.trim() || criar.isPending}
            className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            {criar.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-2" />}
            Criar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
