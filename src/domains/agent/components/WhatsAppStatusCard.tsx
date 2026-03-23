import { Smartphone, CheckCircle, XCircle, AlertTriangle, ArrowUpRight, Send, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useWhatsAppStatus, useToggleWhatsAppChannel, useRecentWhatsAppMessages } from '../hooks/useWhatsAppStatus';
import { formatDate } from '@/shared/utils/format';
import { useNavigate } from 'react-router-dom';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  );
}

export default function WhatsAppStatusCard() {
  const navigate = useNavigate();
  const { data: status, isLoading } = useWhatsAppStatus();
  const { data: recentMessages = [] } = useRecentWhatsAppMessages();
  const toggleChannel = useToggleWhatsAppChannel();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 bg-slate-100 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const allConfigured = status.configured && status.hasAppSecret && status.hasVerifyToken;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${allConfigured ? 'bg-green-50' : 'bg-amber-50'}`}>
            <Smartphone size={20} className={allConfigured ? 'text-green-600' : 'text-amber-600'} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">WhatsApp Business</h3>
            <p className="text-xs text-slate-400">
              {allConfigured ? 'Configurado e pronto' : 'Configuração pendente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{status.channelActive ? 'Ativo' : 'Inativo'}</span>
            <Switch
              checked={status.channelActive}
              onCheckedChange={(checked) => toggleChannel.mutate(checked)}
              disabled={!status.configured || toggleChannel.isPending}
            />
          </div>
        </div>
      </div>

      {/* Config checklist */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 text-xs">
          <StatusDot ok={status.hasToken} />
          <span className="text-slate-500">Access Token</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatusDot ok={status.hasPhoneId} />
          <span className="text-slate-500">Phone ID</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatusDot ok={status.hasVerifyToken} />
          <span className="text-slate-500">Verify Token</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatusDot ok={status.hasAppSecret} />
          <span className="text-slate-500">App Secret</span>
        </div>
      </div>

      {/* Stats */}
      {status.configured && (
        <div className="px-5 py-3 flex items-center gap-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm">
            <Send size={14} className="text-blue-500" />
            <span className="text-slate-600">{status.todaySent}</span>
            <span className="text-slate-400 text-xs">/{status.dailyLimit} enviadas hoje</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Inbox size={14} className="text-green-500" />
            <span className="text-slate-600">{status.todayReceived}</span>
            <span className="text-slate-400 text-xs">recebidas hoje</span>
          </div>
          {status.lastMessageAt && (
            <div className="text-xs text-slate-400 ml-auto">
              Última: {formatDate(status.lastMessageAt)}
            </div>
          )}
        </div>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <div className="divide-y divide-slate-100">
          {recentMessages.map((msg: any) => {
            const lead = (msg.agent_conversations as any)?.leads;
            return (
              <div
                key={msg.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/agente/conversa/${(msg.agent_conversations as any)?.id}`)}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${msg.direcao === 'recebida' ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {msg.direcao === 'recebida'
                    ? <Inbox size={12} className="text-green-600" />
                    : <Send size={12} className="text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {lead?.empresa ?? lead?.contato_nome ?? 'Desconhecido'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{msg.conteudo?.slice(0, 80)}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {msg.created_at ? formatDate(msg.created_at) : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!status.configured && (
        <div className="px-5 py-4 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-medium">Configuração necessária</p>
              <p className="mt-1">
                Adicione as credenciais do WhatsApp Business em{' '}
                <button
                  onClick={() => navigate('/agente/config')}
                  className="underline font-medium hover:text-amber-900"
                >
                  Configurações do Agente
                </button>
                {' '}ou diretamente no Supabase Dashboard (admin_config).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
