// src/domains/comercial/components/leads/CampanhaSelector.tsx
// Dropdown opcional para vincular um disparo a uma campanha de agent_campanhas.
//
// Comportamento:
//   - Default: "Sem campanha (disparo avulso)" — value=null. Comportamento legacy.
//   - Lista campanhas ativas/rascunho compatíveis com o canal.
//   - Item "+ Criar campanha rápida" abre QuickCriarCampanhaDialog.
//
// Sessão 2026-05-06 (Cowork) — Entrega 1 frontend Campanhas ↔ Leads.
// Componente isolado: só é renderizado pelo DispararAberturaModal quando a feature
// flag `feature_campanhas_link_disparo` está ON. Com flag OFF, este arquivo nem é
// montado em runtime.

import { useState } from 'react';
import { Megaphone, Plus, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import {
  useCampanhasAtivas,
  type AgentCampanhaResumo,
  type AgentCampanhaCanal,
} from '../../hooks/useAgentCampanhas';
import { QuickCriarCampanhaDialog } from './QuickCriarCampanhaDialog';

const SEM_CAMPANHA = '__SEM_CAMPANHA__';
const CRIAR_NOVA  = '__CRIAR__';

interface Props {
  /** UUID da campanha selecionada, ou null para "disparo avulso". */
  value: string | null;
  /** Recebe UUID ou null. Nunca recebe a string sentinela __SEM_CAMPANHA__. */
  onChange: (campanhaId: string | null) => void;
  /** Canal do disparo (usado para filtrar campanhas compatíveis). */
  canal: 'whatsapp' | 'email';
  /** Quando true (ex.: durante request de disparo), bloqueia interação. */
  disabled?: boolean;
}

export function CampanhaSelector({ value, onChange, canal, disabled }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campanhas = [], isLoading } = useCampanhasAtivas(canal);

  const handleSelectChange = (next: string) => {
    if (next === SEM_CAMPANHA) {
      onChange(null);
      return;
    }
    if (next === CRIAR_NOVA) {
      // Reabre o select no estado anterior (não muda value).
      setCreateOpen(true);
      return;
    }
    onChange(next);
  };

  const handleCreated = (campanha: AgentCampanhaResumo) => {
    onChange(campanha.id);
  };

  const selectValue = value ?? SEM_CAMPANHA;

  // Mantém a campanha selecionada visível mesmo se o filtro de canal mudou e ela
  // ficou fora da lista. Evita um "valor fantasma" em que o Select mostra vazio.
  const selectedKnown = !value || campanhas.some((c) => c.id === value);

  const canalSugerido: AgentCampanhaCanal = canal === 'whatsapp' ? 'whatsapp' : 'email';

  return (
    <>
      <Select
        value={selectValue}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Selecionar campanha" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={SEM_CAMPANHA}>
              <span className="text-slate-600">Sem campanha (disparo avulso)</span>
            </SelectItem>
          </SelectGroup>

          {(campanhas.length > 0 || isLoading) && <SelectSeparator />}

          {isLoading && (
            <div className="px-2 py-1.5 text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Carregando...
            </div>
          )}

          {!isLoading && campanhas.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-slate-400">
                Campanhas compatíveis
              </SelectLabel>
              {campanhas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <Megaphone size={11} className="text-blue-500" />
                    <span className="truncate">{c.nome}</span>
                    {c.status === 'rascunho' && (
                      <span className="text-[10px] text-amber-600 ml-1">rascunho</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {!selectedKnown && value && (
            // Fallback: mostra UUID truncado para não perder seleção quando filtro muda.
            <SelectGroup>
              <SelectSeparator />
              <SelectItem value={value}>
                <span className="text-slate-500 text-xs">Campanha selecionada (id …{value.slice(-6)})</span>
              </SelectItem>
            </SelectGroup>
          )}

          <SelectSeparator />
          <SelectItem value={CRIAR_NOVA}>
            <span className="inline-flex items-center gap-1.5 text-blue-600">
              <Plus size={11} /> Criar campanha rápida
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {value === null && (
        <p className="text-xs text-slate-400">
          Disparo solto, não vinculado a nenhuma campanha.
        </p>
      )}

      <QuickCriarCampanhaDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        canalSugerido={canalSugerido}
        onCreated={handleCreated}
      />
    </>
  );
}
