// src/domains/comercial/pages/LeadsPage.tsx
// Página de leads com disparo em massa.
// v2 (2026-05-04L): redesign UX — banner de campanha, pills de segmento,
// cards de lead, cesta lateral sticky, paginação 50/pg, modal galeria.

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ilikeTerm } from '@/shared/utils/searchUtils';
import { Plus, Loader2, AlertTriangle, Upload, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LEAD_STATUS_CONFIG, getStatusConfig } from '@/shared/constants/status';
import QueryErrorState from '@/shared/components/QueryErrorState';
import { useLeadsDisparo, type LeadsFilterState } from '../hooks/useLeadsDisparo';
import { useLeadsSelection } from '../hooks/useLeadsSelection';
import { CampanhaBanner } from '../components/leads/CampanhaBanner';
import { SegmentoPills } from '../components/leads/SegmentoPills';
import { LeadsFilters } from '../components/leads/LeadsFilters';
import { LeadsCardList } from '../components/leads/LeadsCardList';
import { LeadsCesta } from '../components/leads/LeadsCesta';
import { DispararAberturaModal } from '../components/leads/DispararAberturaModal';
import { ImportWizard } from '@/domains/dados/components/ImportWizard';
import { ExportDialog } from '@/domains/dados/components/ExportDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadDuplicado {
  id: string; empresa: string | null; contato_nome: string | null; status: string;
}

const PAGE_SIZE = 50;
const DEFAULT_FILTERS: LeadsFilterState = { excluirBloqueados: true };

// ─── URL <-> Filtros ─────────────────────────────────────────────────────────

function filtersFromParams(sp: URLSearchParams): LeadsFilterState {
  const get = (k: string) => sp.get(k) ?? undefined;
  const getArr = (k: string) => sp.getAll(k).length > 0 ? sp.getAll(k) : undefined;
  return {
    segmentos:        getArr('seg'),
    subSegmentos:     getArr('sub'),
    status:           getArr('st'),
    temperaturas:     getArr('temp'),
    regioes:          getArr('reg'),
    busca:            get('q'),
    temTelefone:      sp.get('tel') === '1' ? true : sp.get('tel') === '0' ? false : null,
    temEmail:         sp.get('email') === '1' ? true : sp.get('email') === '0' ? false : null,
    emConversaAtiva:  sp.get('conv') === '1' ? true : null,
    excluirBloqueados: sp.get('bloq') !== '0',
    scoreMin:         sp.get('smin') ? Number(sp.get('smin')) : undefined,
    scoreMax:         sp.get('smax') ? Number(sp.get('smax')) : undefined,
    cadastroDe:       get('dde'),
    cadastroAte:      get('date'),
  };
}

function filtersToParams(f: LeadsFilterState, page: number): URLSearchParams {
  const sp = new URLSearchParams();
  f.segmentos?.forEach(v => sp.append('seg', v));
  f.subSegmentos?.forEach(v => sp.append('sub', v));
  f.status?.forEach(v => sp.append('st', v));
  f.temperaturas?.forEach(v => sp.append('temp', v));
  f.regioes?.forEach(v => sp.append('reg', v));
  if (f.busca) sp.set('q', f.busca);
  if (f.temTelefone === true)  sp.set('tel', '1');
  if (f.temTelefone === false) sp.set('tel', '0');
  if (f.temEmail === true)     sp.set('email', '1');
  if (f.temEmail === false)    sp.set('email', '0');
  if (f.emConversaAtiva === true) sp.set('conv', '1');
  if (f.excluirBloqueados === false) sp.set('bloq', '0');
  if (f.scoreMin != null)  sp.set('smin', String(f.scoreMin));
  if (f.scoreMax != null)  sp.set('smax', String(f.scoreMax));
  if (f.cadastroDe)        sp.set('dde', f.cadastroDe);
  if (f.cadastroAte)       sp.set('date', f.cadastroAte);
  if (page > 1) sp.set('page', String(page));
  return sp;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros (URL-persisted)
  const [filters, setFiltersState] = useState<LeadsFilterState>(() =>
    filtersFromParams(searchParams)
  );
  const [page, setPageState] = useState<number>(() => {
    const p = Number(searchParams.get('page') ?? 1);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });

  // Seleção
  const selection = useLeadsSelection();

  const setFilters = useCallback((next: LeadsFilterState) => {
    setFiltersState(next);
    setPageState(1);
    setSearchParams(filtersToParams(next, 1), { replace: true });
    selection.clear();
    // selection.clear é estável (useCallback com [] no useLeadsSelection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchFilters = useCallback((patch: Partial<LeadsFilterState>) => {
    setFilters({ ...filters, ...patch });
  }, [filters, setFilters]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  const setPage = useCallback((next: number) => {
    setPageState(next);
    setSearchParams(filtersToParams(filters, next), { replace: true });
    // Scroll suave pro topo da lista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters, setSearchParams]);

  // Disparo modal
  const [showDisparar, setShowDisparar] = useState(false);

  // Import modal
  const [showImport, setShowImport] = useState(false);

  // Data — paginada
  const { data: pageData, isLoading, isError, refetch } = useLeadsDisparo(
    filters,
    { page, pageSize: PAGE_SIZE }
  );
  const leads = pageData?.data ?? [];
  const totalCount = pageData?.totalCount ?? 0;

  // Cesta — busca dados completos dos selecionados (podem estar em outras páginas)
  const { data: cestaLeads = [] } = useQuery({
    queryKey: ['leads-cesta', Array.from(selection.ids).sort()],
    enabled: selection.count > 0,
    queryFn: async () => {
      const ids = Array.from(selection.ids);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('vw_leads_disparo')
        .select('*')
        .in('id', ids);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // ── New lead dialog ───────────────────────────────────────────────────────
  const [showNewLead, setShowNewLead]               = useState(false);
  const [showConfirmDup, setShowConfirmDup]         = useState(false);
  const [leadsDuplicados, setLeadsDuplicados]       = useState<LeadDuplicado[]>([]);
  const [form, setForm] = useState({
    empresa: '', contato_nome: '', contato_email: '', contato_telefone: '',
    segmento: '', status: 'novo', temperatura: 'frio', valor_estimado: '',
    proximo_contato: '', observacoes: '',
  });

  const verificarDuplicata = useCallback(async (termo: string) => {
    if (!termo || termo.trim().length < 3) return;
    const t = ilikeTerm(termo.trim());
    const { data } = await supabase
      .from('leads').select('id, empresa, contato_nome, status')
      .or(`empresa.ilike.${t},contato_nome.ilike.${t}`).limit(3);
    setLeadsDuplicados((data ?? []) as LeadDuplicado[]);
  }, []);

  const createLead = useMutation({
    mutationFn: async (newLead: typeof form) => {
      const { data, error } = await supabase.from('leads').insert({
        ...newLead,
        valor_estimado: newLead.valor_estimado ? Math.max(0, Number(newLead.valor_estimado)) : null,
        proximo_contato: newLead.proximo_contato || null,
      }).select().single();
      if (error) throw error;
      if (!data) throw new Error('Falha ao criar lead — verifique suas permissões.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-segmento'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-sub'] });
      queryClient.invalidateQueries({ queryKey: ['campanha-status'] });
      showSuccess('Lead criado com sucesso!');
      setShowNewLead(false);
      setLeadsDuplicados([]);
      setForm({ empresa: '', contato_nome: '', contato_email: '', contato_telefone: '',
        segmento: '', status: 'novo', temperatura: 'frio', valor_estimado: '', proximo_contato: '', observacoes: '' });
    },
    onError: (err: any) => showError(err.message || 'Erro ao criar lead'),
  });

  const handleSalvar = () =>
    leadsDuplicados.length > 0 ? setShowConfirmDup(true) : createLead.mutate(form);

  const handleFecharDialog = () => {
    setShowNewLead(false); setLeadsDuplicados([]);
    setForm({ empresa: '', contato_nome: '', contato_email: '', contato_telefone: '',
      segmento: '', status: 'novo', temperatura: 'frio', valor_estimado: '', proximo_contato: '', observacoes: '' });
  };

  // Cesta — derivar segmento principal pra mostrar banner contextual
  const segmentoBanner = useMemo<string>(() => {
    return filters.segmentos?.[0] ?? 'seguranca';
  }, [filters.segmentos]);

  if (isError) return <QueryErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
          <p className="text-sm text-slate-500">
            {totalCount.toLocaleString('pt-BR')} {totalCount === 1 ? 'lead' : 'leads'} no filtro atual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog
            entityKey="leads"
            trigger={
              <Button variant="outline" size="sm">
                <Download size={14} className="mr-1.5" /> Exportar
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1.5" /> Importar
          </Button>
          <Button onClick={() => setShowNewLead(true)} className="bg-blue-600 hover:bg-blue-700" size="sm">
            <Plus size={15} className="mr-1.5" /> Novo lead
          </Button>
        </div>
      </div>

      {/* Banner da campanha em andamento */}
      <CampanhaBanner segmento={segmentoBanner} />

      {/* Pills de segmento + sub-segmento */}
      <SegmentoPills filters={filters} onChange={patchFilters} />

      {/* Busca + filtros avançados */}
      <LeadsFilters filters={filters} onChange={patchFilters} onReset={resetFilters} />

      {/* Layout principal: lista + cesta */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <LeadsCardList
          leads={leads}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          selection={selection}
        />

        <LeadsCesta
          leads={cestaLeads}
          onRemove={(id) => selection.toggle(id)}
          onClear={selection.clear}
          onDisparar={() => setShowDisparar(true)}
          isDisparando={false}
        />
      </div>

      {/* Modal de disparo */}
      <DispararAberturaModal
        open={showDisparar}
        onClose={() => setShowDisparar(false)}
        leads={cestaLeads as any}
        onSuccess={() => { selection.clear(); setShowDisparar(false); }}
      />

      {/* New Lead Dialog */}
      <Dialog open={showNewLead} onOpenChange={open => { if (!open) handleFecharDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="empresa">Empresa *</Label>
              <Input id="empresa" value={form.empresa}
                onChange={e => { setForm({ ...form, empresa: e.target.value }); setLeadsDuplicados([]); }}
                onBlur={e => verificarDuplicata(e.target.value)}
                placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contato_nome">Contato</Label>
                <Input id="contato_nome" value={form.contato_nome}
                  onChange={e => { setForm({ ...form, contato_nome: e.target.value }); setLeadsDuplicados([]); }}
                  onBlur={e => { if (!form.empresa && e.target.value.trim().length >= 3) verificarDuplicata(e.target.value); }}
                  placeholder="Nome do contato" />
              </div>
              <div>
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input id="contato_telefone" value={form.contato_telefone}
                  onChange={e => setForm({ ...form, contato_telefone: e.target.value })}
                  placeholder="(11) 99999-9999" />
              </div>
            </div>
            {leadsDuplicados.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-2">
                  <AlertTriangle size={14} /> Possíveis duplicatas
                </div>
                {leadsDuplicados.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between text-xs text-yellow-600 py-1 border-b border-yellow-100 last:border-0">
                    <span>{lead.empresa ?? lead.contato_nome}{lead.empresa && lead.contato_nome ? ` — ${lead.contato_nome}` : ''}</span>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                      {getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).label}
                    </Badge>
                  </div>
                ))}
                <p className="text-xs text-yellow-500 mt-2">Verifique antes de criar um novo lead.</p>
              </div>
            )}
            <div>
              <Label htmlFor="contato_email">Email</Label>
              <Input id="contato_email" type="email" value={form.contato_email}
                onChange={e => setForm({ ...form, contato_email: e.target.value })}
                placeholder="contato@empresa.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label htmlFor="valor_estimado">Valor estimado</Label>
                <Input id="valor_estimado" type="number" min={0} value={form.valor_estimado}
                  onChange={e => setForm({ ...form, valor_estimado: e.target.value })} placeholder="50000" />
              </div>
            </div>
            <div>
              <Label>Segmento</Label>
              <Select value={form.segmento} onValueChange={v => setForm({ ...form, segmento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {['calcados','varejo','franquia','supermercado','farmacia','academia','restaurante',
                    'concessionaria','shopping','seguranca','outro'].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="proximo_contato">Próximo contato</Label>
              <Input id="proximo_contato" type="datetime-local" value={form.proximo_contato}
                onChange={e => setForm({ ...form, proximo_contato: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" value={form.observacoes}
                onChange={e => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Notas sobre o lead..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleFecharDialog}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={!form.empresa || createLead.isPending}
              className="bg-blue-600 hover:bg-blue-700">
              {createLead.isPending
                ? <><Loader2 size={16} className="animate-spin mr-2" />Salvando...</>
                : 'Criar lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Wizard Dialog */}
      <Dialog open={showImport} onOpenChange={open => { if (!open) setShowImport(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importar leads</DialogTitle></DialogHeader>
          <ImportWizard
            entityKey="leads"
            onClose={() => {
              setShowImport(false);
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
              queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-segmento'] });
              queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-sub'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog confirmação duplicata
          Regra do projeto: AlertDialogAction com mutation async DEVE usar
          e.preventDefault() e fechar manualmente após settle. */}
      <AlertDialog open={showConfirmDup} onOpenChange={setShowConfirmDup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              Possíveis duplicatas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Os seguintes leads com nome/empresa similar já existem:</p>
                <ul className="space-y-1">
                  {leadsDuplicados.map(lead => (
                    <li key={lead.id} className="flex items-center justify-between text-sm bg-yellow-50 px-3 py-1.5 rounded-lg">
                      <span className="font-medium text-slate-700">
                        {lead.empresa ?? lead.contato_nome}
                        {lead.empresa && lead.contato_nome ? ` — ${lead.contato_nome}` : ''}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).color}`}>
                        {getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).label}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-500">Deseja criar um novo lead mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault(); // impede o close automático do Radix
                try {
                  await createLead.mutateAsync(form);
                } finally {
                  setShowConfirmDup(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Criar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
