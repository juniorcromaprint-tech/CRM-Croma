import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Upload,
  Download,
  Users,
  Star,
  Globe,
  Phone,
  MapPin,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useLeads } from '@/domains/comercial/hooks/useLeads';
import { iniciarSequenciaEmail } from '../services/agentEmailService';
import { parseCsvLeads, verificarDuplicatas, type DiscoveredLead } from '../services/leadDiscoveryService';
import {
  useSearchLeads,
  useImportLeads,
  useImportCsvLeads,
  type ParsedCsvLead,
} from '../hooks/useLeadDiscovery';
import { showSuccess, showError } from '@/utils/toast';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value, total }: { value: number | null; total: number | null }) {
  if (value == null) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Star size={12} className="text-amber-400 fill-amber-400" />
      <span className="tabular-nums text-slate-600">{value.toFixed(1)}</span>
      {total != null && (
        <span className="text-slate-400">({total})</span>
      )}
    </span>
  );
}

function DuplicateBadge({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/comercial/leads/${leadId}`)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
    >
      <AlertCircle size={10} />
      Já cadastrado
      <ExternalLink size={10} />
    </button>
  );
}

// ─── Tab 1: Busca Google ──────────────────────────────────────────────────────

function TabBuscaGoogle({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [regiao, setRegiao] = useState('');
  const [maxResultados, setMaxResultados] = useState(20);
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const searchMutation = useSearchLeads();
  const importMutation = useImportLeads();

  const handleSearch = async () => {
    if (!query.trim()) return;
    const data = await searchMutation.mutateAsync({
      query: query.trim(),
      regiao: regiao.trim() || undefined,
      max_resultados: maxResultados,
    });
    setResults(data);
    setSelected(new Set());
  };

  const toggleSelect = (idx: number) => {
    if (results[idx]?.duplicado) return; // cannot select duplicates
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    const validIndices = results
      .map((r, i) => (!r.duplicado ? i : -1))
      .filter((i) => i >= 0);
    if (selected.size === validIndices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(validIndices));
    }
  };

  const handleImport = async () => {
    const toImport = Array.from(selected).map((i) => results[i]);
    if (toImport.length === 0) return;

    await importMutation.mutateAsync(toImport);
    onClose();
  };

  const validCount = results.filter((r) => !r.duplicado).length;
  const allSelected = selected.size > 0 && selected.size === validCount;

  return (
    <div className="space-y-4">
      {/* Search form */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            placeholder='Ex: loja de calçados em São Paulo'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-xl"
          />
          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl"
          >
            {searchMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {searchMutation.isPending ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Região (opcional — Ex: São Paulo, SP)"
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="flex-1 rounded-xl text-sm"
          />
          <Input
            type="number"
            min={1}
            max={60}
            value={maxResultados}
            onChange={(e) => setMaxResultados(Number(e.target.value))}
            className="w-24 rounded-xl text-sm text-center"
            title="Máx. resultados"
          />
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                id="select-all"
                disabled={validCount === 0}
              />
              <label htmlFor="select-all" className="text-sm text-slate-600 cursor-pointer">
                Selecionar todos ({validCount} disponíveis)
              </label>
            </div>
            <span className="text-xs text-slate-400">
              {results.filter((r) => r.duplicado).length} duplicado(s)
            </span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
            {results.map((lead, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${
                  lead.duplicado
                    ? 'bg-slate-50 opacity-60'
                    : selected.has(idx)
                    ? 'bg-blue-50'
                    : 'hover:bg-slate-50 cursor-pointer'
                }`}
                onClick={() => !lead.duplicado && toggleSelect(idx)}
              >
                <Checkbox
                  checked={selected.has(idx)}
                  onCheckedChange={() => toggleSelect(idx)}
                  disabled={!!lead.duplicado}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm truncate ${lead.duplicado ? 'text-slate-400' : 'text-slate-800'}`}>
                      {lead.nome}
                    </span>
                    {lead.duplicado && lead.lead_existente_id && (
                      <DuplicateBadge leadId={lead.lead_existente_id} />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {lead.endereco && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <MapPin size={10} />
                        <span className="truncate max-w-[180px]">{lead.endereco}</span>
                      </span>
                    )}
                    {lead.telefone && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Phone size={10} />
                        {lead.telefone}
                      </span>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                      >
                        <Globe size={10} />
                        Site
                      </a>
                    )}
                    <StarRating value={lead.avaliacao} total={lead.total_avaliacoes} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleImport}
              disabled={selected.size === 0 || importMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl"
            >
              {importMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {importMutation.isPending
                ? 'Importando...'
                : `Importar ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </Button>
          </div>
        </>
      )}

      {results.length === 0 && !searchMutation.isPending && (
        <div className="py-10 text-center">
          <Search size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">
            Busque empresas pelo nome ou segmento
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Importar Lista CSV ────────────────────────────────────────────────

function TabImportarLista({ onClose }: { onClose: () => void }) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<(ParsedCsvLead & { duplicado?: boolean; lead_existente_id?: string })[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const importMutation = useImportCsvLeads();

  const handleParse = useCallback(async () => {
    const parsed = parseCsvLeads(csv);
    if (parsed.length === 0) {
      showError('Nenhum lead encontrado. Verifique o formato.');
      return;
    }
    setIsParsing(true);
    try {
      const discovered = parsed.map((l) => ({
        nome: l.nome,
        endereco: '',
        telefone: l.telefone,
        website: null,
        google_maps_url: null,
        tipos: [],
        avaliacao: null,
        total_avaliacoes: null,
      }));
      const withDedup = await verificarDuplicatas(discovered);
      setPreview(
        parsed.map((p, i) => ({
          ...p,
          duplicado: withDedup[i]?.duplicado,
          lead_existente_id: withDedup[i]?.lead_existente_id,
        }))
      );
    } finally {
      setIsParsing(false);
    }
  }, [csv]);

  const handleImport = async () => {
    const toImport = preview.filter((p) => !p.duplicado);
    if (toImport.length === 0) {
      showError('Todos os leads já estão cadastrados.');
      return;
    }
    await importMutation.mutateAsync(toImport);
    onClose();
  };

  const validCount = preview.filter((p) => !p.duplicado).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">Formato: nome, email, telefone (um por linha)</p>
            <p className="text-xs text-slate-400">A linha de cabeçalho é detectada e ignorada automaticamente.</p>
          </div>
          <a
            href="/modelo-importacao-leads.csv"
            download="modelo-importacao-leads.csv"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
          >
            <Download size={14} />
            Baixar modelo
          </a>
        </div>
      </div>

      <Textarea
        placeholder={'Empresa A, contato@a.com, 11999990000\nEmpresa B, b@empresa.com, 21988887777'}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPreview([]); // reset preview on change
        }}
        rows={6}
        className="rounded-xl font-mono text-sm"
      />

      <Button
        onClick={handleParse}
        disabled={!csv.trim() || isParsing}
        variant="outline"
        className="gap-2 rounded-xl w-full"
      >
        {isParsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isParsing ? 'Verificando...' : 'Pré-visualizar e verificar duplicatas'}
      </Button>

      {preview.length > 0 && (
        <>
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
            {preview.map((lead, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 text-sm ${
                  lead.duplicado ? 'bg-slate-50 opacity-60' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className={`font-medium truncate ${lead.duplicado ? 'text-slate-400' : 'text-slate-800'}`}>
                    {lead.nome}
                  </span>
                  <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                    {lead.email && <span>{lead.email}</span>}
                    {lead.telefone && <span>{lead.telefone}</span>}
                  </div>
                </div>
                {lead.duplicado ? (
                  lead.lead_existente_id ? (
                    <DuplicateBadge leadId={lead.lead_existente_id} />
                  ) : (
                    <Badge variant="secondary" className="text-xs">Duplicado</Badge>
                  )
                ) : (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {validCount} novo{validCount !== 1 ? 's' : ''} ·{' '}
              {preview.length - validCount} duplicado{preview.length - validCount !== 1 ? 's' : ''}
            </span>
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || importMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl"
            >
              {importMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {importMutation.isPending ? 'Importando...' : `Importar (${validCount})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Do CRM ────────────────────────────────────────────────────────────

function TabDoCRM({ onClose }: { onClose: () => void }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'novo' | 'em_contato' | ''>('');
  const [temperaturaFilter, setTemperaturaFilter] = useState<'frio' | 'morno' | ''>('');
  const [isStarting, setIsStarting] = useState(false);

  const { data: allLeads = [], isLoading } = useLeads({
    status: statusFilter || undefined,
    temperatura: temperaturaFilter || undefined,
  });

  // Filter out leads that already have agent conversations (no easy client-side check,
  // so we show all with note that already-running ones will be handled server-side)
  const leads = allLeads.filter(
    (l) => l.status === 'novo' || l.status === 'em_contato'
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const handleIniciarProspeccao = async () => {
    if (selectedIds.size === 0) return;
    setIsStarting(true);
    try {
      const results = await iniciarSequenciaEmail(Array.from(selectedIds));
      const pendentes = results.filter((r) => r.status === 'mensagem_pendente').length;
      const descartados = results.filter((r) => r.status === 'descartado').length;
      const erros = results.filter((r) => r.status.startsWith('erro')).length;
      showSuccess(
        `Prospecção iniciada — ${pendentes} aguardando aprovação${descartados > 0 ? `, ${descartados} descartado(s)` : ''}${erros > 0 ? `, ${erros} erro(s)` : ''}`
      );
      onClose();
    } catch (e) {
      showError('Erro ao iniciar prospecção');
    } finally {
      setIsStarting(false);
    }
  };

  const TEMP_LABELS: Record<string, string> = {
    frio: 'Frio',
    morno: 'Morno',
    quente: 'Quente',
  };

  const TEMP_COLORS: Record<string, string> = {
    frio: 'bg-blue-100 text-blue-700',
    morno: 'bg-amber-100 text-amber-700',
    quente: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'novo' | 'em_contato' | '')}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          <option value="novo">Novo</option>
          <option value="em_contato">Em Contato</option>
        </select>
        <select
          value={temperaturaFilter}
          onChange={(e) => setTemperaturaFilter(e.target.value as 'frio' | 'morno' | '')}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas temperaturas</option>
          <option value="frio">Frio</option>
          <option value="morno">Morno</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-slate-300" />
        </div>
      ) : leads.length === 0 ? (
        <div className="py-8 text-center">
          <Users size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Nenhum lead disponível com os filtros selecionados</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              checked={selectedIds.size === leads.length && leads.length > 0}
              onCheckedChange={toggleAll}
              id="select-all-crm"
            />
            <label htmlFor="select-all-crm" className="text-sm text-slate-600 cursor-pointer">
              Selecionar todos ({leads.length})
            </label>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedIds.has(lead.id) ? 'bg-blue-50' : ''
                }`}
                onClick={() => toggle(lead.id)}
              >
                <Checkbox
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={() => toggle(lead.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{lead.empresa}</p>
                  {lead.contato_nome && (
                    <p className="text-xs text-slate-400 truncate">{lead.contato_nome}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEMP_COLORS[lead.temperatura] ?? 'bg-slate-100 text-slate-500'}`}>
                    {TEMP_LABELS[lead.temperatura] ?? lead.temperatura}
                  </span>
                  {lead.score != null && (
                    <span className="text-xs tabular-nums text-slate-400">{lead.score}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleIniciarProspeccao}
              disabled={selectedIds.size === 0 || isStarting}
              className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl"
            >
              {isStarting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Bot size={16} />
              )}
              {isStarting
                ? 'Iniciando...'
                : `Iniciar Prospecção${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

interface LeadDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LeadDiscoveryDialog({
  open,
  onOpenChange,
}: LeadDiscoveryDialogProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Prospecção</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="google" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google" className="gap-1.5 text-sm">
              <Search size={14} />
              Busca Google
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-1.5 text-sm">
              <Upload size={14} />
              Importar Lista
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-1.5 text-sm">
              <Users size={14} />
              Do CRM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google" className="pt-4">
            <TabBuscaGoogle onClose={handleClose} />
          </TabsContent>

          <TabsContent value="csv" className="pt-4">
            <TabImportarLista onClose={handleClose} />
          </TabsContent>

          <TabsContent value="crm" className="pt-4">
            <TabDoCRM onClose={handleClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
