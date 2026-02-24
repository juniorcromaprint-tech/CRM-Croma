import React, { useState, useEffect } from "react";
import { Save, Loader2, Store, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";

interface StoreFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  storeToEdit: any | null;
}

export default function StoreFormSheet({ isOpen, onClose, storeToEdit }: StoreFormSheetProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    corporate_name: "",
    cnpj: "",
    code: "",
    address: "",
    neighborhood: "",
    state: "",
    zip_code: "",
    email: "",
    phone: ""
  });

  // Preenche o formulário se estiver editando, ou limpa se for nova loja
  useEffect(() => {
    if (storeToEdit) {
      setFormData({
        name: storeToEdit.name || "",
        brand: storeToEdit.brand || "",
        corporate_name: storeToEdit.corporate_name || "",
        cnpj: storeToEdit.cnpj || "",
        code: storeToEdit.code || "",
        address: storeToEdit.address || "",
        neighborhood: storeToEdit.neighborhood || "",
        state: storeToEdit.state || "",
        zip_code: storeToEdit.zip_code || "",
        email: storeToEdit.email || "",
        phone: storeToEdit.phone || ""
      });
    } else {
      setFormData({
        name: "", brand: "", corporate_name: "", cnpj: "", code: "",
        address: "", neighborhood: "", state: "", zip_code: "", email: "", phone: ""
      });
    }
  }, [storeToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.brand) {
      showError("Nome e Marca são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (storeToEdit) {
        // Atualizar loja existente
        const { error } = await supabase.from('stores').update(formData).eq('id', storeToEdit.id);
        if (error) throw error;
        showSuccess("Loja atualizada com sucesso!");
      } else {
        // Criar nova loja
        const { error } = await supabase.from('stores').insert([formData]);
        if (error) throw error;
        showSuccess("Loja cadastrada com sucesso!");
      }
      
      // Atualiza a lista de lojas em segundo plano
      queryClient.invalidateQueries({ queryKey: ['all-stores'] });
      onClose();
    } catch (error) {
      console.error(error);
      showError("Erro ao salvar a loja. Verifique os dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg overflow-y-auto p-0 bg-white">
        <div className="p-6 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold text-slate-800">
              {storeToEdit ? "Editar Loja" : "Nova Loja"}
            </SheetTitle>
            <SheetDescription className="text-slate-500">
              {storeToEdit ? "Atualize os dados do cliente ou loja." : "Cadastre um novo cliente ou loja no sistema."}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Informações Principais */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Store className="text-blue-600" size={16} /> Dados Principais
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome da Loja *</label>
                <Input name="name" value={formData.name} onChange={handleChange} placeholder="Ex: Shopping Morumbi" className="h-11 rounded-xl bg-slate-50 border-slate-200" required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Marca / Rede *</label>
                <Input name="brand" value={formData.brand} onChange={handleChange} placeholder="Ex: VICCI" className="h-11 rounded-xl bg-slate-50 border-slate-200" required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Razão Social</label>
                <Input name="corporate_name" value={formData.corporate_name} onChange={handleChange} placeholder="Ex: Vicci Comércio Ltda" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">CNPJ</label>
                  <Input name="cnpj" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Código</label>
                  <Input name="code" value={formData.code} onChange={handleChange} placeholder="Ex: LJ-001" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="text-blue-600" size={16} /> Endereço
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Endereço Completo</label>
                <Input name="address" value={formData.address} onChange={handleChange} placeholder="Rua, Avenida, Número..." className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Bairro</label>
                  <Input name="neighborhood" value={formData.neighborhood} onChange={handleChange} placeholder="Ex: Centro" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">CEP</label>
                  <Input name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="00000-000" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Estado (UF)</label>
                <Input name="state" value={formData.state} onChange={handleChange} placeholder="Ex: SP" className="h-11 rounded-xl bg-slate-50 border-slate-200" maxLength={2} />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Phone className="text-blue-600" size={16} /> Contato
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">E-mail</label>
                <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contato@loja.com" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Telefone / WhatsApp</label>
                <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>
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
                <><Save className="mr-2" size={20} /> Salvar</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}