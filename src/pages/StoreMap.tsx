import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Store, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Corrige o problema do ícone padrão do Leaflet no React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Componente para centralizar o mapa na localização do usuário
function LocationMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { animate: true });
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Você está aqui</Popup>
    </Marker>
  );
}

export default function StoreMap() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Busca todas as lojas que possuem latitude e longitude
  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      
      if (error) throw error;
      return data || [];
    }
  });

  const locateUser = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setIsLocating(false);
        },
        (error) => {
          console.error("Erro ao buscar localização:", error);
          setIsLocating(false);
        }
      );
    }
  };

  // Pede a localização assim que a tela abre
  useEffect(() => {
    locateUser();
  }, []);

  // Centro padrão (Brasil) se não tiver localização do usuário
  const defaultCenter: [number, number] = [-14.2350, -51.9253];
  const center = userLocation || defaultCenter;
  const zoom = userLocation ? 14 : 4;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Mapa de Lojas</h1>
          <p className="text-slate-500 mt-1">Veja as lojas próximas a você.</p>
        </div>
        <Button 
          onClick={locateUser} 
          disabled={isLocating}
          className="bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 shadow-sm rounded-xl"
        >
          {isLocating ? <Loader2 className="animate-spin mr-2" size={18} /> : <Navigation size={18} className="mr-2" />}
          Minha Localização
        </Button>
      </div>

      <Card className="flex-1 border-none shadow-sm rounded-2xl overflow-hidden relative z-0">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-slate-500 font-medium">Carregando mapa...</p>
          </div>
        ) : null}

        <MapContainer 
          center={center} 
          zoom={zoom} 
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <LocationMarker position={userLocation} />

          {stores?.map((store) => (
            <Marker 
              key={store.id} 
              position={[store.lat, store.lng]}
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
                      className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700"
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
        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-100 text-xs font-medium text-slate-600">
          <p>Mostrando {stores?.length || 0} lojas com coordenadas.</p>
          <p className="text-slate-400 mt-1 max-w-[200px]">Para aparecer aqui, edite a loja e clique em "Buscar Coordenadas".</p>
        </div>
      </Card>
    </div>
  );
}