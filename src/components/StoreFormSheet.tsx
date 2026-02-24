import React, { useState, useEffect } from "react";
import { Save, Loader2, Store, MapPin, Phone, Navigation, Search } from "lucide-react";
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
  const [isLocating, setIsLocating] = useState(false);

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
    phone: "",
    lat: null as number | null,
    lng: null as number | null
  });

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
        phone: storeToEdit.phone || "",
        lat: storeToEdit.lat || null,
        lng: storeToEdit.lng || null
      });
    } else {
      setFormData({
        name: "", brand: "", corporate_name: "", cnpj: "", code: "",
        address: "", neighborhood: "", state: "", zip_code: "", email: "", phone: "",
        lat: null, lng: null
      });
    }
  }, [storeToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Busca coordenadas de forma inteligente usando ViaCEP + OpenStreetMap
  const geocodeAddress = async () => {
    if (!formData.address && !formData.zip_code) {
      showError("Preencha o CEP ou o Endereço para buscar no mapa.");
      return;
    }

    setIsLocating(true);
    try {
      let data = null;

      // 1. Tenta usar o CEP primeiro (ViaCEP) para descobrir a cidade exata
      if (formData.zip_code) {
        const cleanCep = formData.zip_code.replace(/\D/g, '');
        if (cleanCep.length === 8) {
          try {
            const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const viaCepData = await viaCepRes.json();

            if (!viaCepData.erro) {
              // Atualiza os campos do formulário automaticamente se estiverem vazios
              setFormData(prev => ({
                ...prev,
                address: prev.address || viaCepData.logradouro,
                neighborhood: prev.neighborhood || viaCepData.bairro,
                state: prev.state || viaCepData.uf,
              }));

              // Extrai o número do endereço digitado (se houver) para maior precisão
              const numeroMatch = formData.address.match(/\d+/);
              const numero = numeroMatch ? numeroMatch[0] : '';
              const ruaComNumero = numero ? `${viaCepData.logradouro}, ${numero}` : viaCepData.logradouro;

              // Busca no mapa com a cidade exata que o ViaCEP retornou
              const query = `${ruaComNumero}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
              const nominatimData = await res.json();
              
              if (nominatimData && nominatimData.length > 0) {
                data = nominatimData;
              }
            }
          } catch (e) {
            console.error("Erro ao consultar ViaCEP", e);
          }
        }
      }

      // 2. Se não achou pelo CEP, tenta pelo endereço digitado
      if (!data && formData.address && formData.state) {
        // Limpa o endereço (remove "Loja 1", "Térreo", etc que confundem o mapa)
        const cleanAddress = formData.address.split(',')[0].split('-')[0].trim();
        
        const queries = [
          `${cleanAddress}, ${formData.neighborhood ? formData.neighborhood + ',' : ''} ${formData.state}, Brasil`,
          `${cleanAddress}, ${formData.state}, Brasil`
        ];

        for (const query of queries) {
          if (data) break;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
          const nominatimData = await res.json();
          if (nominatimData && nominatimData.length > 0) {
            data = nominatimData;
          }
        }
      }

      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        }));
        showSuccess("Coordenadas encontradas com sucesso!");
      } else {
        showError("Endereço não encontrado. Dica: Preencha o CEP corretamente ou simplifique o nome da rua.");
      }
    } catch (error) {
      showError("Erro ao buscar coordenadas.");
    } finally {
      setIsLocating(false);
    }
  };

  // Pega a localização atual do GPS do celular
  const captureCurrentLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }));
          setIsLocating(false);
          showSuccess("Localização atual capturada!");
        },
        (error) => {
          setIsLocating(false);
          showError("Não foi possível capturar o GPS. Verifique as permissões.");
        }
      );
    } else {
      setIsLocating(false);
      showError("Geolocalização não suportada neste dispositivo.");
    }
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
        const { error } = await supabase.from('stores').update(formData).eq('id', storeToEdit.id);
        if (error) throw error;
        showSuccess("Loja atualizada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['store', storeToEdit.id] });
      } else {
        const { error } = await supabase.from('stores').insert([formData]);
        if (error) throw error;
        showSuccess("Loja cadastrada com sucesso!");
      }
      
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

          {/* Endereço e Mapa */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="text-blue-600" size={16} /> Endereço & Mapa
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">CEP</label>
                  <Input name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="00000-000" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end">
                  <p className="text-xs text-slate-400 mb-3">Dica: Digite o CEP e clique em buscar abaixo para preencher.</p>
                </div>
              </div>
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
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Estado (UF)</label>
                  <Input name="state" value={formData.state} onChange={handleChange} placeholder="Ex: SP" className="h-11 rounded-xl bg-slate-50 border-slate-200" maxLength={2} />
                </div>
              </div>

              {/* Coordenadas GPS */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                <label className="text-xs font-bold text-blue-800 mb-2 block uppercase tracking-wider">Coordenadas para o Mapa</label>
                
                {formData.lat && formData.lng ? (
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-blue-200 mb-3">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <MapPin size={16} />
                      <span className="text-sm font-bold">Localização Salva</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}</span>
                  </div>
                ) : (
                  <p className="text-sm text-blue-600 mb-3">Nenhuma coordenada salva. A loja não aparecerá no mapa.</p>
                )}

                <div className="flex flex-col gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={geocodeAddress}
                    disabled={isLocating}
                    className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    {isLocating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Search size={16} className="mr-2" />}
                    Buscar pelo CEP ou Endereço
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={captureCurrentLocation}
                    disabled={isLocating}
                    className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    {isLocating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Navigation size={16} className="mr-2" />}
                    Usar meu GPS Atual (Estou na loja)
                  </Button>
                </div>
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