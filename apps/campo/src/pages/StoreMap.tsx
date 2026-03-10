import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Store, Loader2, ExternalLink, Maximize, Filter, Map as MapIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Criando um ícone SVG personalizado
const customMarkerIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Componente customizado para Múltipla Seleção (Filtros)
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
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-700 flex items-center justify-between text-left transition-all"
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon size={16} />
        </div>
        <span className="truncate font-medium">{displayText}</span>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[1000] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2">
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

// Componente interno para controlar a câmera do mapa
function MapController({ 
  stores, 
  userLocation, 
  viewMode 
}: { 
  stores: any[], 
  userLocation: [number, number] | null,
  viewMode: 'all' | 'user'
}) {
  const map = useMap();
  
  useEffect(() => {
    if (viewMode === 'all' && stores && stores.length > 0) {
      const bounds = L.latLngBounds(stores.map(s => [s.lat, s.lng]));
      // Adiciona um padding para os marcadores não ficarem colados na borda
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (viewMode === 'user' && userLocation) {
      map.flyTo(userLocation, 14, { animate: true });
    }
  }, [stores, userLocation, viewMode, map]);

  return userLocation ? (
    <Marker position={userLocation}>
      <Popup>Você está aqui</Popup>
    </Marker>
  ) : null;
}

export default function StoreMap() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'user'>('all');

  // Estados dos Filtros
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);

  // Busca TODAS as lojas e filtra no JavaScript
  const { data: allStores, isLoading } = useQuery({
    queryKey: ['stores-map'],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
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

  // Extrai opções únicas para os filtros
  const brands = useMemo(() => {
    if (!allStores) return [];
    const uniqueBrands = new Set(allStores.map(s => s.brand).filter(Boolean));
    return Array.from(uniqueBrands).sort();
  }, [allStores]);

  const states = useMemo(() => {
    if (!allStores) return [];
    const uniqueStates = new Set(allStores.map(s => s.state?.trim().toUpperCase()).filter(Boolean));
    return Array.from(uniqueStates).sort();
  }, [allStores]);

  const neighborhoods = useMemo(() => {
    if (!allStores) return [];
    let filtered = allStores;
    if (selectedStates.length > 0) {
      filtered = allStores.filter(s => s.state && selectedStates.includes(s.state.trim().toUpperCase()));
    }
    const uniqueNeigh = new Set(filtered.map(s => s.neighborhood?.trim()).filter(Boolean));
    return Array.from(uniqueNeigh).sort();
  }, [allStores, selectedStates]);

  // Limpa os bairros apenas se o estado mudar e já houver bairros selecionados
  // Isso evita o loop infinito no carregamento inicial
  useEffect(() => {
    if (selectedNeighborhoods.length > 0) {
      setSelectedNeighborhoods([]);
    }
  }, [selectedStates]);

  // Aplica os filtros nas lojas
  const filteredStores = useMemo(() => {
    if (!allStores) return [];
    
    return allStores.filter(store => {
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(store.brand);
      const matchesState = selectedStates.length === 0 || (store.state && selectedStates.includes(store.state.trim().toUpperCase()));
      const matchesNeighborhood = selectedNeighborhoods.length === 0 || (store.neighborhood && selectedNeighborhoods.includes(store.neighborhood.trim()));

      return matchesBrand && matchesState && matchesNeighborhood;
    });
  }, [allStores, selectedBrands, selectedStates, selectedNeighborhoods]);

  const locateUser = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setViewMode('user');
          setIsLocating(false);
        },
        (error) => {
          console.error("Erro ao buscar localização:", error);
          setIsLocating(false);
        }
      );
    }
  };

  const showAllStores = () => {
    setViewMode('all');
  };

  // Centro padrão (Brasil)
  const defaultCenter: [number, number] = [-14.2350, -51.9253];

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Mapa de Lojas</h1>
          <p className="text-slate-500 mt-1">Veja as lojas próximas a você.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={showAllStores} 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm rounded-xl"
          >
            <Maximize size={18} className="mr-2" />
            Ajustar Zoom
          </Button>
          <Button 
            onClick={locateUser} 
            disabled={isLocating}
            className="bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 shadow-sm rounded-xl"
          >
            {isLocating ? <Loader2 className="animate-spin mr-2" size={18} /> : <Navigation size={18} className="mr-2" />}
            Minha Localização
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 relative z-[500]">
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
          icon={MapIcon}
        />
        <MultiSelect 
          options={neighborhoods}
          selected={selectedNeighborhoods}
          onChange={setSelectedNeighborhoods}
          placeholder="Todos os Bairros / Regiões"
          icon={MapPin}
        />
      </div>

      <Card className="flex-1 border-none shadow-sm rounded-2xl overflow-hidden relative z-0">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-slate-500 font-medium">Carregando mapa...</p>
          </div>
        ) : null}

        {/* Mensagem caso não tenha nenhuma loja com coordenada */}
        {!isLoading && allStores?.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/95 z-[400] p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <MapPin size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Nenhuma loja no mapa</h3>
            <p className="text-slate-500 mt-2 max-w-md">
              Você pode adicionar coordenadas às lojas na tela de Lojas ou usar a Sincronização em Massa nas Configurações.
            </p>
            <Button onClick={() => navigate('/settings')} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              Ir para Configurações
            </Button>
          </div>
        )}

        <MapContainer 
          center={defaultCenter} 
          zoom={4} 
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController 
            stores={filteredStores || []} 
            userLocation={userLocation} 
            viewMode={viewMode} 
          />

          {filteredStores?.map((store) => (
            <Marker 
              key={store.id} 
              position={[store.lat, store.lng]}
              icon={customMarkerIcon}
            >
              <Popup className="rounded-xl">
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <Store size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 leading-tight">{store.name}</h3>
                      <p className="text-xs font-bold text-blue-600">{store.brand}</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-3 flex items-start gap-1">
                    <MapPin size={12} className="shrink-0 mt-0.5" />
                    {store.address}, {store.neighborhood}
                  </p>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      Ver Loja
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full text-xs h-8"
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`, '_blank')}
                    >
                      <ExternalLink size={12} className="mr-1" /> Rota
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legenda flutuante */}
        {allStores && allStores.length > 0 && (
          <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-100 text-xs font-medium text-slate-600">
            <p>Mostrando <strong className="text-blue-600 text-sm">{filteredStores.length}</strong> de {allStores.length} lojas.</p>
          </div>
        )}
      </Card>
    </div>
  );
}