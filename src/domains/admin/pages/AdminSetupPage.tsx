// ============================================================================
// ADMIN SETUP PAGE — Croma Print ERP/CRM
// Checklist de configuração do sistema — verifica estado do banco de dados
// ============================================================================

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Settings,
  ClipboardCheck,
  ExternalLink,
  Copy,
} from "lucide-react";

// ----------------------------------------------------------------------------
// SQL para migration 006
// ----------------------------------------------------------------------------

const SQL_MIGRATION_006 = `-- Execute no Supabase SQL Editor:
-- Arquivo: supabase/migrations/006_orcamento_module.sql
-- (Execute o conteúdo completo do arquivo de migration)`;

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CheckItem {
  id: string;
  label: string;
  description: string;
  isCritical?: boolean;
  data: CheckData | null;
  isLoading: boolean;
}

interface CheckData {
  ok: boolean;
  actual: number | string;
  expected: string;
  tableExists?: boolean;
}

// ----------------------------------------------------------------------------
// HOOKS DE VERIFICAÇÃO
// ----------------------------------------------------------------------------

function useCheckMateriaisCount() {
  return useQuery({
    queryKey: ["setup-check-materiais"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("materiais")
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        const n = count ?? 0;
        return { ok: n > 100, actual: n, expected: "> 100" };
      } catch {
        return { ok: false, actual: 0, expected: "> 100" };
      }
    },
  });
}

function useCheckProdutosCount() {
  return useQuery({
    queryKey: ["setup-check-produtos"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("produtos")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true);
        if (error) throw error;
        const n = count ?? 0;
        return { ok: n > 10, actual: n, expected: "> 10" };
      } catch {
        return { ok: false, actual: 0, expected: "> 10" };
      }
    },
  });
}

function useCheckModelosCount() {
  return useQuery({
    queryKey: ["setup-check-modelos"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("produto_modelos")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true);
        if (error) throw error;
        const n = count ?? 0;
        return { ok: n > 10, actual: n, expected: "> 10" };
      } catch {
        return { ok: false, actual: 0, expected: "> 10" };
      }
    },
  });
}

function useCheckModeloMateriaisCount() {
  return useQuery({
    queryKey: ["setup-check-modelo-materiais"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("modelo_materiais")
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        const n = count ?? 0;
        return { ok: n > 0, actual: n, expected: "> 0" };
      } catch {
        return { ok: false, actual: 0, expected: "> 0" };
      }
    },
  });
}

function useCheckRegrasPrecificacao() {
  return useQuery({
    queryKey: ["setup-check-regras-precificacao"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("regras_precificacao")
          .select("*", { count: "exact", head: true });
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            return { ok: false, actual: "Tabela ausente", expected: "> 0", tableExists: false };
          }
          throw error;
        }
        const n = count ?? 0;
        return { ok: n > 0, actual: n, expected: "> 0", tableExists: true };
      } catch {
        return { ok: false, actual: "Tabela ausente", expected: "> 0", tableExists: false };
      }
    },
  });
}

function useCheckModuloOrcamento() {
  return useQuery({
    queryKey: ["setup-check-modulo-orcamento"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { count, error } = await (supabase as unknown as any)
          .from("regras_precificacao")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true);
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            return { ok: false, actual: "Migration 006 não executada", expected: "> 0", tableExists: false };
          }
          throw error;
        }
        const n = count ?? 0;
        return { ok: n > 0, actual: n, expected: "> 0", tableExists: true };
      } catch {
        return { ok: false, actual: "Migration 006 não executada", expected: "> 0", tableExists: false };
      }
    },
  });
}

function useCheckConfigOperacional() {
  return useQuery({
    queryKey: ["setup-check-config-operacional"],
    queryFn: async (): Promise<CheckData> => {
      try {
        const { data, error } = await (supabase as unknown as any)
          .from("config_precificacao")
          .select("custo_operacional_mensal")
          .limit(1)
          .single();
        if (error) throw error;
        const val = data?.custo_operacional_mensal ?? 0;
        return {
          ok: typeof val === "number" && val > 0,
          actual: val > 0 ? `R$ ${val.toLocaleString("pt-BR")}` : "Não configurado",
          expected: "> R$ 0",
        };
      } catch {
        return { ok: false, actual: "Não configurado", expected: "> R$ 0" };
      }
    },
  });
}

// ----------------------------------------------------------------------------
// COMPONENTE — ITEM DO CHECKLIST
// ----------------------------------------------------------------------------

interface ChecklistItemProps {
  item: CheckItem;
  onCorrigir?: () => void;
  onCopySql?: () => void;
}

function ChecklistItem({ item, onCorrigir, onCopySql }: ChecklistItemProps) {
  const { label, description, isCritical, data, isLoading } = item;

  const isOk = data?.ok ?? false;
  const tableExists = data?.tableExists;

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
        isLoading
          ? "bg-slate-50 border-slate-100"
          : isOk
          ? "bg-green-50/50 border-green-100"
          : "bg-red-50/50 border-red-100"
      }`}
    >
      <div className="mt-0.5">
        {isLoading ? (
          <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        ) : isOk ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-sm ${isOk ? "text-slate-700" : "text-slate-800"}`}>
            {label}
          </span>
          {isCritical && !isOk && !isLoading && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">CRÍTICO</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>

        {!isLoading && data && (
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-slate-400">
              Esperado:{" "}
              <span className="font-mono text-slate-600">{data.expected}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">
              Atual:{" "}
              <span
                className={`font-mono font-semibold ${
                  isOk ? "text-green-600" : "text-red-600"
                }`}
              >
                {String(data.actual)}
              </span>
            </span>
          </div>
        )}
      </div>

      {!isLoading && !isOk && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {tableExists === false && onCopySql ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onCopySql}
              className="h-7 text-xs rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar SQL
            </Button>
          ) : onCorrigir ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onCorrigir}
              className="h-7 text-xs rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Corrigir
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminSetupPage() {
  const navigate = useNavigate();

  const checkMateriais = useCheckMateriaisCount();
  const checkProdutos = useCheckProdutosCount();
  const checkModelos = useCheckModelosCount();
  const checkModeloMateriais = useCheckModeloMateriaisCount();
  const checkModuloOrcamento = useCheckModuloOrcamento();
  const checkRegras = useCheckRegrasPrecificacao();
  const checkConfig = useCheckConfigOperacional();

  const allChecks = [
    checkMateriais,
    checkProdutos,
    checkModelos,
    checkModeloMateriais,
    checkModuloOrcamento,
    checkRegras,
    checkConfig,
  ];

  const totalChecks = allChecks.length;
  const loadingAny = allChecks.some((c) => c.isLoading);
  const okCount = allChecks.filter((c) => c.data?.ok === true).length;
  const scorePercent = Math.round((okCount / totalChecks) * 100);

  function copySql() {
    navigator.clipboard
      .writeText(SQL_MIGRATION_006)
      .then(() => showSuccess("SQL copiado para a área de transferência!"))
      .catch(() => {
        /* silently ignore */
      });
  }

  const items: CheckItem[] = [
    {
      id: "materiais",
      label: "Materiais cadastrados",
      description: "O banco deve conter ao menos 100 materiais ativos com preço",
      data: checkMateriais.data ?? null,
      isLoading: checkMateriais.isLoading,
    },
    {
      id: "produtos",
      label: "Produtos cadastrados",
      description: "O catálogo deve conter ao menos 10 produtos ativos",
      data: checkProdutos.data ?? null,
      isLoading: checkProdutos.isLoading,
    },
    {
      id: "modelos",
      label: "Modelos de produtos",
      description: "Deve haver ao menos 10 modelos de produto ativos",
      data: checkModelos.data ?? null,
      isLoading: checkModelos.isLoading,
    },
    {
      id: "modelo-materiais",
      label: "Modelos com materiais",
      description:
        "Ao menos um modelo deve ter materiais vinculados — sem isso o motor de orçamento não funciona",
      isCritical: true,
      data: checkModeloMateriais.data ?? null,
      isLoading: checkModeloMateriais.isLoading,
    },
    {
      id: "modulo-orcamento",
      label: "Módulo de orçamento",
      description:
        "Tabela regras_precificacao deve existir (requer migration 006)",
      isCritical: true,
      data: checkModuloOrcamento.data ?? null,
      isLoading: checkModuloOrcamento.isLoading,
    },
    {
      id: "regras",
      label: "Regras de precificação ativas",
      description: "Deve haver ao menos uma regra de precificação ativa no sistema",
      data: checkRegras.data ?? null,
      isLoading: checkRegras.isLoading,
    },
    {
      id: "config",
      label: "Configuração operacional",
      description:
        "O custo operacional mensal deve estar configurado em Admin > Precificação",
      data: checkConfig.data ?? null,
      isLoading: checkConfig.isLoading,
    },
  ];

  function getCorrigirFn(item: CheckItem): (() => void) | undefined {
    const tableNotExists =
      item.data?.tableExists === false;

    // Navigation targets per item ID
    const navMap: Record<string, string> = {
      materiais: "/admin/produtos",
      produtos: "/admin/produtos",
      modelos: "/admin/produtos",
      "modelo-materiais": "/admin/produtos",
      config: "/admin/precificacao",
    };

    if (tableNotExists) return undefined;

    const path = navMap[item.id];
    if (path) return () => navigate(path);
    return undefined;
  }

  function getCopySqlFn(item: CheckItem): (() => void) | undefined {
    if (
      (item.id === "modulo-orcamento" || item.id === "regras") &&
      item.data?.tableExists === false
    ) {
      return copySql;
    }
    return undefined;
  }

  const scoreColor =
    okCount === totalChecks
      ? "bg-green-500"
      : okCount >= totalChecks * 0.7
      ? "bg-amber-400"
      : "bg-red-500";

  const motorInoperante = checkModeloMateriais.data?.ok === false && !checkModeloMateriais.isLoading;
  const allOk = okCount === totalChecks && !loadingAny;

  return (
    <div className="space-y-6 p-6 max-w-screen-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuração do Sistema</h1>
          <p className="text-sm text-slate-500">
            Verifique se todos os itens estão configurados antes de usar em produção
          </p>
        </div>
      </div>

      {/* Score Card */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-slate-800">
                {loadingAny ? "—" : okCount}
                <span className="text-lg text-slate-400 font-normal">/{totalChecks}</span>
              </p>
              <p className="text-sm text-slate-500 mt-0.5">itens configurados</p>
            </div>
            <div className="text-right">
              {loadingAny ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Verificando...</span>
                </div>
              ) : (
                <Badge
                  className={`text-white text-base font-bold px-4 py-1.5 ${
                    allOk
                      ? "bg-green-500"
                      : okCount >= totalChecks * 0.7
                      ? "bg-amber-400"
                      : "bg-red-500"
                  }`}
                >
                  {scorePercent}%
                </Badge>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${scoreColor}`}
              style={{ width: loadingAny ? "0%" : `${scorePercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* CRITICAL ALERT — motor inoperante */}
      {motorInoperante && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700">Motor de orçamento inoperante</p>
            <p className="text-sm text-red-600 mt-0.5">
              Nenhum modelo possui materiais vinculados. O cálculo automático de custos não
              funcionará. Acesse <strong>Admin &rsaquo; Produtos &rsaquo; Modelos</strong> e
              configure os materiais de cada modelo.
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/admin/produtos")}
              className="mt-2 h-7 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Configurar Modelos
            </Button>
          </div>
        </div>
      )}

      {/* SUCCESS — all OK */}
      {allOk && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-green-700">Sistema pronto para producao!</p>
            <p className="text-sm text-green-600 mt-0.5">
              Todos os 7 itens de configuração estão corretos. O sistema está pronto para uso em
              produção.
            </p>
          </div>
        </div>
      )}

      {/* Checklist */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-slate-800 text-base">Checklist de Configuração</CardTitle>
          </div>
          <CardDescription>
            Cada item verifica uma condição necessária para o funcionamento correto do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onCorrigir={getCorrigirFn(item)}
              onCopySql={getCopySqlFn(item)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="text-xs text-slate-400 text-center space-y-1">
        <p>
          Os itens marcados como <strong className="text-red-500">CRÍTICO</strong> impedem o
          funcionamento do módulo de orçamentos.
        </p>
        <p>
          Itens dependentes da migration 006 exigem execução manual no{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Supabase SQL Editor
          </a>
          .
        </p>
      </div>
    </div>
  );
}
