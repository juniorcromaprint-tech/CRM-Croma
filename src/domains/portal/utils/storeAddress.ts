// src/domains/portal/utils/storeAddress.ts
// =============================================================================
// Helper: formata o snapshot da loja (config_snapshot.store) gravado pela
// Edge Function briefing-beira-rio (v9+) para o bloco "Loja de destino" do
// portal /p/:token. Aceita snapshot vivo sem acoplar tipos do Supabase.
//
// Parser inclui workaround pra coluna stores.state vinda do CSV legado em
// formato 'CIDADE-UF' (1254/1572 rows na producao). Mantemos esse parser ate
// migration que normalize state -> city + state separados.
// =============================================================================

export type StoreSnapshot = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  brand?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

export type StoreLocation = {
  hasAny: boolean;        // se vale a pena renderizar o bloco
  identifier: string;     // ex: "186958-1 · Giseli" ou só código
  displayName: string;    // brand || name || ''
  addressLine: string;    // ex: "Avenida Sao Miguel, 4392 · Vila Rio Branco"
  cityLine: string;       // ex: "Sao Paulo/SP · CEP 03870-000"
};

/**
 * Parser de `stores.state` que pode vir em 2 formatos:
 *  - 'SP'           -> { city: null,        uf: 'SP' }
 *  - 'GUARULHOS-SP' -> { city: 'Guarulhos', uf: 'SP' }
 * Capitaliza a cidade ("GUARULHOS" -> "Guarulhos").
 */
export function parseStateField(
  rawState: string | null | undefined
): { city: string | null; uf: string | null } {
  if (!rawState) return { city: null, uf: null };
  const s = rawState.trim();
  if (!s) return { city: null, uf: null };
  if (s.length === 2) return { city: null, uf: s.toUpperCase() };
  // formato CIDADE-UF (ultimo hifen + 2 letras no fim)
  const lastDash = s.lastIndexOf('-');
  if (lastDash > 0 && s.length - lastDash === 3) {
    const cityRaw = s.slice(0, lastDash).trim();
    const uf = s.slice(lastDash + 1).toUpperCase();
    const city = cityRaw
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
    return { city: city || null, uf };
  }
  return { city: null, uf: s.toUpperCase() };
}

/**
 * Formata o snapshot da loja em linhas prontas pra renderizar no portal.
 * Retorna `hasAny=false` quando nenhum campo util esta presente — usar pra
 * decidir se o bloco "Loja de destino" deve ser renderizado.
 */
export function formatStoreLocation(
  store: StoreSnapshot | null | undefined
): StoreLocation {
  if (!store) {
    return { hasAny: false, identifier: '', displayName: '', addressLine: '', cityLine: '' };
  }
  const code = (store.code ?? '').trim();
  const name = (store.name ?? '').trim();
  const brand = (store.brand ?? '').trim();
  const displayName = brand || name;
  const identifier = [code, displayName].filter(Boolean).join(' · ');

  // city pode vir ja preenchido no snapshot. Se NULL, parseia de state.
  let cityVal = (store.city ?? '').trim();
  const stateRaw = (store.state ?? '').trim();
  const parsed = parseStateField(stateRaw);
  if (!cityVal && parsed.city) cityVal = parsed.city;
  const uf = parsed.uf ?? (stateRaw.length === 2 ? stateRaw.toUpperCase() : '');

  const addressBits = [
    (store.address ?? '').trim(),
    (store.neighborhood ?? '').trim(),
  ].filter(Boolean);
  const addressLine = addressBits.join(' · ');

  const cityBits = [
    [cityVal, uf].filter(Boolean).join('/'),
    store.zip_code ? `CEP ${store.zip_code}` : '',
  ].filter(Boolean);
  const cityLine = cityBits.join(' · ');

  const hasAny = !!(code || displayName || addressLine || cityLine);
  return { hasAny, identifier, displayName, addressLine, cityLine };
}
