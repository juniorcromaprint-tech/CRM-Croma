/**
 * Valida CNPJ com cálculo dos dois dígitos verificadores.
 * Retorna true para valores vazios/nulos (CNPJ é opcional na conversão lead→cliente).
 */
export function validarCNPJ(cnpj: string | null | undefined): boolean {
  if (!cnpj || cnpj.trim() === '') return true;

  // Remove caracteres não numéricos
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;

  // Rejeita todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Cálculo do 1º dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12], 10) !== digit1) return false;

  // Cálculo do 2º dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[13], 10) !== digit2) return false;

  return true;
}
