// ============================================================================
// ADMIN PRODUTOS PAGE — Croma Print ERP/CRM
// Gestão de Produtos, Modelos e Materiais Sem Preço
// ============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Package,
  Layers,
  AlertTriangle,
  Loader2,
  Save,
  Search,
} from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  descricao: string | null;
  unidade_padrao: string;
  ativo: boolean;
}

interface ProdutoModelo {
  id: string;
  produto_id: string;
  nome: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  markup_padrao: number;
  margem_minima: number;
  preco_fixo: number | null;
  tempo_producao_min: number | null;
  ativo: boolean;
  produto?: { nome: string; categoria: string } | null;
}

interface MaterialSemPreco {
  id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  preco_medio: number | null;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function categoriaBadgeColor(categoria: string): string {
  const map: Record<string, string> = {
    fachadas: "bg-blue-50 text-blue-700 border-blue-200",
    pdv: "bg-purple-50 text-purple-700 border-purple-200",
    comunicacao_interna: "bg-teal-50 text-teal-700 border-teal-200",
    campanhas: "bg-amber-50 text-amber-700 border-amber-200",
    envelopamento: "bg-rose-50 text-rose-700 border-rose-200",
    impressao: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return map[categoria] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

// ----------------------------------------------------------------------------
// ABA 1 — PRODUTOS
// ----------------------------------------------------------------------------

function TabProdutos() {
  const [search, setSearch] = useState("");

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["admin-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codigo ?? "").toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando produtos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Buscar por nome, código ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
        />
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Produtos Cadastrados</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Catálogo completo de produtos do sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {produto.codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{produto.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${categoriaBadgeColor(produto.categoria)}`}
                        >
                          {produto.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {produto.unidade_padrao}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            produto.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ABA 2 — MODELOS
// ----------------------------------------------------------------------------

function TabModelos() {
  const [search, setSearch] = useState("");

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["admin-produto-modelos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produto_modelos")
        .select(`
          *,
          produto:produtos(nome, categoria)
        `)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProdutoModelo[];
    },
  });

  const filtered = modelos.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.produto?.nome ?? "").toLowerCase().includes(q) ||
      (m.produto?.categoria ?? "").toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando modelos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Buscar por nome ou produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
        />
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Modelos de Produto</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {filtered.length} modelo{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Variações e tamanhos específicos por produto</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum modelo encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Produto</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Modelo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Dimensões</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Padrão</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Fixo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Tempo (min)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((modelo) => (
                    <tr
                      key={modelo.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {modelo.produto?.nome ?? "—"}
                        </div>
                        {modelo.produto?.categoria && (
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded border ${categoriaBadgeColor(modelo.produto.categoria)}`}
                          >
                            {modelo.produto.categoria}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{modelo.nome}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {modelo.largura_cm != null && modelo.altura_cm != null
                          ? `${modelo.largura_cm} × ${modelo.altura_cm} cm`
                          : modelo.area_m2 != null
                          ? `${modelo.area_m2} m²`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className="font-mono bg-blue-50 text-blue-700"
                        >
                          {modelo.markup_padrao}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                        {modelo.preco_fixo != null ? formatBRL(modelo.preco_fixo) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {modelo.tempo_producao_min != null ? `${modelo.tempo_producao_min} min` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            modelo.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {modelo.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ABA 3 — SEM PREÇO
// ----------------------------------------------------------------------------

interface MaterialRowProps {
  material: MaterialSemPreco;
  onSave: (id: string, novoPreco: number) => void;
  isSaving: boolean;
}

function MaterialSemPrecoRow({ material, onSave, isSaving }: MaterialRowProps) {
  const [preco, setPreco] = useState("");

  function handleSave() {
    const valor = parseFloat(preco.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      showError("Informe um preço válido maior que zero.");
      return;
    }
    onSave(material.id, valor);
    setPreco("");
  }

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
        {material.codigo ?? "—"}
      </td>
      <td className="px-4 py-3 font-medium text-slate-800">{material.nome}</td>
      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{material.unidade}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          Sem preço
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="h-8 w-28 pl-8 text-sm"
              placeholder="0,00"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !preco}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

interface TabSemPrecoProps {
  onCountChange?: (count: number) => void;
}

function TabSemPreco({ onCountChange }: TabSemPrecoProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: materiaisSemPreco = [], isLoading } = useQuery({
    queryKey: ["materiais-sem-preco"],
    queryFn: async () => {
      const { data } = await (supabase as unknown as any)
        .from("materiais")
        .select("id, codigo, nome, unidade, preco_medio")
        .or("preco_medio.is.null,preco_medio.eq.0")
        .eq("ativo", true)
        .order("nome")
        .limit(200);
      return (data ?? []) as MaterialSemPreco[];
    },
  });

  // Notify parent of count changes for badge
  if (onCountChange) {
    onCountChange(materiaisSemPreco.length);
  }

  const updatePreco = useMutation({
    mutationFn: async ({ id, preco }: { id: string; preco: number }) => {
      const { error } = await (supabase as unknown as any)
        .from("materiais")
        .update({
          preco_medio: preco,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-sem-preco"] });
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      showSuccess("Preço atualizado!");
    },
    onError: () => showError("Erro ao atualizar preço."),
  });

  const filtered = materiaisSemPreco.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.codigo ?? "").toLowerCase().includes(q) ||
      m.unidade.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando materiais...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerta informativo */}
      {materiaisSemPreco.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {materiaisSemPreco.length} material{materiaisSemPreco.length !== 1 ? "is" : ""} sem preço cadastrado
            </p>
            <p className="text-amber-700 mt-0.5 text-xs">
              Materiais sem preço não entram no cálculo automático de orçamentos. Informe o preço médio por unidade.
            </p>
          </div>
        </div>
      )}

      {/* Buscador */}
      {materiaisSemPreco.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, código ou unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
      )}

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-slate-800 text-base">Materiais Sem Preço</CardTitle>
            </div>
            {materiaisSemPreco.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                {materiaisSemPreco.length} pendente{materiaisSemPreco.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <CardDescription>
            Informe o preço médio de cada material para que os orçamentos sejam calculados corretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 && materiaisSemPreco.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="text-green-500 font-semibold mb-2">Tudo certo!</div>
              <p className="text-sm">Todos os materiais ativos possuem preço cadastrado.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Nenhum material encontrado para o termo pesquisado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Atual</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nova Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((material) => (
                    <MaterialSemPrecoRow
                      key={material.id}
                      material={material}
                      onSave={(id, novoPreco) =>
                        updatePreco.mutate({ id, preco: novoPreco })
                      }
                      isSaving={updatePreco.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminProdutosPage() {
  const [semPrecoCount, setSemPrecoCount] = useState<number>(0);

  return (
    <div className="space-y-6 p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Package className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos e Materiais</h1>
          <p className="text-sm text-slate-500">
            Gerencie o catálogo de produtos, modelos e corrija materiais sem preço
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="produtos">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1">
          <TabsTrigger
            value="produtos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Package className="h-4 w-4 mr-1.5" />
            Produtos
          </TabsTrigger>
          <TabsTrigger
            value="modelos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Layers className="h-4 w-4 mr-1.5" />
            Modelos
          </TabsTrigger>
          <TabsTrigger
            value="sem-preco"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-500" />
            Sem Preço
            {semPrecoCount > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {semPrecoCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <TabProdutos />
        </TabsContent>

        <TabsContent value="modelos" className="mt-6">
          <TabModelos />
        </TabsContent>

        <TabsContent value="sem-preco" className="mt-6">
          <TabSemPreco onCountChange={setSemPrecoCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
