// src/domains/dados/engine/validators/common.ts

const VALID_UFS = new Set([
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]);

export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  const calc = (digits: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(digits[i]) * w, 0);

  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];

  let remainder = calc(clean, w1) % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(clean[12]) !== d1) return false;

  remainder = calc(clean, w2) % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(clean[13]) === d2;
}

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      sum += parseInt(clean[i]) * (t + 1 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (parseInt(clean[t]) !== remainder) return false;
  }
  return true;
}

export function validateCNPJorCPF(value: string): boolean {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 14) return validateCNPJ(value);
  if (clean.length === 11) return validateCPF(value);
  return false;
}

export function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // optional
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

export function validateUF(uf: string): boolean {
  return VALID_UFS.has(uf.toUpperCase().trim());
}

export function parseBRDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

export interface ValidationError {
  row: number;
  column: string;
  value: string;
  reason: string;
}
