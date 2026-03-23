// ============================================================================
// ADMIN PRODUTOS PAGE — Croma Print ERP/CRM
// Gestão de Produtos, Modelos, Acabamentos, Serviços e Materiais Sem Preço
// ============================================================================

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Package,
  Layers,
  AlertTriangle,
  Wrench,
  Scissors,
} from "lucide-react";

import {
  TabProdutos,
  TabModelos,
  TabSemPreco,
  TabAcabamentos,
  TabServicos,
} from "@/domains/admin/components/produtos";

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminProdutosPage() {
  const [semPrecoCount, setSemPrecoCount] = useState<number>(0);

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Package className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos e Materiais</h1>
          <p className="text-sm text-slate-500">
            Gerencie o catálogo de produtos, modelos, acabamentos, serviços e materiais sem preço
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="produtos">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1 flex-wrap">
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
          <TabsTrigger
            value="acabamentos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Scissors className="h-4 w-4 mr-1.5" />
            Acabamentos
          </TabsTrigger>
          <TabsTrigger
            value="servicos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Wrench className="h-4 w-4 mr-1.5" />
            Serviços
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

        <TabsContent value="acabamentos" className="mt-6">
          <TabAcabamentos />
        </TabsContent>

        <TabsContent value="servicos" className="mt-6">
          <TabServicos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
