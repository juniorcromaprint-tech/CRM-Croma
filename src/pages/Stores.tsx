import React, { useState, useMemo } from "react";
import { Search, Store, MapPin, ChevronRight, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Stores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");

  const { data: stores, isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Extrai todas as marcas únicas para o filtro
  const brands = useMemo(() => {
    if (!stores) return [];
    const uniqueBrands = new Set(stores.map(s => s.brand).filter(Boolean));
    return Array.from(uniqueBrands).sort();
  }, [stores]);

  // Filtra as lojas com base na busca e na marca selecionada
  const filteredStores = useMemo(() => {
    if (!stores) return [];
    
    return stores.filter(store => {
      const searchLower = searchTerm.toLowerCase();
      
      // Verifica se o termo de busca bate com nome, código, marca ou endereço
      const matchesSearch = 
        (store.name?.toLowerCase() || "").includes(searchLower) ||
        (store.code?.toLowerCase() || "").includes(searchLower) ||
        (store.brand?.toLowerCase() || "").includes(searchLower) ||
        (store.address?.toLowerCase() || "").includes(searchLower);

      // Verifica se a marca bate com o filtro selecionado
      const matchesBrand = selectedBrand === "all" || store.brand === selectedBrand;

      return matchesSearch && matchesBrand;
    });
  }, [stores, searchTerm, selectedBrand]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Lojas & Clientes</h1>
        <p className="text-slate-500 mt-1">Consulte sua base de clientes e histórico de locais.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por nome, código, marca ou endereço..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm w-full"
          />
        </div>
        
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700"
          >
            <option value="all">Todas as Marcas</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          {/* Ícone de seta customizado para o select */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
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
        <div className="grid gap-4">
          {filteredStores.map((store) => (
            <Card key={store.id} className="border-none shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer group bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{store.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {store.code && (
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          Cód: {store.code}
                        </span>
                      )}
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                        {store.brand}
                      </span>
                      {store.address && (
                        <span className="text-sm text-slate-500 flex items-center gap-1 ml-1">
                          <MapPin size={14} /> 
                          <span className="truncate max-w-[200px] md:max-w-md">{store.address}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}