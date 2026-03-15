// src/domains/compras/pages/FornecedoresPage.tsx

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useFornecedores, useExcluirFornecedor } from "../hooks/useFornecedores";
import FornecedorForm from "../components/FornecedorForm";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  contato_nome: string | null;
  categorias: string[] | null;
  lead_time_dias: number | null;
  ativo: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function getFornecedorName(f: { nome_fantasia: string | null; razao_social: string }): string {
  return f.nome_fantasia || f.razao_social;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-56" />
        </div>
      </div>
    </div>
  );
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: fornecedores = [], isLoading, isError } = useFornecedores();
  const excluir = useExcluirFornecedor();

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return fornecedores as Fornecedor[];
    return (fornecedores as Fornecedor[]).filter(
      (f) =>
        getFornecedorName(f).toLowerCase().includes(term) ||
        (f.cnpj ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    );
  }, [fornecedores, searchTerm]);

  function handleEdit(f: Fornecedor) {
    setEditingFornecedor(f);
    setFormOpen(true);
  }

  function handleNew() {
    setEditingFornecedor(null);
    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingFornecedor(null);
  }

  async function handleDelete() {
    if (!deletingId) return;
    await excluir.mutateAsync(deletingId);
    setDeletingId(null);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Fornecedores</h1>
        <p className="text-slate-500 mt-1">Gerencie os fornecedores de materiais</p>
      </div>

      {/* Busca + Botão */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
          />
        </div>
        <Button
          onClick={handleNew}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
        >
          <Plus size={18} className="mr-2" /> Novo Fornecedor
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Erro ao carregar fornecedores</h3>
          <p className="text-slate-500 mt-1 text-sm">Verifique a conexão com o banco de dados.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">
            {(fornecedores as Fornecedor[]).length === 0
              ? "Nenhum fornecedor cadastrado"
              : "Nenhum fornecedor encontrado"}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {(fornecedores as Fornecedor[]).length === 0
              ? "Cadastre o primeiro fornecedor para começar."
              : "Ajuste a busca."}
          </p>
          {(fornecedores as Fornecedor[]).length === 0 && (
            <Button
              onClick={handleNew}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus size={18} className="mr-2" /> Cadastrar fornecedor
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}
          </p>
          <div className="grid gap-3">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div
                    className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleEdit(f)}
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-700 transition-colors truncate">
                          {getFornecedorName(f)}
                        </h3>
                        <Badge
                          variant="outline"
                          className={f.ativo
                            ? "text-green-700 border-green-200 bg-green-50"
                            : "text-red-600 border-red-200 bg-red-50"
                          }
                        >
                          {f.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {f.nome_fantasia && f.razao_social !== f.nome_fantasia && (
                        <p className="text-sm text-slate-500 truncate">{f.razao_social}</p>
                      )}
                      {f.cnpj && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          CNPJ: {formatCNPJ(f.cnpj)}
                        </p>
                      )}
                      {(f.categorias ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(f.categorias ?? []).map((cat) => (
                            <span
                              key={cat}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {f.lead_time_dias != null && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> {f.lead_time_dias} dias
                          </span>
                        )}
                        {f.contato_nome && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <User size={12} /> {f.contato_nome}
                          </span>
                        )}
                        {f.telefone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone size={12} /> {f.telefone}
                          </span>
                        )}
                        {f.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={12} /> {f.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeletingId(f.id); }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-9 w-9"
                    >
                      <Trash2 size={16} />
                    </Button>
                    <ChevronRight
                      className="text-slate-300 group-hover:text-blue-600 transition-colors cursor-pointer"
                      size={20}
                      onClick={() => handleEdit(f)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <FornecedorForm
        open={formOpen}
        onClose={handleFormClose}
        fornecedor={editingFornecedor}
      />

      {/* Confirm Delete */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O fornecedor será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={excluir.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {excluir.isPending ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Excluindo...</>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
