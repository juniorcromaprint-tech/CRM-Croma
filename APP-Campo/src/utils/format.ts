// ============================================================================
// FORMATAÇÃO — APP-Campo (Croma Print)
//
// REGRA DE TIMEZONE — IMPORTANTE
// -----------------------------------------------------------------------------
// Campos `date` puro do Postgres (ex.: scheduled_date) chegam como string
// "YYYY-MM-DD". Se forem passados direto para `new Date(string)`, o JavaScript
// interpreta como UTC 00:00 — em SP (UTC-3) isso vira o dia anterior às 21h
// e renderiza com -1 dia ("bug do fuso horário").
//
// Por isso `formatDate` quebra a string manualmente quando detecta o padrão
// DATE puro e só entra no caminho de `Date` real para timestamps com hora.
//
// Use `formatDate` para qualquer campo `date` ou `timestamptz`.
// Use `formatDateTime` quando quiser exibir hora (sempre converte para
// timezone local — só faz sentido para timestamps).
// ============================================================================

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateFormatterFromDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Formata data como dd/MM/yyyy.
 * Trata DATE puro ("YYYY-MM-DD") sem passar por `new Date()` para evitar
 * shift de timezone. Veja comentário no topo do arquivo.
 */
export function formatDate(
  date: string | Date | null | undefined,
): string {
  if (date === null || date === undefined || date === "") return "";

  if (typeof date === "string") {
    if (DATE_ONLY_REGEX.test(date)) {
      const [y, m, d] = date.split("-");
      return `${d}/${m}/${y}`;
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return dateFormatterFromDate.format(parsed);
  }

  if (Number.isNaN(date.getTime())) return "";
  return dateFormatterFromDate.format(date);
}

/**
 * Formata data e hora: 09/03/2026 14:30 — sempre converte para timezone local.
 * Use APENAS para timestamps; para campos `date` puro use `formatDate`.
 */
export function formatDateTime(
  date: string | Date | null | undefined,
): string {
  if (date === null || date === undefined || date === "") return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "";
  return dateTimeFormatter.format(parsed);
}
