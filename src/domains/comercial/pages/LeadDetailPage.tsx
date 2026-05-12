import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Phone, Mail, Thermometer, Edit2, Save, X,
  TrendingUp, Calendar, FileText, UserCheck, Trash2,
  Globe, MapPin, Hash, Star, Tag,
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
import { EmailTimeline } from "../components/leads/EmailTimeline";

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
    cargo: string;
    cnpj: string;
    site: string;
    whatsapp: string;
    email2: string;
    telefone2: string;
    endereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    classificacao: string;
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
      cargo: lead.cargo ?? "",
      cnpj: lead.cnpj ?? "",
      site: lead.site ?? "",
      whatsapp: lead.whatsapp ?? "",
      email2: lead.email2 ?? "",
      telefone2: lead.telefone2 ?? "",
      endereco: lead.endereco ?? "",
      bairro: lead.bairro ?? "",
      cidade: lead.cidade ?? "",
      uf: lead.uf ?? "",
      cep: lead.cep ?? "",
      classificacao: lead.classificacao ?? "",
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
    // Validação de telefone: aceita qualquer formato BR válido (com/sem DDI, com/sem máscara)
    // Exemplos aceitos: (11) 98154-9118, 11981549118, +5511981549118, +55 11 98154-9118, 11 9 8154-9118
    if (form.contato_telefone) {
      const digitsOnly = form.contato_telefone.replace(/\D/g, "");
      const isValidBR =
        /^\d{10,11}$/.test(digitsOnly) ||           // sem DDI: DDD + 8 ou 9 dígitos
        /^55\d{10,11}$/.test(digitsOnly);           // com DDI 55
      if (!isValidBR) {
        showError("Telefone inválido. Use formato BR: (XX) XXXXX-XXXX ou +5511XXXXXXXXX.");
        return;
      }
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
        cargo: form.cargo || null,
        cnpj: form.cnpj || null,
        site: form.site || null,
        whatsapp: form.whatsapp || null,
        email2: form.email2 || null,
        telefone2: form.telefone2 || null,
        endereco: form.endereco || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        cep: form.cep || null,
        classificacao: form.classificacao || null,
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
      // clientes.classificacao tem CHECK IN ('A','B','C','D'). Lead aceita texto livre
      // ("MEI", "EPP", "Grande" etc) → mapear: só passa se for A/B/C/D, senão null.
      const leadClass = (lead as any).classificacao;
      const classificacaoCliente = ['A', 'B', 'C', 'D'].includes(leadClass) ? leadClass : null;

      const novoCliente = await createCliente.mutateAsync({
        razao_social: (lead as any).razao_social || lead.empresa,
        nome_fantasia: lead.empresa,
        email: lead.contato_email ?? (lead as any).email ?? null,
        telefone: lead.contato_telefone ?? (lead as any).telefone ?? null,
        segmento: lead.segmento ?? null,
        classificacao: classificacaoCliente,
        origem: "lead_convertido",
        lead_id: id,
        cnpj: cnpjLimpo,
        // Endereço completo (antes era ignorado)
        cidade: (lead as any).cidade ?? null,
        estado: (lead as any).uf ?? null,
        bairro: (lead as any).bairro ?? null,
        endereco: (lead as any).endereco ?? null,
        cep: (lead as any).cep ?? null,
        observacoes: lead.observacoes ?? null,
      });

      // Cria contato principal em cliente_contatos
      if (novoCliente?.id && (lead.contato_nome || lead.contato_email || lead.contato_telefone)) {
        const { error: contatoErr } = await supabase.from('cliente_contatos').insert({
          cliente_id: novoCliente.id,
          nome: lead.contato_nome || lead.empresa,
          cargo: (lead as any).cargo ?? null,
          email: lead.contato_email ?? null,
          telefone: lead.contato_telefone ?? null,
          whatsapp: (lead as any).whatsapp ?? lead.contato_telefone ?? null,
          principal: true,
          e_decisor: true,
          ativo: true,
        });
        if (contatoErr) console.error('Erro ao criar contato principal:', contatoErr.message);
      }

      await updateLead.mutateAsync({ id, status: "convertido" });
      setConvertOpen(false);
      showSuccess("Lead convertido com endereço, contato e observações! Complete IE para emitir NF-e.");
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
            {/* Contato principal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lead.contato_nome && (
                <div className="flex items-center gap-3">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Contato</p>
                    <p className="text-sm font-medium text-slate-700">
                      {lead.contato_nome}
                      {lead.cargo && <span className="text-slate-400 ml-1">({lead.cargo})</span>}
                    </p>
                  </div>
                </div>
              )}
              {(lead.contato_telefone || lead.telefone) && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Telefone</p>
                    <p className="text-sm font-medium text-slate-700">{lead.contato_telefone || lead.telefone}</p>
                    {lead.telefone2 && (
                      <p className="text-xs text-slate-500 mt-0.5">{lead.telefone2}</p>
                    )}
                  </div>
                </div>
              )}
              {(lead.contato_email || lead.email) && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-700">{lead.contato_email || lead.email}</p>
                    {lead.email2 && (
                      <p className="text-xs text-slate-500 mt-0.5">{lead.email2}</p>
                    )}
                  </div>
                </div>
              )}
              {lead.whatsapp && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className={(lead as any).whatsapp_invalido ? "text-red-400 shrink-0" : "text-emerald-400 shrink-0"} />
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={(lead as any).whatsapp_invalido ? "text-sm font-medium text-slate-400 line-through" : "text-sm font-medium text-slate-700"}>{lead.whatsapp}</p>
                      {(lead as any).whatsapp_invalido && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                          title={(lead as any).whatsapp_invalidado_motivo
                            ? `Marcado em ${(lead as any).whatsapp_invalidado_em ? new Date((lead as any).whatsapp_invalidado_em).toLocaleDateString('pt-BR') : '—'}. Motivo: ${(lead as any).whatsapp_invalidado_motivo}`
                            : 'Número confirmado sem WhatsApp ativo. Lead continua elegível para email.'}
                        >
                          WhatsApp inválido
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dados da empresa */}
            {(lead.cnpj || lead.razao_social || lead.site || lead.classificacao) && (
              <>
                <hr className="border-slate-100" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lead.cnpj && (
                    <div className="flex items-center gap-3">
                      <Hash size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">CNPJ</p>
                        <p className="text-sm font-medium text-slate-700">{lead.cnpj}</p>
                      </div>
                    </div>
                  )}
                  {lead.razao_social && lead.razao_social !== lead.empresa && (
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Razão Social</p>
                        <p className="text-sm font-medium text-slate-700">{lead.razao_social}</p>
                      </div>
                    </div>
                  )}
                  {lead.site && (
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Site</p>
                        <a
                          href={lead.site.startsWith('http') ? lead.site : `https://${lead.site}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {lead.site}
                        </a>
                      </div>
                    </div>
                  )}
                  {lead.classificacao && (
                    <div className="flex items-center gap-3">
                      <Tag size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Classificação / Porte</p>
                        <p className="text-sm font-medium text-slate-700 capitalize">{lead.classificacao}</p>
                      </div>
                    </div>
                  )}
                  {lead.score != null && (
                    <div className="flex items-center gap-3">
                      <Star size={16} className="text-amber-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Score</p>
                        <p className="text-sm font-medium text-slate-700">{lead.score}/100</p>
                      </div>
                    </div>
                  )}
                  {lead.origens && (
                    <div className="flex items-center gap-3">
                      <TrendingUp size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Origem</p>
                        <p className="text-sm font-medium text-slate-700">{lead.origens}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Endereço */}
            {(lead.endereco || lead.cidade || lead.uf || lead.cep) && (
              <>
                <hr className="border-slate-100" />
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Endereço</p>
                    <p className="text-sm font-medium text-slate-700">
                      {[lead.endereco, lead.bairro].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-slate-600">
                      {[lead.cidade, lead.uf].filter(Boolean).join(' - ')}
                      {lead.cep && ` — CEP ${lead.cep}`}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Observações */}
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  value={form.cargo}
                  onChange={e => setForm({ ...form, cargo: e.target.value })}
                  placeholder="Gerente, Diretor..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(51) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="telefone2">Telefone 2</Label>
                <Input
                  id="telefone2"
                  value={form.telefone2}
                  onChange={e => setForm({ ...form, telefone2: e.target.value })}
                  placeholder="Telefone alternativo"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email2">Email 2</Label>
              <Input
                id="email2"
                type="email"
                value={form.email2}
                onChange={e => setForm({ ...form, email2: e.target.value })}
                placeholder="Email alternativo"
              />
            </div>

            <hr className="border-slate-100 my-1" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados da Empresa</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={e => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label htmlFor="site">Site</Label>
                <Input
                  id="site"
                  value={form.site}
                  onChange={e => setForm({ ...form, site: e.target.value })}
                  placeholder="www.empresa.com.br"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="classificacao">Classificação / Porte</Label>
              <Input
                id="classificacao"
                value={form.classificacao}
                onChange={e => setForm({ ...form, classificacao: e.target.value })}
                placeholder="MEI, ME, EPP, Grande..."
              />
            </div>

            <hr className="border-slate-100 my-1" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endereço</p>

            <div>
              <Label htmlFor="endereco">Logradouro</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={e => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, Avenida, nº"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={form.bairro}
                  onChange={e => setForm({ ...form, bairro: e.target.value })}
                  placeholder="Bairro"
                />
              </div>
              <div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={e => setForm({ ...form, cidade: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  value={form.uf}
                  onChange={e => setForm({ ...form, uf: e.target.value })}
                  placeholder="RS"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={form.cep}
                  onChange={e => setForm({ ...form, cep: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <hr className="border-slate-100 my-1" />

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

      {/* Email tracking timeline (sent/delivered/opened/clicked/bounced) */}
      {!editing && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Mail size={14} className="text-slate-500" />
            Histórico de email
          </h3>
          <EmailTimeline leadId={id} />
        </div>
      )}

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
