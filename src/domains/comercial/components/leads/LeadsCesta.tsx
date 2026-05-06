// src/domains/comercial/components/leads/LeadsCesta.tsx
// Cesta lateral sticky de leads selecionados para disparo.
// Substitui o LeadsBulkActionBar (deprecated nesta versão da UX).
// Em desktop: coluna lateral sticky. Em mobile: barra inferior compacta + sheet.
// Fonte: redesign UX 2026-05-04L (mockup aprovado).

import { useState } from 'react';
import { Send, X, Trash2, ShoppingBasket, AlertTriangle, Phone, Mail, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { LeadDisparo } from '../../hooks/useLeadsDisparo';
import { useExcluirLeadsEmLote } from '../../hooks/useExcluirLead';

interface Props {
  leads: LeadDisparo[];           // só os selecionados
  onRemove: (leadId: string) => void;
  onClear: () => void;
  onDisparar: () => void;
  isDisparando?: boolean;
}

// ─── Helper: estatísticas da cesta ───────────────────────────────────────────

function useEstatisticas(leads: LeadDisparo[]) {
  const total      = leads.length;
  const bloqueados = leads.filter(l => l.bloqueado_disparo).length;
  const emConv     = leads.filter(l => l.em_conversa_ativa && !l.bloqueado_disparo).length;
  // Elegível = tem telefone OU email (canal é escolhido no modal)
  const semContato = leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && !l.tem_telefone_valido && !l.tem_email_valido).length;
  const comWhatsapp = leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && l.tem_telefone_valido).length;
  const comEmail   = leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && l.tem_email_valido).length;
  const elegiveis  = leads.filter(l => !l.bloqueado_disparo && !l.em_conversa_ativa && (l.tem_telefone_valido || l.tem_email_valido)).length;
  return { total, semContato, bloqueados, emConv, elegiveis, comWhatsapp, comEmail };
}

// ─── Componente principal ────────────────────────────────────────────────────

export function LeadsCesta(props: Props) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const excluirEmLote = useExcluirLeadsEmLote();
  const ids = props.leads.map(l => l.id);

  const handleExcluirSelecionados = async () => {
    try {
      await excluirEmLote.mutateAsync(ids);
      props.onClear();
    } finally {
      setConfirmDeleteAll(false);
    }
  };

  const enriched = {
    ...props,
    onExcluirSelecionados: () => setConfirmDeleteAll(true),
    isExcluindo: excluirEmLote.isPending,
  };

  return (
    <>
      <DesktopCesta {...enriched} />
      <MobileCestaBar {...enriched} />

      {/* Confirmacao de exclusao em lote */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {ids.length} lead{ids.length !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ids.length} lead{ids.length !== 1 ? 's' : ''} {ids.length !== 1 ? 'serão removidos' : 'será removido'} da listagem.
              Conversas, propostas e historico permanecem,
              mas {ids.length !== 1 ? 'eles não aparecerão' : 'ele não aparecerá'} mais nos disparos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirEmLote.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await handleExcluirSelecionados();
              }}
              disabled={excluirEmLote.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {excluirEmLote.isPending ? 'Excluindo...' : `Excluir ${ids.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface PropsEnriched extends Props {
  onExcluirSelecionados: () => void;
  isExcluindo: boolean;
}

// ─── Desktop: coluna sticky ──────────────────────────────────────────────────

function DesktopCesta({ leads, onRemove, onClear, onDisparar, isDisparando, onExcluirSelecionados, isExcluindo }: PropsEnriched) {
  const stats = useEstatisticas(leads);

  return (
    <aside className="hidden lg:block sticky top-4 h-fit">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <ShoppingBasket size={15} className="text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">Cesta de disparo</span>
        </div>

        {/* Contagem grande */}
        <div className="px-4 pt-3">
          <div className="text-3xl font-bold text-slate-800 leading-none">
            {stats.total}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {stats.total === 1 ? 'lead selecionado' : 'leads selecionados'}
          </div>
        </div>

        {/* Mini-stats */}
        {stats.total > 0 && (
          <div className="px-4 pt-2 pb-3 space-y-1 text-xs">
            <StatLine
              label="Elegíveis"
              value={stats.elegiveis}
              tone="text-emerald-600"
            />
            <StatLine
              label="WhatsApp"
              value={stats.comWhatsapp}
              tone="text-emerald-600"
              icon={<Phone size={11} />}
            />
            <StatLine
              label="Email"
              value={stats.comEmail}
              tone="text-blue-600"
              icon={<Mail size={11} />}
            />
            {stats.semContato > 0 && (
              <StatLine
                label="Sem contato"
                value={stats.semContato}
                tone="text-amber-600"
              />
            )}
            {stats.emConv > 0 && (
              <StatLine
                label="Em conversa"
                value={stats.emConv}
                tone="text-slate-500"
              />
            )}
            {stats.bloqueados > 0 && (
              <StatLine
                label="Bloqueados"
                value={stats.bloqueados}
                tone="text-red-500"
                icon={<Ban size={11} />}
              />
            )}
          </div>
        )}

        {/* Lista de selecionados */}
        {stats.total === 0 ? (
          <div className="px-4 py-6 text-center border-t border-slate-100">
            <ShoppingBasket size={28} className="mx-auto text-slate-200 mb-2" />
            <p className="text-xs text-slate-400">
              Marque leads para disparar uma abertura em massa.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[320px] border-t border-slate-100">
            <ul className="divide-y divide-slate-50">
              {leads.map(lead => (
                <CestaItem key={lead.id} lead={lead} onRemove={() => onRemove(lead.id)} />
              ))}
            </ul>
          </ScrollArea>
        )}

        {/* Aviso quando algum não vai pra frente */}
        {stats.total > 0 && stats.elegiveis < stats.total && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-start gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span>
              {stats.total - stats.elegiveis} {stats.total - stats.elegiveis === 1 ? 'lead não tem contato válido' : 'leads não têm contato válido'}.
            </span>
          </div>
        )}

        {/* Ações */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          <Button
            onClick={onDisparar}
            disabled={stats.total === 0 || stats.elegiveis === 0 || isDisparando}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-9"
          >
            <Send size={14} />
            Disparar abertura
          </Button>
          {stats.total > 0 && (
            <>
              <button
                onClick={onExcluirSelecionados}
                disabled={isExcluindo}
                className="w-full text-xs text-red-600 hover:bg-red-50 transition-colors py-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-red-100 disabled:opacity-50"
              >
                <Trash2 size={11} />
                {isExcluindo ? 'Excluindo...' : `Excluir ${stats.total} lead${stats.total !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={onClear}
                className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors py-1 flex items-center justify-center gap-1.5"
              >
                <X size={11} /> Limpar seleção
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile: barra inferior + sheet com lista completa ───────────────────────

function MobileCestaBar({ leads, onRemove, onClear, onDisparar, isDisparando, onExcluirSelecionados, isExcluindo }: PropsEnriched) {
  const [open, setOpen] = useState(false);
  const stats = useEstatisticas(leads);

  if (stats.total === 0) return null;

  return (
    <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-slate-900 text-white rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 flex-1 text-left">
              <ShoppingBasket size={16} className="text-blue-400" />
              <div>
                <div className="text-sm font-medium">{stats.total} na cesta</div>
                <div className="text-[11px] text-slate-300">
                  {stats.elegiveis} elegíveis · toque pra ver
                </div>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Cesta de disparo</SheetTitle>
            </SheetHeader>
            <ScrollArea className="max-h-[60vh] mt-4">
              <ul className="divide-y divide-slate-100">
                {leads.map(lead => (
                  <CestaItem key={lead.id} lead={lead} onRemove={() => onRemove(lead.id)} />
                ))}
              </ul>
            </ScrollArea>
            <div className="pt-3 space-y-2">
              <Button
                onClick={() => { setOpen(false); onDisparar(); }}
                disabled={stats.elegiveis === 0 || isDisparando}
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Send size={14} /> Disparar abertura
              </Button>
              <button
                onClick={() => { setOpen(false); onExcluirSelecionados(); }}
                disabled={isExcluindo}
                className="w-full text-xs text-red-600 hover:bg-red-50 py-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-red-100 disabled:opacity-50"
              >
                <Trash2 size={11} />
                {isExcluindo ? 'Excluindo...' : `Excluir ${stats.total} lead${stats.total !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="w-full text-xs text-slate-500 hover:text-slate-700 py-1 flex items-center justify-center gap-1.5"
              >
                <X size={11} /> Limpar seleção
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="w-px h-7 bg-slate-700" />

        <Button
          size="sm"
          onClick={onDisparar}
          disabled={stats.elegiveis === 0 || isDisparando}
          className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-3 rounded-xl gap-1"
        >
          <Send size={12} /> Disparar
        </Button>

        <button
          onClick={onClear}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700"
          title="Limpar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Item da cesta ───────────────────────────────────────────────────────────

function CestaItem({ lead, onRemove }: { lead: LeadDisparo; onRemove: () => void }) {
  const hasContato = lead.tem_telefone_valido || lead.tem_email_valido;
  const isElegivel = !lead.bloqueado_disparo && hasContato && !lead.em_conversa_ativa;

  // Canal badges
  const canais: string[] = [];
  if (lead.tem_telefone_valido) canais.push('WhatsApp');
  if (lead.tem_email_valido) canais.push('Email');

  return (
    <li className="px-4 py-2 flex items-center gap-2 text-xs">
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${isElegivel ? 'text-slate-700' : 'text-slate-400'}`}>
          {lead.empresa ?? lead.contato_nome ?? '—'}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {!hasContato && !lead.bloqueado_disparo && !lead.em_conversa_ativa && 'Sem contato'}
          {lead.bloqueado_disparo && 'Bloqueado'}
          {lead.em_conversa_ativa && !lead.bloqueado_disparo && 'Em conversa ativa'}
          {isElegivel && (
            <>
              {canais.join(' · ')}
              {(lead.cidade || lead.sub_segmento) && ' · '}
              {lead.cidade}
              {lead.cidade && lead.sub_segmento && ' · '}
              {lead.sub_segmento}
            </>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label={`Remover ${lead.empresa} da cesta`}
      >
        <X size={13} />
      </button>
    </li>
  );
}

function StatLine({
  label, value, tone, icon,
}: { label: string; value: number; tone: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 inline-flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
