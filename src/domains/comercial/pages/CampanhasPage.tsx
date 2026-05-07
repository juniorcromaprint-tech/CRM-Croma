// src/domains/comercial/pages/CampanhasPage.tsx
// v3 (2026-05-06 Entrega 3) — opera em agent_campanhas (mestre) com métricas reais.
//
// Regras-chave:
//   - SEM botão de disparo aqui. Disparo é feito EXCLUSIVAMENTE em /leads pelo
//     modal DispararAberturaModal, que vincula via dropdown CampanhaSelector.
//   - Esta página organiza, mede, e direciona o usuário para /leads quando
//     ele quer adicionar mais leads a uma campanha.
//   - Tabela legacy `campanhas` continua viva para retrocompatibilidade, mas
//     esta página NÃO depende dela.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone, Plus, Pause, Play, CheckCircle2, XCircle, ArrowRight,
  TrendingUp, Mail, MessageCircle, Edit2, Loader2, Users, Send, Eye, Reply, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  useCampanhasListagem,
  useAtualizarStatusCampanha,
  useAtualizarCampanhaMeta,
  useLeadsDaCampanha,
  type AgentCampanhaListagem,
  type AgentCampanhaStatus,
} from '../hooks/useAgentCampanhas';
import { QuickCriarCampanhaDialog } from '../components/leads/QuickCriarCampanhaDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AgentCampanhaStatus, { label: string; cls: string; ord: number }> = {
  ativa:      { label: 'Ativa',      cls: 'bg-emerald-100 text-emerald-700', ord: 0 },
  rascunho:   { label: 'Rascunho',   cls: 'bg-amber-100 text-amber-700',     ord: 1 },
  pausada:    { label: 'Pausada',    cls: 'bg-orange-100 text-orange-700',   ord: 2 },
  concluida:  { label: 'Concluída',  cls: 'bg-slate-100 text-slate-600',     ord: 3 },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700',         ord: 4 },
};

const CANAL_ICON: Record<'whatsapp' | 'email' | 'misto', JSX.Element> = {
  whatsapp: <MessageCircle size={11} className="text-emerald-600" />,
  email:    <Mail size={11} className="text-blue-600" />,
  misto:    <Megaphone size={11} className="text-violet-600" />,
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR');
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function pct(num: number, den: number | null | undefined): string {
  if (!den || den <= 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

// ─── Cards de KPI agregado ────────────────────────────────────────────────────

function GlobalKPIs({ list }: { list: AgentCampanhaListagem[] }) {
  const total = list.length;
  const ativas = list.filter(c => c.status === 'ativa').length;
  const totalEnviadas    = list.reduce((s, c) => s + (c.total_enviadas    ?? 0), 0);
  const totalRespondidas = list.reduce((s, c) => s + (c.total_respondidas ?? 0), 0);
  const taxaResp = totalEnviadas > 0 ? Math.round((totalRespondidas / totalEnviadas) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Campanhas"        value={total}          sub={`${ativas} ${ativas === 1 ? 'ativa' : 'ativas'}`} tone="blue" />
      <KPI label="Mensagens enviadas" value={totalEnviadas.toLocaleString('pt-BR')} sub="acumulado" tone="emerald" />
      <KPI label="Respostas"        value={totalRespondidas.toLocaleString('pt-BR')} sub={`taxa ${taxaResp}%`}      tone="violet" />
      <KPI label="Taxa de resposta" value={`${taxaResp}%`} sub="média geral" tone="amber" />
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone: 'blue' | 'emerald' | 'violet' | 'amber' }) {
  const cls =
    tone === 'blue'    ? 'border-blue-100 bg-blue-50' :
    tone === 'emerald' ? 'border-emerald-100 bg-emerald-50' :
    tone === 'violet'  ? 'border-violet-100 bg-violet-50' :
                         'border-amber-100 bg-amber-50';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Card de campanha individual ──────────────────────────────────────────────

function CampanhaCard({
  c,
  onOpen,
  onPausar,
  onAtivar,
  onConcluir,
  onCancelar,
  isMutating,
}: {
  c: AgentCampanhaListagem;
  onOpen: () => void;
  onPausar: () => void;
  onAtivar: () => void;
  onConcluir: () => void;
  onCancelar: () => void;
  isMutating: boolean;
}) {
  const cfg = STATUS_CFG[c.status];
  const enviadas = c.total_enviadas ?? 0;
  const respondidas = c.total_respondidas ?? 0;
  const lidas = c.total_lidas ?? 0;
  const taxaResp = enviadas > 0 ? Math.round((respondidas / enviadas) * 100) : 0;
  const progressoLeads = c.total_alvo && c.total_alvo > 0 ? Math.round(((c.total_leads ?? 0) / c.total_alvo) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              {CANAL_ICON[c.canal] ?? null}
              {c.canal}
            </span>
            {c.data_inicio && (
              <span className="text-[11px] text-slate-400">desde {fmtDate(c.data_inicio)}</span>
            )}
          </div>
          <h3
            className="text-base font-semibold text-slate-800 mt-1.5 cursor-pointer hover:text-blue-600 truncate"
            onClick={onOpen}
            title={c.nome}
          >
            {c.nome}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {c.status === 'ativa' && (
            <Button size="sm" variant="outline" onClick={onPausar} disabled={isMutating} className="gap-1">
              <Pause size={12} /> Pausar
            </Button>
          )}
          {(c.status === 'pausada' || c.status === 'rascunho') && (
            <Button size="sm" onClick={onAtivar} disabled={isMutating} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
              <Play size={12} /> Ativar
            </Button>
          )}
          {(c.status === 'ativa' || c.status === 'pausada') && (
            <Button size="sm" variant="outline" onClick={onConcluir} disabled={isMutating} className="gap-1">
              <CheckCircle2 size={12} /> Concluir
            </Button>
          )}
          {c.status !== 'cancelada' && c.status !== 'concluida' && (
            <Button size="sm" variant="ghost" onClick={onCancelar} disabled={isMutating} className="text-red-600 hover:text-red-700 gap-1">
              <XCircle size={12} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onOpen} className="gap-1">
            <Eye size={12} /> Detalhes
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
        <Metric icon={<Users size={11} />}    label="Leads"        value={c.total_leads ?? 0} sub={c.total_alvo ? `de ${c.total_alvo}` : undefined} />
        <Metric icon={<Send size={11} />}     label="Enviadas"     value={enviadas} />
        <Metric icon={<Eye size={11} />}      label="Lidas"        value={lidas} sub={enviadas ? pct(lidas, enviadas) : undefined} />
        <Metric icon={<Reply size={11} />}    label="Respondidas"  value={respondidas} sub={enviadas ? `${taxaResp}%` : undefined} />
        <Metric icon={<AlertTriangle size={11} />} label="Erros" value={c.total_erros ?? 0} tone="red" />
      </div>

      {/* Barra de progresso de leads */}
      {c.total_alvo && c.total_alvo > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Progresso da meta</span>
            <span>{progressoLeads}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(progressoLeads, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; tone?: 'red' }) {
  const valueCls = tone === 'red' && Number(value) > 0 ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1">{icon} {label}</div>
      <div className={`text-base font-semibold mt-0.5 ${valueCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 -mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Sheet de detalhes da campanha ────────────────────────────────────────────

function CampanhaDetailsSheet({
  campanha, onClose,
}: { campanha: AgentCampanhaListagem | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [nome, setNome] = useState('');
  const [totalAlvo, setTotalAlvo] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const atualizar = useAtualizarCampanhaMeta();
  const { data: leads = [], isLoading: loadingLeads } = useLeadsDaCampanha(campanha?.id ?? null);

  if (!campanha) return null;

  const startEdit = () => {
    setNome(campanha.nome);
    setTotalAlvo(campanha.total_alvo?.toString() ?? '');
    setDataFim(campanha.data_fim ?? '');
    setEditMode(true);
  };

  const handleSave = async () => {
    await atualizar.mutateAsync({
      id: campanha.id,
      nome,
      total_alvo: totalAlvo === '' ? null : Number(totalAlvo),
      data_fim: dataFim || null,
    });
    setEditMode(false);
  };

  const enviadas = campanha.total_enviadas ?? 0;
  const respondidas = campanha.total_respondidas ?? 0;

  return (
    <Sheet open={!!campanha} onOpenChange={(o) => { if (!o) { setEditMode(false); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Megaphone size={18} className="text-blue-600" />
            {editMode ? 'Editar campanha' : campanha.nome}
          </SheetTitle>
        </SheetHeader>

        {/* Bloco editável (nome, total_alvo, data_fim) */}
        {editMode ? (
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="ed-nome" className="text-xs uppercase text-slate-500 tracking-wide">Nome</Label>
              <Input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-meta" className="text-xs uppercase text-slate-500 tracking-wide">Meta de leads</Label>
                <Input id="ed-meta" type="number" min="0" value={totalAlvo} onChange={(e) => setTotalAlvo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ed-fim" className="text-xs uppercase text-slate-500 tracking-wide">Data fim</Label>
                <Input id="ed-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={atualizar.isPending} className="bg-blue-600 hover:bg-blue-700">
                {atualizar.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 text-sm space-y-1">
            <Row label="Status"  value={STATUS_CFG[campanha.status].label} />
            <Row label="Canal"   value={campanha.canal} />
            <Row label="Início"  value={fmtDate(campanha.data_inicio)} />
            <Row label="Fim"     value={fmtDate(campanha.data_fim)} />
            <Row label="Meta"    value={campanha.total_alvo ? `${campanha.total_alvo} leads` : '—'} />
            <Row label="Criada"  value={fmtDateTime(campanha.created_at)} />
            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={startEdit} className="gap-1">
                <Edit2 size={12} /> Editar
              </Button>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Metric icon={<Users size={11} />}   label="Leads"       value={campanha.total_leads ?? 0} />
          <Metric icon={<Send size={11} />}    label="Enviadas"    value={enviadas} />
          <Metric icon={<Eye size={11} />}     label="Lidas"       value={campanha.total_lidas ?? 0} sub={enviadas ? pct(campanha.total_lidas ?? 0, enviadas) : undefined} />
          <Metric icon={<Reply size={11} />}   label="Respondidas" value={respondidas} sub={enviadas ? pct(respondidas, enviadas) : undefined} />
        </div>

        <Tabs defaultValue="leads">
          <TabsList className="w-full mb-3">
            <TabsTrigger value="leads" className="flex-1">
              <Users size={13} className="mr-1.5" /> Leads vinculados ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="acoes" className="flex-1">
              <ArrowRight size={13} className="mr-1.5" /> Como adicionar leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            {loadingLeads ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
                <Loader2 size={14} className="animate-spin" /> Carregando leads...
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600 text-sm">Nenhum lead vinculado ainda</p>
                <p className="text-xs text-slate-400 mt-1">Vá para /leads, selecione e dispare vinculando esta campanha.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {leads.map((l) => (
                  <div key={l.conversation_id} className="bg-white rounded-xl border border-slate-200 p-3 text-sm flex items-center justify-between hover:border-slate-300 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">{l.empresa ?? l.contato_nome ?? '(sem nome)'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        {l.contato_nome && l.empresa && <span>{l.contato_nome}</span>}
                        {l.cidade && <span>· {l.cidade}</span>}
                        <span className="text-slate-400">· última msg {fmtDateTime(l.ultima_mensagem_em)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/leads?lead=${l.lead_id}`)} className="shrink-0">
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="acoes">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm space-y-3">
              <p className="text-slate-700">
                Para adicionar leads a esta campanha, vá para a aba <strong>Leads</strong>:
              </p>
              <ol className="list-decimal list-inside text-slate-600 space-y-1.5 text-sm">
                <li>Filtrar e selecionar os leads desejados.</li>
                <li>Clicar em "Disparar mensagem de abertura".</li>
                <li>No passo <strong>Cadência</strong>, escolher esta campanha no dropdown "Vincular a campanha".</li>
                <li>Disparar.</li>
              </ol>
              <Button onClick={() => navigate('/leads')} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto gap-2">
                Ir para /leads <ArrowRight size={14} />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const { data: campanhas = [], isLoading } = useCampanhasListagem();
  const atualizarStatus = useAtualizarStatusCampanha();
  const [createOpen, setCreateOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<AgentCampanhaListagem | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ id: string; status: AgentCampanhaStatus; titulo: string; descricao: string } | null>(null);

  const ordenadas = useMemo(() => {
    return [...campanhas].sort((a, b) => {
      const ordA = STATUS_CFG[a.status].ord;
      const ordB = STATUS_CFG[b.status].ord;
      if (ordA !== ordB) return ordA - ordB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [campanhas]);

  const handleStatusChange = async (id: string, status: AgentCampanhaStatus) => {
    await atualizarStatus.mutateAsync({ id, status });
    setConfirmacao(null);
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone size={22} className="text-blue-600" />
            Campanhas
          </h1>
          <p className="text-sm text-slate-500">
            Organize disparos por campanha e meça o que rende. Disparo é feito em /leads.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus size={15} /> Nova campanha
        </Button>
      </div>

      {/* KPIs globais */}
      {!isLoading && campanhas.length > 0 && <GlobalKPIs list={campanhas} />}

      {/* Listagem */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-slate-300" />
          <p className="text-sm text-slate-400 mt-2">Carregando campanhas...</p>
        </div>
      ) : ordenadas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Sem campanhas ainda</h3>
          <p className="text-sm text-slate-400 mt-1">Crie sua primeira campanha para começar a medir.</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus size={14} /> Criar primeira campanha
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenadas.map((c) => (
            <CampanhaCard
              key={c.id}
              c={c}
              onOpen={() => setSelecionada(c)}
              onPausar={()  => setConfirmacao({ id: c.id, status: 'pausada',   titulo: 'Pausar campanha?',   descricao: 'Disparos novos não poderão ser vinculados a essa campanha enquanto ela estiver pausada. Mensagens já criadas continuam tramitando normalmente.' })}
              onAtivar={()  => setConfirmacao({ id: c.id, status: 'ativa',     titulo: 'Ativar campanha?',   descricao: 'A campanha volta a aceitar disparos novos.' })}
              onConcluir={() => setConfirmacao({ id: c.id, status: 'concluida', titulo: 'Concluir campanha?', descricao: 'Marca a campanha como finalizada. Não bloqueia o histórico nem as métricas.' })}
              onCancelar={() => setConfirmacao({ id: c.id, status: 'cancelada', titulo: 'Cancelar campanha?', descricao: 'A campanha some da listagem ativa. Vínculos existentes em mensagens são preservados.' })}
              isMutating={atualizarStatus.isPending}
            />
          ))}
        </div>
      )}

      {/* Dialog de criação rápida (reaproveita Entrega 1) */}
      <QuickCriarCampanhaDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        canalSugerido="whatsapp"
        onCreated={() => { /* refetch via invalidação no hook */ }}
      />

      {/* Sheet de detalhes */}
      <CampanhaDetailsSheet campanha={selecionada} onClose={() => setSelecionada(null)} />

      {/* Confirmação de mudança de status */}
      <AlertDialog open={!!confirmacao} onOpenChange={(o) => { if (!o) setConfirmacao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacao?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>{confirmacao?.descricao}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={atualizarStatus.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={atualizarStatus.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (confirmacao) await handleStatusChange(confirmacao.id, confirmacao.status);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {atualizarStatus.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Re-export nomeado para compat com imports antigos (caso alguém faça named import)
export { CampanhasPage };
