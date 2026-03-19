import React, { useState, useRef, useEffect } from "react";
import { PenTool, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import SignatureCanvas from "react-signature-canvas";

interface JobSignatureProps {
  jobId: string;
  jobNotes?: string | null;
  signatureUrl?: string | null;
  isOffline: boolean;
  onSaved: () => void; // invalidates job query after saving
}

export default function JobSignature({ jobId, jobNotes, signatureUrl, isOffline, onSaved }: JobSignatureProps) {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [signerName, setSignerName] = useState("");
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  const sigCanvasFullscreen = useRef<SignatureCanvas>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Resize canvas when modal opens or screen rotates
  useEffect(() => {
    if (!isSignatureModalOpen) return;

    const updateSize = () => {
      if (!canvasContainerRef.current) return;
      const savedData = sigCanvasFullscreen.current?.isEmpty() ? null : sigCanvasFullscreen.current?.toDataURL();
      const { offsetWidth, offsetHeight } = canvasContainerRef.current;
      setCanvasSize({ width: offsetWidth, height: offsetHeight });
      if (savedData) {
        setTimeout(() => {
          sigCanvasFullscreen.current?.fromDataURL(savedData, { width: offsetWidth, height: offsetHeight });
        }, 50);
      }
    };

    const timer = setTimeout(updateSize, 50);
    window.addEventListener("resize", updateSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSize);
    };
  }, [isSignatureModalOpen]);

  const saveSignature = async () => {
    if (isOffline) return showError("Assinatura requer internet.");
    if (!signerName.trim()) return showError("Informe o nome do responsável da loja.");
    if (sigCanvasFullscreen.current?.isEmpty()) return showError("A loja deve assinar o campo.");

    setIsSavingSignature(true);
    try {
      const signatureDataUrl = sigCanvasFullscreen.current?.getCanvas().toDataURL("image/png");
      const blob = await (await fetch(signatureDataUrl!)).blob();
      const fileName = `sig_${jobId}_${Date.now()}.png`;
      await supabase.storage.from("job_photos").upload(fileName, blob);
      const {
        data: { publicUrl },
      } = supabase.storage.from("job_photos").getPublicUrl(fileName);

      const signatureNote = `\n\n[ASSINATURA DIGITAL]\nResponsável pela Loja: ${signerName.toUpperCase()}\nData/Hora: ${new Date().toLocaleString("pt-BR")}`;

      const { error } = await supabase
        .from("jobs")
        .update({
          signature_url: publicUrl,
          notes: jobNotes ? `${jobNotes}${signatureNote}` : signatureNote,
          status: "Concluído",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;

      showSuccess("Assinatura salva!");
      setIsSignatureModalOpen(false);
      onSaved();
    } catch (error) {
      showError("Erro ao salvar assinatura.");
    } finally {
      setIsSavingSignature(false);
    }
  };

  const extractSigner = () => {
    if (!jobNotes) return "";
    const match = jobNotes.match(/Responsável pela Loja: (.*)/);
    return match ? match[1] : "";
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b-2 border-slate-100 pb-2">
            <PenTool size={20} /> Validação da Loja
          </h3>
          {signatureUrl ? (
            <div className="flex flex-col items-center py-6">
              <img src={signatureUrl} className="max-h-40 object-contain mb-4" />
              <div className="text-center">
                <p className="text-xs uppercase font-black text-slate-400 tracking-widest">Assinado por:</p>
                <p className="text-lg font-bold text-slate-800 uppercase">{extractSigner()}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600">Nome do Responsável (Gerente/Dono)</label>
                <Input
                  placeholder="Quem está acompanhando a instalação?"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 italic">* Obrigatório para identificar a rubrica abaixo.</p>
              </div>
              <button
                onClick={() => setIsSignatureModalOpen(true)}
                disabled={isOffline}
                className="w-full border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center gap-3 py-10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenTool size={36} className="text-blue-400" />
                <span className="font-bold text-blue-700 text-lg">Toque para Assinar</span>
                <span className="text-xs text-blue-400">Abre tela cheia para facilitar a assinatura</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen signature modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col print:hidden">
          <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-black text-slate-800 text-base leading-tight truncate">Assinatura da Loja</p>
              {signerName ? (
                <p className="text-xs text-blue-600 font-bold truncate">{signerName.toUpperCase()}</p>
              ) : (
                <p className="text-xs text-rose-500 font-medium">Informe o nome antes de assinar</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sigCanvasFullscreen.current?.clear()}
                className="rounded-xl"
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={saveSignature}
                disabled={isSavingSignature || isOffline}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-4"
              >
                {isSavingSignature ? <Loader2 className="animate-spin mr-1" size={16} /> : null}
                Validar OS
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSignatureModalOpen(false)}
                className="text-slate-400 rounded-xl"
              >
                <X size={20} />
              </Button>
            </div>
          </div>

          <div ref={canvasContainerRef} className="flex-1 relative bg-slate-50 overflow-hidden">
            {canvasSize.width > 0 && (
              <SignatureCanvas
                ref={sigCanvasFullscreen}
                penColor="black"
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  style: { display: "block" },
                }}
              />
            )}
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-300 pointer-events-none select-none">
              Assine acima com o dedo
            </p>
          </div>
        </div>
      )}
    </>
  );
}
