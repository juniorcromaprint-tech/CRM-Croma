import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Phone, Mail, Thermometer, Edit2, Save, X,
  TrendingUp, Calendar, FileText, UserCheck, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLead, useUpdateLead } from "../hooks/useLeads";
import { useCreateCliente } from "@/domains/clientes/hooks/useClientes";
import { brl, formatDate } from "@/shared/utils/format";
import { showError, showSuccess } from "@/utils/toast";
import { validarCNPJ } from '@/shared/utils/cnpj';
import { TEMPERATURA_CONFIG } from "../constants/temperatura";
import { LEAD_STATUS_CONFIG, getStatusConfig } from "@/shared/constants/status";
import { supabase } from "@/integrations/supabase/client";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  const createCliente = useCreateCliente();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canDelete = profile?.role === 'admin' || profile?.role === 'diretor';

  const [editing, setEditing] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateNameDialog, setDuplicateNameDialog] = useState<{ open: boolean; razaoSocial: string; cnpjLimpo: string | null }>({ open: false, razaoSocial: '', cnpjLimpo: null });

  const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase
        .from("leads")
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: profile?.id ?? null,
        })
        .eq("id", leadId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Falha ao excluir lead — verifique suas permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      showSuccess("Lead excluído com sucesso");
      navigate("/leads");
    },
    onError: (err: any) => showError(err.message || "Erro ao excluir lead"),
  });
  const [convertCnpj, setConvertCnpj] = useState("");
  const [form, setForm] = useState<{
    empresa: string;
    contato_nome: string;
    contato_email: string;
    contato_telefone: string;
    segmento: string;
    status: string;
    temperatura: string;
    valor_estimado: string;
    observacoes: string;
  } | null>(null);

  const handleEdit = () => {
    if (!lead) return;
    setForm({
      empresa: lead.empresa ?? "",
      contato_nome: lead.contato_nome ?? "",
      contato_email: lead.contato_email ?? "",
      contato_telefone: lead.contato_telefone ?? "",
      segmento: lead.segmento ?? "",
      status: lead.status,
      temperatura: lead.temperatura,
      valor_estimado: lead.valor_estimado != null ? String(lead.valor_estimado) : "",
      observacoes: lead.observacoes ?? "",
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setForm(null);
  };

  const handleSave = () => {
    if (!id || !form) return;
    if (!form.empresa.trim()) {
      showError("Nome da empresa é obrigatório.");
      return;
    }
    // M-01: Validação de email
    if (form.contato_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contato_email)) {
      showError("Email inválido. Verifique o formato.");
      return;
    }
    // M-01: Validação de telefone (aceita formatos brasileiros)
    if (form.contato_telefone && !/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(form.contato_telefone.replace(/\s/g, ""))) {
      showError("Telefone inválido. Use o formato (XX) XXXXX-XXXX.");
      return;
    }
    updateLead.mutate(
      {
        id,
        empresa: form.empresa,
        contato_nome: form.contato_nome || null,
        contato_email: form.contato_email || null,
        contato_telefone: form.contato_telefone || null,
        segmento: form.segmento || null,
        status: form.status as any,
        temperatura: form.temperatura as any,
        valor_estimado: form.valor_estimado ? Math.max(0, Number(form.valor_estimado)) : null,
        observacoes: form.observacoes || null,
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleConverter = async () => {
    if (!id || !lead) return;

    if (!lead.empresa?.trim()) {
      showError("Lead precisa ter nome da empresa para ser convertido.");
      return;
    }

    const cnpjLimpo = convertCnpj.trim() || null;
    if (cnpjLimpo && !validarCNPJ(cnpjLimpo)) {
      showError("CNPJ inválido. Verifique os dígitos.");
      return;
    }

    try {
      // Verificação de CNPJ duplicado (bloqueio obrigatório)
      const cnpjSoNumeros = cnpjLimpo?.replace(/\D/g, '') || '';
      if (cnpjSoNumeros) {
        const { data: existingByCnpj } = await supabase
          .from('clientes')
          .select('id, razao_social')
          .eq('cnpj', cnpjSoNumeros)
          .is('excluido_em', null)
          .maybeSingle();

        if (existingByCnpj) {
          showError(`Já existe um cliente com este CNPJ: ${existingByCnpj.razao_social}`);
          return;
        }
      }

      // Verificação de razão social duplicada (aviso com confirmação)
      const { data: existingByName } = await supabase
        .from('clientes')
        .select('id, razao_social')
        .ilike('razao_social', (lead?.empresa || '').trim())
        .is('excluido_em', null)
        .maybeSingle();

      if (existingByName) {
        setDuplicateNameDialog({ open: true, razaoSocial: existingByName.razao_social, cnpjLimpo });
        return;
      }

      await doConvert(cnpjLimpo);
    } catch (err: any) {
      showError(err?.message || "Erro ao converter lead em cliente.");
    }
  };

  const doConvert = async (cnpjLimpo: string | null) => {
    if (!id || !lead) return;
    try {
      const novoCliente = await createCliente.mutateAsync({
        razao_social: lead.empresa,
        nome_fantasia: lead.empresa,
        email: lead.contato_email ?? null,
        telefone: lead.contato_telefone ?? null,
        segmento: lead.segmento ?? null,
        origem: "lead_convertido",
        lead_id: id,
        cnpj: cnpjLimpo,
      });
      await updateLead.mutateAsync({ id, status: "convertido" });
      setConvertOpen(false);
      showSuccess("Lead convertido! Complete o endereço e IE para emitir NF-e.");
      navigate(`/clientes/${novoCliente.id}`);
    } catch (err: any) {
      showError(err?.message || "Erro ao converter lead em cliente.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <h3 className="font-semibold text-slate-600">Lead não encontrado</h3>
        <Link to="/leads" className="text-sm text-blue-600 mt-2 inline-block hover:underline">
          Voltar para Leads
        </Link>
      </div>
    );
  }

  const sc = getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any);
  const tc = TEMPERATURA_CONFIG[lead.temperatura as keyof typeof TEMPERATURA_CONFIG] ?? TEMPERATURA_CONFIG.frio;

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/leads">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{lead.empresa}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.color}`}>
              {sc.label}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tc.badgeColor}`}>
              <Thermometer size={11} className="inline mr-1" />{tc.label}
            </span>
          </div>
          {lead.segmento && (
            <p className="text-slate-500 text-sm mt-0.5 capitalize">{lead.segmento}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canDelete && !editing && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} /> Excluir
            </Button>
          )}
          {lead.status !== "convertido" && lead.status !== "perdido" && !editing && (
            <Button
              size="sm"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={() => setConvertOpen(true)}
            >
              <UserCheck size={14} /> Converter em Cliente
            </Button>
          )}
          {!editing ? (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleEdit}>
              <Edit2 size={14} /> Editar
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleCancel}>
                <X size={14} /> Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
                onClick={handleSave}
                disabled={updateLead.isPending}
              >
                <Save size={14} /> Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        {/* KPIs */}
        {!editing && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Valor Estimado</p>
              <p className="text-lg font-bold text-emerald-600">
                {lead.valor_estimado != null ? brl(lead.valor_estimado) : "—"}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Criado em</p>
              <p className="text-sm font-semibold text-slate-700">{formatDate(lead.created_at)}</p>
            </div>
            {lead.proximo_contato && (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Próximo Contato</p>
                <p className="text-sm font-semibold text-slate-700">
                  <Calendar size={13} className="inline mr-1" />
                  {formatDate(lead.proximo_contato)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* View mode */}
        {!editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lead.contato_nome && (
                <div className="flex items-center gap-3">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Contato</p>
                    <p className="text-sm font-medium text-slate-700">{lead.contato_nome}</p>
                  </div>
                </div>
              )}
              {lead.contato_telefone && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Telefone</p>
                    <p className="text-sm font-medium text-slate-700">{lead.contato_telefone}</p>
                  </div>
                </div>
              )}
              {lead.contato_email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-700">{lead.contato_email}</p>
                  </div>
                </div>
              )}
            </div>
            {lead.observacoes && (
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 mb-1">Observações</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.observacoes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit mode */}
        {editing && form && (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="empresa">Empresa *</Label>
              <Input
                id="empresa"
                value={form.empresa}
                onChange={e => setForm({ ...form, empresa: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contato_nome">Contato</Label>
                <Input
                  id="contato_nome"
                  value={form.contato_nome}
                  onChange={e => setForm({ ...form, contato_nome: e.target.value })}
                  placeholder="Nome do contato"
                />
              </div>
              <div>
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  value={form.contato_telefone}
                  onChange={e => setForm({ ...form, contato_telefone: e.target.value })}
                  placeholder="(51) 99999-9999"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="contato_email">Email</Label>
              <Input
                id="contato_email"
                type="email"
                value={form.contato_email}
                onChange={e => setForm({ ...form, contato_email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperatura</Label>
                <Select value={form.temperatura} onValueChange={v => setForm({ ...form, temperatura: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">Frio</SelectItem>
                    <SelectItem value="morno">Morno</SelectItem>
                    <SelectItem value="quente">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="valor_estimado">Valor Estimado</Label>
                <Input
                  id="valor_estimado"
                  type="number"
                  min="0"
                  value={form.valor_estimado}
                  onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label>Segmento</Label>
                <Select value={form.segmento || "__none__"} onValueChange={v => setForm({ ...form, segmento: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="calcados">Calçados</SelectItem>
                    <SelectItem value="varejo">Varejo</SelectItem>
                    <SelectItem value="franquia">Franquia</SelectItem>
                    <SelectItem value="supermercado">Supermercado</SelectItem>
                    <SelectItem value="farmacia">Farmácia</SelectItem>
                    <SelectItem value="academia">Academia</SelectItem>
                    <SelectItem value="restaurante">Restaurante</SelectItem>
                    <SelectItem value="concessionaria">Concessionária</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={e => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Notas sobre o lead..."
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* Convert dialog */}
      <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter em cliente?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  <strong>{lead.empresa}</strong> será marcado como convertido e você será redirecionado
                  para o cadastro do cliente.
                </p>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ (opcional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="00.000.000/0000-00"
                  value={convertCnpj}
                  onChange={(e) => setConvertCnpj(e.target.value)}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => {
                e.preventDefault();
                handleConverter();
              }}
              disabled={createCliente.isPending || updateLead.isPending}
            >
              {(createCliente.isPending || updateLead.isPending) ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" /> Convertendo...</>
              ) : (
                <><UserCheck size={14} className="mr-1.5" /> Converter</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de nome duplicado */}
      <AlertDialog
        open={duplicateNameDialog.open}
        onOpenChange={(open) => !open && setDuplicateNameDialog({ open: false, razaoSocial: '', cnpjLimpo: null })}
      >
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente já existe</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um cliente com o nome <strong>"{duplicateNameDialog.razaoSocial}"</strong>. Deseja criar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                setDuplicateNameDialog({ open: false, razaoSocial: '', cnpjLimpo: null });
                doConvert(duplicateNameDialog.cnpjLimpo);
              }}
            >
              Criar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead "{lead.empresa}" será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => id && deleteLead.mutate(id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLead.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
