import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search } from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

type TipoConta = "receita" | "despesa" | "ambos";

interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  nivel: number;
  tipo: TipoConta;
  categoria_slug: string | null;
  pai_id: string | null;
  ativo: boolean;
}

interface PlanoContaNivel2 extends PlanoConta {
  filhos: PlanoConta[];
}

interface PlanoContaNivel1 extends PlanoConta {
  filhos: PlanoContaNivel2[];
}

// ----------------------------------------------------------------------------
// TREE BUILDER
// ----------------------------------------------------------------------------

function buildTree(items: PlanoConta[]): PlanoContaNivel1[] {
  const raizes = items.filter((i) => i.nivel === 1);
  const nivel2 = items.filter((i) => i.nivel === 2);
  const nivel3 = items.filter((i) => i.nivel === 3);

  return raizes.map((raiz) => {
    const grupos: PlanoContaNivel2[] = nivel2
      .filter((g) => g.pai_id === raiz.id)
      .map((grupo) => ({
        ...grupo,
        filhos: nivel3.filter((s) => s.pai_id === grupo.id),
      }));

    return { ...raiz, filhos: grupos };
  });
}

function filterTree(
  arvore: PlanoContaNivel1[],
  busca: string
): PlanoContaNivel1[] {
  if (!busca.trim()) return arvore;
  const q = busca.toLowerCase();

  return arvore
    .map((raiz) => {
      const raizMatch =
        raiz.codigo.toLowerCase().includes(q) ||
        raiz.nome.toLowerCase().includes(q);

      const filhosFiltrados = raiz.filhos
        .map((grupo) => {
          const grupoMatch =
            grupo.codigo.toLowerCase().includes(q) ||
            grupo.nome.toLowerCase().includes(q);

          const subsFiltrados = grupo.filhos.filter(
            (sub) =>
              sub.codigo.toLowerCase().includes(q) ||
              sub.nome.toLowerCase().includes(q)
          );

          if (grupoMatch || subsFiltrados.length > 0) {
            return { ...grupo, filhos: subsFiltrados };
          }
          return null;
        })
        .filter((g): g is PlanoContaNivel2 => g !== null);

      if (raizMatch || filhosFiltrados.length > 0) {
        return { ...raiz, filhos: filhosFiltrados };
      }
      return null;
    })
    .filter((r): r is PlanoContaNivel1 => r !== null);
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function contarItens(arvore: PlanoContaNivel1[]): number {
  let total = 0;
  for (const raiz of arvore) {
    total += 1;
    for (const grupo of raiz.filhos) {
      total += 1 + grupo.filhos.length;
    }
  }
  return total;
}

// ----------------------------------------------------------------------------
// SKELETON
// ----------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3 mt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TREE RENDER — parameterized by color theme
// ----------------------------------------------------------------------------

interface TreeColors {
  headerBg: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  codoPrimary: string;
  codoSecondary: string;
}

const RECEITA_COLORS: TreeColors = {
  headerBg: "bg-emerald-600 text-white",
  borderColor: "border-emerald-400",
  badgeBg: "bg-emerald-50",
  badgeText: "text-emerald-700",
  codoPrimary: "text-emerald-500",
  codoSecondary: "text-emerald-300",
};

const DESPESA_COLORS: TreeColors = {
  headerBg: "bg-red-600 text-white",
  borderColor: "border-red-400",
  badgeBg: "bg-red-50",
  badgeText: "text-red-700",
  codoPrimary: "text-red-500",
  codoSecondary: "text-red-300",
};

interface PlanoTreeProps {
  arvore: PlanoContaNivel1[];
  colors: TreeColors;
  emptyMessage: string;
}

function PlanoTree({ arvore, colors, emptyMessage }: PlanoTreeProps) {
  if (arvore.length === 0) {
    return (
      <Card className="rounded-2xl border-none shadow-sm mt-4">
        <CardContent className="py-12 text-center text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {arvore.map((raiz) => (
        <Card key={raiz.id} className="rounded-2xl border-none shadow-sm overflow-hidden">
          {/* Nível 1 */}
          <CardHeader className={`${colors.headerBg} py-3 px-4`}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold opacity-75">
                {raiz.codigo}
              </span>
              <span className="font-semibold text-base">{raiz.nome}</span>
            </div>
          </CardHeader>

          {raiz.filhos.length > 0 && (
            <CardContent className="p-3 space-y-1">
              {raiz.filhos.map((grupo) => (
                <div key={grupo.id}>
                  {/* Nível 2 */}
                  <div
                    className={`border-l-4 ${colors.borderColor} pl-4 py-2 pr-2 rounded-r-lg hover:bg-slate-50 transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-medium ${colors.codoPrimary}`}
                      >
                        {grupo.codigo}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {grupo.nome}
                      </span>
                      {grupo.categoria_slug && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ml-auto ${colors.badgeBg} ${colors.badgeText}`}
                        >
                          {grupo.categoria_slug}
                        </Badge>
                      )}
                    </div>

                    {/* Nível 3 */}
                    {grupo.filhos.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 pl-3">
                        {grupo.filhos.map((sub) => (
                          <div
                            key={sub.id}
                            className="py-1.5 px-2 rounded hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`font-mono text-xs pt-0.5 flex-shrink-0 ${colors.codoSecondary}`}
                              >
                                {sub.codigo}
                              </span>
                              <span className="text-xs text-slate-500">
                                {sub.nome}
                              </span>
                              {sub.categoria_slug && (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ml-auto ${colors.badgeBg} ${colors.badgeText}`}
                                >
                                  {sub.categoria_slug}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminPlanoContasPage() {
  const [busca, setBusca] = useState("");

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["plano-contas"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as ReturnType<typeof Object.create>)
        .from("plano_contas")
        .select("id, codigo, nome, nivel, tipo, categoria_slug, pai_id, ativo")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as PlanoConta[];
    },
  });

  const contasReceita = useMemo(
    () => contas.filter((c) => c.tipo === "receita" || c.tipo === "ambos"),
    [contas]
  );

  const contasDespesa = useMemo(
    () => contas.filter((c) => c.tipo === "despesa" || c.tipo === "ambos"),
    [contas]
  );

  const arvoreReceita = useMemo(() => buildTree(contasReceita), [contasReceita]);
  const arvoreDespesa = useMemo(() => buildTree(contasDespesa), [contasDespesa]);

  const arvoreReceitaFiltrada = useMemo(
    () => filterTree(arvoreReceita, busca),
    [arvoreReceita, busca]
  );
  const arvoreDespesaFiltrada = useMemo(
    () => filterTree(arvoreDespesa, busca),
    [arvoreDespesa, busca]
  );

  const totalReceitas = useMemo(() => contarItens(arvoreReceita), [arvoreReceita]);
  const totalDespesas = useMemo(() => contarItens(arvoreDespesa), [arvoreDespesa]);

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Plano de Contas</h1>
            <p className="text-sm text-slate-500">
              Estrutura hierárquica de receitas e despesas
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código ou nome..."
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      {/* Tabs */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Tabs defaultValue="receitas">
          <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1">
            <TabsTrigger
              value="receitas"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm gap-2"
            >
              Receitas
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full"
              >
                {totalReceitas}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="despesas"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm gap-2"
            >
              Despesas
              <Badge
                variant="secondary"
                className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full"
              >
                {totalDespesas}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receitas">
            <PlanoTree
              arvore={arvoreReceitaFiltrada}
              colors={RECEITA_COLORS}
              emptyMessage={
                busca
                  ? "Nenhuma conta de receita encontrada para esta busca."
                  : "Nenhuma conta de receita cadastrada. Execute a migration 012 no Supabase."
              }
            />
          </TabsContent>

          <TabsContent value="despesas">
            <PlanoTree
              arvore={arvoreDespesaFiltrada}
              colors={DESPESA_COLORS}
              emptyMessage={
                busca
                  ? "Nenhuma conta de despesa encontrada para esta busca."
                  : "Nenhuma conta de despesa cadastrada. Execute a migration 012 no Supabase."
              }
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
