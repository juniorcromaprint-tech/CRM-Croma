import React, { useState, useMemo } from "react";
import { Search, Plus, Edit, ChevronRight, Building2, Phone, Mail, Users, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import ClienteFormSheet from "@/components/ClienteFormSheet";

const TIPO_LABELS: Record<string, string> = {
  agencia: "Agência",
  cliente_final: "Cliente Final",
  revenda: "Revenda",
};

const TIPO_COLORS: Record<string, string> = {
  agencia: "bg-purple-50 text-purple-700 border-purple-100",
  cliente_final: "bg-blue-50 text-blue-700 border-blue-100",
  revenda: "bg-orange-50 text-orange-700 border-orange-100",
};

const ORIGEM_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  indicacao: "Indicação",
  internet: "Internet",
  carteira: "Carteira",
  email: "E-mail",
};

// Dados de demonstração
const MOCK_CLIENTES = [
  {
    id: "demo-1",
    razao_social: "Calçados Beira Rio S/A",
    nome_fantasia: "Beira Rio",
    cnpj: "94.868.906/0001-56",
    telefone: "(51) 3594-3200",
    email: "marketing@beiraio.com.br",
    tipo_cliente: "cliente_final",
    origem: "prospeccao",
    cidade: "Novo Hamburgo",
    estado: "RS",
    profiles: { first_name: "Edmar" },
  },
  {
    id: "demo-2",
    razao_social: "Lojas Renner S.A.",
    nome_fantasia: "Renner",
    cnpj: "92.754.738/0001-62",
    telefone: "(51) 2121-7000",
    email: "visual@lojasrenner.com.br",
    tipo_cliente: "cliente_final",
    origem: "indicacao",
    cidade: "Porto Alegre",
    estado: "RS",
    profiles: { first_name: "Regiane" },
  },
  {
    id: "demo-3",
    razao_social: "Agência Kreatif Comunicação Ltda",
    nome_fantasia: "Kreatif",
    cnpj: "12.345.678/0001-90",
    telefone: "(11) 3456-7890",
    email: "projetos@kreatif.com.br",
    tipo_cliente: "agencia",
    origem: "internet",
    cidade: "São Paulo",
    estado: "SP",
    profiles: { first_name: "Viviane" },
  },
  {
    id: "demo-4",
    razao_social: "Rede Farmácias São João",
    nome_fantasia: "Farmácias São João",
    cnpj: "87.654.321/0001-00",
    telefone: "(51) 3333-4444",
    email: "compras@saojoao.com.br",
    tipo_cliente: "cliente_final",
    origem: "carteira",
    cidade: "Passo Fundo",
    estado: "RS",
    profiles: { first_name: "Edmar" },
  },
  {
    id: "demo-5",
    razao_social: "Visual Print Comércio e Representações",
    nome_fantasia: "Visual Print",
    cnpj: "55.123.456/0001-77",
    telefone: "(41) 9999-8888",
    email: "comercial@visualprint.com.br",
    tipo_cliente: "revenda",
    origem: "prospeccao",
    cidade: "Curitiba",
    estado: "PR",
    profiles: null,
  },
  {
    id: "demo-6",
    razao_social: "Grupo Paquetá Calçados",
    nome_fantasia: "Paquetá",
    cnpj: "89.123.456/0001-00",
    telefone: "(51) 3594-5000",
    email: "trade@paqueta.com.br",
    tipo_cliente: "cliente_final",
    origem: "indicacao",
    cidade: "Sapiranga",
    estado: "RS",
    profiles: { first_name: "Regiane" },
  },
  {
    id: "demo-7",
    razao_social: "Supermercados BIG",
    nome_fantasia: "BIG",
    cnpj: "01.123.456/0001-99",
    telefone: "(51) 3500-9000",
    email: "mkt@big.com.br",
    tipo_cliente: "cliente_final",
    origem: "carteira",
    cidade: "Porto Alegre",
    estado: "RS",
    profiles: { first_name: "Edmar" },
  },
];

export default function ClientesList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<any>(null);
  const navigate = useNavigate();

  const clientes = MOCK_CLIENTES;

  const filteredClientes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clientes;
    return clientes.filter((c) =>
      (c.razao_social || "").toLowerCase().includes(term) ||
      (c.nome_fantasia || "").toLowerCase().includes(term) ||
      (c.cnpj || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term) ||
      (c.telefone || "").toLowerCase().includes(term) ||
      (c.cidade || "").toLowerCase().includes(term)
    );
  }, [clientes, searchTerm]);

  const handleNew = () => {
    setClienteToEdit(null);
    setIsSheetOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, cliente: any) => {
    e.stopPropagation();
    setClienteToEdit(cliente);
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 mt-1">
            {clientes.length} empresa{clientes.length !== 1 ? "s" : ""} cadastrada{clientes.length !== 1 ? "s" : ""}
            <span className="ml-2 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-medium">DEMO</span>
          </p>
        </div>
        <Button
          onClick={handleNew}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Novo Cliente
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <Input
          placeholder="Buscar por nome, CNPJ, e-mail, cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
        />
      </div>

      {/* Lista */}
      {filteredClientes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum cliente encontrado</h3>
          <p className="text-slate-500 mt-1 text-sm">Tente ajustar a busca.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {filteredClientes.map((cliente) => (
              <Card
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                className="border-none shadow-sm rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group bg-white"
              >
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-700 transition-colors truncate">
                        {cliente.razao_social}
                      </h3>
                      {cliente.nome_fantasia && cliente.nome_fantasia !== cliente.razao_social && (
                        <p className="text-sm text-slate-500 truncate">{cliente.nome_fantasia}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${TIPO_COLORS[cliente.tipo_cliente] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
                          {TIPO_LABELS[cliente.tipo_cliente] || cliente.tipo_cliente}
                        </span>
                        {(cliente.cidade || cliente.estado) && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            📍 {[cliente.cidade, cliente.estado].filter(Boolean).join(" - ")}
                          </span>
                        )}
                        {cliente.telefone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone size={11} /> {cliente.telefone}
                          </span>
                        )}
                        {cliente.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1 hidden md:flex">
                            <Mail size={11} /> {cliente.email}
                          </span>
                        )}
                        {cliente.origem && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Tag size={11} /> {ORIGEM_LABELS[cliente.origem] || cliente.origem}
                          </span>
                        )}
                        {cliente.profiles && (
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-medium">
                            {cliente.profiles.first_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-9 w-9"
                      onClick={(e) => handleEdit(e, cliente)}
                      title="Editar"
                    >
                      <Edit size={16} />
                    </Button>
                    <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors" size={20} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ClienteFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        clienteToEdit={clienteToEdit}
      />
    </div>
  );
}
