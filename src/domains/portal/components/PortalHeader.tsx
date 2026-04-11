// src/domains/portal/components/PortalHeader.tsx
import { FileText, Building2, Phone, Mail, MapPin, Download } from 'lucide-react';
import type { PortalEmpresa, PortalCliente } from '../services/portal.service';

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function formatCep(cep: string): string {
  const d = cep.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0,5)}-${d.slice(5)}`;
  return cep;
}

interface Props {
  numero: string;
  clienteNome?: string;
  empresa?: PortalEmpresa;
  cliente?: PortalCliente;
  onDownloadPdf?: () => void;
}

export function PortalHeader({ numero, clienteNome, empresa, cliente, onDownloadPdf }: Props) {
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
  const enderecoEmpresa = empresa
    ? [empresa.logradouro, empresa.numero_endereco].filter(Boolean).join(', ')
      + (empresa.bairro ? ` - ${empresa.bairro}` : '')
      + (empresa.municipio ? ` - ${empresa.municipio}` : '')
      + (empresa.uf ? `/${empresa.uf}` : '')
      + (empresa.cep ? ` - CEP: ${formatCep(empresa.cep)}` : '')
    : null;

  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top bar: Logo + Proposal badge + PDF button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo_croma.png"
              alt={nomeEmpresa}
              className="h-10 sm:h-12 w-auto object-contain brightness-0 invert"
            />
          </div>
          <div className="flex items-center gap-2">
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
                title="Baixar PDF"
              >
                <Download size={14} className="text-blue-300" />
                <span className="text-sm font-medium text-blue-100 hidden sm:inline">Baixar PDF</span>
              </button>
            )}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <FileText size={14} className="text-blue-300" />
              <span className="text-sm font-medium text-blue-100">Proposta {numero}</span>
            </div>
          </div>
        </div>

        {/* Company info */}
        {empresa && (
          <div className="mb-5 space-y-1">
            <p className="text-white/90 text-sm font-semibold">{nomeEmpresa}</p>
            {empresa.cnpj && (
              <p className="text-blue-200/70 text-xs">
                CNPJ: {formatCnpj(empresa.cnpj)}
                {empresa.ie && ` | IE: ${empresa.ie}`}
              </p>
            )}
            {enderecoEmpresa && (
              <p className="text-blue-200/60 text-xs flex items-center gap-1">
                <MapPin size={11} className="flex-shrink-0" />
                {enderecoEmpresa}
              </p>
            )}
            {empresa.telefone && (
              <p className="text-blue-200/60 text-xs flex items-center gap-1">
                <Phone size={11} className="flex-shrink-0" />
                {formatPhone(empresa.telefone)}
              </p>
            )}
          </div>
        )}

        {/* Welcome message */}
        {clienteNome && (
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Ola, {clienteNome}!
            </h1>
            <p className="text-blue-200 text-sm sm:text-base max-w-lg">
              Preparamos esta proposta comercial especialmente para voce.
              Confira os detalhes abaixo e aprove quando estiver pronto.
            </p>
          </div>
        )}

        {/* Client info card */}
        {cliente && (cliente.cnpj || cliente.telefone || cliente.email) && (
          <div className="mt-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={14} className="text-blue-300" />
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wide">Dados do Cliente</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-100/80">
              <div>
                <p className="font-medium text-white/90">{cliente.razao_social || cliente.nome_fantasia}</p>
                {cliente.cnpj && <p>CNPJ: {formatCnpj(cliente.cnpj)}</p>}
              </div>
              <div className="space-y-0.5">
                {cliente.telefone && (
                  <p className="flex items-center gap-1"><Phone size={10} /> {formatPhone(cliente.telefone)}</p>
                )}
                {cliente.email && (
                  <p className="flex items-center gap-1"><Mail size={10} /> {cliente.email}</p>
                )}
                {cliente.cidade && (
                  <p className="flex items-center gap-1">
                    <MapPin size={10} />
                    {[cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(' - ')}
                    {cliente.cep && ` - CEP: ${formatCep(cliente.cep)}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 40L60 35C120 30 240 20 360 17.5C480 15 600 20 720 22.5C840 25 960 25 1080 22.5C1200 20 1320 15 1380 12.5L1440 10V40H0Z" fill="#f8fafc" />
        </svg>
      </div>
    </header>
  );
}
