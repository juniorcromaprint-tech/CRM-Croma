// src/domains/comercial/components/leads/QuickCriarCampanhaDialog.tsx
// Dialog mínimo para criar uma campanha rápida em status='rascunho' a partir do
// dropdown CampanhaSelector. Não substitui a página /campanhas — só evita ter que
// sair do modal de disparo para registrar uma campanha nova.
//
// Sessão 2026-05-06 (Cowork) — Entrega 1 frontend Campanhas ↔ Leads.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useCriarCampanhaRapida,
  type AgentCampanhaCanal,
  type AgentCampanhaResumo,
} from '../../hooks/useAgentCampanhas';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Canal sugerido (vem do canal já escolhido no modal de disparo). */
  canalSugerido: AgentCampanhaCanal;
  /** Chamado quando a campanha é criada com sucesso. Recebe a campanha criada. */
  onCreated: (campanha: AgentCampanhaResumo) => void;
}

export function QuickCriarCampanhaDialog({
  open,
  onClose,
  canalSugerido,
  onCreated,
}: Props) {
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState<AgentCampanhaCanal>(canalSugerido);
  const [dataFim, setDataFim] = useState<string>('');

  const criar = useCriarCampanhaRapida();

  const reset = () => {
    setNome('');
    setCanal(canalSugerido);
    setDataFim('');
    criar.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = nome.trim();
    if (!trimmed) return;
    try {
      const campanha = await criar.mutateAsync({
        nome: trimmed,
        canal,
        data_fim: dataFim || null,
      });
      onCreated(campanha);
      handleClose();
    } catch {
      // toast de erro é disparado pelo onError do hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar campanha rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qcc-nome" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Nome da campanha
            </Label>
            <Input
              id="qcc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Envelopamento poste segurança 2026"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Canal principal
            </Label>
            <RadioGroup
              value={canal}
              onValueChange={(v) => setCanal(v as AgentCampanhaCanal)}
              className="grid grid-cols-3 gap-2"
            >
              <CanalOption value="whatsapp" label="WhatsApp" current={canal} />
              <CanalOption value="email"    label="E-mail"  current={canal} />
              <CanalOption value="misto"    label="Misto"   current={canal} />
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qcc-data-fim" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Data de término (opcional)
            </Label>
            <Input
              id="qcc-data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Pode deixar em branco e definir depois na página /campanhas.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
            A campanha será criada como <strong>rascunho</strong>. Você pode editá-la
            ou ativá-la depois sem perder o vínculo com os disparos.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!nome.trim() || criar.isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {criar.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Criando...</>
            ) : (
              'Criar campanha'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CanalOption({
  value,
  label,
  current,
}: {
  value: AgentCampanhaCanal;
  label: string;
  current: AgentCampanhaCanal;
}) {
  const active = current === value;
  return (
    <Label
      htmlFor={`qcc-canal-${value}`}
      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors text-sm ${
        active ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <RadioGroupItem value={value} id={`qcc-canal-${value}`} />
      <span className="text-slate-700">{label}</span>
    </Label>
  );
}
