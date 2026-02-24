import React, { useState, useMemo, useEffect } from "react";
import { Search, Store, MapPin, ChevronRight, Filter, Building2, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Stores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const navigate = useNavigate();

  const { data: stores, isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      // Loop para buscar de 1000 em 1000 e burlar o limite do banco
      while (true) {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        
        // Se vieram menos de 1000, significa que acabaram os registros
        if (data.length < pageSize) break;
        page++;
      }
      
      return allData;
    }
  });

  // Extrai todas as marcas únicas para o filtro
  const brands = useMemo(() => {
    if (!stores) return [];
    const uniqueBrands = new Set(stores.map(s => s.brand).filter(Boolean));
    return Array.from(uniqueBrands).sort();
  }, [stores]);

  // Reseta a página para 1 sempre que o usuário digitar algo na busca ou mudar o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBrand]);

  // Filtra as lojas com base na busca e na marca selecionada
  const filteredStores = useMemo(() => {
    if (!stores) return [];
    
    return stores.filter(store => {
      const searchLower = searchTerm.toLowerCase().trim();
      
      const matchesSearch = 
        (String(store.name || "").toLowerCase()).includes(searchLower) ||
        (String(store.corporate_name || "").toLowerCase()).includes(searchLower) ||
        (String(store.code || "").toLowerCase()).includes(searchLower) ||
        (String(store.cnpj || "").toLowerCase()).includes(searchLower) ||
        (String(store.brand || "").toLowerCase()).includes(searchLower) ||
        (String(store.address || "").toLowerCase()).includes(searchLower);

      const matchesBrand = selectedBrand === "all" || store.brand === selectedBrand;

      return matchesSearch && matchesBrand;
    });
  }, [stores, searchTerm, selectedBrand]);

  // Paginação
  const totalPages = Math.ceil(filteredStores.length / itemsPerPage);
  const paginatedStores = filteredStores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
            placeholder="Buscar por nome, razão social, código, CNPJ ou endereço..." 
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
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500 px-1">
            <span>Mostrando {paginatedStores.length} de {filteredStores.length} lojas</span>
          </div>

          <div className="grid gap-4">
            {paginatedStores.map((store) => (
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

          {/* Controles de Paginação */}
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
    </div>
  );
}