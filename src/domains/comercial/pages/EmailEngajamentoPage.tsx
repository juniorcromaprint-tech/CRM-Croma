// src/domains/comercial/pages/EmailEngajamentoPage.tsx
// Painel consolidado de engajamento de email — todas as msgs, todos os opens/clicks/bounces
// num só lugar. Filtros por período + tipo de evento. Click no lead abre detalhe.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Mail, Inbox, MailOpen, MousePointerClick, AlertTriangle, ShieldAlert, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { EmailStatusBadge } from '@/components/ui/email-status-badge';
import type { EmailEngajamentoRow } from '../hooks/useEmailEngajamento';

type Periodo = '24h' | '7d' | '30d';
type Filtro = 'todos' | 'abertos' | 'cliques' | 'bounces' | 'sem_abertura';

const PERIODO_HORAS: Record<Periodo, number> = { '24h': 24, '7d': 168, '30d': 720 };

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

/** Hook query única: pega TODAS as msgs do período + agregados. */
function useEngajamentoTabela(periodo: Periodo) {
  return useQuery({
    queryKey: ['email-engajamento-tabela', periodo],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<EmailEngajamentoRow[]> => {
      const horas = PERIODO_HORAS[periodo];
      const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('vw_email_engajamento_leads')
        .select('*')
        .gte('data_envio', desde)
        .order('ultimo_evento_em', { ascending: false, nullsFirst: false })
        .order('data_envio', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailEngajamentoRow[];
    },
  });
}

function ultimoStatus(row: EmailEngajamentoRow): 'clicked' | 'opened' | 'bounced' | 'complained' | 'delivered' | 'enviada' | null {
  if (row.clicou_em) return 'clicked';
  if (row.abriu_em) return 'opened';
  if (row.bounced_em) return 'bounced';
  if (row.reclamado_em) return 'complained';
  if (row.entregue_em) return 'delivered';
  if (row.enviado_em) return 'enviada';
  return null;
}

function MetricCard({ label, value, color, Icon }: { label: string; value: number; color: string; Icon: any }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

export default function EmailEngajamentoPage() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const { data: rows = [], isLoading } = useEngajamentoTabela(periodo);

  // Métricas agregadas
  const stats = useMemo(() => ({
    enviados: rows.filter(r => r.enviado_em).length,
    entregues: rows.filter(r => r.entregue_em).length,
    abertos: rows.filter(r => r.abriu_em).length,
    cliques: rows.filter(r => r.clicou_em).length,
    bounces: rows.filter(r => r.bounced_em).length,
    reclamados: rows.filter(r => r.reclamado_em).length,
    total_opens: rows.reduce((s, r) => s + (r.qtd_opens ?? 0), 0),
    total_clicks: rows.reduce((s, r) => s + (r.qtd_clicks ?? 0), 0),
  }), [rows]);

  const taxaAbertura = stats.entregues > 0 ? ((stats.abertos / stats.entregues) * 100).toFixed(1) : '—';
  const taxaClique = stats.abertos > 0 ? ((stats.cliques / stats.abertos) * 100).toFixed(1) : '—';

  // Filtra rows pela aba
  const linhas = useMemo(() => {
    switch (filtro) {
      case 'abertos':       return rows.filter(r => r.abriu_em);
      case 'cliques':       return rows.filter(r => r.clicou_em);
      case 'bounces':       return rows.filter(r => r.bounced_em);
      case 'sem_abertura':  return rows.filter(r => r.entregue_em && !r.abriu_em);
      default:              return rows;
    }
  }, [rows, filtro]);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail size={22} className="text-blue-600" /> Engajamento de email
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Quem abriu, clicou, deu bounce. Atualizado em tempo real via webhook do Resend.
        </p>
      </div>

      {/* Filtro de período */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Período:</span>
        {(['24h', '7d', '30d'] as Periodo[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              periodo === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p === '24h' ? 'Últimas 24h' : p === '7d' ? '7 dias' : '30 dias'}
          </button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Enviados"  value={stats.enviados}  color="bg-slate-400" Icon={Send} />
        <MetricCard label="Entregues" value={stats.entregues} color="bg-blue-500"  Icon={Inbox} />
        <MetricCard label="Abertos"   value={stats.abertos}   color="bg-emerald-500" Icon={MailOpen} />
        <MetricCard label="Cliques"   value={stats.cliques}   color="bg-emerald-700" Icon={MousePointerClick} />
        <MetricCard label="Bounces"   value={stats.bounces}   color="bg-red-500"   Icon={AlertTriangle} />
        <MetricCard label="Reclamou"  value={stats.reclamados} color="bg-purple-500" Icon={ShieldAlert} />
      </div>

      {/* Taxas */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 text-sm flex flex-wrap gap-x-6 gap-y-2 text-blue-900">
        <span><strong>Taxa entrega:</strong> {stats.enviados > 0 ? ((stats.entregues / stats.enviados) * 100).toFixed(1) : '—'}%</span>
        <span><strong>Taxa abertura:</strong> {taxaAbertura}%</span>
        <span><strong>Taxa clique:</strong> {taxaClique}%</span>
        <span className="ml-auto text-blue-700">
          Total opens: <strong>{stats.total_opens}</strong> · Total clicks: <strong>{stats.total_clicks}</strong>
        </span>
      </div>

      {/* Tabs de filtro */}
      <div className="flex items-center gap-2 border-b border-slate-200 -mb-px overflow-x-auto">
        {([
          ['todos',        `Todos (${rows.length})`],
          ['abertos',      `📧 Abriram (${stats.abertos})`],
          ['cliques',      `🎯 Clicaram (${stats.cliques})`],
          ['bounces',      `⚠️ Bounce (${stats.bounces})`],
          ['sem_abertura', `Sem abertura (${stats.entregues - stats.abertos})`],
        ] as Array<[Filtro, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              filtro === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-12 text-center">
            <Mail size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum evento neste filtro</h3>
            <p className="text-sm text-slate-400 mt-1">Ajuste o período ou tipo de evento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Assunto</th>
                  <th className="px-4 py-3 font-medium text-right">Opens · Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map(row => (
                  <tr key={row.message_id}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/leads/${row.lead_id}`)}>
                    <td className="px-4 py-3 font-medium text-slate-800 truncate max-w-[200px]">
                      {row.empresa || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">
                      {row.contato_nome || <span className="text-slate-400">—</span>}
                      <div className="text-[11px] text-slate-400 truncate">{row.contato_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge
                        status={ultimoStatus(row)}
                        qtdOpens={row.qtd_opens}
                        qtdClicks={row.qtd_clicks}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtDateTime(row.ultimo_evento_em ?? row.data_envio)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[300px]">
                      {row.assunto || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                      {row.qtd_opens > 0 && <span className="text-emerald-600 font-medium">{row.qtd_opens}× </span>}
                      {row.qtd_clicks > 0 && <span className="text-emerald-800 font-bold">· {row.qtd_clicks} clk</span>}
                      {row.qtd_opens === 0 && row.qtd_clicks === 0 && <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
