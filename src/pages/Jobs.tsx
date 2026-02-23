import React from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Plus, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Jobs() {
  const jobs = [
    { id: "OS-1042", client: "Beira Rio", store: "Shopping Morumbi", date: "Hoje", status: "Pendente", type: "Adesivagem Vitrine" },
    { id: "OS-1041", client: "Vizzano", store: "Rua Oscar Freire, 120", date: "Hoje", status: "Concluído", type: "Placa Fachada" },
    { id: "OS-1040", client: "Moleca", store: "Shopping Tatuapé", date: "Ontem", status: "Concluído", type: "Adesivo Interno" },
    { id: "OS-1039", client: "Beira Rio", store: "Shopping Ibirapuera", date: "Ontem", status: "Divergência", type: "Adesivagem Vitrine" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Concluído": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200";
      case "Pendente": return "bg-amber-100 text-amber-700 hover:bg-amber-200";
      case "Divergência": return "bg-rose-100 text-rose-700 hover:bg-rose-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Instalações</h1>
          <p className="text-slate-500 mt-1">Gerencie todas as ordens de serviço.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
          <Plus size={20} className="mr-2" /> Nova OS
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por cliente, loja ou OS..." 
            className="pl-10 rounded-xl border-slate-200 bg-white h-12"
          />
        </div>
        <Button variant="outline" className="h-12 w-12 rounded-xl border-slate-200 bg-white p-0 flex-shrink-0">
          <Filter size={20} className="text-slate-600" />
        </Button>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => (
          <Link 
            key={job.id} 
            to={`/jobs/${job.id}`}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                  {job.id}
                </span>
                <Badge variant="secondary" className={getStatusColor(job.status)}>
                  {job.status}
                </Badge>
              </div>
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Calendar size={14} /> {job.date}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1">{job.client} - {job.type}</h3>
            
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              <MapPin size={16} className="text-slate-400" />
              <span>{job.store}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}