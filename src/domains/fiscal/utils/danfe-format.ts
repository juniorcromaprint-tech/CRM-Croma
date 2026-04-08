/**
 * DANFE — Helpers de formatacao fiscal
 * Formatadores para CNPJ, CPF, CEP, chave de acesso, moeda, etc.
 * Usados tanto no template HTML do DANFE quanto no preview React.
 */

/** Formata CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '').padStart(14, '0');
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/** Formata CPF: 000.000.000-00 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '').padStart(11, '0');
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** Formata CNPJ ou CPF automaticamente */
export function formatCNPJouCPF(doc: string | null | undefined): string {
  if (!doc) return '';
  const digits = doc.replace(/\D/g, '');
  if (digits.length <= 11) return formatCPF(doc);
  return formatCNPJ(doc);
}

/** Formata CEP: 00000-000 */
export function formatCEP(cep: string | null | undefined): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '').padStart(8, '0');
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/** Formata telefone: (00) 0000-0000 ou (00) 00000-0000 */
export function formatFone(fone: string | null | undefined): string {
  if (!fone) return '';
  const digits = fone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`;
  return fone;
}

/**
 * Formata chave de acesso NF-e em grupos de 4 digitos
 * Ex: 3526 0404 1875 8000 0390 5500 9000 3731 9211 5300 8724
 */
export function formatChaveAcesso(chave: string | null | undefined): string {
  if (!chave) return '';
  const digits = chave.replace(/\D/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Formata valor monetario BRL: 1.234,56 */
export function formatMoeda(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return '0,00';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata quantidade com ate 4 casas decimais */
export function formatQtd(valor: number | null | undefined, casas = 4): string {
  if (valor == null || isNaN(valor)) return '0';
  // Remove trailing zeros
  const formatted = valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
  return formatted;
}

/** Formata valor unitario com ate 4 casas */
export function formatValorUnitario(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return '0,00';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Formata aliquota com 2 casas: 18,00 */
export function formatAliquota(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return '0,00';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata data ISO para dd/mm/aaaa */
export function formatDataBR(data: string | null | undefined): string {
  if (!data) return '';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return ''; }
}

/** Formata data ISO para dd/mm/aaaa HH:mm:ss */
export function formatDataHoraBR(data: string | null | undefined): string {
  if (!data) return '';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      + ' ' + d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return ''; }
}

/** Formata numero da NF-e com 9 digitos: 000373192 */
export function formatNumeroNFe(numero: number | string | null | undefined): string {
  if (numero == null) return '';
  return String(numero).padStart(9, '0');
}

/** Formata serie com 3 digitos: 009 */
export function formatSerie(serie: number | string | null | undefined): string {
  if (serie == null) return '';
  return String(serie).padStart(3, '0');
}

/** Tipo de operacao: 0=Entrada, 1=Saida */
export function tipoOperacao(tipo: number | string | null | undefined): string {
  return String(tipo) === '0' ? '0 - ENTRADA' : '1 - SAÍDA';
}

/** Frete por conta */
export function fretePorConta(mod: number | string | null | undefined): string {
  const map: Record<string, string> = {
    '0': '0-Contrat. por conta do Remetente (CIF)',
    '1': '1-Contrat. por conta do Destinatário (FOB)',
    '2': '2-Contrat. por conta de Terceiros',
    '3': '3-Transporte Próprio por conta do Remetente',
    '4': '4-Transporte Próprio por conta do Destinatário',
    '9': '9-Sem Ocorrência de Transporte',
  };
  return map[String(mod)] ?? `${mod}`;
}

/** Escapa HTML */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
