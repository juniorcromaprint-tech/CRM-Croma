import { Building2, Phone, Mail, MapPin } from 'lucide-react';
import type { OSCliente } from '../../types/ordem-servico';

interface OSClienteInfoProps {
  cliente: OSCliente;
}

function formatCNPJ(cnpj: string | null): string {
  if (!cnpj) return '';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cnpj;
}

function buildEndereco(c: OSCliente): string {
  const parts = [
    c.endereco,
    c.numero,
    c.complemento,
    c.bairro,
    c.cep ? `CEP: ${c.cep}` : null,
    c.cidade,
    c.estado,
  ].filter(Boolean);
  return parts.join(', ');
}

export function OSClienteInfo({ cliente }: OSClienteInfoProps) {
  const endereco = buildEndereco(cliente);
  const docFormatado = formatCNPJ(cliente.cnpj || cliente.cpf_cnpj);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Cliente</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-800">
              {cliente.nome_fantasia || cliente.razao_social}
            </span>
          </div>
          {cliente.nome_fantasia && (
            <p className="text-sm text-slate-500 ml-6">{cliente.razao_social}</p>
          )}
          {docFormatado && (
            <p className="text-sm text-slate-500 ml-6">CNPJ/CPF: {docFormatado}</p>
          )}
        </div>
        <div className="space-y-1">
          {cliente.telefone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={14} className="text-slate-400" />
              {cliente.telefone}
            </div>
          )}
          {cliente.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail size={14} className="text-slate-400" />
              {cliente.email}
            </div>
          )}
        </div>
      </div>
      {endereco && (
        <div className="flex items-start gap-2 text-sm text-slate-600 mt-2 pt-2 border-t border-slate-100">
          <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
          {endereco}
        </div>
      )}
    </div>
  );
}
