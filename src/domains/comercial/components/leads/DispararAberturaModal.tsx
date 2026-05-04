// src/domains/comercial/components/leads/DispararAberturaModal.tsx
// Wizard em 4 passos para disparar mensagem de abertura em lote.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seção 6.7

import { useState } from 'react';
import { Loader2, Send, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTemplatesAbertura, useDispararAbertura } from '../../hooks/useDispararAbertura';
import type { DisparoResultRow } from '../../hooks/useDispararAbertura';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  leads: LeadDisparo[];   // leads selecionados (já filtrados: não bloqueados)
  onSuccess?: () => void;
}

type Step = 'confirmacao' | 'template' | 'cadencia' | 'resultado';

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: 'confirmacao', label: 'Confirmação' },
  { id: 'template',    label: 'Template'    },
  { id: 'cadencia',    label: 'Cadência'    },
  { id: 'resultado',   label: 'Resultado'   },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold transition-colors ${
            i < idx  ? 'bg-blue-600 text-white' :
            i === idx ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                       'bg-slate-100 text-slate-400'
          }`}>
            {i < idx ? <CheckCircle2 size={14} /> : i + 1}
          </div>
          <span className={`text-xs ${i === idx ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DispararAberturaModal({ open, onClose, leads, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('confirmacao');
  const [templateId, setTemplateId] = useState<string>('');
  const [modo, setModo] = useState<'imediato' | 'agendado'>('imediato');
  const [resultado, setResultado] = useState<DisparoResultRow[] | null>(null);

  const dispararMutation = useDispararAbertura();

  // Pega segmento predominante pra filtrar templates relevantes
  const segmentoPred = leads[0]?.segmento ?? undefined;
  const { data: templates = [], isLoading: loadingTemplates } = useTemplatesAbertura(segmentoPred);

  // Leads elegíveis (não bloqueados, com telefone)
  const elegíveis     = leads.filter(l => !l.bloqueado_disparo && l.tem_telefone_valido);
  const semTelefone   = leads.filter(l => !l.bloqueado_disparo && !l.tem_telefone_valido);
  const bloqueados    = leads.filter(l => l.bloqueado_disparo);
  const emConversa    = leads.filter(l => l.em_conversa_ativa);

  const handleDisparar = async () => {
    if (!templateId) return;
    const data = await dispararMutation.mutateAsync({
      leadIds:    leads.map(l => l.id),
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
    setModo('imediato');
    setResultado(null);
    dispararMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disparar Mensagem de Abertura</DialogTitle>
        </DialogHeader>

        <StepDots current={step} />

        {/* ── Passo 1: Confirmação ────────────────────────────────────────── */}
        {step === 'confirmacao' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Você selecionou <span className="font-semibold">{leads.length} leads</span>. Veja o resumo:
            </p>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <Row label="Elegíveis para disparo" value={elegíveis.length} color="text-emerald-600 font-semibold" />
              {semTelefone.length > 0 && (
                <Row label="Sem telefone válido (serão pulados)" value={semTelefone.length} color="text-amber-600" />
              )}
              {bloqueados.length > 0 && (
                <Row label="Bloqueados (NAO INCLUIR)" value={bloqueados.length} color="text-red-500" />
              )}
              {emConversa.length > 0 && (
                <Row label="Já em conversa ativa" value={emConversa.length} color="text-blue-500" />
              )}
            </div>

            {elegíveis.length === 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3 text-sm">
                <AlertTriangle size={15} />
                Nenhum lead elegível para disparo entre os selecionados.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={() => setStep('template')}
                disabled={elegíveis.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 2: Template ───────────────────────────────────────────── */}
        {step === 'template' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Escolha o template que será enviado para os leads:
            </p>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> Carregando templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
                Nenhum template de abertura ativo para este segmento.
              </div>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.nome}</span>
                      {t.sub_segmento && (
                        <span className="ml-2 text-xs text-slate-400">({t.sub_segmento})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Preview do template selecionado */}
            {templateId && templates.find(t => t.id === templateId) && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-green-700">Preview</p>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {templates.find(t => t.id === templateId)?.conteudo}
                </p>
                <Badge variant="outline" className="text-xs text-slate-500 mt-1">
                  Meta: {templates.find(t => t.id === templateId)?.meta_template_name}
                </Badge>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('confirmacao')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep('cadencia')}
                disabled={!templateId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 3: Cadência ───────────────────────────────────────────── */}
        {step === 'cadencia' && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">Como enviar os disparos?</p>

            <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${modo === 'imediato' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <RadioGroupItem value="imediato" id="imediato" className="mt-0.5" />
                <Label htmlFor="imediato" className="cursor-pointer space-y-0.5">
                  <div className="font-medium text-slate-800">Imediato</div>
                  <div className="text-xs text-slate-500">
                    Mensagens entram na fila agora e são enviadas dentro da janela de horário configurada.
                  </div>
                </Label>
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${modo === 'agendado' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <RadioGroupItem value="agendado" id="agendado" className="mt-0.5" />
                <Label htmlFor="agendado" className="cursor-pointer space-y-0.5">
                  <div className="font-medium text-slate-800">Agendado (cron)</div>
                  <div className="text-xs text-slate-500">
                    Cron processa automaticamente respeitando rampa de aquecimento (15/dia → 30/dia) e janelas 10–12h e 14–17h BRT.
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">Janelas de envio configuradas:</p>
              <p>10:00 – 12:00 e 14:00 – 17:00 (horário de Brasília)</p>
              <p>Limite: 15 disparos/dia nos primeiros 2 dias, depois 30/dia.</p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('template')}>
                <ChevronLeft size={14} className="mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleDisparar}
                disabled={dispararMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {dispararMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Disparando...</>
                ) : (
                  <><Send size={14} /> Disparar {elegíveis.length} leads</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 4: Resultado ─────────────────────────────────────────── */}
        {step === 'resultado' && resultado && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="font-semibold">Disparo concluído!</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <Row
                label="Enfileirados"
                value={resultado.filter(r => r.status === 'criado').length}
                color="text-emerald-600 font-semibold"
              />
              <Row
                label="Bloqueados"
                value={resultado.filter(r => r.status === 'bloqueado').length}
                color="text-red-500"
              />
              <Row
                label="Sem telefone"
                value={resultado.filter(r => r.status === 'pulado').length}
                color="text-amber-600"
              />
              <Row
                label="Já em conversa"
                value={resultado.filter(r => r.status === 'duplicado').length}
                color="text-blue-500"
              />
            </div>

            <p className="text-xs text-slate-400">
              As mensagens serão enviadas dentro das janelas de horário configuradas.
            </p>

            <div className="flex justify-end pt-2">
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Erro genérico */}
        {dispararMutation.isError && step === 'cadencia' && (
          <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
            <AlertTriangle size={15} />
            {(dispararMutation.error as any)?.message || 'Erro ao disparar. Tente novamente.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
