// src/domains/contabilidade/services/ofx-parser.service.ts

export interface OFXTransaction {
  trntype: string;      // DEBIT, CREDIT, XFER, etc.
  dtposted: string;     // YYYYMMDD
  trnamt: number;       // valor (negativo = débito)
  fitid: string;        // ID único da transação
  memo: string;         // descrição
}

export interface OFXResult {
  bankId: string;
  acctId: string;
  dtStart: string;
  dtEnd: string;
  transactions: OFXTransaction[];
}

export function parseOFX(content: string): OFXResult {
  // OFX pode ter header SGML antes do XML
  const xmlStart = content.indexOf('<OFX>');
  const xml = xmlStart >= 0 ? content.substring(xmlStart) : content;

  // Extrair info da conta
  const bankId = extractTag(xml, 'BANKID') || '';
  const acctId = extractTag(xml, 'ACCTID') || '';
  const dtStart = extractTag(xml, 'DTSTART') || '';
  const dtEnd = extractTag(xml, 'DTEND') || '';

  // Extrair transações
  const transactions: OFXTransaction[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = trnRegex.exec(xml)) !== null) {
    const block = match[1];
    const trnamt = parseFloat(extractTag(block, 'TRNAMT') || '0');

    transactions.push({
      trntype: extractTag(block, 'TRNTYPE') || 'OTHER',
      dtposted: extractTag(block, 'DTPOSTED')?.substring(0, 8) || '',
      trnamt,
      fitid: extractTag(block, 'FITID') || '',
      memo: extractTag(block, 'MEMO') || extractTag(block, 'NAME') || '',
    });
  }

  return { bankId, acctId, dtStart: formatOFXDate(dtStart), dtEnd: formatOFXDate(dtEnd), transactions };
}

function extractTag(xml: string, tag: string): string | null {
  // OFX tags podem não ter closing tag (SGML style)
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

export function formatOFXDate(d: string): string {
  if (!d || d.length < 8) return '';
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
}
