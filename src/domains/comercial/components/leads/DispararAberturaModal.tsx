// src/domains/comercial/components/leads/DispararAberturaModal.tsx
// Wizard de 4 passos para disparar mensagem de abertura em lote.
// v3 (2026-05-04): suporte a canal WhatsApp + Email com toggle amigável.

import { useMemo, useState } from 'react';
import {
  Loader2, Send, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft,
  Sparkles, BarChart3, MessageCircle, Mail, ImageIcon,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useTemplatesAbertura, useDispararAbertura } from '../../hooks/useDispararAbertura';
import type { CanalDisparo, DisparoResultRow } from '../../hooks/useDispararAbertura';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';
import { useCreateLeadSegment } from '../../hooks/useLeadSegments';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { CampanhaSelector } from './CampanhaSelector';
import { Input } from '@/components/ui/input';
import { BookmarkPlus } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  leads: LeadDisparo[];
  onSuccess?: () => void;
}

type Step = 'confirmacao' | 'template' | 'cadencia' | 'resultado';

// v6 UX (2026-05-11): 'ambos' dispara WhatsApp + Email pro mesmo conjunto de leads.
// O tipo CanalDisparo do hook continua binário ('whatsapp' | 'email') — quando
// usuário escolhe 'ambos' aqui, fazemos 2 chamadas sequenciais à RPC.
type CanalSelecionado = 'whatsapp' | 'email' | 'ambos';

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: 'confirmacao', label: 'Cesta'     },
  { id: 'template',    label: 'Template'  },
  { id: 'cadencia',    label: 'Cadência'  },
  { id: 'resultado',   label: 'Resultado' },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-semibold transition-colors ${
            i < idx  ? 'bg-blue-600 text-white' :
            i === idx ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                       'bg-slate-100 text-slate-400'
          }`}>
            {i < idx ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          <span className={`text-[11px] ${i === idx ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="w-3 h-px bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

// ─── Canal toggle ───────────────────────────────────────────────────────────

function CanalToggle({
  canal, onChange, countWhatsapp, countEmail, countAmbos,
}: {
  canal: CanalSelecionado;
  onChange: (c: CanalSelecionado) => void;
  countWhatsapp: number;
  countEmail: number;
  countAmbos: number;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      <button
        type="button"
        onClick={() => onChange('whatsapp')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          canal === 'whatsapp'
            ? 'bg-white shadow-sm text-emerald-700 ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <MessageCircle size={13} />
        WhatsApp
        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
          canal === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
        }`}>
          {countWhatsapp}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange('email')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          canal === 'email'
            ? 'bg-white shadow-sm text-blue-700 ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <Mail size={13} />
        Email
        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
          canal === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
        }`}>
          {countEmail}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange('ambos')}
        title="Dispara WhatsApp e Email pros mesmos leads (2 mensagens por lead que tiver ambos canais)"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          canal === 'ambos'
            ? 'bg-white shadow-sm text-purple-700 ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <MessageCircle size={11} />
        <Mail size={11} className="-ml-2.5" />
        Ambos
        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
          canal === 'ambos' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-500'
        }`}>
          {countAmbos}
        </span>
      </button>
    </div>
  );
}

// ─── Substitui placeholders {{contato_nome}}, {{empresa}}, {{cidade}} ────────

function renderPreview(conteudo: string | null, lead?: LeadDisparo): string {
  if (!conteudo) return '';
  if (!lead) return conteudo;
  return conteudo
    .replace(/\{\{contato_nome\}\}/g, lead.contato_nome ?? lead.empresa ?? 'Cliente')
    .replace(/\{\{empresa\}\}/g, lead.empresa ?? 'sua empresa')
    .replace(/\{\{cidade\}\}/g, lead.cidade ?? 'sua região')
    .replace(/\{\{nome_remetente\}\}/g, 'Junior - Croma Print')
    .replace(/\{\{telefone_empresa\}\}/g, '(11) 3399-4517')
    .replace(/\{\{saudacao\}\}/g, lead.contato_nome ? `Olá ${lead.contato_nome}` : 'Olá, tudo bem?')
    .replace(/\{\{assinatura_nome\}\}/g, 'Junior')
    .replace(/\{\{assinatura_empresa\}\}/g, 'Croma Print Comunicação Visual');
}

// v3 UX (2026-05-11): monta HTML aproximado do email final pra preview em iframe.
// Reflete o fluxo do agent-enviar-email v24: subject renderizado, body com
// quebras de linha viradas <br>, imagem como banner topo (se incluir).
function buildEmailPreviewHtml(
  template: { nome: string; assunto: string | null; conteudo: string | null; imagem_url?: string | null } | null,
  lead?: LeadDisparo,
  incluirImagem: boolean = true,
): string {
  if (!template) return '';
  const subject = renderPreview(template.assunto, lead);
  const body = renderPreview(template.conteudo, lead)
    .split('\n')
    .map(line => line.length === 0 ? '<br/>' : `<p style="margin:0 0 12px 0;">${escapeHtml(line)}</p>`)
    .join('');
  const imgUrl = incluirImagem ? (template.imagem_url ?? '') : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeHtml(subject || template.nome)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 16px; background: #fff; }
  .subject-bar { background: #f1f5f9; padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #475569; margin-bottom: 16px; }
  .subject-bar strong { color: #1e293b; }
  .banner { width: 100%; max-width: 600px; border-radius: 8px; margin-bottom: 16px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
</style>
</head>
<body>
  <div class="subject-bar">De: <strong>Junior &lt;junior@cromaprint.com.br&gt;</strong> · Assunto: <strong>${escapeHtml(subject)}</strong></div>
  ${imgUrl ? `<img class="banner" src="${escapeAttr(imgUrl)}" alt="Croma Print" />` : ''}
  <div>${body}</div>
  <div class="footer">Email simulado pelo CRM Croma — preview do que o destinatário receberá via Resend.</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─── Próxima janela do cron de dispatch ─────────────────────────────────────
// O cron `dispatch-approved-messages-30min` roda em janelas BRT 9–12h e 14–17h,
// a cada 30 min. Fora dessas janelas o dispatch ignora a fila. Esse helper
// calcula em texto humano quando a próxima execução vai pegar a mensagem.

function calcularProximaJanela(now: Date = new Date()): string {
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const h = brt.getUTCHours();
  const m = brt.getUTCMinutes();
  const mins = h * 60 + m;

  const proximoSlotEm = (slotMins: number): string => {
    const totalMin = Math.max(0, slotMins - mins);
    if (totalMin === 0) return 'agora';
    if (totalMin < 60) return `em ${totalMin} min`;
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return mm === 0 ? `em ${hh}h` : `em ${hh}h${mm}min`;
  };

  // Janela manhã 9–12h BRT (cron */30 nos minutos 0 e 30)
  if (mins >= 9 * 60 && mins < 12 * 60) {
    const proxMin = m < 30 ? h * 60 + 30 : (h + 1) * 60;
    if (proxMin < 12 * 60) {
      const ph = Math.floor(proxMin / 60);
      const pm = proxMin % 60;
      return `hoje ${String(ph).padStart(2, '0')}:${String(pm).padStart(2, '0')} BRT (${proximoSlotEm(proxMin)})`;
    }
    // ultrapassa 12:00 → janela tarde
    return `hoje 14:00 BRT (${proximoSlotEm(14 * 60)})`;
  }

  // Janela tarde 14–17h BRT
  if (mins >= 14 * 60 && mins < 17 * 60) {
    const proxMin = m < 30 ? h * 60 + 30 : (h + 1) * 60;
    if (proxMin < 17 * 60) {
      const ph = Math.floor(proxMin / 60);
      const pm = proxMin % 60;
      return `hoje ${String(ph).padStart(2, '0')}:${String(pm).padStart(2, '0')} BRT (${proximoSlotEm(proxMin)})`;
    }
    return `amanhã 09:00 BRT`;
  }

  // Gap almoço 12–14h BRT
  if (mins >= 12 * 60 && mins < 14 * 60) {
    return `hoje 14:00 BRT (${proximoSlotEm(14 * 60)})`;
  }

  // Antes das 9h
  if (mins < 9 * 60) {
    return `hoje 09:00 BRT (${proximoSlotEm(9 * 60)})`;
  }

  // Depois das 17h ou madrugada
  return `amanhã 09:00 BRT`;
}

// ─── Main component ─────────────────────────────────────────────────────────

export function DispararAberturaModal({ open, onClose, leads, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('confirmacao');
  // v6 UX (2026-05-11): canal aceita 'ambos' além de 'whatsapp' | 'email'.
  // Quando 'ambos', dispara via 2 chamadas sequenciais à RPC (1 por canal).
  const [canal, setCanal] = useState<CanalSelecionado>('whatsapp');
  // Template por canal. Em 'ambos' usamos os 2; em canal único, só o do canal ativo.
  const [templateIdWhatsapp, setTemplateIdWhatsapp] = useState<string>('');
  const [templateIdEmail, setTemplateIdEmail] = useState<string>('');
  const templateId = canal === 'email' ? templateIdEmail : templateIdWhatsapp; // back-compat com restante do código (lê 1)
  const setTemplateId = (id: string) => {
    if (canal === 'email') setTemplateIdEmail(id);
    else setTemplateIdWhatsapp(id);
  };
  const [modo, setModo] = useState<'imediato' | 'agendado'>('agendado');
  const [incluirImagem, setIncluirImagem] = useState<boolean>(true);
  const [imagemCustomUrl, setImagemCustomUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState<DisparoResultRow[] | null>(null);
  // v4 UX (2026-05-11): AlertDialog de confirmação antes do disparo definitivo.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // v3 UX (2026-05-11): preview HTML real do email num iframe sandbox.
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false);
  // v8 UX (2026-05-11): salvar a cesta como segmento pra re-uso.
  const [segmentoNome, setSegmentoNome] = useState('');
  const [segmentoSalvo, setSegmentoSalvo] = useState(false);
  const criarSegmento = useCreateLeadSegment();

  // Vínculo opcional com campanha (atrás de feature flag).
  // Default null = "Sem campanha (disparo avulso)" → comportamento legacy preservado.
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const { enabled: campanhasLinkEnabled } = useFeatureFlag('feature_campanhas_link_disparo');

  // Upload de imagem direto no modal
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showError('Imagem muito grande (max 5MB)'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const filename = `portfolio_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('email-templates')
        .upload(filename, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('email-templates').getPublicUrl(filename);
      setImagemCustomUrl(urlData.publicUrl);
      setIncluirImagem(true);
      // Salva a URL no template para uso futuro
      if (templateId) {
        await supabase.from('agent_templates').update({ imagem_url: urlData.publicUrl }).eq('id', templateId);
      }
      showSuccess('Imagem enviada!');
    } catch (err: any) {
      showError('Erro no upload: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const dispararMutation = useDispararAbertura();

  // Segmento predominante (filtra templates relevantes; se misto, mostra todos)
  const segmentoPred = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      if (l.segmento) counts[l.segmento] = (counts[l.segmento] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return undefined;
    if (sorted.length === 1) return sorted[0][0];
    return sorted[0][1] / leads.length > 0.7 ? sorted[0][0] : undefined;
  }, [leads]);

  // v6: quando 'ambos', buscamos ambos os conjuntos de templates.
  const { data: templatesWhatsapp = [], isLoading: loadingTemplatesWhatsapp } = useTemplatesAbertura('whatsapp');
  const { data: templatesEmail = [],    isLoading: loadingTemplatesEmail    } = useTemplatesAbertura('email');
  const templates = canal === 'email' ? templatesEmail : canal === 'whatsapp' ? templatesWhatsapp : templatesWhatsapp; // back-compat
  const loadingTemplates = canal === 'ambos' ? (loadingTemplatesWhatsapp || loadingTemplatesEmail) : (canal === 'email' ? loadingTemplatesEmail : loadingTemplatesWhatsapp);

  // Stats da cesta — dinâmicos conforme o canal selecionado
  const elegiveisWhatsapp = leads.filter(l => !l.bloqueado_disparo && l.tem_telefone_valido && !l.em_conversa_ativa);
  const elegiveisEmail    = leads.filter(l => !l.bloqueado_disparo && l.tem_email_valido && !l.em_conversa_ativa);
  // v6: em 'ambos' elegíveis = leads com QUALQUER canal válido (telefone OU email).
  // O total de mensagens criadas será elegiveisWhatsapp.length + elegiveisEmail.length (cada lead pode receber 1 ou 2).
  const elegiveis = canal === 'whatsapp'
    ? elegiveisWhatsapp
    : canal === 'email'
      ? elegiveisEmail
      : leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && (l.tem_telefone_valido || l.tem_email_valido));

  const semContato  = canal === 'whatsapp'
    ? leads.filter(l => !l.bloqueado_disparo && !l.tem_telefone_valido && !l.em_conversa_ativa)
    : canal === 'email'
      ? leads.filter(l => !l.bloqueado_disparo && !l.tem_email_valido && !l.em_conversa_ativa)
      : leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && !l.tem_telefone_valido && !l.tem_email_valido);
  const bloqueados = leads.filter(l => l.bloqueado_disparo);
  const emConv     = leads.filter(l => l.em_conversa_ativa);

  const templateSelecionado          = templatesWhatsapp.find(t => t.id === templateIdWhatsapp) ?? templatesEmail.find(t => t.id === templateIdEmail) ?? null;
  const templateSelecionadoWhatsapp  = templatesWhatsapp.find(t => t.id === templateIdWhatsapp) ?? null;
  const templateSelecionadoEmail     = templatesEmail.find(t => t.id === templateIdEmail) ?? null;
  const leadAmostra = elegiveis[0] ?? leads[0];

  // Quando troca de canal, NÃO limpa templates já escolhidos — útil em 'ambos'
  // pra preservar a escolha entre toggles. Mas se voltar pra canal único, mantém também.
  const handleCanalChange = (c: CanalSelecionado) => {
    setCanal(c);
  };

  // v6: em 'ambos' precisa de UM template selecionado em CADA canal antes de avançar.
  const templateValidoParaAvancar = canal === 'ambos'
    ? !!templateIdWhatsapp && !!templateIdEmail
    : !!templateId;

  const handleDisparar = async () => {
    if (!templateValidoParaAvancar) return;
    const leadIds = leads.map(l => l.id);
    const campanhaIdFinal = campanhasLinkEnabled ? campanhaId : null;

    if (canal === 'ambos') {
      // v6: dispara 2 vezes — primeiro WhatsApp, depois Email.
      // Cada lead vai receber 1 ou 2 mensagens conforme canais disponíveis.
      // Resultado agrega ambos pra mostrar no passo Resultado.
      const resWp = await dispararMutation.mutateAsync({
        leadIds,
        templateId: templateIdWhatsapp,
        modo,
        autoAprovar: true,
        incluirImagem: false,
        campanhaId: campanhaIdFinal,
      });
      const resEm = await dispararMutation.mutateAsync({
        leadIds,
        templateId: templateIdEmail,
        modo,
        autoAprovar: true,
        incluirImagem,
        campanhaId: campanhaIdFinal,
      });
      // Agrega: cada DisparoResultRow tem lead_id; concatena os 2 arrays.
      // Status duplicado em ambos é OK — UI conta por status, não por lead.
      setResultado([...resWp, ...resEm]);
    } else {
      const data = await dispararMutation.mutateAsync({
        leadIds,
        templateId,
        modo,
        autoAprovar: true,
        incluirImagem: canal === 'email' ? incluirImagem : false,
        campanhaId: campanhaIdFinal,
      });
      setResultado(data);
    }

    setStep('resultado');
    onSuccess?.();
  };

  const handleClose = () => {
    setStep('confirmacao');
    setCanal('whatsapp');
    setTemplateIdWhatsapp('');
    setTemplateIdEmail('');
    setModo('agendado');
    setIncluirImagem(true);
    setImagemCustomUrl('');
    setCampanhaId(null);
    setResultado(null);
    setSegmentoNome('');
    setSegmentoSalvo(false);
    dispararMutation.reset();
    onClose();
  };

  // v8 UX (2026-05-11): salva os lead.ids do disparo como segmento reutilizável.
  const handleSalvarSegmento = async () => {
    if (!segmentoNome.trim() || !resultado) return;
    // IDs dos que foram efetivamente enfileirados (status='criado')
    const enfileiradosIds = resultado
      .filter(r => r.status === 'criado')
      .map(r => r.lead_id);
    if (!enfileiradosIds.length) {
      showError('Nenhum lead foi enfileirado pra salvar');
      return;
    }
    try {
      await criarSegmento.mutateAsync({
        nome: segmentoNome,
        descricao: `Disparo ${canalLabel} · ${new Date().toLocaleDateString('pt-BR')} · template ${templateSelecionado?.nome ?? ''}`,
        lead_ids: enfileiradosIds,
      });
      setSegmentoSalvo(true);
    } catch {
      // erro já tratado pelo toast do hook
    }
  };

  const labelSemContato = canal === 'whatsapp' ? 'Sem telefone válido' : 'Sem email válido';
  const canalLabel = canal === 'whatsapp' ? 'WhatsApp' : canal === 'email' ? 'Email' : 'WhatsApp + Email';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            Disparar mensagem de abertura
          </DialogTitle>
        </DialogHeader>

        <StepDots current={step} />

        {/* ── Passo 1: Confirmação + Seleção de Canal ──────────────────────── */}
        {step === 'confirmacao' && (
          <div className="space-y-4">
            {/* Canal toggle */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Canal de envio</p>
              <CanalToggle
                canal={canal}
                onChange={handleCanalChange}
                countWhatsapp={elegiveisWhatsapp.length}
                countEmail={elegiveisEmail.length}
                countAmbos={leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && (l.tem_telefone_valido || l.tem_email_valido)).length}
              />
            </div>

            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{leads.length}</span>{' '}
              {leads.length === 1 ? 'lead' : 'leads'} na cesta.{' '}
              {canal === 'ambos'
                ? 'Quem vai receber em pelo menos um canal:'
                : `Quem vai receber via ${canalLabel}:`}
            </p>

            {canal === 'ambos' ? (
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="WhatsApp"
                  value={elegiveisWhatsapp.length}
                  tone="emerald"
                />
                <StatCard
                  label="Email"
                  value={elegiveisEmail.length}
                  tone="blue"
                />
                <StatCard
                  label="Pulados"
                  value={leads.length - elegiveis.length}
                  tone="amber"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={`Receberão via ${canalLabel}`}
                  value={elegiveis.length}
                  tone="emerald"
                />
                <StatCard
                  label="Pulados"
                  value={semContato.length + bloqueados.length + emConv.length}
                  tone="amber"
                />
              </div>
            )}

            {(semContato.length + bloqueados.length + emConv.length) > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
                {semContato.length > 0 && (
                  <Row label={labelSemContato} value={semContato.length} tone="text-amber-600" />
                )}
                {bloqueados.length > 0 && (
                  <Row label="Bloqueados (NAO INCLUIR)" value={bloqueados.length} tone="text-red-500" />
                )}
                {emConv.length > 0 && (
                  <Row label="Já em conversa ativa" value={emConv.length} tone="text-blue-500" />
                )}
              </div>
            )}

            {elegiveis.length === 0 && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-xl p-3 text-sm">
                <AlertTriangle size={15} />
                Nenhum lead elegível para {canalLabel}. {canal === 'email' ? 'Tente WhatsApp ou cadastre emails.' : 'Tente Email ou cadastre telefones.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={() => setStep('template')}
                disabled={elegiveis.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 2: Galeria de Templates ───────────────────────────────── */}
        {step === 'template' && (
          <div className="space-y-4">
            {canal === 'ambos' ? (
              // v6 UX (2026-05-11): em "ambos" mostramos 2 galerias compactas lado a lado,
              // cada uma com seu próprio templateId. Avançar requer 1 template por canal.
              <>
                <p className="text-sm text-slate-600">
                  Escolha <strong>um template por canal</strong>. Cada lead vai receber até 2 mensagens (1 WhatsApp + 1 Email) conforme seu canal disponível.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MiniGaleria
                    titulo="WhatsApp"
                    canal="whatsapp"
                    templates={templatesWhatsapp}
                    loading={loadingTemplatesWhatsapp}
                    templateId={templateIdWhatsapp}
                    onSelect={setTemplateIdWhatsapp}
                  />
                  <MiniGaleria
                    titulo="Email"
                    canal="email"
                    templates={templatesEmail}
                    loading={loadingTemplatesEmail}
                    templateId={templateIdEmail}
                    onSelect={setTemplateIdEmail}
                  />
                </div>
                {(templateIdWhatsapp || templateIdEmail) && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2 text-xs">
                    <div className="font-medium text-purple-700">Templates escolhidos:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MessageCircle size={11} className="text-emerald-600" />
                        {templateSelecionadoWhatsapp?.nome ?? <span className="text-slate-400">— escolha um</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail size={11} className="text-blue-600" />
                        {templateSelecionadoEmail?.nome ?? <span className="text-slate-400">— escolha um</span>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-slate-600">
                    Escolha a abertura — clique no card para selecionar.
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {canal === 'whatsapp' ? <MessageCircle size={10} className="mr-1" /> : <Mail size={10} className="mr-1" />}
                    {canalLabel} · {templates.length} {templates.length === 1 ? 'opção' : 'opções'}
                  </Badge>
                </div>

                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                    <Loader2 size={14} className="animate-spin" /> Carregando templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
                    Nenhum template de abertura ativo para {canalLabel}. Cadastre um na página de templates.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {templates.map(t => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        selected={t.id === templateId}
                        onClick={() => setTemplateId(t.id)}
                        canal={canal === 'email' ? 'email' : 'whatsapp'}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Preview ao vivo — apenas em canal único (em ambos mostramos só os nomes acima) */}
            {canal !== 'ambos' && templateSelecionado && (
              <div className={`border rounded-xl p-3 space-y-2 ${
                canal === 'email' ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs font-medium ${canal === 'email' ? 'text-blue-700' : 'text-emerald-700'}`}>
                    Preview {leadAmostra ? `(com ${leadAmostra.empresa ?? 'lead'})` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {canal === 'email' && templateSelecionado.assunto && (
                      <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-200">
                        Assunto: {renderPreview(templateSelecionado.assunto, leadAmostra)}
                      </Badge>
                    )}
                    {canal === 'whatsapp' && (
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                        {templateSelecionado.meta_template_name}
                      </Badge>
                    )}
                    {canal === 'email' && (
                      <button
                        type="button"
                        onClick={() => setHtmlPreviewOpen(true)}
                        className="text-[11px] font-medium text-blue-700 bg-white border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                      >
                        <Mail size={11} /> Ver email completo
                      </button>
                    )}
                  </div>
                </div>

                {/* Image section for email: upload + toggle */}
                {canal === 'email' && (() => {
                  const imgUrl = imagemCustomUrl || templateSelecionado.imagem_url;
                  return (
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100 space-y-2">
                      {imgUrl ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src={imgUrl}
                              alt="Banner"
                              className="w-20 h-12 object-cover rounded-md border border-slate-200"
                            />
                            <div>
                              <p className="text-[11px] font-medium text-slate-700">Imagem de portfólio</p>
                              <p className="text-[10px] text-slate-400">Banner no topo do email</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">
                              {incluirImagem ? 'Incluir' : 'Sem imagem'}
                            </span>
                            <Switch
                              checked={incluirImagem}
                              onCheckedChange={setIncluirImagem}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ImageIcon size={14} className="text-slate-400" />
                          <span className="text-[11px] text-slate-500">Nenhuma imagem vinculada</span>
                        </div>
                      )}
                      {/* Upload / trocar */}
                      <label className="cursor-pointer inline-block">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                          {uploading ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                          {uploading ? 'Enviando...' : imgUrl ? 'Trocar imagem' : 'Anexar imagem'}
                        </span>
                      </label>
                    </div>
                  );
                })()}

                <div className={`text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-white rounded-lg p-2.5 border ${
                  canal === 'email' ? 'border-blue-100' : 'border-emerald-100'
                }`}>
                  {renderPreview(templateSelecionado.conteudo, leadAmostra)}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep('confirmacao')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep('cadencia')}
                disabled={!templateValidoParaAvancar}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 3: Cadência ───────────────────────────────────────────── */}
        {step === 'cadencia' && (
          <div className="space-y-4">
            {/* Vincular a campanha (opcional). Só aparece com feature flag ON.
                Com flag OFF, este bloco inteiro não é renderizado e nada muda no fluxo. */}
            {campanhasLinkEnabled && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Vincular a campanha (opcional)
                </p>
                <CampanhaSelector
                  value={campanhaId}
                  onChange={setCampanhaId}
                  canal={canal === 'whatsapp' ? 'whatsapp' : 'email'}
                  disabled={dispararMutation.isPending}
                />
              </div>
            )}

            <p className="text-sm text-slate-600">Como enviar?</p>

            <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <div className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${modo === 'agendado' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setModo('agendado')}>
                <RadioGroupItem value="agendado" id="agendado" className="mt-0.5" />
                <Label htmlFor="agendado" className="cursor-pointer flex-1">
                  <div className="font-medium text-slate-800 text-sm">Cron com rampa de aquecimento (recomendado)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {canal === 'whatsapp'
                      ? 'Cron processa respeitando 15/dia nos primeiros 2 dias e 30/dia depois. Janelas 10–12h e 14–17h BRT.'
                      : 'Cron processa respeitando limites do Resend. Janelas 9–12h e 14–17h BRT.'}
                  </div>
                </Label>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${modo === 'imediato' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setModo('imediato')}>
                <RadioGroupItem value="imediato" id="imediato" className="mt-0.5" />
                <Label htmlFor="imediato" className="cursor-pointer flex-1">
                  <div className="font-medium text-slate-800 text-sm">Enviar na próxima janela</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Mensagem fica pronta para envio agora e sai automaticamente na próxima execução do cron.
                    Próxima janela: <strong className="text-slate-700">{calcularProximaJanela()}</strong>.
                    Pula a rampa, mas respeita o limite diário.
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <BarChart3 size={12} /> Resumo do disparo
              </div>
              <div>Canal: <strong className="inline-flex items-center gap-1">
                {canal === 'whatsapp' ? <MessageCircle size={11} /> :
                 canal === 'email' ? <Mail size={11} /> :
                 <><MessageCircle size={11} /> <Mail size={11} /></>}
                {canalLabel}
              </strong></div>
              {canal === 'ambos' ? (
                <>
                  <div>Template WhatsApp: <strong>{templateSelecionadoWhatsapp?.nome}</strong></div>
                  <div>Template Email: <strong>{templateSelecionadoEmail?.nome}</strong></div>
                </>
              ) : (
                <div>Template: <strong>{templateSelecionado?.nome}</strong></div>
              )}
              {canal === 'email' && templateSelecionado?.imagem_url && (
                <div className="flex items-center gap-1">
                  <ImageIcon size={10} />
                  Imagem: <strong>{incluirImagem ? 'Sim (banner no topo)' : 'Não'}</strong>
                </div>
              )}
              <div>Vão receber: <strong>{elegiveis.length}</strong> {elegiveis.length === 1 ? 'lead' : 'leads'}</div>
              {canal === 'email' && (
                <div className="text-slate-400">
                  Remetente: junior@cromaprint.com.br
                </div>
              )}
              <div className="text-slate-400">
                {canal === 'whatsapp' && 'Janelas: 10–12h e 14–17h BRT · limite atual 15/dia'}
                {canal === 'email'    && 'Janelas: 9–12h e 14–17h BRT · via Resend'}
                {canal === 'ambos'    && 'WhatsApp 10–12 e 14–17 BRT (15/dia) · Email 9–12 e 14–17 BRT (Resend)'}
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep('template')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={dispararMutation.isPending || elegiveis.length === 0}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {dispararMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Disparando...</>
                ) : canal === 'ambos' ? (
                  <><Send size={14} /> Disparar {elegiveisWhatsapp.length + elegiveisEmail.length} mensagens</>
                ) : (
                  <><Send size={14} /> Disparar {elegiveis.length} {elegiveis.length === 1 ? 'lead' : 'leads'}</>
                )}
              </Button>
            </div>

            {dispararMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
                <AlertTriangle size={15} />
                {(dispararMutation.error as any)?.message || 'Erro ao disparar. Tente novamente.'}
              </div>
            )}
          </div>
        )}

        {/* ── Passo 4: Resultado ─────────────────────────────────────────── */}
        {step === 'resultado' && resultado && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="font-semibold">Disparo concluído!</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Enfileirados"
                value={resultado.filter(r => r.status === 'criado').length}
                tone="emerald"
              />
              <StatCard
                label="Não enviados"
                value={resultado.filter(r => r.status !== 'criado').length}
                tone="amber"
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
              <Row label="Bloqueados" value={resultado.filter(r => r.status === 'bloqueado').length} tone="text-red-500" />
              <Row label={labelSemContato} value={resultado.filter(r => r.status === 'pulado').length} tone="text-amber-600" />
              <Row label="Já em conversa" value={resultado.filter(r => r.status === 'duplicado').length} tone="text-blue-500" />
            </div>

            <p className="text-xs text-slate-500">
              {canal === 'whatsapp'
                ? 'As mensagens serão enviadas dentro das janelas de horário configuradas via WhatsApp.'
                : 'Os emails serão enviados via Resend dentro das janelas de horário configuradas.'}
            </p>

            {/* v8 UX (2026-05-11): Salvar lista como segmento reutilizável */}
            {resultado.filter(r => r.status === 'criado').length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
                  <BookmarkPlus size={13} />
                  Salvar essa lista pra re-usar
                </div>
                <p className="text-[11px] text-slate-500">
                  Útil pra follow-up depois (ex: WhatsApp na quarta nos mesmos {resultado.filter(r => r.status === 'criado').length} leads que receberam email hoje).
                </p>
                {segmentoSalvo ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                    <CheckCircle2 size={13} /> Segmento <strong>{segmentoNome}</strong> salvo
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={segmentoNome}
                      onChange={(e) => setSegmentoNome(e.target.value)}
                      placeholder="Ex: Calçados Lote 1 — 11/05"
                      className="text-xs h-8 flex-1"
                      maxLength={80}
                      disabled={criarSegmento.isPending}
                    />
                    <Button
                      size="sm"
                      onClick={handleSalvarSegmento}
                      disabled={!segmentoNome.trim() || criarSegmento.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs gap-1"
                    >
                      {criarSegmento.isPending ? <Loader2 size={11} className="animate-spin" /> : <BookmarkPlus size={11} />}
                      Salvar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* v3 UX (2026-05-11): Preview HTML real do email num iframe sandbox.
          Mostra exatamente o que o destinatário vai receber via Resend (com
          imagem banner, formatação, assinatura). */}
      <Dialog open={htmlPreviewOpen} onOpenChange={setHtmlPreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={16} className="text-blue-600" />
              Preview do email
              {leadAmostra && (
                <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                  Renderizado com {leadAmostra.empresa ?? 'lead'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <iframe
            sandbox=""
            title="Preview do email"
            className="flex-1 w-full min-h-[500px] bg-white border border-slate-200 rounded-lg"
            srcDoc={buildEmailPreviewHtml(
              templateSelecionado ?? null,
              leadAmostra,
              incluirImagem,
            )}
          />
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Preview aproximado. A renderização final pode variar levemente entre clientes de email (Gmail, Outlook, etc).
          </div>
        </DialogContent>
      </Dialog>

      {/* v4 UX (2026-05-11): Confirm dialog antes do disparo final.
          Regra do projeto: AlertDialogAction com mutation async DEVE usar
          e.preventDefault() e fechar manualmente após settle. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send size={16} className="text-blue-600" />
              Confirmar disparo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="text-slate-700">
                  Vai disparar <strong className="text-slate-900">{elegiveis.length}</strong>{' '}
                  {elegiveis.length === 1 ? 'mensagem' : 'mensagens'} via{' '}
                  <strong className="text-slate-900">{canalLabel}</strong>.
                </div>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
                  {canal === 'ambos' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 inline-flex items-center gap-1">
                          <MessageCircle size={11} /> Template WhatsApp
                        </span>
                        <span className="font-medium text-slate-800">{templateSelecionadoWhatsapp?.nome}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 inline-flex items-center gap-1">
                          <Mail size={11} /> Template Email
                        </span>
                        <span className="font-medium text-slate-800">{templateSelecionadoEmail?.nome}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vão receber</span>
                        <span className="font-medium text-slate-800">
                          {elegiveisWhatsapp.length} WhatsApp + {elegiveisEmail.length} Email
                        </span>
                      </div>
                      {templateSelecionadoEmail?.imagem_url && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Imagem (Email)</span>
                          <span className="font-medium text-slate-800">{incluirImagem ? 'Sim' : 'Não'}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Template</span>
                        <span className="font-medium text-slate-800">{templateSelecionado?.nome}</span>
                      </div>
                      {canal === 'email' && templateSelecionado?.imagem_url && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Imagem</span>
                          <span className="font-medium text-slate-800">{incluirImagem ? 'Sim' : 'Não'}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Modo</span>
                    <span className="font-medium text-slate-800">
                      {modo === 'agendado' ? 'Cron com rampa' : 'Próxima janela'}
                    </span>
                  </div>
                  {modo === 'imediato' && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Próxima janela</span>
                      <span className="font-medium text-slate-800">{calcularProximaJanela()}</span>
                    </div>
                  )}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <strong>Esta ação é irreversível.</strong> Mensagens entram na fila e
                  saem automaticamente — não há "desfazer". Verifique tudo antes de confirmar.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dispararMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault(); // impede o close automático do Radix
                try {
                  await handleDisparar();
                } finally {
                  setConfirmOpen(false);
                }
              }}
              disabled={dispararMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {dispararMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" />Disparando...</>
              ) : (
                <>Confirmar disparo</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ─── Card de template ────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: {
    id: string;
    nome: string;
    etapa: string;
    segmento: string | null;
    sub_segmento: string | null;
    meta_template_name: string | null;
    conteudo: string | null;
    assunto?: string | null;
    variaveis: string[] | null;
    vezes_usado: number | null;
    taxa_resposta: number | null;
    imagem_url?: string | null;
  };
  selected: boolean;
  onClick: () => void;
  canal: CanalDisparo;
}

function TemplateCard({ template, selected, onClick, canal }: TemplateCardProps) {
  const previewLen = 140;
  const preview = (template.conteudo ?? '').replace(/\s+/g, ' ').trim();
  const previewTrunc = preview.length > previewLen ? preview.slice(0, previewLen) + '…' : preview;
  const numVars = template.variaveis?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-left bg-white border rounded-xl p-3 flex flex-col gap-2 transition-all',
        selected
          ? 'border-blue-500 border-2 ring-2 ring-blue-100'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 leading-snug">
          {template.nome}
        </span>
        {selected && (
          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 shrink-0">
            <CheckCircle2 size={10} className="mr-0.5" /> Selecionado
          </Badge>
        )}
      </div>

      {/* Show subject for email templates */}
      {canal === 'email' && template.assunto && (
        <div className="text-[11px] text-blue-600 font-medium truncate">
          Assunto: {template.assunto}
        </div>
      )}

      {/* Image indicator */}
      {canal === 'email' && template.imagem_url && (
        <div className="flex items-center gap-1.5 text-[10px] text-purple-600 bg-purple-50 rounded-md px-2 py-0.5 w-fit">
          <ImageIcon size={10} /> Com imagem
        </div>
      )}

      <div className="text-xs text-slate-600 leading-relaxed border-l-2 border-slate-100 pl-2">
        {previewTrunc || <span className="text-slate-400 italic">sem conteúdo</span>}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {template.segmento && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {template.segmento}
          </Badge>
        )}
        {template.sub_segmento && (
          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
            {template.sub_segmento}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] text-slate-500">
          {numVars === 0 ? 'Sem variáveis' : `${numVars} ${numVars === 1 ? 'variável' : 'variáveis'}`}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        {canal === 'whatsapp' ? (
          <span>Meta: <code className="font-mono">{template.meta_template_name ?? '—'}</code></span>
        ) : (
          <span className="flex items-center gap-1"><Mail size={9} /> Email</span>
        )}
        <span>
          Usado {template.vezes_usado ?? 0}×
          {template.taxa_resposta != null && template.taxa_resposta > 0 && (
            <> · {Math.round(template.taxa_resposta * 100)}% resp.</>
          )}
        </span>
      </div>
    </button>
  );
}

// ─── MiniGaleria (usado em modo 'ambos': 1 galeria compacta por canal) ─────

interface MiniGaleriaProps {
  titulo: string;
  canal: 'whatsapp' | 'email';
  templates: any[];
  loading: boolean;
  templateId: string;
  onSelect: (id: string) => void;
}

function MiniGaleria({ titulo, canal, templates, loading, templateId, onSelect }: MiniGaleriaProps) {
  const isEmail = canal === 'email';
  const headerColor = isEmail ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100';
  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${headerColor}`}>
        <span className="text-xs font-semibold inline-flex items-center gap-1.5">
          {isEmail ? <Mail size={12} /> : <MessageCircle size={12} />}
          {titulo}
        </span>
        <Badge variant="outline" className="text-[10px] bg-white border-slate-200">
          {templates.length} {templates.length === 1 ? 'opção' : 'opções'}
        </Badge>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-6 justify-center">
          <Loader2 size={12} className="animate-spin" /> Carregando...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
          Nenhum template ativo para {canal === 'whatsapp' ? 'WhatsApp' : 'Email'}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={t.id === templateId}
              onClick={() => onSelect(t.id)}
              canal={canal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, tone,
}: { label: string; value: number; tone: 'emerald' | 'amber' | 'blue' }) {
  const toneCls =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    tone === 'amber'   ? 'bg-amber-50 text-amber-700 border-amber-100' :
                         'bg-blue-50 text-blue-700 border-blue-100';
  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-90">{label}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
