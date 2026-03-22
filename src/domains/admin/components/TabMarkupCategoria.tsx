// src/domains/admin/components/TabMarkupCategoria.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { BarChart2, Save, Loader2 } from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface RegraPrecificacao {
  id: string;
  categoria: string;
  markup_minimo: number;
  markup_sugerido: number;
  desconto_maximo: number | null;
  taxa_urgencia: number | null;
  ativo: boolean;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

// ----------------------------------------------------------------------------
// REGRA ROW
// ----------------------------------------------------------------------------

interface RegraRowProps {
  regra: RegraPrecificacao;
  onSave: (id: string, data: Partial<RegraPrecificacao>) => void;
  isSaving: boolean;
}

function RegraRow({ regra, onSave, isSaving }: RegraRowProps) {
  const [editing, setEditing] = useState(false);
  const [markupMin, setMarkupMin] = useState(String(regra.markup_minimo));
  const [markupSug, setMarkupSug] = useState(String(regra.markup_sugerido));
  const [descontoMax, setDescontoMax] = useState(String(regra.desconto_maximo ?? ""));
  const [taxaUrgencia, setTaxaUrgencia] = useState(String(regra.taxa_urgencia ?? ""));

  function handleSave() {
    onSave(regra.id, {
      markup_minimo: parseFloat(markupMin) || regra.markup_minimo,
      markup_sugerido: parseFloat(markupSug) || regra.markup_sugerido,
      desconto_maximo: descontoMax ? parseFloat(descontoMax) : null,
      taxa_urgencia: taxaUrgencia ? parseFloat(taxaUrgencia) : null,
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
        <td className="px-4 py-3 font-medium text-slate-800">{regra.categoria}</td>
        <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
          {formatPct(regra.markup_minimo)}
        </td>
        <td className="px-4 py-3">
          <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 hover:bg-blue-100">
            {formatPct(regra.markup_sugerido)}
          </Badge>
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono">
          {regra.desconto_maximo != null ? formatPct(regra.desconto_maximo) : "—"}
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono">
          {regra.taxa_urgencia != null ? formatPct(regra.taxa_urgencia) : "—"}
        </td>
        <td className="px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="h-8 text-xs"
          >
            Editar
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-amber-50/40">
      <td className="px-4 py-2 font-medium text-slate-700">{regra.categoria}</td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={markupMin}
          onChange={(e) => setMarkupMin(e.target.value)}
          className="h-8 w-24 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={markupSug}
          onChange={(e) => setMarkupSug(e.target.value)}
          className="h-8 w-24 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={descontoMax}
          onChange={(e) => setDescontoMax(e.target.value)}
          className="h-8 w-24 text-sm"
          placeholder="—"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.1"
          value={taxaUrgencia}
          onChange={(e) => setTaxaUrgencia(e.target.value)}
          className="h-8 w-24 text-sm"
          placeholder="—"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export default function TabMarkupCategoria() {
  const queryClient = useQueryClient();

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["admin-regras-precificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .select("*")
        .order("categoria");
      if (error) throw error;
      return (data || []) as RegraPrecificacao[];
    },
  });

  const updateRegra = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RegraPrecificacao> }) => {
      const { error } = await (supabase as unknown as any)
        .from("regras_precificacao")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-regras-precificacao"] });
      queryClient.invalidateQueries({ queryKey: ["regras_precificacao"] });
      showSuccess("Regra salva!");
    },
    onError: () => showError("Erro ao salvar regra."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando regras...</span>
      </div>
    );
  }

  if (regras.length === 0) {
    return (
      <Card className="rounded-2xl border-none shadow-sm">
        <CardContent className="py-12 text-center text-slate-400">
          <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma regra de markup configurada.</p>
          <p className="text-sm mt-1">
            Execute a migration <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-xs">006_orcamento_module.sql</code> para criar as regras padrão.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-none shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-slate-800 text-base">Markup por Categoria</CardTitle>
        </div>
        <CardDescription>
          Markup mínimo, sugerido, desconto máximo e taxa de urgência por categoria de produto
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Mín.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Markup Sug.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Desc. Máx.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Taxa Urgência</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map((regra) => (
                <RegraRow
                  key={regra.id}
                  regra={regra}
                  onSave={(id, data) => updateRegra.mutate({ id, data })}
                  isSaving={updateRegra.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
