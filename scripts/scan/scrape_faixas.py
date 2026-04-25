# -*- coding: utf-8 -*-
"""
scrape_faixas.py — Fase 2: Scraping de faixas de quantidade do catálogo Scan
=============================================================================
Captura a tabela de descontos por volume de cada produto tipo "cada" e
faz UPSERT na tabela public.terceirizacao_catalogo_faixas no Supabase.

REQUISITO: Cookie autenticado da conta Viviane (#4055) na Scan.
           Sem cookie, o site não exibe preços nem faixas.

Como obter o cookie:
  1. Abrir https://www.revendascan.com.br logado como Viviane
  2. F12 → Application → Cookies → www.revendascan.com.br
  3. Copiar TODOS os cookies e colar abaixo em SCAN_COOKIES

Uso:
  python scrape_faixas.py
  python scrape_faixas.py --dry-run   # só mostra, não salva
  python scrape_faixas.py --limit 10  # só primeiros 10 produtos
"""

import json
import os
import re
import sys
import time
import argparse
import urllib.request
import urllib.parse
from datetime import datetime

# ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

# Cole aqui o cookie completo da conta da Viviane (copiar do DevTools)
# Exemplo: "PHPSESSID=abc123; outros_cookies=valor"
SCAN_COOKIES = os.environ.get("SCAN_COOKIES", "")

SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

CATALOGO_JSON = r"C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\catalogo_final.json"

RATE_LIMIT_MS = 500   # ms entre requests
LOG_EVERY = 10        # logar progresso a cada N produtos

# ─── HEADERS HTTP ─────────────────────────────────────────────────────────────

def build_headers(with_cookie: bool = True) -> dict:
    h = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.revendascan.com.br/",
    }
    if with_cookie and SCAN_COOKIES:
        h["Cookie"] = SCAN_COOKIES
    return h


# ─── PARSING HTML ─────────────────────────────────────────────────────────────

def parse_faixas(html: str) -> list[dict]:
    """
    Extrai faixas de quantidade do HTML da página do produto.
    Padrões esperados (baseado em descoberta de 2026-04-24):
      - "Acima de 1 = R$ 17,00"
      - Tabela HTML com colunas Quantidade / Valor
      - Bloco JS com array de faixas
    """
    faixas = []

    # Padrão 1: texto "Acima de N" com preço
    pattern_texto = re.compile(
        r'[Aa]cima\s+de\s+(\d+)\s*[=:–\-]?\s*R\$\s*([\d\.,]+)',
        re.IGNORECASE
    )
    for m in pattern_texto.finditer(html):
        qtd = int(m.group(1))
        preco_str = m.group(2).replace('.', '').replace(',', '.')
        try:
            preco = float(preco_str)
            faixas.append({"qtd_min": qtd, "preco_unitario": preco})
        except ValueError:
            pass

    # Padrão 2: tabela HTML com th/td contendo quantidade e preço
    if not faixas:
        rows = re.findall(
            r'<tr[^>]*>.*?<td[^>]*>\s*(\d+)\s*</td>.*?R\$\s*([\d\.,]+).*?</tr>',
            html, re.DOTALL | re.IGNORECASE
        )
        for qtd_str, preco_str in rows:
            try:
                qtd = int(qtd_str)
                preco = float(preco_str.replace('.', '').replace(',', '.'))
                faixas.append({"qtd_min": qtd, "preco_unitario": preco})
            except ValueError:
                pass

    # Padrão 3: JSON embutido no script com array de faixas
    if not faixas:
        json_blocks = re.findall(
            r'tabelaFaixas\s*=\s*(\[.*?\])',
            html, re.DOTALL
        )
        for block in json_blocks:
            try:
                data = json.loads(block)
                for item in data:
                    qtd = item.get("qtd") or item.get("quantidade") or item.get("qtd_min")
                    preco = item.get("preco") or item.get("valor") or item.get("preco_unitario")
                    if qtd and preco:
                        faixas.append({"qtd_min": int(qtd), "preco_unitario": float(str(preco).replace(',', '.'))})
            except (json.JSONDecodeError, TypeError):
                pass

    # Deduplica e ordena
    seen = set()
    result = []
    for f in faixas:
        key = f["qtd_min"]
        if key not in seen:
            seen.add(key)
            result.append(f)
    result.sort(key=lambda x: x["qtd_min"])
    return result


# ─── SUPABASE ─────────────────────────────────────────────────────────────────

def get_catalogo_ids() -> dict:
    """Retorna {url: id} de todos os produtos ativos tipo 'cada'."""
    if not SUPABASE_KEY:
        print("[WARN] SUPABASE_SERVICE_KEY não definida. Usando IDs do JSON local.")
        return {}

    url = f"{SUPABASE_URL}/rest/v1/terceirizacao_catalogo?select=id,url,preco_unidade&ativo=eq.true&preco_unidade=eq.cada"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    return {row["url"]: row["id"] for row in data if row.get("url")}


def upsert_faixas(catalogo_id: str, faixas: list[dict], dry_run: bool = False) -> bool:
    if not faixas:
        return False
    if dry_run:
        print(f"  [DRY-RUN] upsert {len(faixas)} faixas para {catalogo_id}")
        return True
    if not SUPABASE_KEY:
        print(f"  [SKIP] Sem SUPABASE_SERVICE_KEY — não salvou")
        return False

    payload = [
        {
            "catalogo_id": catalogo_id,
            "qtd_min": f["qtd_min"],
            "preco_unitario": f["preco_unitario"],
            "capturado_em": datetime.utcnow().isoformat() + "Z",
        }
        for f in faixas
    ]

    body = json.dumps(payload).encode("utf-8")
    url = f"{SUPABASE_URL}/rest/v1/terceirizacao_catalogo_faixas"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201, 204)
    except urllib.error.HTTPError as e:
        print(f"  [ERROR] Supabase upsert {e.code}: {e.read().decode()[:200]}")
        return False


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape faixas de quantidade do catálogo Scan")
    parser.add_argument("--dry-run", action="store_true", help="Só mostra, não salva no banco")
    parser.add_argument("--limit", type=int, default=0, help="Limita a N produtos (0 = todos)")
    args = parser.parse_args()

    if not SCAN_COOKIES:
        print("ERRO: SCAN_COOKIES não definida.")
        print("  Defina via: set SCAN_COOKIES=PHPSESSID=xxx; outros_cookies=yyy")
        print("  Ou edite a variável SCAN_COOKIES neste arquivo.")
        sys.exit(1)

    # Carregar catálogo local
    with open(CATALOGO_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)

    # Filtrar só "cada" (têm faixas de quantidade)
    produtos_cada = [p for p in catalogo if p.get("preco_unidade") == "cada" and p.get("url")]
    print(f"Produtos tipo 'cada': {len(produtos_cada)}")

    if args.limit:
        produtos_cada = produtos_cada[:args.limit]
        print(f"Limitando a {args.limit} produtos")

    # Buscar IDs do banco (url -> id)
    id_map = get_catalogo_ids()
    if not id_map:
        # Fallback: carregar do banco via query direta (se supabase_key disponível)
        # ou usar IDs do JSON se existirem
        print("[INFO] Buscando IDs via fallback (sem filtro de preco_unidade)...")

    stats = {"ok": 0, "sem_faixas": 0, "erro": 0, "sem_id": 0}
    total = len(produtos_cada)

    for i, produto in enumerate(produtos_cada):
        url = produto["url"]
        nome = produto.get("nome", "?")

        if i > 0 and i % LOG_EVERY == 0:
            print(f"[{i}/{total}] ok={stats['ok']} sem_faixas={stats['sem_faixas']} erro={stats['erro']}")

        # Buscar ID do banco
        catalogo_id = id_map.get(url)
        if not catalogo_id:
            # Tentar buscar pelo nome no banco se não achou pela URL
            stats["sem_id"] += 1
            if args.dry_run:
                catalogo_id = "00000000-0000-0000-0000-000000000000"  # placeholder
            else:
                print(f"  [SKIP] {nome} — ID não encontrado no banco")
                continue

        # Fetch página com autenticação
        try:
            req = urllib.request.Request(url, headers=build_headers(with_cookie=True))
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  [ERRO fetch] {nome}: {e}")
            stats["erro"] += 1
            time.sleep(RATE_LIMIT_MS / 1000)
            continue

        # Parsear faixas
        faixas = parse_faixas(html)

        if faixas:
            print(f"  [{i+1}/{total}] {nome}: {len(faixas)} faixas — {[f['qtd_min'] for f in faixas]}")
            ok = upsert_faixas(catalogo_id, faixas, dry_run=args.dry_run)
            if ok:
                stats["ok"] += 1
            else:
                stats["erro"] += 1
        else:
            stats["sem_faixas"] += 1

        time.sleep(RATE_LIMIT_MS / 1000)

    print(f"\n=== RESULTADO ===")
    print(f"Total processado: {total}")
    print(f"Com faixas salvas: {stats['ok']}")
    print(f"Sem faixas no HTML: {stats['sem_faixas']}")
    print(f"IDs não encontrados: {stats['sem_id']}")
    print(f"Erros: {stats['erro']}")
    pct = (stats['ok'] / total * 100) if total else 0
    print(f"Taxa de captura: {pct:.1f}%")

    if stats["ok"] < total * 0.5:
        print("\n[WARN] Taxa de captura < 50% — pode ser que o cookie expirou ou o HTML mudou.")
        print("  → Renovar cookie: DevTools → Application → Cookies → copiar PHPSESSID")


if __name__ == "__main__":
    main()
