// ─── CNAB 400 — Parser de Arquivo de Retorno Itaú ───────────────────────────
// Croma Print ERP — Layout CNAB 400 Banco Itaú (341)
// Referência: Manual Itaú CNAB 400 Cobrança — Arquivo de Retorno
// Cada linha tem exatamente 400 caracteres
// ─────────────────────────────────────────────────────────────────────────────

export interface RetornoHeader {
  codigoRegistro: string;
  codigoRetorno: string;
  dataGeracao: string;
  nomeBanco: string;
}

export interface RetornoDetalhe {
  codigoRegistro: string;
  nossoNumero: string;
  valorPago: number;
  dataPagamento: Date | null;
  dataCredito: Date | null;
  valorTarifa: number;
  codigoOcorrencia: string;
  numeroDocumento: string;
}

export interface RetornoTrailer {
  codigoRegistro: string;
  quantidadeRegistros: number;
  valorTotal: number;
}

export interface RetornoParseado {
  header: RetornoHeader;
  detalhes: RetornoDetalhe[];
  trailer: RetornoTrailer;
  liquidacoes: RetornoDetalhe[];
}

const OCORRENCIAS: Record<string, string> = {
  '02': 'Confirmação de entrada',
  '03': 'Rejeição de entrada',
  '06': 'Liquidação normal',
  '09': 'Baixa automática',
  '10': 'Baixa por ter sido liquidado',
  '17': 'Liquidação após baixa',
  '33': 'Confirmação de alteração',
};

function parseDateCNAB(ddmmyy: string): Date | null {
  if (!ddmmyy || ddmmyy === '000000') return null;
  const day = parseInt(ddmmyy.substring(0, 2), 10);
  const month = parseInt(ddmmyy.substring(2, 4), 10) - 1;
  const year = 2000 + parseInt(ddmmyy.substring(4, 6), 10);
  return new Date(year, month, day);
}

export function parseRetornoHeader(line: string): RetornoHeader {
  return {
    codigoRegistro: line[0],
    codigoRetorno: line[1],
    dataGeracao: line.substring(94, 100),
    nomeBanco: line.substring(76, 79) === '341' ? 'Itaú' : 'Desconhecido',
  };
}

export function parseRetornoLine(line: string, index: number): RetornoDetalhe | null {
  if (line[0] !== '1') return null;
  return {
    codigoRegistro: '1',
    nossoNumero: line.substring(62, 70).trim(),
    codigoOcorrencia: line.substring(108, 110),
    dataPagamento: parseDateCNAB(line.substring(110, 116)),
    valorPago: parseInt(line.substring(253, 266), 10) / 100,
    valorTarifa: parseInt(line.substring(175, 188), 10) / 100,
    dataCredito: parseDateCNAB(line.substring(295, 301)),
    numeroDocumento: line.substring(116, 126).trim(),
  };
}

export function parseRetornoTrailer(line: string): RetornoTrailer {
  return {
    codigoRegistro: line[0],
    quantidadeRegistros: parseInt(line.substring(17, 25), 10),
    valorTotal: parseInt(line.substring(25, 39), 10) / 100,
  };
}

export function parseRetornoFile(content: string): RetornoParseado {
  const lines = content.split(/\r?\n/).filter(l => l.length >= 400);
  if (lines.length < 2) {
    throw new Error('Arquivo de retorno inválido: menos de 2 linhas');
  }
  const header = parseRetornoHeader(lines[0]);
  if (header.codigoRegistro !== '0') {
    throw new Error('Header inválido: primeiro caractere deve ser 0');
  }
  const detalhes: RetornoDetalhe[] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const d = parseRetornoLine(lines[i], i);
    if (d) detalhes.push(d);
  }
  const trailer = parseRetornoTrailer(lines[lines.length - 1]);
  const liquidacoes = detalhes.filter(d =>
    ['06', '09', '10', '17'].includes(d.codigoOcorrencia)
  );
  return { header, detalhes, trailer, liquidacoes };
}

export function getOcorrenciaLabel(codigo: string): string {
  return OCORRENCIAS[codigo] || `Ocorrência ${codigo}`;
}
