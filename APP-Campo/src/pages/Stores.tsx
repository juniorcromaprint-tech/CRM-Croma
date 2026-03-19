import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Store, MapPin, ChevronRight, Filter, Building2, ChevronLeft, Plus, Edit, Map, Check, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import StoreFormSheet from "@/components/StoreFormSheet";

// Componente customizado para Múltipla Seleção
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  icon: React.ElementType;
}

const MultiSelect = ({ options, selected, onChange, placeholder, icon: Icon }: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === 1 
      ? selected[0] 
      : `${selected.length} selecionados`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-700 flex items-center justify-between text-left transition-all"
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon size={18} />
        </div>
        <span className="truncate font-medium">{displayText}</span>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">Nenhuma opção</div>
          ) : (
            <>
              {selected.length > 0 && (
                <div 
                  className="px-4 py-2.5 text-sm text-blue-600 font-bold hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex items-center justify-center transition-colors"
                  onClick={() => { onChange([]); setIsOpen(false); }}
                >
                  Limpar seleção
                </div>
              )}
              {options.map((option) => (
                <div 
                  key={option}
                  className="flex items-center px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 transition-colors"
                  onClick={() => toggleOption(option)}
                >
                  <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors ${selected.includes(option) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {selected.includes(option) && <Check size={12} className="text-white" />}
                  </div>
                  <span className="truncate">{option}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default function Stores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const navigate = useNavigate();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [storeToEdit, setStoreToEdit] = useState<any>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      
      return allData;
    }
  });

  const brands = useMemo(() => {
    if (!stores) return [];
    const uniqueBrands = new Set(stores.map(s => s.brand).filter(Boolean));
    return Array.from(uniqueBrands).sort();
  }, [stores]);

  const states = useMemo(() => {
    if (!stores) return [];
    const uniqueStates = new Set(stores.map(s => s.state?.trim().toUpperCase()).filter(Boolean));
    return Array.from(uniqueStates).sort();
  }, [stores]);

  const neighborhoods = useMemo(() => {
    if (!stores) return [];
    let filtered = stores;
    if (selectedStates.length > 0) {
      filtered = stores.filter(s => s.state && selectedStates.includes(s.state.trim().toUpperCase()));
    }
    const uniqueNeigh = new Set(filtered.map(s => s.neighborhood?.trim()).filter(Boolean));
    return Array.from(uniqueNeigh).sort();
  }, [stores, selectedStates]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reseta a página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedBrands, selectedStates, selectedNeighborhoods]);

  // Limpa os bairros apenas se o estado mudar e já houver bairros selecionados
  // Isso evita o loop infinito no carregamento inicial
  useEffect(() => {
    if (selectedNeighborhoods.length > 0) {
      setSelectedNeighborhoods([]);
    }
  }, [selectedStates]);

  const filteredStores = useMemo(() => {
    if (!stores) return [];

    return stores.filter(store => {
      const searchLower = debouncedSearch.toLowerCase().trim();

      const matchesSearch =
        (String(store.name || "").toLowerCase()).includes(searchLower) ||
        (String(store.corporate_name || "").toLowerCase()).includes(searchLower) ||
        (String(store.code || "").toLowerCase()).includes(searchLower) ||
        (String(store.cnpj || "").toLowerCase()).includes(searchLower) ||
        (String(store.brand || "").toLowerCase()).includes(searchLower) ||
        (String(store.address || "").toLowerCase()).includes(searchLower);

      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(store.brand);
      const matchesState = selectedStates.length === 0 || (store.state && selectedStates.includes(store.state.trim().toUpperCase()));
      const matchesNeighborhood = selectedNeighborhoods.length === 0 || (store.neighborhood && selectedNeighborhoods.includes(store.neighborhood.trim()));

      return matchesSearch && matchesBrand && matchesState && matchesNeighborhood;
    });
  }, [stores, debouncedSearch, selectedBrands, selectedStates, selectedNeighborhoods]);

  const totalPages = Math.ceil(filteredStores.length / itemsPerPage);
  const paginatedStores = filteredStores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNewStore = () => {
    setStoreToEdit(null);
    setIsSheetOpen(true);
  };

  const handleEditStore = (e: React.MouseEvent, store: any) => {
    e.stopPropagation();
    setStoreToEdit(store);
    setIsSheetOpen(true);
  };

  const openRoute = (e: React.MouseEvent, lat: number, lng: number) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Lojas & Clientes</h1>
          <p className="text-slate-500 mt-1">Consulte sua base de clientes e histórico de locais.</p>
        </div>
        <Button 
          onClick={handleNewStore}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Nova Loja
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por nome, razão social, código, CNPJ ou endereço..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm w-full"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MultiSelect 
            options={brands}
            selected={selectedBrands}
            onChange={setSelectedBrands}
            placeholder="Todas as Marcas"
            icon={Filter}
          />

          <MultiSelect 
            options={states}
            selected={selectedStates}
            onChange={setSelectedStates}
            placeholder="Todos os Estados (UF)"
            icon={Map}
          />

          <MultiSelect 
            options={neighborhoods}
            selected={selectedNeighborhoods}
            onChange={setSelectedNeighborhoods}
            placeholder="Todos os Bairros / Regiões"
            icon={MapPin}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p>Carregando lojas...</p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Store className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">Nenhuma loja encontrada</h3>
          <p className="text-slate-500 mt-1">Tente ajustar sua busca ou filtro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500 px-1">
            <span>Mostrando {paginatedStores.length} de {filteredStores.length} lojas</span>
          </div>

          <div className="grid gap-4">
            {paginatedStores.map((store) => {
              const isSynced = store.lat && store.lng;

              return (
                <Card 
                  key={store.id} 
                  onClick={() => navigate(`/stores/${store.id}`)}
                  className="border-none shadow-sm rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group bg-white"
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                        <Store size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-700 transition-colors">{store.name}</h3>
                        
                        {store.corporate_name && store.corporate_name !== store.name && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Building2 size={12} /> {store.corporate_name}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {store.code && (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                              Cód: {store.code}
                            </span>
                          )}
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                            {store.brand}
                          </span>
                          {store.state && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                              {store.state}
                            </span>
                          )}
                          {store.address && (
                            <span className="text-sm text-slate-500 flex items-center gap-1 ml-1" title={isSynced ? "Endereço sincronizado no mapa" : "Endereço sem coordenadas"}>
                              <MapPin size={14} className={isSynced ? "text-emerald-500" : "text-slate-300"} /> 
                              <span className="truncate max-w-[200px] md:max-w-md">
                                {store.neighborhood ? `${store.neighborhood} - ` : ''}{store.address}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      {/* Botão de Rota */}
                      {isSynced ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg h-9 w-9"
                          onClick={(e) => openRoute(e, store.lat, store.lng)}
                          title="Endereço Sincronizado - Traçar Rota"
                        >
                          <Navigation size={18} />
                        </Button>
                      ) : (
                        <div 
                          className="flex items-center justify-center h-9 w-9 text-slate-200 cursor-help"
                          title="Endereço não sincronizado no mapa"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MapPin size={18} />
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-9 w-9"
                        onClick={(e) => handleEditStore(e, store)}
                        title="Editar Loja"
                      >
                        <Edit size={18} />
                      </Button>
                      <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 pb-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="rounded-xl border-slate-200 text-slate-600"
              >
                <ChevronLeft size={16} className="mr-1" /> Anterior
              </Button>
              
              <span className="text-sm font-medium text-slate-500">
                Página {currentPage} de {totalPages}
              </span>
              
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="rounded-xl border-slate-200 text-slate-600"
              >
                Próxima <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      <StoreFormSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
        storeToEdit={storeToEdit} 
      />
    </div>
  );
}