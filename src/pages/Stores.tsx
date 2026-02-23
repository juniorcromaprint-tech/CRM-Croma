import React from "react";
import { Search, Store, MapPin, History, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Stores() {
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Lojas & Histórico</h1>
        <p className="text-slate-500 mt-1">Consulte o histórico de instalações e medidas de cada local.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <Input 
          placeholder="Buscar por nome do shopping, rua ou marca..." 
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-center text-slate-500 py-10">Carregando lojas...</p>
      ) : (
        <div className="grid gap-4">
          {stores?.map((store) => (
            <Card key={store.id} className="border-none shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{store.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {store.brand}
                      </span>
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin size={14} /> {store.address}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}