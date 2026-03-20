// ============================================================================
// AGENT CONFIG PAGE — Croma Print ERP/CRM
// Configurações do Agente de Vendas: Geral, Modelos IA, Templates
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAIModels } from '@/domains/ai/hooks/useAIModels';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  Bot,
  Settings,
  Brain,
  FileText,
  Save,
  Loader2,
  Plus,
  Edit2,
  Check,
  X,
  MessageCircle,
  Copy,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import type { AgentConfig, AgentTemplate, AgentCanal } from '../types/agent.types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  max_contatos_dia: 20,
  horario_inicio: '08:00',
  horario_fim: '18:00',
  dias_entre_followup: 3,
  max_tentativas: 5,
  canais_ativos: ['email'],
  segmentos_ativos: ['varejo', 'franquia', 'industria', 'servicos'],
  tom: 'consultivo',
  modelo_qualificacao: 'openai/gpt-4.1-mini',
  modelo_composicao: 'openai/gpt-4.1-mini',
  modelo_fallback: 'openai/gpt-4.1-mini',
  email_remetente: 'comercial@cromaprint.com.br',
  nome_remetente: 'Croma Print',
};

const CANAIS: { value: AgentCanal; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const SEGMENTOS = [
  { value: 'varejo', label: 'Varejo' },
  { value: 'franquia', label: 'Franquia' },
  { value: 'industria', label: 'Indústria' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'governo', label: 'Governo' },
];

const TONS = [
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'direto', label: 'Direto' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'tecnico', label: 'Técnico' },
];

// ─── Tab 1: Configurações Gerais ──────────────────────────────────────────────

function TabGeralConfig() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['agent_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'agent_config')
        .maybeSingle();
      if (error) throw error;
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor) as Partial<AgentConfig>;
          setConfig((prev) => ({ ...prev, ...parsed }));
          return parsed;
        } catch {
          return null;
        }
      }
      return null;
    },
  });

  useQuery({
    queryKey: ['whatsapp_config_check'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'whatsapp_config')
        .maybeSingle();
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor) as Record<string, string>;
          setWhatsappConfigured(!!parsed.phone_number_id);
        } catch {
          setWhatsappConfigured(false);
        }
      }
      return null;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_config')
        .upsert({ chave: 'agent_config', valor: JSON.stringify(config) }, { onConflict: 'chave' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_config'] });
      showSuccess('Configurações do agente salvas!');
    },
    onError: () => showError('Erro ao salvar configurações.'),
  });

  function toggleCanal(canal: AgentCanal) {
    setConfig((prev) => {
      const active = prev.canais_ativos.includes(canal)
        ? prev.canais_ativos.filter((c) => c !== canal)
        : [...prev.canais_ativos, canal];
      return { ...prev, canais_ativos: active };
    });
  }

  function toggleSegmento(seg: string) {
    setConfig((prev) => {
      const active = prev.segmentos_ativos.includes(seg)
        ? prev.segmentos_ativos.filter((s) => s !== seg)
        : [...prev.segmentos_ativos, seg];
      return { ...prev, segmentos_ativos: active };
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Limites de operação */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Limites de Operação</CardTitle>
            </div>
            <CardDescription>Controles de volume e cadência do agente (vale para todos os canais: WhatsApp, Email, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Máximo de Contatos por Dia</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={config.max_contatos_dia}
                onChange={(e) => setConfig((p) => ({ ...p, max_contatos_dia: parseInt(e.target.value, 10) || 20 }))}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Horário Início</Label>
                <Input
                  type="time"
                  value={config.horario_inicio}
                  onChange={(e) => setConfig((p) => ({ ...p, horario_inicio: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Horário Fim</Label>
                <Input
                  type="time"
                  value={config.horario_fim}
                  onChange={(e) => setConfig((p) => ({ ...p, horario_fim: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Dias entre Follow-ups</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={config.dias_entre_followup}
                  onChange={(e) => setConfig((p) => ({ ...p, dias_entre_followup: parseInt(e.target.value, 10) || 3 }))}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Máximo de Tentativas</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.max_tentativas}
                  onChange={(e) => setConfig((p) => ({ ...p, max_tentativas: parseInt(e.target.value, 10) || 5 }))}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identidade e tom */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Identidade do Agente</CardTitle>
            </div>
            <CardDescription>Como o agente se apresenta e se comunica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Nome do Remetente</Label>
              <Input
                value={config.nome_remetente}
                onChange={(e) => setConfig((p) => ({ ...p, nome_remetente: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="Croma Print"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">E-mail do Remetente</Label>
              <Input
                type="email"
                value={config.email_remetente}
                onChange={(e) => setConfig((p) => ({ ...p, email_remetente: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="comercial@cromaprint.com.br"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Tom de Comunicação</Label>
              <Select
                value={config.tom}
                onValueChange={(v) => setConfig((p) => ({ ...p, tom: v }))}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o tom" />
                </SelectTrigger>
                <SelectContent>
                  {TONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Canais ativos */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-800 text-base">Canais Ativos</CardTitle>
            <CardDescription>Meios de comunicação habilitados para o agente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {CANAIS.map((canal) => {
                const isWhatsApp = canal.value === 'whatsapp';
                const isDisabled = isWhatsApp && !whatsappConfigured;
                return (
                  <div key={canal.value} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label
                        className={`font-medium ${isDisabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'}`}
                        htmlFor={`canal-${canal.value}`}
                      >
                        {canal.label}
                      </Label>
                      {isDisabled && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">
                          Configure na aba WhatsApp primeiro
                        </span>
                      )}
                    </div>
                    <Switch
                      id={`canal-${canal.value}`}
                      checked={config.canais_ativos.includes(canal.value)}
                      onCheckedChange={() => !isDisabled && toggleCanal(canal.value)}
                      disabled={isDisabled}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Segmentos ativos */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-800 text-base">Segmentos Ativos</CardTitle>
            <CardDescription>Segmentos de mercado que o agente deve prospectar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {SEGMENTOS.map((seg) => (
                <div key={seg.value} className="flex items-center justify-between">
                  <Label className="text-slate-700 font-medium cursor-pointer" htmlFor={`seg-${seg.value}`}>
                    {seg.label}
                  </Label>
                  <Switch
                    id={`seg-${seg.value}`}
                    checked={config.segmentos_ativos.includes(seg.value)}
                    onCheckedChange={() => toggleSegmento(seg.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => saveConfig.mutate()}
        disabled={saveConfig.isPending}
        className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
      >
        {saveConfig.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Tab 2: Modelos IA ─────────────────────────────────────────────────────────

function TabModelosIA() {
  const queryClient = useQueryClient();
  const { models, isLoading: modelsLoading } = useAIModels();

  const { data: agentConfigData, isLoading: configLoading } = useQuery({
    queryKey: ['agent_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'agent_config')
        .maybeSingle();
      if (error) throw error;
      if (data?.valor) {
        try {
          return JSON.parse(data.valor) as Partial<AgentConfig>;
        } catch {
          return null;
        }
      }
      return null;
    },
  });

  const [modeloQual, setModeloQual] = useState('');
  const [modeloComp, setModeloComp] = useState('');
  const [modeloFallback, setModeloFallback] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Sync state from query data once loaded
  useEffect(() => {
    if (agentConfigData && !initialized) {
      setModeloQual(agentConfigData.modelo_qualificacao ?? 'openai/gpt-4.1-mini');
      setModeloComp(agentConfigData.modelo_composicao ?? 'openai/gpt-4.1-mini');
      setModeloFallback(agentConfigData.modelo_fallback ?? 'openai/gpt-4.1-mini');
      setInitialized(true);
    }
  }, [agentConfigData, initialized]);

  const saveModelos = useMutation({
    mutationFn: async () => {
      // Load current config and merge
      const { data } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'agent_config')
        .maybeSingle();

      let current: Partial<AgentConfig> = {};
      if (data?.valor) {
        try { current = JSON.parse(data.valor); } catch { /* ignore */ }
      }

      const updated = { ...current, modelo_qualificacao: modeloQual, modelo_composicao: modeloComp, modelo_fallback: modeloFallback };
      const { error } = await supabase
        .from('admin_config')
        .upsert({ chave: 'agent_config', valor: JSON.stringify(updated) }, { onConflict: 'chave' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_config'] });
      showSuccess('Modelos IA salvos!');
    },
    onError: () => showError('Erro ao salvar modelos.'),
  });

  if (modelsLoading || configLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando modelos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-slate-800 text-base">Modelos de Inteligência Artificial</CardTitle>
          </div>
          <CardDescription>
            Modelos usados nas etapas de qualificação de leads e composição de mensagens.
            Configure os modelos disponíveis em <strong>Admin → Configurações → Inteligência Artificial</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Modelo de Qualificação</Label>
            <p className="text-xs text-slate-400">Usado para analisar leads e determinar score e próxima ação</p>
            <Select value={modeloQual} onValueChange={setModeloQual}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    <span>{m.label}</span>
                    {m.free && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Free</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Modelo de Composição</Label>
            <p className="text-xs text-slate-400">Usado para redigir mensagens de prospecção e follow-ups</p>
            <Select value={modeloComp} onValueChange={setModeloComp}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    <span>{m.label}</span>
                    {m.free && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Free</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Modelo de Fallback</Label>
            <p className="text-xs text-slate-400">Usado automaticamente se o modelo principal falhar (ex: modelo gratuito indisponível)</p>
            <Select value={modeloFallback} onValueChange={setModeloFallback}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione o modelo de fallback" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    <span>{m.label}</span>
                    {m.free && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Free</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Informação de custo</p>
            <p>Cada qualificação de lead realiza 1 chamada ao modelo de qualificação.</p>
            <p>Cada mensagem composta realiza 1 chamada ao modelo de composição.</p>
            <p>Se o modelo principal falhar, o sistema usa o <strong>modelo de fallback</strong> automaticamente.</p>
            <p>Modelos marcados como <strong>Free</strong> não geram custo no OpenRouter.</p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveModelos.mutate()}
        disabled={saveModelos.isPending}
        className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
      >
        {saveModelos.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Modelos
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Tab 3: Templates ─────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: AgentTemplate;
  onToggle: (id: string, ativo: boolean) => void;
  onEdit: (t: AgentTemplate) => void;
  isUpdating: boolean;
}

function TemplateRow({ template, onToggle, onEdit, isUpdating }: TemplateRowProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{template.nome}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {template.etapa}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">
            {template.canal}
          </Badge>
          {template.segmento && (
            <span className="text-xs text-slate-400">{template.segmento}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Usado {template.vezes_usado}x · Taxa de resposta: {Math.round(template.taxa_resposta * 100)}%
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Switch
          checked={template.ativo}
          onCheckedChange={(v) => onToggle(template.id, v)}
          disabled={isUpdating}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(template)}
          className="h-8 text-xs gap-1"
        >
          <Edit2 size={12} />
          Editar
        </Button>
      </div>
    </div>
  );
}

interface EditTemplateFormProps {
  template: AgentTemplate | null;
  onClose: () => void;
  onSave: (id: string | null, data: Partial<AgentTemplate>) => void;
  isSaving: boolean;
}

function EditTemplateForm({ template, onClose, onSave, isSaving }: EditTemplateFormProps) {
  const [nome, setNome] = useState(template?.nome ?? '');
  const [assunto, setAssunto] = useState(template?.assunto ?? '');
  const [conteudo, setConteudo] = useState(template?.conteudo ?? '');

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-700 text-sm">
        {template ? `Editando: ${template.nome}` : 'Novo Template'}
      </h3>

      <div className="space-y-1.5">
        <Label className="text-slate-700 text-sm font-medium">Nome do Template</Label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-9 rounded-xl text-sm"
          placeholder="Ex: Abertura Varejo Email"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-700 text-sm font-medium">Assunto (para email)</Label>
        <Input
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          className="h-9 rounded-xl text-sm"
          placeholder="Ex: Parceria Croma Print — {{empresa}}"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-700 text-sm font-medium">Conteúdo</Label>
        <Textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="rounded-xl text-sm min-h-[120px] resize-y"
          placeholder="Conteúdo do template. Use {{variavel}} para campos dinâmicos."
        />
        <p className="text-xs text-slate-400">Variáveis disponíveis: {'{{empresa}}'}, {'{{contato}}'}, {'{{segmento}}'}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onSave(template?.id ?? null, { nome, assunto, conteudo })}
          disabled={isSaving || !nome.trim() || !conteudo.trim()}
          className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
        >
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-8 text-xs gap-1"
          disabled={isSaving}
        >
          <X size={12} />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function TabTemplates() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null | undefined>(undefined);
  // undefined = closed, null = new template, AgentTemplate = editing existing

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['agent_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_templates')
        .select('*')
        .order('etapa')
        .order('nome');
      if (error) throw new Error(error.message);
      return (data ?? []) as AgentTemplate[];
    },
  });

  const toggleTemplate = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('agent_templates')
        .update({ ativo })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_templates'] });
      showSuccess('Template atualizado!');
    },
    onError: () => showError('Erro ao atualizar template.'),
  });

  const saveTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: Partial<AgentTemplate> }) => {
      if (id) {
        const { error } = await supabase
          .from('agent_templates')
          .update(data)
          .eq('id', id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('agent_templates')
          .insert({
            nome: data.nome ?? '',
            canal: 'email' as AgentCanal,
            etapa: 'abertura',
            conteudo: data.conteudo ?? '',
            assunto: data.assunto ?? null,
            variaveis: [],
            ativo: true,
            vezes_usado: 0,
            taxa_resposta: 0,
          });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_templates'] });
      setEditingTemplate(undefined);
      showSuccess('Template salvo!');
    },
    onError: () => showError('Erro ao salvar template.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
        </p>
        <Button
          size="sm"
          onClick={() => setEditingTemplate(null)}
          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
        >
          <Plus size={13} />
          Novo Template
        </Button>
      </div>

      {editingTemplate === null && (
        <EditTemplateForm
          template={null}
          onClose={() => setEditingTemplate(undefined)}
          onSave={(id, data) => saveTemplate.mutate({ id, data })}
          isSaving={saveTemplate.isPending}
        />
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum template cadastrado</h3>
          <p className="text-sm text-slate-400 mt-1">Clique em &quot;Novo Template&quot; para criar o primeiro.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {templates.map((t) => (
            <div key={t.id}>
              <TemplateRow
                template={t}
                onToggle={(id, ativo) => toggleTemplate.mutate({ id, ativo })}
                onEdit={(tmpl) => setEditingTemplate(tmpl)}
                isUpdating={toggleTemplate.isPending}
              />
              {editingTemplate?.id === t.id && (
                <div className="px-5 pb-5">
                  <EditTemplateForm
                    template={t}
                    onClose={() => setEditingTemplate(undefined)}
                    onSave={(id, data) => saveTemplate.mutate({ id, data })}
                    isSaving={saveTemplate.isPending}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: WhatsApp ──────────────────────────────────────────────────────────

const WEBHOOK_URL = 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook';

interface WhatsAppConfig {
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  app_secret: string;
  template_abertura: string;
  max_whatsapp_dia: number;
  horario_whatsapp_inicio: string;
  horario_whatsapp_fim: string;
}

const DEFAULT_WA_CONFIG: WhatsAppConfig = {
  phone_number_id: '',
  access_token: '',
  verify_token: '',
  app_secret: '',
  template_abertura: 'croma_abertura',
  max_whatsapp_dia: 50,
  horario_whatsapp_inicio: '08:00',
  horario_whatsapp_fim: '18:00',
};

function TabWhatsApp() {
  const queryClient = useQueryClient();
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>(DEFAULT_WA_CONFIG);
  const [copied, setCopied] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['whatsapp_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'whatsapp_config')
        .maybeSingle();
      if (error) throw error;
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor) as Partial<WhatsAppConfig>;
          setWaConfig((prev) => ({ ...prev, ...parsed }));
          return parsed;
        } catch {
          return null;
        }
      }
      return null;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_config')
        .upsert({ chave: 'whatsapp_config', valor: JSON.stringify(waConfig) }, { onConflict: 'chave' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp_config_check'] });
      showSuccess('Configurações do WhatsApp salvas!');
    },
    onError: () => showError('Erro ao salvar configurações do WhatsApp.'),
  });

  function handleCopy() {
    navigator.clipboard.writeText(WEBHOOK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isConnected = !!waConfig.phone_number_id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Section 1: Conexão */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Conexão</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Conectado</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-red-500">Não conectado</span>
                </>
              )}
            </div>
          </div>
          <CardDescription>Credenciais da API do WhatsApp Business (Meta)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Phone Number ID (Meta Business)</Label>
            <Input
              value={waConfig.phone_number_id}
              onChange={(e) => setWaConfig((p) => ({ ...p, phone_number_id: e.target.value }))}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="Ex: 123456789012345"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Access Token (Meta)</Label>
            <Input
              type="password"
              value={waConfig.access_token}
              onChange={(e) => setWaConfig((p) => ({ ...p, access_token: e.target.value }))}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="EAAxxxxxxxxxxxxxxx"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Verify Token (para webhook)</Label>
            <Input
              value={waConfig.verify_token}
              onChange={(e) => setWaConfig((p) => ({ ...p, verify_token: e.target.value }))}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="Token secreto que você define"
            />
            <p className="text-xs text-slate-400">Token definido por você para verificação do webhook no Meta.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">App Secret (validação webhook)</Label>
            <Input
              type="password"
              value={waConfig.app_secret}
              onChange={(e) => setWaConfig((p) => ({ ...p, app_secret: e.target.value }))}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="App Secret do seu app no Meta"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Webhook URL */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 text-base">URL do Webhook</CardTitle>
          <CardDescription>Configure esta URL como webhook no Meta Business Suite. Eventos: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">messages</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={WEBHOOK_URL}
              className="h-11 rounded-xl font-mono text-xs bg-slate-50 text-slate-600"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-11 px-3 rounded-xl shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="text-xs">Copiar</span>
                </>
              )}
            </Button>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Como configurar no Meta Business Suite:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Acesse o painel do seu app em <strong>developers.facebook.com</strong></li>
              <li>Vá em <strong>WhatsApp → Configuração</strong></li>
              <li>Cole a URL acima no campo <strong>URL de Callback</strong></li>
              <li>Informe o mesmo <strong>Verify Token</strong> configurado acima</li>
              <li>Inscreva-se no evento <strong>messages</strong></li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Templates Meta */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 text-base">Templates Meta</CardTitle>
          <CardDescription>
            Templates devem ser aprovados no Meta Business Suite antes de usar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            Crie e submeta templates para aprovação em <strong>business.facebook.com → Conta WhatsApp Business → Modelos de mensagem</strong>. O processo de aprovação pode levar até 24h.
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Template de Abertura</Label>
            <Input
              value={waConfig.template_abertura}
              onChange={(e) => setWaConfig((p) => ({ ...p, template_abertura: e.target.value }))}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="croma_abertura"
            />
            <p className="text-xs text-slate-400">Nome exato do template aprovado no Meta para a primeira mensagem de contato.</p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveConfig.mutate()}
        disabled={saveConfig.isPending}
        className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
      >
        {saveConfig.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações WhatsApp
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentConfigPage() {
  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Bot className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configurações do Agente</h1>
          <p className="text-sm text-slate-500">
            Parâmetros do agente autônomo de prospecção e vendas
          </p>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="geral">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1">
          <TabsTrigger
            value="geral"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Settings className="h-4 w-4 mr-1.5" />
            Configurações Gerais
          </TabsTrigger>
          <TabsTrigger
            value="modelos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Brain className="h-4 w-4 mr-1.5" />
            Modelos IA
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <TabGeralConfig />
        </TabsContent>

        <TabsContent value="modelos" className="mt-6">
          <TabModelosIA />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TabTemplates />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <TabWhatsApp />
        </TabsContent>
      </Tabs>
    </div>
  );
}
