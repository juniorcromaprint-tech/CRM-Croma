import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const PATH_LABELS: Record<string, string> = {
  "": "Início",
  leads: "Leads",
  pipeline: "Pipeline",
  propostas: "Propostas",
  orcamentos: "Orçamentos",
  clientes: "Clientes",
  pedidos: "Pedidos",
  producao: "Produção",
  instalacoes: "Instalações",
  estoque: "Estoque",
  compras: "Compras",
  produtos: "Produtos",
  financeiro: "Financeiro",
  dre: "DRE",
  comissoes: "Comissões",
  ocorrencias: "Ocorrências",
  fiscal: "Fiscal",
  documentos: "Documentos",
  fila: "Fila de Emissão",
  configuracao: "Configuração",
  certificado: "Certificado Digital",
  auditoria: "Auditoria",
  admin: "Administração",
  usuarios: "Usuários",
  config: "Configurações",
  precificacao: "Precificação",
  settings: "Ajustes",
};

function getLabel(segment: string): string {
  return PATH_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on the root / dashboard
  if (segments.length === 0) return null;

  const crumbs: { label: string; path: string }[] = [
    { label: "Início", path: "/" },
  ];

  let accumulated = "";
  for (const segment of segments) {
    // Skip UUID-like segments from showing ugly IDs
    const isUuid = /^[0-9a-f-]{36}$/.test(segment);
    accumulated += "/" + segment;
    crumbs.push({
      label: isUuid ? "Detalhe" : getLabel(segment),
      path: accumulated,
    });
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4 print:hidden" aria-label="Breadcrumb">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={crumb.path}>
            {idx === 0 ? (
              <Link
                to={crumb.path}
                className="text-slate-400 hover:text-blue-600 transition-colors"
                aria-label="Início"
              >
                <Home size={14} />
              </Link>
            ) : isLast ? (
              <span className="font-medium text-slate-700" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-blue-600 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
