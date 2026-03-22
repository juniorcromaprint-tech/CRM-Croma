import React, { useState, useEffect } from "react";
import { Save, Loader2, ClipboardList, Calendar, Store, FileText, Hash, User, Check, ChevronsUpDown, Search } from "lucide-react";
import { getCnhStatus } from "@/shared/components/CnhBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface JobFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  jobToEdit?: any | null;
  initialStoreId?: string;
}

const SERVICE_TYPES = [
  'Instalação de Adesivo',
  'Troca de Adesivo',
  'Manutenção de Adesivo',
  'Instalação de Fachada',
  'Instalação de Banner',
  'Instalação de Placa',
  'Retirada de Material',
  'Vistoria Técnica',
];

export default function JobFormSheet({ isOpen, onClose, jobToEdit, initialStoreId }: JobFormSheetProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openStoreSelect, setOpenStoreSelect] = useState(false);

  // Busca a lista de lojas para o select
  const { data: stores } = useQuery({
    queryKey: ['stores-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, brand, code')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  // Busca a lista de instaladores para o select
  const { data: installers } = useQuery({
    queryKey: ['installers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, cnh_validade, cnh_categoria')
        .eq('role', 'instalador')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  const [formData, setFormData] = useState({
    store_id: "",
    os_number: "",
    type: "",
    status: "Pendente",
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: "",
    assigned_to: ""
  });

  // Preenche o formulário ao abrir
  useEffect(() => {
    if (jobToEdit) {
      setFormData({
        store_id: jobToEdit.store_id || "",
        os_number: jobToEdit.os_number || "",
        type: jobToEdit.type || "",
        status: jobToEdit.status || "Pendente",
        scheduled_date: jobToEdit.scheduled_date ? jobToEdit.scheduled_date.split('T')[0] : new Date().toISOString().split('T')[0],
        notes: jobToEdit.notes || "",
        assigned_to: jobToEdit.assigned_to || ""
      });
    } else {
      setFormData({
        store_id: initialStoreId || "",
        os_number: "",
        type: "",
        status: "Pendente",
        scheduled_date: new Date().toISOString().split('T')[0],
        notes: "",
        assigned_to: ""
      });
    }
  }, [jobToEdit, initialStoreId, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStoreSelect = (storeId: string) => {
    setFormData(prev => ({ ...prev, store_id: storeId }));
    setOpenStoreSelect(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.store_id || !formData.os_number || !formData.type) {
      showError("Loja, Número da OS e Tipo são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        assigned_to: formData.assigned_to === "" ? null : formData.assigned_to
      };

      if (jobToEdit) {
        const { error } = await supabase.from('jobs').update(submitData).eq('id', jobToEdit.id);
        if (error) throw error;
        showSuccess("OS atualizada com sucesso!");
      } else {
        const { error } = await supabase.from('jobs').insert([submitData]);
        if (error) throw error;
        showSuccess("Nova OS criada com sucesso!");
      }
      
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      if (formData.store_id) {
        queryClient.invalidateQueries({ queryKey: ['store-jobs', formData.store_id] });
      }
      
      onClose();
    } catch (error) {
      console.error(error);
      showError("Erro ao salvar a OS. Verifique os dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStore = stores?.find((store) => store.id === formData.store_id);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg overflow-y-auto p-0 bg-white">
        <div className="p-6 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold text-slate-800">
              {jobToEdit ? "Editar OS" : "Nova OS"}
            </SheetTitle>
            <SheetDescription className="text-slate-500">
              {jobToEdit ? "Atualize os dados desta instalação." : "Registre uma nova instalação ou manutenção."}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Vínculo com a Loja */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Store className="text-blue-600" size={16} /> Cliente / Loja
            </h3>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Selecione a Loja *</label>
              
              <Popover open={openStoreSelect} onOpenChange={setOpenStoreSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStoreSelect}
                    disabled={!!initialStoreId && !jobToEdit}
                    className="w-full justify-between h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-normal text-slate-700 hover:bg-slate-100"
                  >
                    {selectedStore 
                      ? `${selectedStore.name} ${selectedStore.code ? `(${selectedStore.code})` : ''}`
                      : "Pesquisar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl shadow-xl border-slate-200" align="start">
                  <Command className="rounded-xl">
                    <CommandInput placeholder="Digite o nome ou código..." className="h-11" />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {stores?.map((store) => (
                          <CommandItem
                            key={store.id}
                            value={`${store.name} ${store.code || ''} ${store.brand}`}
                            onSelect={() => handleStoreSelect(store.id)}
                            className="py-3 px-4 cursor-pointer hover:bg-blue-50"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-blue-600",
                                formData.store_id === store.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{store.name}</span>
                              <span className="text-xs text-slate-500">{store.brand} {store.code ? `• ${store.code}` : ''}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {initialStoreId && !jobToEdit && (
                <p className="text-xs text-blue-600 mt-1 font-medium">Loja pré-selecionada automaticamente.</p>
              )}
            </div>
          </div>

          {/* Dados da OS */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="text-blue-600" size={16} /> Dados do Serviço
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block flex items-center gap-1">
                  <Hash size={12} /> Número da OS *
                </label>
                <Input 
                  name="os_number" 
                  value={formData.os_number} 
                  onChange={handleChange} 
                  placeholder="Ex: OS-2023-001" 
                  className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                  required 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block flex items-center gap-1">
                  <Calendar size={12} /> Data Agendada
                </label>
                <Input 
                  type="date"
                  name="scheduled_date" 
                  value={formData.scheduled_date} 
                  onChange={handleChange} 
                  className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Tipo de Serviço *</label>
                <div className="relative">
                  <select
                    value={SERVICE_TYPES.includes(formData.type) ? formData.type : (formData.type ? '__custom__' : '')}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setFormData(prev => ({ ...prev, type: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, type: e.target.value }));
                      }
                    }}
                    className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700"
                    required={SERVICE_TYPES.includes(formData.type)}
                  >
                    <option value="">Selecione o tipo...</option>
                    {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">Outro (digitar)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                {!SERVICE_TYPES.includes(formData.type) && (
                  <Input
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="Descreva o tipo de serviço..."
                    className="mt-2 h-11 rounded-xl bg-slate-50 border-slate-200"
                    required
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Status</label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block flex items-center gap-1">
                <User size={12} /> Atribuir a (Instalador)
              </label>
              <div className="relative">
                <select
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={(e) => {
                    const installerId = e.target.value;
                    if (installerId) {
                      const installer = installers?.find((i: any) => i.id === installerId);
                      const { status } = getCnhStatus((installer as any)?.cnh_validade);
                      if (status === 'vencida') {
                        showError('Este instalador está com CNH vencida e não pode ser designado.');
                        return;
                      }
                    }
                    handleChange(e);
                  }}
                  className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700"
                >
                  <option value="">Não atribuído</option>
                  {installers?.map((installer: any) => {
                    const { status } = getCnhStatus(installer.cnh_validade);
                    const bloqueado = status === 'vencida';
                    const cnhLabel =
                      status === 'vencida' ? ' ⛔ CNH Vencida' :
                      status === 'vence_em_breve' ? ' ⚠️ CNH vence em breve' :
                      status === 'nao_cadastrada' ? ' · CNH não cadastrada' : '';
                    return (
                      <option key={installer.id} value={installer.id} disabled={bloqueado}>
                        {installer.first_name} {installer.last_name}{cnhLabel}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              {formData.assigned_to && (() => {
                const inst = installers?.find((i: any) => i.id === formData.assigned_to);
                const { status } = getCnhStatus((inst as any)?.cnh_validade);
                if (status === 'vence_em_breve') {
                  return (
                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-2">
                      Atenção: CNH deste instalador vence em breve.
                    </p>
                  );
                }
                if (status === 'nao_cadastrada') {
                  return (
                    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2">
                      CNH não cadastrada para este instalador.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="text-blue-600" size={16} /> Observações
            </h3>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Instruções ou Detalhes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Adicione detalhes importantes sobre o serviço..."
                className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-700 resize-y"
              />
            </div>
          </div>

          <div className="pt-4 pb-8 flex gap-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border-slate-200 text-slate-600"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin mr-2" size={20} /> Salvando...</>
              ) : (
                <><Save className="mr-2" size={20} /> Salvar OS</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}