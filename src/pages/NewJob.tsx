import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Store, Tag, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

export default function NewJob() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [storeId, setStoreId] = useState("");
  const [osNumber, setOsNumber] = useState("");
  const [type, setType] = useState("Merchandising");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");

  // Buscar lojas para o select
  const { data: stores, isLoading: isLoadingStores } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeId || !osNumber || !type) {
      showError("Por favor, preencha a Loja, Número da OS e o Tipo de Serviço.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([
          {
            store_id: storeId,
            os_number: osNumber,
            type: type,
            scheduled_date: scheduledDate,
            notes: notes,
            status: 'Pendente'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      showSuccess("Ordem de Serviço criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
      
      // Redireciona para a tela da OS recém criada
      navigate(`/jobs/${data.id}`);
    } catch (error) {
      console.error(error);
      showError("Erro ao criar a OS. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-600">
          <ArrowLeft size={24} />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Nova Ordem de Serviço</h1>
          <p className="text-slate-500 mt-1">Cadastre uma nova instalação ou ação de merchandising.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-6 space-y-6">
            
            {/* Loja */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Store size={18} className="text-blue-600" /> Selecione a Loja / Cliente *
              </label>
              <select 
                className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                disabled={isLoadingStores}
              >
                <option value="">{isLoadingStores ? "Carregando lojas..." : "Selecione uma loja..."}</option>
                {stores?.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.brand} - {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Número da OS */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Tag size={18} className="text-blue-600" /> Número da OS *
                </label>
                <Input 
                  placeholder="Ex: OS-1050" 
                  className="h-12 rounded-xl border-slate-200"
                  value={osNumber}
                  onChange={(e) => setOsNumber(e.target.value)}
                />
              </div>

              {/* Data Agendada */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" /> Data Agendada
                </label>
                <Input 
                  type="date"
                  className="h-12 rounded-xl border-slate-200"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>

            {/* Tipo de Serviço */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> Tipo de Serviço *
              </label>
              <select 
                className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="Merchandising">Merchandising (Ação no PDV)</option>
                <option value="Adesivagem Vitrine">Adesivagem de Vitrine</option>
                <option value="Adesivo Interno">Adesivo Interno / Parede</option>
                <option value="Placa Fachada">Instalação de Placa / Fachada</option>
                <option value="Totem / Display">Montagem de Totem / Display</option>
                <option value="Vistoria / Medição">Vistoria / Medição Técnica</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Observações Iniciais */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileText size={18} className="text-slate-400" /> Instruções para a Equipe (Opcional)
              </label>
              <Textarea 
                placeholder="Detalhes do que precisa ser feito, materiais que devem ser levados, contatos no local..." 
                className="min-h-[100px] rounded-xl border-slate-200 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-sm w-full md:w-auto"
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin mr-2" size={20} /> Salvando...</>
            ) : (
              <><Save className="mr-2" size={20} /> Criar Ordem de Serviço</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}