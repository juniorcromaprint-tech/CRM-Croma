import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, FileText, AlertTriangle, CheckCircle2, Printer, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess } from "@/utils/toast";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");

  // Simulação de upload de fotos
  const PhotoUpload = ({ label, type }: { label: string, type: 'before' | 'after' }) => (
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer min-h-[200px]">
      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-indigo-600">
        <Camera size={32} />
      </div>
      <h4 className="font-bold text-slate-700 mb-1">{label}</h4>
      <p className="text-sm text-slate-500 mb-4">Toque para abrir a câmera ou galeria</p>
      <Button variant="outline" size="sm" className="rounded-xl bg-white">
        <Upload size={16} className="mr-2" /> Selecionar Foto
      </Button>
    </div>
  );

  const handleComplete = () => {
    setStatus("completed");
    showSuccess("Instalação finalizada com sucesso!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header - Hidden on Print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-600">
          <ArrowLeft size={24} />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="rounded-xl border-slate-200">
            <Printer size={18} className="mr-2" /> Relatório PDF
          </Button>
          {status !== "completed" && (
            <Button onClick={handleComplete} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 size={18} className="mr-2" /> Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block text-center border-b pb-6 mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Relatório de Instalação</h1>
        <p className="text-slate-500 mt-2">GráficaApp - Serviços de Comunicação Visual</p>
      </div>

      {/* Job Info Card */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <div className="h-2 w-full bg-indigo-600" />
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block mb-2">
                {id || "OS-1042"}
              </span>
              <h2 className="text-2xl font-bold text-slate-800">Beira Rio Calçados</h2>
              <p className="text-slate-500 font-medium">Adesivagem de Vitrine e Fachada</p>
            </div>
            <div className={`px-3 py-1 rounded-lg text-sm font-bold ${status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {status === 'completed' ? 'Concluído' : 'Em Andamento'}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-xl">
            <MapPin size={18} className="text-indigo-600" />
            <span className="font-medium">Shopping Morumbi - Loja 142 (Piso Térreo)</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Field Work - We hide the tab list on print and just show content */}
      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl p-1 bg-slate-200/50 print:hidden">
          <TabsTrigger value="photos" className="rounded-lg font-medium">Fotos da Instalação</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg font-medium">Relatório & Medidas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="photos" className="space-y-6 print:block">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Camera size={20} className="text-slate-400" /> Antes
              </h3>
              <PhotoUpload label="Adicionar foto do local antes" type="before" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-500" /> Depois
              </h3>
              <PhotoUpload label="Adicionar foto do serviço finalizado" type="after" />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="notes" className="space-y-6 print:block">
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-6 space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <FileText size={18} /> Observações da Instalação
                </label>
                <Textarea 
                  placeholder="Descreva como foi a instalação, materiais utilizados, etc..." 
                  className="min-h-[120px] rounded-xl border-slate-200 resize-none"
                />
              </div>
              
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                <label className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} /> Divergência de Medidas / Problemas
                </label>
                <Textarea 
                  placeholder="Houve alguma diferença no tamanho da vitrine? O adesivo faltou? Anote aqui para o histórico da loja..." 
                  className="min-h-[100px] rounded-xl border-rose-200 bg-white resize-none focus-visible:ring-rose-500"
                />
                <p className="text-xs text-rose-600 mt-2 font-medium">
                  * Estas anotações ficarão salvas no histórico desta loja para futuras instalações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}