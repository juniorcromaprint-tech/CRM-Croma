import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  nivel: number;
  pai_id: string | null;
  descricao: string | null;
  ativo: boolean;
}

interface CentroCustoNivel2 extends CentroCusto {
  filhos: CentroCusto[];
}

interface CentroCustoNivel1 extends CentroCusto {
  filhos: CentroCustoNivel2[];
}

// ----------------------------------------------------------------------------
// TREE BUILDER
// ----------------------------------------------------------------------------

function buildTree(items: CentroCusto[]): CentroCustoNivel1[] {
  const raizes = items.filter((i) => i.nivel === 1);
  const nivel2 = items.filter((i) => i.nivel === 2);
  const nivel3 = items.filter((i) => i.nivel === 3);

  return raizes.map((raiz) => {
    const deptos: CentroCustoNivel2[] = nivel2
      .filter((d) => d.pai_id === raiz.id)
      .map((depto) => ({
        ...depto,
        filhos: nivel3.filter((s) => s.pai_id === depto.id),
      }));

    return { ...raiz, filhos: deptos };
  });
}

// ----------------------------------------------------------------------------
// SKELETON
// ----------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TREE RENDER
// ----------------------------------------------------------------------------

function CentroCustoTree({ arvore }: { arvore: CentroCustoNivel1[] }) {
  if (arvore.length === 0) {
    return (
      <Card className="rounded-2xl border-none shadow-sm">
        <CardContent className="py-12 text-center text-slate-400">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum centro de custo cadastrado.</p>
          <p className="text-sm mt-1">
            Execute a migration{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-xs">
              012
            </code>{" "}
            no Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {arvore.map((raiz) => (
        <Card key={raiz.id} className="rounded-2xl border-none shadow-sm overflow-hidden">
          {/* Nível 1 — header azul escuro */}
          <CardHeader className="bg-blue-700 text-white py-3 px-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold opacity-80">
                {raiz.codigo}
              </span>
              <span className="font-semibold text-base">{raiz.nome}</span>
            </div>
          </CardHeader>

          {raiz.filhos.length > 0 && (
            <CardContent className="p-3 space-y-1">
              {raiz.filhos.map((depto) => (
                <div key={depto.id}>
                  {/* Nível 2 — borda esquerda azul clara */}
                  <div className="border-l-4 border-blue-300 pl-4 py-2 pr-2 rounded-r-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-500 font-medium">
                        {depto.codigo}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {depto.nome}
                      </span>
                    </div>

                    {/* Nível 3 */}
                    {depto.filhos.length > 0 && (
                      <div className="mt-1.5 space-y-1 pl-3">
                        {depto.filhos.map((sub) => (
                          <div
                            key={sub.id}
                            className="py-1.5 px-2 rounded hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-xs text-slate-400 pt-0.5 flex-shrink-0">
                                {sub.codigo}
                              </span>
                              <div>
                                <span className="text-xs font-medium text-slate-600">
                                  {sub.nome}
                                </span>
                                {sub.descricao && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {sub.descricao}
                                  </p>
                                )}
                              </div>
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

export default function AdminCentrosCustoPage() {
  const { data: centros = [], isLoading } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as ReturnType<typeof Object.create>)
        .from("centros_custo")
        .select("id, codigo, nome, nivel, pai_id, descricao, ativo")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as CentroCusto[];
    },
  });

  const arvore = useMemo(() => buildTree(centros), [centros]);

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Layers className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Centros de Custo</h1>
            <p className="text-sm text-slate-500">
              Estrutura hierárquica de centros de custo da empresa
            </p>
          </div>
        </div>

        {!isLoading && (
          <Badge
            variant="secondary"
            className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full"
          >
            {centros.length} {centros.length === 1 ? "centro" : "centros"}
          </Badge>
        )}
      </div>

      {/* Content */}
      {isLoading ? <LoadingSkeleton /> : <CentroCustoTree arvore={arvore} />}
    </div>
  );
}
