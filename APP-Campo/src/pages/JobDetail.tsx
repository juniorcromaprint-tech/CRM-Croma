import React, { Suspense, useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, Printer, MapPin, Calendar, Navigation, Loader2, User, MessageCircle, ExternalLink, WifiOff, Timer, Lock, PlayCircle, Edit2, Share2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from "@/utils/toast";
import { CromaLogo, CromaLogoFallback } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import JobChecklist from "@/components/JobChecklist";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const JobPhotos = React.lazy(() => import("@/components/job/JobPhotos"));
const JobVideos = React.lazy(() => import("@/components/job/JobVideos"));
const JobSignature = React.lazy(() => import("@/components/job/JobSignature"));

const TabFallback = () => (
  <div className="flex justify-center py-8">
    <Loader2 className="animate-spin text-blue-500" size={24} />
  </div>
);

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [isLocating, setIsLocating] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Estados para edição de tempo (Admin)
  const [isEditingTimes, setIsEditingTimes] = useState(false);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const [jobFinished, setJobFinished] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showStartAlert, setShowStartAlert] = useState(false);

  const printSectionRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const issuesDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, stores(*), profiles!jobs_assigned_to_fkey(first_name, last_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: photos } = useQuery({
    queryKey: ["job-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateJobMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("jobs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      if (!isOffline) showSuccess("Alteração salva!");
    },
  });

  const handleStartJob = () => {
    if (isOffline) return showError("Requer internet para iniciar o serviço.");
    const updates: any = { status: "Em andamento", started_at: new Date().toISOString() };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateJobMutation.mutate({ ...updates, lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => updateJobMutation.mutate(updates),
      { timeout: 6000 }
    );
  };

  const handleFinishJob = () => {
    updateJobMutation.mutate(
      { status: "Concluído", finished_at: new Date().toISOString() },
      { onSuccess: () => setJobFinished(true) }
    );
  };

  // Inicializa o campo de notas quando o job carrega
  useEffect(() => {
    if (job) setNotesValue(job.notes || "");
  }, [job?.id]);

  // Para a gravação se o componente for desmontado
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // Alerta automático para iniciar contagem de tempo
  useEffect(() => {
    if (job && !isAdmin && (job.status === "Pendente" || job.status === "Agendado") && !job.started_at) {
      setShowStartAlert(true);
    }
  }, [job?.id, job?.status]);

  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado. Use Chrome no Android ou Chrome/Edge no PC.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + " ";
      }
      if (finalText) {
        setNotesValue((prev) => {
          const updated = prev ? prev.trimEnd() + " " + finalText.trim() : finalText.trim();
          handleNotesChange(updated);
          return updated;
        });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        showError("Erro no microfone. Verifique as permissões do navegador.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleNotesChange = (value: string) => {
    localStorage.setItem(`draft_notes_${id}`, value);
    clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      updateJobMutation.mutate({ notes: value });
    }, 1500);
  };

  // Carrega rascunho do localStorage se existir e o campo estiver vazio
  useEffect(() => {
    if (job && !job.notes) {
      const draft = localStorage.getItem(`draft_notes_${id}`);
      if (draft) {
        setNotesValue(draft);
      }
    }
  }, [job?.id]);

  const handleIssuesChange = (value: string) => {
    clearTimeout(issuesDebounceRef.current);
    issuesDebounceRef.current = setTimeout(() => {
      updateJobMutation.mutate({ issues: value });
    }, 1500);
  };

  const captureLocation = () => {
    if (isOffline) return showError("GPS requer internet.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateJobMutation.mutate(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { onSuccess: () => setIsLocating(false) }
        );
      },
      () => {
        setIsLocating(false);
        showError("Erro GPS.");
      }
    );
  };

  const handleWhatsAppShare = () => {
    if (!job) return;
    const formattedDate = job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("pt-BR") : "Sem data";
    const clientName = job.stores?.name || "Não informado";
    const text = `Olá! Segue o status da *Ordem de Serviço* da Cromaprint:%0A%0A*OS:* ${job.os_number}%0A*Cliente:* ${clientName}%0A*Data:* ${formattedDate}%0A*Serviço:* ${job.type}%0A*Status:* ${job.status}`;
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handlePrint = () => {
    if (!job) return;
    const originalTitle = document.title;
    const clientName = job.stores?.brand || "Cliente";
    const storeCode = job.stores?.code ? `Cod ${job.stores.code}` : "SemCod";
    const dateStr = job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("pt-BR").replace(/\//g, "-") : "sem-data";
    const osNumber = `OS ${job.os_number || "SemNumero"}`;

    document.title = `${clientName} - ${storeCode} - ${dateStr} - ${osNumber}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleSharePDF = async () => {
    if (!job || !printSectionRef.current) return;

    const clientName = job.stores?.brand || "Cliente";
    const storeCode = job.stores?.code ? `Cod${job.stores.code}` : "";
    const dateStr = job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("pt-BR").replace(/\//g, "-") : "sem-data";
    const fileName = `Relatorio_${clientName}${storeCode ? "_" + storeCode : ""}_${dateStr}_OS${job.os_number || ""}.pdf`.replace(/\s+/g, "_");

    setIsGeneratingPDF(true);
    await new Promise((r) => setTimeout(r, 150));

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: false, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: "avoid-all", before: ".break-before-page" },
      };

      const pdfBlob: Blob = await html2pdf().set(opt).from(printSectionRef.current).outputPdf("blob");
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

      const formattedDate = new Date(job.scheduled_date).toLocaleDateString("pt-BR");
      const shareText = `Olá! Segue o relatório de instalação da *Cromaprint*.\n\n*OS:* ${job.os_number}\n*Cliente:* ${job.stores?.name || "Não informado"}\n*Marca:* ${job.stores?.brand || ""}\n*Data:* ${formattedDate}\n*Serviço:* ${job.type}\n*Status:* ${job.status}${job.notes ? `\n\n*Relatório:* ${job.notes}` : ""}`;

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: fileName, text: shareText });
      } else {
        const url = URL.createObjectURL(pdfFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showSuccess("PDF baixado! Anexe-o manualmente no WhatsApp.");
      }
    } catch (err) {
      console.error(err);
      showError('Erro ao gerar o PDF. Tente usar o botão "PDF" normal.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return "Em andamento...";
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 0) return "0m";
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const toLocalDatetime = (isoString?: string | null) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startEditingTimes = () => {
    setEditStartTime(toLocalDatetime(job?.started_at));
    setEditEndTime(toLocalDatetime(job?.finished_at));
    setIsEditingTimes(true);
  };

  const saveTimes = () => {
    updateJobMutation.mutate(
      {
        started_at: editStartTime ? new Date(editStartTime).toISOString() : null,
        finished_at: editEndTime ? new Date(editEndTime).toISOString() : null,
      },
      { onSuccess: () => setIsEditingTimes(false) }
    );
  };

  if (isLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!job) return <div className="p-10 text-center">Não encontrado.</div>;

  const beforePhotos = photos?.filter((p) => p.photo_type === "before") || [];
  const afterPhotos = photos?.filter((p) => p.photo_type === "after") || [];
  const canInteract = job.status !== "Pendente";

  const extractSigner = () => {
    if (!job.notes) return "";
    const match = job.notes.match(/Responsável pela Loja: (.*)/);
    return match ? match[1] : "";
  };

  return (
    <div className="space-y-6 pb-10 print:pb-0 print:space-y-0 print:bg-white">
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 text-amber-800 animate-pulse print:hidden">
          <div className="flex items-center gap-3">
            <WifiOff size={20} />
            <p className="text-sm font-bold">Modo Offline Ativo.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-white border shadow-sm shrink-0 self-start">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleWhatsAppShare} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex-1 sm:flex-none">
            <MessageCircle size={18} className="mr-2" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={handleSharePDF}
            disabled={isGeneratingPDF}
            className="text-green-700 border-green-200 hover:bg-green-50 flex-1 sm:flex-none"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Share2 size={18} className="mr-2" /> PDF + WA
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handlePrint} className="text-blue-600 border-slate-200 flex-1 sm:flex-none">
            <Printer size={18} className="mr-2" /> PDF
          </Button>
          {job.status !== "Concluído" && canInteract && (
            <Button
              onClick={handleFinishJob}
              disabled={isOffline || updateJobMutation.isPending}
              className="bg-emerald-600 text-white flex-1 sm:flex-none shadow-lg active:scale-95 transition-transform"
            >
              <CheckCircle2 size={18} className="mr-2" /> Finalizar
            </Button>
          )}
        </div>
      </div>

      <div className="hidden print:block mb-8 border-b-2 border-slate-200 pb-6">
        <div className="flex justify-between items-center">
          <div>
            <CromaLogo className="h-12 mb-2" />
            <CromaLogoFallback className="h-12 mb-2" />
            <h1 className="text-2xl font-black text-slate-800">RELATÓRIO DE INSTALAÇÃO</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-blue-600">OS: {job.os_number}</p>
            <p className="text-xs text-slate-500">Gerado em: {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white print:shadow-none print:border print:border-slate-200 print:rounded-xl print:mb-6">
        <div className="h-2 w-full bg-blue-600 print:hidden" />
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg mb-3 inline-block print:hidden">
                OS: {job.os_number}
              </span>
              <h2 className="text-3xl font-black text-slate-800 print:text-2xl">{job.stores?.brand}</h2>
              <p className="text-slate-500 font-medium text-lg print:text-base">{job.type}</p>
            </div>
            <div className="print:hidden">
              <select
                value={job.status}
                disabled={isOffline}
                onChange={(e) => updateJobMutation.mutate({ status: e.target.value })}
                className="p-2 rounded-xl border font-bold text-sm bg-slate-50"
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Local</p>
              <p className="font-bold text-sm text-slate-800">{job.stores?.name}</p>
              <p className="text-xs text-slate-500">{job.stores?.address}</p>
              {job.stores?.cnpj && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  CNPJ: {job.stores.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                </p>
              )}
              {(job.stores?.lat && job.stores?.lng) && (
                <div className="flex gap-2 mt-2 print:hidden">
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.stores.lat},${job.stores.lng}`, '_blank')}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100"
                  >
                    <Navigation size={12} /> Maps
                  </button>
                  <button
                    onClick={() => window.open(`https://waze.com/ul?ll=${job.stores.lat},${job.stores.lng}&navigate=yes`, '_blank')}
                    className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100"
                  >
                    <ExternalLink size={12} /> Waze
                  </button>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Data</p>
              <p className="font-bold text-sm text-slate-800">{new Date(job.scheduled_date).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Instalador</p>
              <p className="font-bold text-sm text-slate-800">
                {job.profiles ? `${job.profiles.first_name} ${job.profiles.last_name}` : "Não atribuído"}
              </p>
            </div>

            {/* Métricas de Tempo com Edição para Admin */}
            {(job.started_at || isAdmin) && (
              <div className="bg-blue-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3 col-span-1 md:col-span-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {isEditingTimes ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                    <div className="flex-1 w-full">
                      <label className="text-xs text-blue-600 font-bold uppercase mb-1 block">Início</label>
                      <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="bg-white" />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs text-blue-600 font-bold uppercase mb-1 block">Fim</label>
                      <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="bg-white" />
                    </div>
                    <div className="flex gap-2 mt-4 sm:mt-0 self-end sm:self-center">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingTimes(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={saveTimes} disabled={updateJobMutation.isPending} className="bg-blue-600 text-white">
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      {job.started_at ? (
                        <>
                          <div>
                            <p className="text-xs text-blue-600 font-bold uppercase">Início</p>
                            <p className="font-bold text-sm text-slate-800">
                              {new Date(job.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-[10px] text-slate-500">{new Date(job.started_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                          {job.finished_at && (
                            <>
                              <div className="w-px h-8 bg-blue-200" />
                              <div>
                                <p className="text-xs text-blue-600 font-bold uppercase">Fim</p>
                                <p className="font-bold text-sm text-slate-800">
                                  {new Date(job.finished_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p className="text-[10px] text-slate-500">{new Date(job.finished_at).toLocaleDateString("pt-BR")}</p>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div>
                          <p className="text-xs text-blue-600 font-bold uppercase">Tempo</p>
                          <p className="font-bold text-sm text-slate-500">Não iniciado</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      {job.started_at && (
                        <div className="text-right">
                          <p className="text-xs text-blue-600 font-bold uppercase flex items-center gap-1 justify-end">
                            <Timer size={12} /> Duração
                          </p>
                          <p className="font-black text-lg text-blue-700">{formatDuration(job.started_at, job.finished_at)}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={startEditingTimes}
                          className="text-blue-600 hover:bg-blue-100 print:hidden shrink-0"
                          title="Editar Horários"
                        >
                          <Edit2 size={16} />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center print:border-slate-100">
            <div className="flex items-center gap-2">
              <Navigation size={18} className={job.lat ? "text-emerald-500" : "text-slate-400"} />
              {job.lat ? (
                <span className="text-sm font-bold text-slate-600">
                  GPS: {job.lat.toFixed(6)}, {job.lng.toFixed(6)}
                </span>
              ) : (
                <span className="text-sm font-medium text-slate-400">GPS não capturado</span>
              )}
            </div>
            {!job.lat && (
              <Button variant="outline" size="sm" onClick={captureLocation} disabled={isLocating || isOffline} className="rounded-xl print:hidden">
                {isLocating ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Capturar GPS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="print:hidden">
        {!canInteract ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Lock size={40} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800">Serviço não iniciado</h3>
            <p className="text-slate-500 max-w-md mt-2 text-lg">
              Você precisa iniciar o serviço para liberar o envio de fotos, vídeos e a assinatura.
            </p>
            <Button
              onClick={handleStartJob}
              className="mt-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-14 px-8 text-lg font-bold shadow-lg shadow-blue-200 w-full sm:w-auto transition-transform hover:scale-105"
            >
              <PlayCircle size={24} className="mr-2" /> Iniciar Serviço Agora
            </Button>
          </div>
        ) : (
          <>
            <JobChecklist
              jobId={id!}
              initialData={JSON.parse(localStorage.getItem(`checklist_${id}`) || "{}")}
              onSave={(data) => localStorage.setItem(`checklist_${id}`, JSON.stringify(data))}
            />
            <Tabs defaultValue="photos" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 rounded-xl p-1 bg-slate-200/50">
                <TabsTrigger value="photos">Fotos</TabsTrigger>
                <TabsTrigger value="videos">Vídeos</TabsTrigger>
                <TabsTrigger value="notes">Relatório</TabsTrigger>
                <TabsTrigger value="signature">Assinatura</TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="space-y-8">
                <Suspense fallback={<TabFallback />}>
                  <JobPhotos jobId={id!} jobLat={job.lat} jobLng={job.lng} isOffline={isOffline} />
                </Suspense>
              </TabsContent>

              <TabsContent value="videos" className="space-y-6">
                <Suspense fallback={<TabFallback />}>
                  <JobVideos jobId={id!} isOffline={isOffline} />
                </Suspense>
              </TabsContent>

              <TabsContent value="notes" className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                  <div className="mb-8">
                    <div className="flex items-center justify-between border-b pb-2 mb-3">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Relatório do Instalador</label>
                      <button
                        onClick={toggleVoice}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                          isRecording
                            ? "bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse"
                            : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                        {isRecording ? "Parar" : "Falar"}
                      </button>
                    </div>
                    {isRecording && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                        Ouvindo... fale o relatório em português. Toque em "Parar" quando terminar.
                      </div>
                    )}
                    <Textarea
                      className="min-h-[120px] rounded-xl"
                      value={notesValue}
                      onChange={(e) => {
                        setNotesValue(e.target.value);
                        handleNotesChange(e.target.value);
                      }}
                      placeholder="Descreva o serviço realizado..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1 italic">Salvo automaticamente enquanto você digita.</p>
                  </div>
                  <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100">
                    <label className="text-sm font-bold text-rose-800 block mb-3 border-b border-rose-200 pb-1">
                      Divergências / Problemas Relatados
                    </label>
                    <Textarea
                      className="min-h-[100px] rounded-xl bg-white"
                      defaultValue={job.issues || ""}
                      onChange={(e) => handleIssuesChange(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="signature" className="space-y-6">
                <Suspense fallback={<TabFallback />}>
                  <JobSignature
                    jobId={id!}
                    jobNotes={job.notes}
                    signatureUrl={job.signature_url}
                    isOffline={isOffline}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["job", id] })}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <div ref={printSectionRef} className={isGeneratingPDF ? "block" : "hidden print:block"}>
        <div className="space-y-10">
          <div>
            <h3 className="text-lg font-black text-slate-800 border-l-4 border-blue-600 pl-3 mb-4 uppercase tracking-tight">
              1. Antes da Instalação
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {beforePhotos.map((photo) => (
                <div key={photo.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <a href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={photo.photo_url} crossOrigin="anonymous" className="w-full h-64 object-cover" />
                  </a>
                  {(photo as any).note && (
                    <div className="p-2 bg-amber-50 border-t border-amber-100">
                      <p className="text-xs text-amber-800 italic">{(photo as any).note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="break-before-page">
            <h3 className="text-lg font-black text-slate-800 border-l-4 border-emerald-500 pl-3 mb-4 uppercase tracking-tight">
              2. Depois da Instalação
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {afterPhotos.map((photo) => (
                <div key={photo.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <a href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={photo.photo_url} crossOrigin="anonymous" className="w-full h-64 object-cover" />
                  </a>
                  {(photo as any).note && (
                    <div className="p-2 bg-amber-50 border-t border-amber-100">
                      <p className="text-xs text-amber-800 italic">{(photo as any).note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 break-inside-avoid">
            {job.notes && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Relatório Técnico:</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}
            {job.issues && (
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                <h4 className="text-sm font-bold text-rose-800 uppercase mb-2">Divergências / Observações:</h4>
                <p className="text-sm text-rose-900 whitespace-pre-wrap">{job.issues}</p>
              </div>
            )}
          </div>

          {job.signature_url && (
            <div className="mt-12 flex flex-col items-center border-t-2 border-slate-100 pt-8 break-inside-avoid">
              <img src={job.signature_url} className="h-32 object-contain mb-2" />
              <div className="text-center">
                <p className="text-sm font-black text-slate-800 uppercase">{extractSigner()}</p>
                <div className="w-64 h-px bg-slate-300 my-1 mx-auto" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Responsável pela Loja / Recebimento
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {jobFinished && (
        <div className="fixed inset-0 z-[9997] bg-emerald-600 flex flex-col items-center justify-center text-white print:hidden animate-in fade-in duration-300">
          <div className="text-center p-8">
            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={60} className="text-white" />
            </div>
            <h2 className="text-3xl font-black mb-2">OS Finalizada!</h2>
            <p className="text-emerald-100 text-lg mb-8">Serviço concluído com sucesso.</p>
            <Button onClick={() => setJobFinished(false)} className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold px-10 py-3 rounded-2xl text-lg shadow-lg h-auto">
              Fechar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showStartAlert} onOpenChange={setShowStartAlert}>
        <AlertDialogContent className="rounded-2xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black flex items-center gap-2">
              <PlayCircle className="text-blue-600" size={24} />
              Iniciar Serviço?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600">
              Você está na loja? Ao iniciar, a contagem de tempo e o GPS serão registrados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl h-12">Ainda não</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartJob} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 font-bold">
              Sim, Iniciar Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
