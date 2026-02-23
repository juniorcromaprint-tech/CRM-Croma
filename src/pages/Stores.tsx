import React from "react";
import { Search, Store, MapPin, History, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function Stores() {
  const stores = [
    { id: 1, name: "Shopping Morumbi - Loja 142", brand: "Beira Rio", lastVisit: "12/10/2023", issues: true },
    { id: 2, name: "Rua Oscar Freire, 120", brand: "Vizzano", lastVisit: "05/11/2023", issues: false },
    { id: 3, name: "Shopping Tatuapé - Loja 45", brand: "Moleca", lastVisit: "20/09/2023", issues: false },
  ];

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

      <div className="grid gap-4">
        {stores.map((store) => (
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
                      <History size={14} /> Última visita: {store.lastVisit}
                    </span>
                  </div>
                  {store.issues && (
                    <p className="text-xs font-medium text-rose-600 mt-2 flex items-center gap-1 bg-rose-50 inline-flex px-2 py-1 rounded-md">
                      ⚠️ Histórico de divergência de medidas nesta loja
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}