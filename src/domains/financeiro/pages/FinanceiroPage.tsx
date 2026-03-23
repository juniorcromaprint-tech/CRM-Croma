// ============================================================================
// FINANCEIRO PAGE — Croma Print ERP/CRM
// Contas a Receber, Contas a Pagar e DRE (Demonstrativo de Resultado)
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

import TabContasReceber from "../components/TabContasReceber";
import TabContasPagar from "../components/TabContasPagar";
import TabDRE from "../components/TabDRE";

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { data: pendentesCount = 0 } = useQuery({
    queryKey: ["financeiro", "pendentes_aprovacao_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("contas_pagar")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente_aprovacao")
        .is("excluido_em", null);
      return count ?? 0;
    },
    staleTime: 1000 * 30,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-blue-600" />
            </div>
            Financeiro
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Contas a receber, contas a pagar e demonstrativo de resultado
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="receber" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          <TabsTrigger
            value="receber"
            className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
          >
            <ArrowDownLeft size={16} className="hidden sm:block" />
            A Receber
          </TabsTrigger>
          <TabsTrigger
            value="pagar"
            className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
          >
            <ArrowUpRight size={16} className="hidden sm:block" />
            A Pagar
            {pendentesCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-amber-500 text-white">
                {pendentesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="dre"
            className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
          >
            <BarChart3 size={16} className="hidden sm:block" />
            DRE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receber">
          <TabContasReceber />
        </TabsContent>

        <TabsContent value="pagar">
          <TabContasPagar />
        </TabsContent>

        <TabsContent value="dre">
          <TabDRE />
        </TabsContent>
      </Tabs>
    </div>
  );
}
