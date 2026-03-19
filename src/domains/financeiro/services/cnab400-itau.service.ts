// ─── CNAB 400 — Gerador de Arquivo de Remessa Itaú ─────────────────────────
// Croma Print ERP — Layout CNAB 400 Banco Itaú (341)
// Referência: Arquivo CB11031.TST + Manual Itaú CNAB 400 Cobrança
// Cada linha tem exatamente 400 caracteres
// ─────────────────────────────────────────────────────────────────────────────

import type { BankAccount, BankSlipWithClient } from '../types/boleto.types';

// ─── Helpers de Formatação ───────────────────────────────────────────────────

/** Preenche à direita com espaços (campos alfa) */
function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, ' ');
}

/** Preenche à esquerda com zeros (campos numéricos) */
function padLeft(str: string, len: number, char = '0'): string {
  return str.substring(0, len).padStart(len, char);
}

/** Formata data como DDMMYY */
function formatCnabDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/** Formata data string (YYYY-MM-DD) como DDMMYY */
function dateToCnab(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}${m}${y.slice(-2)}`;
}

/** Converte valor em reais para centavos zero-padded */
function formatCnabValue(value: number, len: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  return padLeft(String(cents), len);
}

/** Remove caracteres especiais (acentos, ç, etc.) para CNAB */
function sanitize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .toUpperCase();
}

/** Extrai apenas dígitos */
function onlyDigits(str: string): string {
  return str.replace(/\D/g, '');
}

// ─── Geração de Registros ────────────────────────────────────────────────────

/**
 * Registro Header (Tipo 0) — Primeira linha do arquivo
 * Layout baseado no arquivo CB11031.TST do Itaú
 */
export function generateHeader(
  account: BankAccount,
  sequencial: number,
  date: Date = new Date(),
): string {
  let line = '';

  // Pos 001-001: Tipo de registro = 0
  line += '0';
  // Pos 002-002: Código de remessa = 1 (Remessa)
  line += '1';
  // Pos 003-009: Literal "REMESSA"
  line += 'REMESSA';
  // Pos 010-011: Código de serviço = 01 (Cobrança)
  line += '01';
  // Pos 012-026: Literal "COBRANCA" (15 posições)
  line += padRight('COBRANCA', 15);
  // Pos 027-030: Agência (4 dígitos)
  line += padLeft(onlyDigits(account.agencia), 4);
  // Pos 031-032: Zeros
  line += '00';
  // Pos 033-037: Conta (5 dígitos)
  line += padLeft(onlyDigits(account.conta), 5);
  // Pos 038-038: DAC conta
  line += padLeft(onlyDigits(account.conta_digito), 1);
  // Pos 039-046: Brancos (8 posições)
  line += padRight('', 8);
  // Pos 047-076: Nome da empresa (30 posições)
  line += padRight(sanitize(account.cedente_nome), 30);
  // Pos 077-079: Código do banco = 341
  line += padLeft(account.banco_codigo, 3);
  // Pos 080-094: Nome do banco (15 posições)
  line += padRight(sanitize(account.banco_nome), 15);
  // Pos 095-100: Data de geração (DDMMAA)
  line += formatCnabDate(date);
  // Pos 101-394: Brancos (294 posições)
  line += padRight('', 294);
  // Pos 395-400: Número sequencial do registro (6 dígitos)
  line += padLeft('1', 6);

  return line;
}

/**
 * Registro Detalhe (Tipo 1) — Um por boleto
 * Layout Itaú CNAB 400 baseado no arquivo de amostra
 */
export function generateDetail(
  slip: BankSlipWithClient,
  account: BankAccount,
  lineNum: number,
): string {
  let line = '';

  const cnpjCedente = onlyDigits(account.cedente_cnpj);
  const cnpjSacado = onlyDigits(slip.sacado_cpf_cnpj);
  const isCnpj = cnpjSacado.length > 11;

  // Pos 001-001: Tipo de registro = 1
  line += '1';
  // Pos 002-003: Tipo de inscrição do cedente (02 = CNPJ)
  line += '02';
  // Pos 004-017: CNPJ do cedente (14 dígitos)
  line += padLeft(cnpjCedente, 14);
  // Pos 018-021: Agência (4 dígitos)
  line += padLeft(onlyDigits(account.agencia), 4);
  // Pos 022-023: Zeros
  line += '00';
  // Pos 024-028: Conta (5 dígitos)
  line += padLeft(onlyDigits(account.conta), 5);
  // Pos 029-029: DAC conta
  line += padLeft(onlyDigits(account.conta_digito), 1);
  // Pos 030-033: Brancos
  line += padRight('', 4);
  // Pos 034-037: Código de instrução (zeros)
  line += '0000';
  // Pos 038-062: Identificação do título na empresa (25 posições)
  line += padRight(slip.seu_numero || '', 25);
  // Pos 063-070: Nosso número (8 dígitos)
  line += padLeft(onlyDigits(slip.nosso_numero), 8);
  // Pos 071-083: Zeros (quantidade de moeda, 13 posições)
  line += padLeft('', 13);
  // Pos 084-086: Carteira (3 dígitos)
  line += padLeft(account.carteira, 3);
  // Pos 087-107: Uso do banco (21 posições)
  line += padRight('', 21);
  // Pos 108-108: Carteira (I = com registro)
  line += 'I';
  // Pos 109-110: Código de ocorrência = 01 (Remessa)
  line += '01';
  // Pos 111-120: Número do documento (10 posições)
  line += padRight(slip.seu_numero || slip.nosso_numero, 10);
  // Pos 121-126: Data de vencimento (DDMMAA)
  line += dateToCnab(slip.data_vencimento);
  // Pos 127-139: Valor do título (13 posições, centavos)
  line += formatCnabValue(slip.valor_nominal, 13);
  // Pos 140-142: Código do banco cobrador = 341
  line += padLeft(account.banco_codigo, 3);
  // Pos 143-147: Agência cobradora (5 posições com zeros)
  line += padLeft('', 5);
  // Pos 148-149: Espécie de documento = DMN (Duplicata Mercantil por Indicação)
  line += padRight('DM', 2);
  // Pos 150-150: Aceite = N
  line += 'N';
  // Pos 151-156: Data de emissão (DDMMAA)
  line += dateToCnab(slip.data_emissao);
  // Pos 157-158: Instrução 1 = 00 (sem instrução)
  line += '00';
  // Pos 159-160: Instrução 2 = 00
  line += '00';
  // Pos 161-173: Valor de juros por dia (13 posições)
  const jurosDiario = (slip.valor_nominal * (account.juros_ao_mes / 100)) / 30;
  line += formatCnabValue(jurosDiario, 13);
  // Pos 174-179: Data limite para desconto (DDMMAA ou zeros)
  line += slip.data_limite_desconto ? dateToCnab(slip.data_limite_desconto) : '000000';
  // Pos 180-192: Valor do desconto (13 posições)
  line += formatCnabValue(slip.valor_desconto || 0, 13);
  // Pos 193-205: Valor do IOF (13 posições, zeros)
  line += padLeft('', 13);
  // Pos 206-218: Valor do abatimento (13 posições, zeros)
  line += padLeft('', 13);
  // Pos 219-220: Tipo de inscrição do sacado (01=CPF, 02=CNPJ)
  line += isCnpj ? '02' : '01';
  // Pos 221-234: CPF/CNPJ do sacado (14 posições)
  line += padLeft(cnpjSacado, 14);
  // Pos 235-274: Nome do sacado (40 posições)
  line += padRight(sanitize(slip.sacado_nome), 40);
  // Pos 275-314: Endereço do sacado (40 posições)
  line += padRight(sanitize(slip.sacado_endereco || ''), 40);
  // Pos 315-326: Bairro (12 posições)
  line += padRight('', 12);
  // Pos 327-334: CEP (8 dígitos)
  line += padLeft(onlyDigits(slip.sacado_cep || ''), 8);
  // Pos 335-349: Cidade (15 posições)
  line += padRight(sanitize(slip.sacado_cidade || ''), 15);
  // Pos 350-351: Estado (2 posições)
  line += padRight(sanitize(slip.sacado_estado || ''), 2);
  // Pos 352-394: Sacador/Avalista + brancos (43 posições)
  line += padRight('', 43);
  // Pos 395-400: Número sequencial do registro (6 dígitos)
  line += padLeft(String(lineNum), 6);

  return line;
}

/**
 * Registro Trailer (Tipo 9) — Última linha do arquivo
 */
export function generateTrailer(lineCount: number): string {
  let line = '';

  // Pos 001-001: Tipo de registro = 9
  line += '9';
  // Pos 002-394: Brancos (393 posições)
  line += padRight('', 393);
  // Pos 395-400: Número sequencial do registro (6 dígitos)
  line += padLeft(String(lineCount), 6);

  return line;
}

// ─── Geração do Arquivo Completo ─────────────────────────────────────────────

export interface RemessaFileResult {
  content: string;
  filename: string;
  totalRegistros: number;
  valorTotal: number;
}

/**
 * Gera o arquivo de remessa CNAB 400 completo para o Itaú.
 *
 * Estrutura:
 * - Linha 1: Header (tipo 0)
 * - Linhas 2..N: Detalhe (tipo 1) — um por boleto
 * - Última linha: Trailer (tipo 9)
 *
 * @param account Conta bancária do cedente
 * @param slips Boletos a incluir na remessa (com dados do cliente)
 * @param sequencial Número sequencial da remessa
 * @param date Data de geração (default: hoje)
 */
export function generateRemessaFile(
  account: BankAccount,
  slips: BankSlipWithClient[],
  sequencial: number,
  date: Date = new Date(),
): RemessaFileResult {
  const lines: string[] = [];

  // Header — linha 1
  lines.push(generateHeader(account, sequencial, date));

  // Detalhes — uma linha por boleto
  let valorTotal = 0;
  for (let i = 0; i < slips.length; i++) {
    const lineNum = i + 2; // header é 1, primeiro detalhe é 2
    lines.push(generateDetail(slips[i], account, lineNum));
    valorTotal += Number(slips[i].valor_nominal) || 0;
  }

  // Trailer — última linha
  const totalLines = lines.length + 1;
  lines.push(generateTrailer(totalLines));

  // Gera nome do arquivo: CB{DDMM}{seq}.REM
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(sequencial).padStart(1, '0');
  const filename = `CB${dd}${mm}${seqStr}.REM`;

  // Valida que todas as linhas têm 400 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 400) {
      lines[i] = lines[i].length > 400
        ? lines[i].substring(0, 400)
        : lines[i].padEnd(400, ' ');
    }
  }

  return {
    content: lines.join('\r\n'),
    filename,
    totalRegistros: slips.length,
    valorTotal,
  };
}

/**
 * Faz download do arquivo de remessa no navegador.
 */
export function downloadRemessaFile(content: string, filename: string): void {
  // CNAB 400 tradicionalmente usa ISO-8859-1, mas bancos modernos aceitam UTF-8
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
