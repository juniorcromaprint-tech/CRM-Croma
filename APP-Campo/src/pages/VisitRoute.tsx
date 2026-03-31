import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Navigation, MapPin, Loader2, CheckCircle2, Store,
  ArrowLeft, Route, ExternalLink, Plus, Filter, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

/** Calcula distância entre dois pontos (Haversine) em km */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Gera código automático para merchandising */
function generateMerchCode(): string {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `MERCH-${year}-${rand}`;
}

/** Gera URL de rota multi-parada (Google Maps) */
function buildGoogleMapsRoute(stores: { lat: number; lng: number }[]): string {
  if (stores.length === 0) return "";
  const dest = stores[stores.length - 1];
  const waypoints = stores.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

/** Gera URL de rota Waze (single dest — Waze não suporta multi-waypoint via URL) */
function buildWazeRoute(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

type StoreWithDistance = {
  id: string;
  name: string;
  brand: string;
  address: string;
  neighborhood: string;
  state: string;
  lat: number;
  lng: number;
  distance: number;
  origem: string;
  cliente_id: string | null;
};

export default function VisitRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // GPS state
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Filtros e seleção
  const [maxDistance, setMaxDistance] = useState(10); // km
  const [maxStores, setMaxStores] = useState(10);
  const [brandFilter, setBrandFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingOS, setIsCreatingOS] = useState(false);
  const [osCreated, setOsCreated] = useState(false);

  // Buscar todas as stores com coordenadas
  const { data: allStores } = useQuery({
    queryKey: ["stores-with-coords"],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("stores")
          .select("id, name, brand, address, neighborhood, state, lat, lng, origem, cliente_id")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .order("name")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      return allData;
    },
  });

  // Lojas próximas ordenadas por distância
  const nearbyStores: StoreWithDistance[] = useMemo(() => {
    if (!allStores || userLat === null || userLng === null) return [];

    const brandLower = brandFilter.toLowerCase().trim();

    return allStores
      .map((s: any) => ({
        ...s,
        distance: haversine(userLat, userLng, s.lat, s.lng),
      }))
      .filter((s: StoreWithDistance) => s.distance <= maxDistance)
      .filter((s: StoreWithDistance) => !brandLower || s.brand?.toLowerCase().includes(brandLower))
      .sort((a: StoreWithDistance, b: StoreWithDistance) => a.distance - b.distance)
      .slice(0, maxStores);
  }, [allStores, userLat, userLng, maxDistance, maxStores, brandFilter]);

  // Lojas selecionadas (na ordem de seleção)
  const selectedStores = useMemo(
    () => nearbyStores.filter((s) => selectedIds.has(s.id)),
    [nearbyStores, selectedIds]
  );

  // Capturar GPS
  const captureGPS = () => {
    setIsLocating(true);
    setGpsError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setIsLocating(false);
          setSelectedIds(new Set());
          setOsCreated(false);
          showSuccess("Localização capturada!");
        },
        () => {
          setIsLocating(false);
          setGpsError("Não foi possível capturar o GPS. Verifique as permissões.");
          showError("Erro ao capturar GPS.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setIsLocating(false);
      setGpsError("GPS não suportado neste dispositivo.");
    }
  };

  // Toggle seleção
  const toggleStore = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecionar / desmarcar todas
  const selectAll = () => {
    if (selectedIds.size === nearbyStores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nearbyStores.map((s) => s.id)));
    }
  };

  // Criar OS de merchandising para todas as selecionadas
  const createAllOS = async () => {
    if (selectedStores.length === 0) return;
    setIsCreatingOS(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const jobs = selectedStores.map((store) => ({
        store_id: store.id,
        os_number: generateMerchCode(),
        type: "Merchandising",
        scheduled_date: today,
        status: "Pendente",
        notes: `Roteiro de visitas - ${selectedStores.length} lojas`,
      }));

      const { error } = await supabase.from("jobs").insert(jobs);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["all-jobs"] });
      setOsCreated(true);
      showSuccess(`${jobs.length} OS de merchandising criadas!`);
    } catch {
      showError("Erro ao criar as OS. Tente novamente.");
    } finally {
      setIsCreatingOS(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-600">
          <ArrowLeft size={24} />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Roteiro de Visitas</h1>
          <p className="text-slate-500 mt-1">Monte sua rota de merchandising com lojas próximas.</p>
        </div>
      </div>

      {/* Passo 1: Capturar GPS */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-6">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-black">1</div>
            Onde você está?
          </h2>

          {userLat && userLng ? (
            <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={20} />
                <span className="font-bold">GPS capturado</span>
                <span className="text-xs text-emerald-500 font-mono">
                  {userLat.toFixed(4)}, {userLng.toFixed(4)}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={captureGPS} className="text-xs">
                Atualizar
              </Button>
            </div>
          ) : (
            <Button
              onClick={captureGPS}
              disabled={isLocating}
              className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold"
            >
              {isLocating ? (
                <><Loader2 className="animate-spin mr-2" size={22} /> Capturando GPS...</>
              ) : (
                <><Navigation className="mr-2" size={22} /> Capturar minha localização</>
              )}
            </Button>
          )}
          {gpsError && <p className="text-sm text-red-600 mt-2">{gpsError}</p>}
        </CardContent>
      </Card>

      {/* Passo 2: Filtros (só mostra após GPS) */}
      {userLat && userLng && (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardContent className="p-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-black">2</div>
              Filtrar lojas próximas
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Raio máximo (km)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-sm font-bold text-blue-700 w-12 text-right">{maxDistance} km</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Máx. de lojas</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={maxStores}
                    onChange={(e) => setMaxStores(Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-sm font-bold text-blue-700 w-12 text-right">{maxStores}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Filtrar marca</label>
                <Input
                  placeholder="Ex: Beira Rio"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                <span className="font-bold text-blue-700">{nearbyStores.length}</span> lojas encontradas num raio de {maxDistance}km
              </p>
              {nearbyStores.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                  {selectedIds.size === nearbyStores.length ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 3: Lista de lojas próximas */}
      {userLat && userLng && nearbyStores.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 px-1">
            <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-black">3</div>
            Selecione as lojas para visitar
          </h2>

          {nearbyStores.map((store) => {
            const isSelected = selectedIds.has(store.id);

            return (
              <Card
                key={store.id}
                onClick={() => toggleStore(store.id)}
                className={`border-2 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-transparent bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Checkbox visual */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isSelected ? <CheckCircle2 size={18} /> : <Store size={16} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 truncate">{store.name}</h3>
                      {store.origem === "crm" && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                          CRM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {store.brand} {store.address ? `• ${store.address}` : ""} {store.neighborhood ? `• ${store.neighborhood}` : ""}
                    </p>
                  </div>

                  {/* Distância */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-blue-700">{store.distance.toFixed(1)} km</p>
                    <p className="text-[10px] text-slate-400">{store.state}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sem lojas no raio */}
      {userLat && userLng && nearbyStores.length === 0 && allStores && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MapPin size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma loja no raio de {maxDistance}km</h3>
          <p className="text-sm text-slate-400 mt-1">Aumente o raio ou limpe o filtro de marca.</p>
        </div>
      )}

      {/* Passo 4: Ações — criar OS + abrir rota */}
      {selectedStores.length > 0 && (
        <div className="sticky bottom-4 z-20">
          <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-800">
                  {selectedStores.length} {selectedStores.length === 1 ? "loja selecionada" : "lojas selecionadas"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedStores.reduce((sum, s) => sum + s.distance, 0).toFixed(1)} km total
                </p>
              </div>

              {!osCreated ? (
                <Button
                  onClick={createAllOS}
                  disabled={isCreatingOS}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
                >
                  {isCreatingOS ? (
                    <><Loader2 className="animate-spin mr-2" size={20} /> Criando OS...</>
                  ) : (
                    <><Plus className="mr-2" size={20} /> Criar {selectedStores.length} OS de Merchandising</>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">{selectedStores.length} OS criadas com sucesso!</span>
                </div>
              )}

              {/* Botões de rota */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(buildGoogleMapsRoute(selectedStores), "_blank")}
                  className="flex-1 h-11 rounded-xl text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 font-bold"
                >
                  <Navigation size={16} className="mr-2" /> Rota Google Maps
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Waze não suporta multi-waypoint, abre a primeira loja
                    const first = selectedStores[0];
                    window.open(buildWazeRoute(first.lat, first.lng), "_blank");
                  }}
                  className="flex-1 h-11 rounded-xl text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 font-bold"
                >
                  <ExternalLink size={16} className="mr-2" /> Rota Waze
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Google Maps suporta rota com múltiplas paradas. Waze abre a primeira loja.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
