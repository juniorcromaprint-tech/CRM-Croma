import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download, Share2, Loader2, FileText, Camera,
  Calendar, Store, User, CheckCircle2, AlertTriangle, Image as ImageIcon
} from "lucide-react";
import { showError } from "@/utils/toast";

const STATUS_COLORS: Record<string, string> = {
  "Concluído": "bg-green-100 text-green-800",
  "Pendente": "bg-yellow-100 text-yellow-800",
  "Em andamento": "bg-blue-100 text-blue-800",
  "Cancelado": "bg-red-100 text-red-800",
};

function PhotoGrid({
  photos,
  label,
  borderColor = "border-blue-600",
  onPhotoClick,
}: {
  photos: any[];
  label: string;
  borderColor?: string;
  onPhotoClick: (url: string) => void;
}) {
  return (
    <div className="mb-4">
      <h4 className={`text-sm font-black text-slate-800 border-l-4 ${borderColor} pl-3 mb-3 uppercase tracking-tight`}>{label}</h4>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo: any) => (
          <div key={photo.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <a
              href={photo.photo_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); onPhotoClick(photo.photo_url); }}
            >
              <img
                src={photo.photo_url}
                alt={label}
                crossOrigin="anonymous"
                className="w-full h-48 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            </a>
            {photo.note && (
              <div className="p-2 bg-amber-50 border-t border-amber-100">
                <p className="text-xs text-amber-800 italic">{photo.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function firstDayOfMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().split("T")[0];
}
function lastDayOfMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return d.toISOString().split("T")[0];
}

export default function BillingReport() {
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(lastDayOfMonth());
  const [dateField, setDateField] = useState<"finished_at" | "created_at" | "scheduled_date">("finished_at");
  const [brandFilter, setBrandFilter] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: jobs, isLoading, error: queryError } = useQuery({
    queryKey: ["billing-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          stores ( id, name, brand, code, address ),
          profiles:assigned_to ( first_name, last_name ),
          job_photos ( id, photo_url, photo_type, note, created_at )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").single();
      return data;
    },
  });

  // Filtra por data no cliente usando o campo escolhido pelo usuário
  const dateFiltered = (jobs || []).filter((j: any) => {
    const dateStr: string = (j[dateField] || j.created_at || "").slice(0, 10);
    return dateStr >= startDate && dateStr <= endDate;
  });

  const brands = Array.from(
    new Set(dateFiltered.map((j: any) => j.stores?.brand).filter(Boolean))
  );
  const filtered = dateFiltered.filter((j: any) =>
    !brandFilter || j.stores?.brand === brandFilter
  );

  const stats = {
    total: filtered.length,
    completed: filtered.filter((j: any) => j.status === "Concluído").length,
    pending: filtered.filter((j: any) => j.status === "Pendente").length,
    issues: filtered.filter((j: any) => j.issues && j.issues.trim()).length,
    photos: filtered.reduce((acc: number, j: any) => acc + (j.job_photos?.length || 0), 0),
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  };

  const periodLabel = () => {
    if (!startDate || !endDate) return "";
    return `${formatDate(startDate)} a ${formatDate(endDate)}`;
  };

  const buildPDFOpt = (fileName: string) => ({
    margin: [12, 10, 12, 10],
    filename: fileName,
    image: { type: "jpeg", quality: 0.82 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: false, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: "css" },
  });

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const fileName = `relatorio_${startDate}_${endDate}.pdf`;
      await html2pdf().set(buildPDFOpt(fileName)).from(printRef.current).save();
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const fileName = `relatorio_${startDate}_${endDate}.pdf`;
      const pdfBlob = await html2pdf()
        .set(buildPDFOpt(fileName))
        .from(printRef.current)
        .outputPdf("blob");

      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });
      const shareText = [
        `Relatório de Instalações`,
        `Período: ${periodLabel()}`,
        ``,
        `Total de OS: ${stats.total}`,
        `Concluídas: ${stats.completed}`,
        `Pendentes: ${stats.pending}`,
        `Com ocorrências: ${stats.issues}`,
        `Fotos registradas: ${stats.photos}`,
        ``,
        `Segue em anexo o relatório completo com todas as instalações do período.`,
      ].join("\n");

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: fileName, text: shareText });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar PDF para compartilhamento.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            Relatório de Faturamento
          </h1>
          <p className="text-slate-500 text-sm mt-1">Selecione o período e gere o relatório com fotos</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || filtered.length === 0}
            variant="outline"
            className="h-10 rounded-xl border-slate-200 text-slate-700 flex items-center gap-2"
          >
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Baixar PDF
          </Button>
          <Button
            onClick={handleSharePDF}
            disabled={isGeneratingPDF || filtered.length === 0}
            className="h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
            PDF + WhatsApp
          </Button>
        </div>
      </div>

      {/* Date range + filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        {/* Date inputs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 mb-1 block">Data início</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-700"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 mb-1 block">Data fim</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-700"
            />
          </div>
          {brands.length > 1 && (
            <div className="flex-1 relative">
              <label className="text-xs font-bold text-slate-500 mb-1 block">Filtrar por marca</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 appearance-none outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Todas as marcas</option>
                {brands.map((b) => (
                  <option key={b as string} value={b as string}>{b as string}</option>
                ))}
              </select>
              <div className="absolute right-2 bottom-2.5 pointer-events-none text-slate-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Date field selector */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400 self-center">Filtrar por:</span>
          {([
            { value: "finished_at", label: "Data de finalização" },
            { value: "scheduled_date", label: "Data agendada" },
            { value: "created_at", label: "Data de criação" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateField(value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                dateField === value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-400 self-center">Atalhos:</span>
          {[
            { label: "Este mês", s: firstDayOfMonth(), e: lastDayOfMonth() },
            { label: "Mês passado", s: firstDayOfMonth(-1), e: lastDayOfMonth(-1) },
            { label: "Últimos 7 dias", s: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; })(), e: todayStr() },
            { label: "Últimos 30 dias", s: (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; })(), e: todayStr() },
          ].map(({ label, s, e }) => (
            <button
              key={label}
              onClick={() => { setStartDate(s); setEndDate(e); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                startDate === s && endDate === e
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de OS", value: stats.total, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Concluídas", value: stats.completed, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pendentes", value: stats.pending, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Fotos", value: stats.photos, icon: Camera, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {queryError && (
        <div className="text-center py-8 text-red-600 bg-red-50 rounded-2xl border border-red-200 px-4">
          <p className="font-medium">Erro ao carregar dados:</p>
          <p className="text-sm mt-1">{(queryError as Error).message}</p>
        </div>
      )}

      {!isLoading && !queryError && startDate > endDate && (
        <div className="text-center py-8 text-orange-600 bg-orange-50 rounded-2xl border border-orange-200">
          <p className="font-medium">A data início não pode ser maior que a data fim.</p>
        </div>
      )}

      {!isLoading && !queryError && startDate <= endDate && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma OS encontrada no período selecionado.</p>
          <p className="text-sm mt-1">Total no banco: {jobs?.length ?? 0} OS. Tente ampliar o intervalo de datas.</p>
        </div>
      )}

      {/* Printable report */}
      {!isLoading && filtered.length > 0 && (
        <div
          ref={printRef}
          className="bg-white rounded-2xl border border-slate-200 p-6 space-y-8"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* Report header */}
          <div className="border-b border-slate-200 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <img
                  src="/logo_croma.png"
                  alt="Cromaprint"
                  crossOrigin="anonymous"
                  className="h-12 object-contain mb-2"
                />
                <p className="text-slate-500 text-sm">
                  {(companySettings as any)?.company_phone || ""}
                  {(companySettings as any)?.company_email
                    ? ` • ${(companySettings as any).company_email}`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">Relatório de Instalações</p>
                <p className="text-slate-600 font-medium">{periodLabel()}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Gerado em {new Date().toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {brandFilter && (
              <div className="mt-3">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                  Filtro: {brandFilter}
                </span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Total", value: stats.total },
                { label: "Concluídas", value: stats.completed },
                { label: "Pendentes", value: stats.pending },
                { label: "Fotos", value: stats.photos },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Jobs */}
          {filtered.map((job: any, idx: number) => {
            const beforePhotos = (job.job_photos || []).filter((p: any) => p.photo_type === "before");
            const afterPhotos = (job.job_photos || []).filter((p: any) => p.photo_type === "after");
            const otherPhotos = (job.job_photos || []).filter(
              (p: any) => p.photo_type !== "before" && p.photo_type !== "after"
            );
            const allPhotos = job.job_photos || [];

            return (
              <div key={job.id}>
                {/* Quebra de página antes de cada OS (exceto a primeira) */}
                {idx > 0 && (
                  <div style={{ pageBreakBefore: "always", breakBefore: "page", height: 0 }} />
                )}
              <div
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                  <span className="font-bold text-slate-800">{job.os_number}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || "bg-slate-100 text-slate-600"}`}>
                    {job.status}
                  </span>
                  <span className="text-sm text-slate-600">{job.type}</span>
                  <span className="ml-auto text-sm text-slate-500 flex items-center gap-1">
                    <Calendar size={13} />
                    {formatDate(job.scheduled_date)}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Store size={16} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{job.stores?.name}</p>
                        <p className="text-xs text-slate-500">
                          {job.stores?.brand}{job.stores?.code ? ` • ${job.stores.code}` : ""}
                        </p>
                        {job.stores?.address && (
                          <p className="text-xs text-slate-400 mt-0.5">{job.stores.address}</p>
                        )}
                      </div>
                    </div>
                    {job.profiles && (
                      <div className="flex items-start gap-2">
                        <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            {job.profiles.first_name} {job.profiles.last_name}
                          </p>
                          <p className="text-xs text-slate-500">Instalador</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {job.notes && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-500 mb-1">Observações</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{job.notes}</p>
                    </div>
                  )}

                  {allPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                        <ImageIcon size={12} /> Fotos ({allPhotos.length})
                      </p>
                      {beforePhotos.length > 0 && <PhotoGrid photos={beforePhotos} label="Antes da Instalação" borderColor="border-blue-600" onPhotoClick={setFullscreenPhoto} />}
                      {afterPhotos.length > 0 && <PhotoGrid photos={afterPhotos} label="Depois da Instalação" borderColor="border-emerald-500" onPhotoClick={setFullscreenPhoto} />}
                      {otherPhotos.length > 0 && <PhotoGrid photos={otherPhotos} label="Outras Fotos" borderColor="border-slate-400" onPhotoClick={setFullscreenPhoto} />}
                    </div>
                  )}
                </div>
              </div>
              </div>
            );
          })}

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            Relatório gerado pelo sistema Cromaprint • {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
      )}

      {/* Modal foto em tamanho original */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenPhoto(null)}
        >
          <img
            src={fullscreenPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center text-xl font-bold transition-colors"
          >
            ✕
          </button>
          <a
            href={fullscreenPhoto}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/40 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Abrir original ↗
          </a>
        </div>
      )}
    </div>
  );
}
