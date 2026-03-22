// ============================================================================
// ADMIN CONFIG PAGE — Croma Print ERP/CRM
// Configurações do Sistema: Custo, Markup, IA, Progresso, Tributário, Sobre
// ============================================================================

import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import TabCustoOperacional from "../components/TabCustoOperacional";
import TabMarkupCategoria from "../components/TabMarkupCategoria";
import TabSobre from "../components/TabSobre";
import AIModelsTab from "../components/AIModelsTab";
import { ProgressTracker } from "@/shared/components/ProgressTracker";
import { TabTributario } from "@/domains/contabilidade/components/TabTributario";

import {
  Settings,
  DollarSign,
  BarChart2,
  Info,
  Brain,
  Receipt,
} from "lucide-react";

const VALID_TABS = ["custo", "markup", "ia", "progresso", "tributario", "sobre"] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function AdminConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabValue) ?? "custo";
  const safeTab = VALID_TABS.includes(activeTab) ? activeTab : "custo";

  function handleTabChange(value: string) {
    setSearchParams({ tab: value }, { replace: true });
  }

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Settings className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configurações do Sistema</h1>
          <p className="text-sm text-slate-500">
            Parâmetros gerais, precificação, IA e tributação
          </p>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={safeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1 overflow-x-auto">
          <TabsTrigger
            value="custo"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <DollarSign className="h-4 w-4 mr-1.5" />
            Custo Operacional
          </TabsTrigger>
          <TabsTrigger
            value="markup"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <BarChart2 className="h-4 w-4 mr-1.5" />
            Markup
          </TabsTrigger>
          <TabsTrigger
            value="ia"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Brain className="h-4 w-4 mr-1.5" />
            IA
          </TabsTrigger>
          <TabsTrigger
            value="progresso"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <BarChart2 className="h-4 w-4 mr-1.5" />
            Progresso
          </TabsTrigger>
          <TabsTrigger
            value="tributario"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Receipt className="h-4 w-4 mr-1.5" />
            Tributário
          </TabsTrigger>
          <TabsTrigger
            value="sobre"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Info className="h-4 w-4 mr-1.5" />
            Sobre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custo" className="mt-6">
          <TabCustoOperacional />
        </TabsContent>

        <TabsContent value="markup" className="mt-6">
          <TabMarkupCategoria />
        </TabsContent>

        <TabsContent value="ia" className="mt-6">
          <AIModelsTab />
        </TabsContent>

        <TabsContent value="progresso" className="mt-6">
          <ProgressTracker compact={false} />
        </TabsContent>

        <TabsContent value="tributario" className="mt-6">
          <TabTributario />
        </TabsContent>

        <TabsContent value="sobre" className="mt-6">
          <TabSobre />
        </TabsContent>
      </Tabs>
    </div>
  );
}
