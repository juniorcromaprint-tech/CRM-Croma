// src/domains/instalacao/pages/InstalacaoDetailPage.tsx

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  User,
  Camera,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Timer,
  Building2,
  FileText,
  Image,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { instalacaoService, type CampoInstalacao, type CampoFoto, type PedidoItemResumo } from '../services/instalacao.service';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  Pendente: { label: 'Pendente', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  'Em Andamento': { label: 'Em Andamento', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: Play },
  Concluído: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  Cancelado: { label: 'Cancelado', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuracao(minutos: number | null | undefined): string {
  if (!minutos) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstalacaoDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const { data: job, isLoading: loadingJob } = useQuery<CampoInstalacao | null>({
    queryKey: ['campo-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('vw_campo_instalacoes' as any)
        .select('*')
        .eq('job_id', jobId)
        .single() as any);
      if (error) return null;
      return data as CampoInstalacao;
    },
  });

  const { data: fotos = [], isLoading: loadingFotos } = useQuery<CampoFoto[]>({
    queryKey: ['campo-fotos', jobId],
    enabled: !!jobId,
    queryFn: () => instalacaoService.buscarFotosPorJob(jobId!),
  });

  // Query: itens do pedido (arte a instalar)
  const { data: itensPedido = [] } = useQuery<PedidoItemResumo[]>({
    queryKey: ['campo-itens-pedido', job?.pedido_id],
    enabled: !!job?.pedido_id,
    queryFn: () => instalacaoService.buscarItensPedido(job!.pedido_id!),
  });

  // Query: fotos de layout/referência
  const { data: fotosLayout = [] } = useQuery<CampoFoto[]>({
    queryKey: ['campo-fotos-layout', jobId],
    enabled: !!jobId,
    queryFn: () => instalacaoService.buscarFotosLayout(jobId!),
  });

  const fotosAntes = fotos.filter((f) => f.photo_type === 'before');
  const fotosDepois = fotos.filter((f) => f.photo_type === 'after');
  const fotosOutras = fotos.filter((f) => f.photo_type !== 'before' && f.photo_type !== 'after' && f.photo_type !== 'layout');

  if (loadingJob) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Link to="/instalacoes">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft size={14} className="mr-1.5" />
            Instalações
          </Button>
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Instalação não encontrada</h3>
          <p className="text-sm text-slate-400 mt-1">
            O job <code className="bg-slate-100 px-1 rounded">{jobId}</code> não existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[job.status_campo] ?? STATUS_CONFIG['Pendente'];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/instalacoes">
          <Button variant="ghost" size="sm" className="rounded-xl h-8 px-2 text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} className="mr-1" />
            Instalações
          </Button>
        </Link>
        <span className="text-slate-300 text-sm">/</span>
        <span className="text-slate-700 text-sm font-medium">OS {job.os_number}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-800">OS {job.os_number}</h1>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${statusCfg.color}`}
              >
                <StatusIcon size={12} />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job.tipo_servico}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              <span>Agendado: {formatDateBR(job.data_agendada)}</span>
            </div>
            {job.duracao_minutos != null && (
              <div className="flex items-center gap-1.5">
                <Timer size={14} className="text-slate-400" />
                <span>Duração: {formatDuracao(job.duracao_minutos)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arte a instalar — aparece ANTES de tudo para o instalador saber o que vai fazer */}
      {itensPedido.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Image size={16} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-blue-800 text-sm">Arte a instalar</h3>
            <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
              {itensPedido.length} {itensPedido.length === 1 ? 'peça' : 'peças'}
            </Badge>
          </div>

          {itensPedido.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-blue-100 p-4 space-y-3">
              {/* Descrição principal */}
              <p className="text-sm font-semibold text-slate-800">{item.descricao}</p>

              {/* Dimensões */}
              {(item.largura_cm || item.altura_cm) && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-slate-500">Qtd: {item.quantidade} pc</span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    {item.largura_cm ? (item.largura_cm >= 100 ? `${(item.largura_cm / 100).toFixed(2)}m` : `${item.largura_cm}cm`) : '?'} × {item.altura_cm ? (item.altura_cm >= 100 ? `${(item.altura_cm / 100).toFixed(2)}m` : `${item.altura_cm}cm`) : '?'}
                  </span>
                  {item.area_m2 != null && (
                    <span className="text-xs text-slate-500">({item.area_m2.toFixed(2)} m²)</span>
                  )}
                </div>
              )}

              {/* Especificação (materiais) */}
              {item.especificacao && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 leading-relaxed">{item.especificacao}</p>
                </div>
              )}

              {/* Instruções */}
              {item.instrucoes && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Instruções:</p>
                  <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">{item.instrucoes}</p>
                </div>
              )}
            </div>
          ))}

          {/* Fotos de layout/referência */}
          {fotosLayout.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Referências visuais</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fotosLayout.map((foto) => (
                  <a
                    key={foto.id}
                    href={foto.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative rounded-xl overflow-hidden border border-blue-100 hover:border-blue-300 transition-colors bg-white"
                  >
                    <img
                      src={foto.photo_url}
                      alt={foto.description ?? 'Referência visual'}
                      className="w-full h-auto max-h-48 object-contain group-hover:scale-[1.02] transition-transform duration-200"
                      loading="lazy"
                    />
                    {foto.description && (
                      <div className="px-3 py-2 bg-slate-50 border-t border-blue-50">
                        <p className="text-xs text-slate-600 truncate">{foto.description}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Loja */}
        <InfoCard icon={Building2} title="Loja">
          <InfoRow label="Nome" value={job.loja_nome} />
          <InfoRow label="Marca" value={job.loja_marca} />
          <InfoRow label="Endereço" value={job.loja_endereco} />
          <InfoRow label="Estado" value={job.loja_estado} />
          {(job.lat != null && job.lng != null) && (
            <InfoRow label="GPS" value={`${job.lat.toFixed(5)}, ${job.lng.toFixed(5)}`} />
          )}
        </InfoCard>

        {/* Técnico */}
        <InfoCard icon={User} title="Técnico">
          <InfoRow label="Nome" value={job.tecnico_nome} />
          <InfoRow label="Função" value={job.tecnico_role} />
          <InfoRow label="Início" value={formatDateTimeBR(job.started_at)} />
          <InfoRow label="Conclusão" value={formatDateTimeBR(job.finished_at)} />
        </InfoCard>
      </div>

      {/* Notes & Issues */}
      {(job.notes || job.issues) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {job.notes && (
            <InfoCard icon={FileText} title="Observações">
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {job.notes}
              </p>
            </InfoCard>
          )}
          {job.issues && (
            <InfoCard icon={AlertTriangle} title="Problemas relatados">
              <p className="text-sm text-red-600 whitespace-pre-wrap leading-relaxed">
                {job.issues}
              </p>
            </InfoCard>
          )}
        </div>
      )}

      {/* Signature */}
      {job.signature_url && (
        <InfoCard icon={FileText} title="Assinatura do cliente">
          <img
            src={job.signature_url}
            alt="Assinatura"
            className="max-h-24 border border-slate-200 rounded-xl bg-white object-contain"
          />
        </InfoCard>
      )}

      {/* Fotos */}
      {loadingFotos ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          Carregando fotos...
        </div>
      ) : fotos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Camera size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Nenhuma foto registrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fotosAntes.length > 0 && (
            <PhotoSection title="Fotos — Antes" fotos={fotosAntes} />
          )}
          {fotosDepois.length > 0 && (
            <PhotoSection title="Fotos — Depois" fotos={fotosDepois} />
          )}
          {fotosOutras.length > 0 && (
            <PhotoSection title="Outras fotos" fotos={fotosOutras} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-blue-600" />
        <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 shrink-0 w-24">{label}</span>
      <span className="text-slate-700 break-words">{value}</span>
    </div>
  );
}

function PhotoSection({ title, fotos }: { title: string; fotos: CampoFoto[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Image size={15} className="text-slate-400" />
        <h3 className="font-semibold text-slate-600 text-sm">{title}</h3>
        <Badge variant="outline" className="text-xs">{fotos.length}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {fotos.map((foto) => (
          <a
            key={foto.id}
            href={foto.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-blue-300 transition-colors"
          >
            <img
              src={foto.photo_url}
              alt={foto.description ?? 'Foto de instalação'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
            {foto.description && (
              <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{foto.description}</p>
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
