// src/domains/comercial/components/leads/DispararAberturaModal.tsx
// Wizard de 4 passos para disparar mensagem de abertura em lote.
// v2 (2026-05-04L): galeria de templates em vez de dropdown + preview com lead real.

import { useMemo, useState } from 'react';
import {
  Loader2, Send, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft,
  Sparkles, BarChart3,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTemplatesAbertura, useDispararAbertura } from '../../hooks/useDispararAbertura';
import type { DisparoResultRow } from '../../hooks/useDispararAbertura';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';

interface Props {
  open: boolean;
  onClose: () => void;
  leads: LeadDisparo[];
  onSuccess?: () => void;
}

type Step = 'confirmacao' | 'template' | 'cadencia' | 'resultado';

const STEPS: { id: Step; label: string }[] = [
  { id: 'confirmacao', label: 'Cesta'    },
  { id: 'template',    label: 'Abertura' },
  { id: 'cadencia',    label: 'Cadencia' },
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

function renderPreview(conteudo: string | null, lead?: LeadDisparo): string {
  if (!conteudo) return '';
  if (!lead) return conteudo;
  return conteudo
    .replace(/\{\{contato_nome\}\}/g, lead.contato_nome ?? lead.empresa ?? 'Cliente')
    .replace(/\{\{empresa\}\}/g, lead.empresa ?? 'sua empresa')
    .replace(/\{\{cidade\}\}/g, lead.cidade ?? 'sua regiao');
}

export function DispararAberturaModal({ open, onClose, leads, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('confirmacao');
  const [templateId, setTemplateId] = useState<string>('');
  const [modo, setModo] = useState<'imediato' | 'agendado'>('agendado');
  const [resultado, setResultado] = useState<DisparoResultRow[] | null>(null);

  const dispararMutation = useDispararAbertura();

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

  const { data: templates = [], isLoading: loadingTemplates } = useTemplatesAbertura(segmentoPred);

  const elegiveis  = leads.filter(l => !l.bloqueado_disparo && l.tem_telefone_valido && !l.em_conversa_ativa);
  const semTel     = leads.filter(l => !l.bloqueado_disparo && !l.tem_telefone_valido);
  const bloqueados = leads.filter(l => l.bloqueado_disparo);
  const emConv     = leads.filter(l => l.em_conversa_ativa);

  const templateSelecionado = templates.find((t: any) => t.id === templateId);
  const leadAmostra = elegiveis[0] ?? leads[0];

  const handleDisparar = async () => {
    if (!templateId) return;
    const data = await dispararMutation.mutateAsync({
      leadIds: leads.map(l => l.id),
      templateId,
      modo,
      autoAprovar: true,
    });
    setResultado(data);
    setStep('resultado');
    onSuccess?.();
  };

  const handleClose = () => {
    setStep('confirmacao');
    setTemplateId('');
    setModo('agendado');
    setResultado(null);
    dispararMutation.reset();
    onClose();
  };

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

        {step === 'confirmacao' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{leads.length}</span>{' '}
              {leads.length === 1 ? 'lead' : 'leads'} na cesta. Quem vai receber:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Receberao a mensagem" value={elegiveis.length} tone="emerald" />
              <StatCard label="Pulados" value={semTel.length + bloqueados.length + emConv.length} tone="amber" />
            </div>

            {(semTel.length + bloqueados.length + emConv.length) > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
                {semTel.length > 0 && <Row label="Sem telefone valido" value={semTel.length} tone="text-amber-600" />}
                {bloqueados.length > 0 && <Row label="Bloqueados (NAO INCLUIR)" value={bloqueados.length} tone="text-red-500" />}
                {emConv.length > 0 && <Row label="Ja em conversa ativa" value={emConv.length} tone="text-blue-500" />}
              </div>
            )}

            {elegiveis.length === 0 && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-xl p-3 text-sm">
                <AlertTriangle size={15} />
                Nenhum lead elegivel. Ajuste a cesta antes de continuar.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={() => setStep('template')} disabled={elegiveis.length === 0} className="bg-blue-600 hover:bg-blue-700">
                Proximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-600">Escolha a abertura — clique no card para selecionar.</p>
              <span className="text-xs text-slate-400">
                {templates.length} {templates.length === 1 ? 'opcao' : 'opcoes'}
              </span>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                <Loader2 size={14} className="animate-spin" /> Carregando templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
                Nenhum template de abertura ativo para esse segmento. Cadastre um na pagina de templates.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((t: any) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={t.id === templateId}
                    onClick={() => setTemplateId(t.id)}
                  />
                ))}
              </div>
            )}

            {templateSelecionado && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-emerald-700">
                    Preview {leadAmostra ? `(com ${leadAmostra.empresa ?? 'lead'})` : ''}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                    {templateSelecionado.meta_template_name}
                  </Badge>
                </div>
                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-white rounded-lg p-2.5 border border-emerald-100">
                  {renderPreview(templateSelecionado.conteudo, leadAmostra)}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep('confirmacao')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep('cadencia')} disabled={!templateId} className="bg-blue-600 hover:bg-blue-700">
                Proximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'cadencia' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Como enviar?</p>

            <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${modo === 'agendado' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setModo('agendado')}
              >
                <RadioGroupItem value="agendado" id="agendado" className="mt-0.5" />
                <Label htmlFor="agendado" className="cursor-pointer flex-1">
                  <div className="font-medium text-slate-800 text-sm">Cron com rampa de aquecimento (recomendado)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Cron processa respeitando 15/dia nos primeiros 2 dias e 30/dia depois. Janelas 10-12h e 14-17h BRT.
                  </div>
                </Label>
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${modo === 'imediato' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setModo('imediato')}
              >
                <RadioGroupItem value="imediato" id="imediato" className="mt-0.5" />
                <Label htmlFor="imediato" className="cursor-pointer flex-1">
                  <div className="font-medium text-slate-800 text-sm">Imediato</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Mensagens entram na fila agora e sao enviadas dentro da proxima janela. Respeita o limite diario.
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <BarChart3 size={12} /> Resumo do disparo
              </div>
              <div>Template: <strong>{templateSelecionado?.nome}</strong></div>
              <div>Vao receber: <strong>{elegiveis.length}</strong> {elegiveis.length === 1 ? 'lead' : 'leads'}</div>
              <div className="text-slate-400">Janelas: 10-12h e 14-17h BRT · limite atual 15/dia</div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep('template')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button onClick={handleDisparar} disabled={dispararMutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
                {dispararMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Disparando...</>
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

        {step === 'resultado' && resultado && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="font-semibold">Disparo concluido!</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Enfileirados" value={resultado.filter(r => r.status === 'criado').length} tone="emerald" />
              <StatCard label="Nao enviados" value={resultado.filter(r => r.status !== 'criado').length} tone="amber" />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
              <Row label="Bloqueados" value={resultado.filter(r => r.status === 'bloqueado').length} tone="text-red-500" />
              <Row label="Sem telefone" value={resultado.filter(r => r.status === 'pulado').length} tone="text-amber-600" />
              <Row label="Ja em conversa" value={resultado.filter(r => r.status === 'duplicado').length} tone="text-blue-500" />
            </div>

            <p className="text-xs text-slate-500">
              As mensagens serao enviadas dentro das janelas de horario configuradas.
            </p>

            <div className="flex justify-end pt-1">
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  template: any;
  selected: boolean;
  onClick: () => void;
}

function TemplateCard({ template, selected, onClick }: TemplateCardProps) {
  const previewLen = 140;
  const preview = (template.conteudo ?? '').replace(/\s+/g, ' ').trim();
  const previewTrunc = preview.length > previewLen ? preview.slice(0, previewLen) + '...' : preview;
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
        <span className="text-sm font-semibold text-slate-800 leading-snug">{template.nome}</span>
        {selected && (
          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 shrink-0">
            <CheckCircle2 size={10} className="mr-0.5" /> Selecionado
          </Badge>
        )}
      </div>

      <div className="text-xs text-slate-600 leading-relaxed border-l-2 border-slate-100 pl-2">
        {previewTrunc || <span className="text-slate-400 italic">sem conteudo</span>}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {template.segmento && (
          <Badge variant="outline" className="text-[10px] capitalize">{template.segmento}</Badge>
        )}
        {template.sub_segmento && (
          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
            {template.sub_segmento}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] text-slate-500">
          {numVars === 0 ? 'Sem variaveis' : `${numVars} ${numVars === 1 ? 'variavel' : 'variaveis'}`}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <span>Meta: <code className="font-mono">{template.meta_template_name ?? '—'}</code></span>
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
