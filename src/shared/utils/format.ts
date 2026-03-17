// ============================================================================
// FORMATAÇÃO — Croma Print ERP/CRM
// Utilitários de formatação para moeda, data, documentos e texto
// ============================================================================

// ---------------------------------------------------------------------------
// MOEDA (BRL)
// ---------------------------------------------------------------------------

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formata valor como moeda brasileira: R$ 1.234,56
 */
export function brl(value: number): string {
  return brlFormatter.format(value);
}

/**
 * Formata valor compacto: R$ 1,2K / R$ 1,2M / R$ 1,2B
 */
export function brlCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}R$ ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return brl(value);
}

// ---------------------------------------------------------------------------
// PERCENTUAL
// ---------------------------------------------------------------------------

/**
 * Calcula e formata percentual: "45,2%"
 */
export function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * Calcula percentual como número: 45.2
 */
export function pctRaw(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Formata data: 09/03/2026
 */
export function formatDate(date: string | Date): string {
  return dateFormatter.format(toDate(date));
}

/**
 * Formata data e hora: 09/03/2026 14:30
 */
export function formatDateTime(date: string | Date): string {
  return dateTimeFormatter.format(toDate(date));
}

/**
 * Formata data relativa: "há 2 dias", "hoje", "amanhã", "há 3 horas"
 */
export function formatDateRelative(date: string | Date): string {
  const now = new Date();
  const target = toDate(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Futuro
  if (diffMs < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'hoje';
    if (absDays === 1) return 'amanhã';
    if (absDays < 7) return `em ${absDays} dias`;
    if (absDays < 30) return `em ${Math.floor(absDays / 7)} semana${Math.floor(absDays / 7) > 1 ? 's' : ''}`;
    return formatDate(target);
  }

  // Passado
  if (diffSeconds < 60) return 'agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) > 1 ? 'meses' : 'mês'}`;
  return formatDate(target);
}

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

/**
 * Formata CNPJ: 12345678000190 → 12.345.678/0001-90
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

/**
 * Remove formatação do CNPJ: 12.345.678/0001-90 → 12345678000190
 */
export function unformatCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

/**
 * Formata CPF: 12345678901 → 123.456.789-01
 */
export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4',
  );
}

// ---------------------------------------------------------------------------
// TELEFONE
// ---------------------------------------------------------------------------

/**
 * Formata telefone: 51999999999 → (51) 99999-9999
 * Aceita 10 ou 11 dígitos.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

/**
 * Formata CEP: 93000000 → 93000-000
 */
export function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return cep;
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

// ---------------------------------------------------------------------------
// PHONE INPUT MASK
// ---------------------------------------------------------------------------

/**
 * Aplica máscara de telefone enquanto digita: (11) 98154-8888 ou (11) 3333-3333
 * Aceita entrada parcial e formata progressivamente.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 11 digits — celular
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ---------------------------------------------------------------------------
// EMAIL VALIDATION
// ---------------------------------------------------------------------------

/**
 * Valida formato de email básico.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return true; // vazio é válido (campo opcional)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// TEXTO
// ---------------------------------------------------------------------------

/**
 * Extrai iniciais de um nome: "Beira Rio Calçados" → "BR"
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Trunca texto com reticências: "Texto longo..."
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trimEnd() + '...';
}

/**
 * Capitaliza a primeira letra: "teste" → "Teste"
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Remove acentos de uma string (para buscas).
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza string para busca: remove acentos e converte para lowercase.
 */
export function normalizeSearch(str: string): string {
  return removeAccents(str).toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// NÚMEROS
// ---------------------------------------------------------------------------

/**
 * Formata número com separador de milhar brasileiro: 1234567.89 → "1.234.567,89"
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata metragem: 12.5 → "12,50 m²"
 */
export function formatArea(value: number): string {
  return `${formatNumber(value)} m\u00B2`;
}
