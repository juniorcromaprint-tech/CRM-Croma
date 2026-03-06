"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText, Calendar as CalendarIcon, Loader2, ChevronLeft, MapPin, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BillingReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['billing-report', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          stores (name, brand, address, city, state),
          job_photos (photo_url, photo_type, description),
          profiles:assigned_to (first_name, last_name)
        `)
        .eq('status', 'Concluído')
        .gte('finished_at', `${dateRange.start}T00:00:00`)
        .lte('finished_at', `${dateRange.end}T23:59:59`)
        .order('finished_at', { ascending: true });

      if (error) throw error;
      return data;
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2 -ml-2 text-slate-500">
            <ChevronLeft size={16} className="mr-1" /> Voltar
          </Button>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatório de Faturamento</h1>
          <p className="text-slate-500">Consolidado de instalações concluídas para envio ao cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="bg-blue-600 text-white shadow-lg">
            <Printer size={18} className="mr-2" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Filters - Hidden on Print */}
      <Card className="border-none shadow-sm print:hidden">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Data Início</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Data Fim</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p>Gerando relatório consolidado...</p>
        </div>
      ) : (
        <div className="space-y-8 print:space-y-4">
          {/* Summary Card */}
          <Card className="border-none shadow-sm overflow-hidden print:shadow-none print:border">
            <CardHeader className="bg-slate-50 border-b border-slate-100 print:bg-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> Resumo do Período
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Total de OS</p>
                <p className="text-2xl font-black text-slate-800">{reportData?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Período</p>
                <p className="text-sm font-medium text-slate-700">
                  {format(new Date(dateRange.start), 'dd/MM/yy')} até {format(new Date(dateRange.end), 'dd/MM/yy')}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                  <CheckCircle2 size={14} /> Concluídas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Jobs List */}
          <div className="space-y-6 print:space-y-8">
            {reportData?.map((job, index) => (
              <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden break-inside-avoid print:shadow-none print:border-slate-200">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:bg-slate-100 print:text-slate-900">
                  <div>
                    <h3 className="font-black text-lg leading-tight">{job.stores?.name}</h3>
                    <p className="text-xs opacity-80 flex items-center gap-1">
                      <MapPin size={12} /> {job.stores?.city}, {job.stores?.state} • OS: {job.os_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase opacity-70">Finalizado em</p>
                    <p className="font-mono text-sm">{format(new Date(job.finished_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Photos Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {job.job_photos?.slice(0, 4).map((photo: any, pIdx: number) => (
                      <div key={pIdx} className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 relative">
                        <img 
                          src={photo.photo_url} 
                          alt={photo.photo_type} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-1 font-bold uppercase">
                          {photo.photo_type === 'before' ? 'Antes' : 'Depois'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Notes & Signature */}
                  <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Observações do Instalador</p>
                      <p className="text-xs text-slate-600 italic">
                        {job.notes || "Nenhuma observação registrada."}
                      </p>
                    </div>
                    {job.signature_url && (
                      <div className="flex flex-col items-end">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Assinatura do Cliente</p>
                        <img src={job.signature_url} alt="Assinatura" className="h-12 object-contain grayscale" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {reportData?.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400">Nenhuma instalação concluída encontrada neste período.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}