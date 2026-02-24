import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Store, Loader2, ExternalLink, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Criando um ícone SVG personalizado que NUNCA falha ou é bloqueado pelo navegador
const customMarkerIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

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

  // Busca TODAS as lojas e filtra no JavaScript para evitar bugs do banco de dados
  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*');
      
      if (error) throw error;
      
      // Filtra apenas as lojas que realmente têm latitude e longitude válidas
      return data?.filter(store => store.lat && store.lng) || [];
    }
  });

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
            Ver Todas
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

      <Card className="flex-1 border-none shadow-sm rounded-2xl overflow-hidden relative z-0">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-slate-500 font-medium">Carregando mapa...</p>
          </div>
        ) : null}

        {/* Mensagem caso não tenha nenhuma loja com coordenada */}
        {!isLoading && stores?.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/95 z-[400] p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <MapPin size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Nenhuma loja no mapa</h3>
            <p className="text-slate-500 mt-2 max-w-md">
              Você ainda não tem lojas com coordenadas salvas. Vá até a lista de lojas, edite uma delas, busque o CEP e <strong>não esqueça de clicar em Salvar</strong>.
            </p>
            <Button onClick={() => navigate('/stores')} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              Ir para Lojas
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
            stores={stores || []} 
            userLocation={userLocation} 
            viewMode={viewMode} 
          />

          {stores?.map((store) => (
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
        {stores && stores.length > 0 && (
          <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-100 text-xs font-medium text-slate-600">
            <p>Mostrando <strong className="text-blue-600 text-sm">{stores.length}</strong> lojas no mapa.</p>
          </div>
        )}
      </Card>
    </div>
  );
}