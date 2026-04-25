# -*- coding: utf-8 -*-
"""
scrape_variacoes.py - Fase 3: Scraping de variacoes do catalogo Scan
=============================================================================
Captura radios var[cor], var[revestimento], var[opcao] etc. das paginas de
produto e gera UPSERT em public.terceirizacao_catalogo_variacoes.

Modos:
  --dry-run            : so imprime, nao salva
  --output-json PATH   : coleta em JSON (para pipeline via MCP, sem SERVICE_KEY)
  (default)            : upsert direto via REST, precisa SUPABASE_SERVICE_KEY

REQUISITO: Cookie autenticado da conta Viviane (#4055) na Scan.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from html import unescape

# --- CONFIG -----------------------------------------------------------------

SCAN_COOKIES = os.environ.get("SCAN_COOKIES", "")
SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

CATALOGO_JSON_WINDOWS = r"C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\catalogo_final.json"
CATALOGO_JSON_LINUX = "/sessions/kind-bold-cerf/mnt/JARVIS/parceiros/scan-revenda/catalogo_final.json"


def resolve_catalogo_path():
    override = os.environ.get("CATALOGO_JSON")
    if override and os.path.exists(override):
        return override
    for p in (CATALOGO_JSON_WINDOWS, CATALOGO_JSON_LINUX):
        if os.path.exists(p):
            return p
    return CATALOGO_JSON_WINDOWS


CATALOGO_JSON = resolve_catalogo_path()
RATE_LIMIT_MS = 500
LOG_EVERY = 20

TIPO_MAP = {
    "cor": "cor", "cores": "cor", "color": "cor",
    "revestimento": "revestimento", "revestimentos": "revestimento",
    "laminacao": "revestimento", "laminação": "revestimento",
    "opcao": "opcao", "opção": "opcao", "opcoes": "opcao", "opções": "opcao",
    "tamanho": "opcao", "dimensao": "opcao", "dimensão": "opcao",
    "formato": "opcao", "acabamento": "opcao", "acabamentos": "opcao",
    "material": "opcao", "gramatura": "opcao",
}


def normalizar_tipo(chave):
    return TIPO_MAP.get(chave.strip().lower(), "outro")


def build_headers(with_cookie=True):
    h = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.revendascan.com.br/",
    }
    if with_cookie and SCAN_COOKIES:
        h["Cookie"] = SCAN_COOKIES
    return h


# --- PARSING ---------------------------------------------------------------

def strip_tags(html_frag):
    txt = re.sub(r"<[^>]+>", " ", html_frag)
    return re.sub(r"\s+", " ", unescape(txt)).strip()


def attr(tag_inner, name):
    m = re.search(r'\b' + name + r'\s*=\s*["\']([^"\']+)["\']', tag_inner, re.IGNORECASE)
    return m.group(1) if m else ""


def parse_variacoes(html):
    variacoes = []
    seen = set()
    ordem_por_chave = {}

    # Padrao Scan: <label ...> <input type="radio" name="var[chave]" value="N"> Rotulo </label>
    label_re = re.compile(
        r'<label\b([^>]*)>\s*(<input\b[^>]*?name\s*=\s*["\']var\[([^\]]+)\]["\'][^>]*?>)\s*([^<]*?)</label>',
        re.IGNORECASE | re.DOTALL,
    )
    for m in label_re.finditer(html):
        label_attrs = m.group(1)
        input_tag = m.group(2)
        chave = m.group(3).strip().lower()
        texto = strip_tags(m.group(4))
        value = attr(input_tag, "value")
        if not value:
            continue
        tipo = attr(input_tag, "type")
        if tipo and tipo.lower() != "radio":
            continue
        key = (chave, value)
        if key in seen:
            continue
        rotulo = texto.strip() or attr(label_attrs, "data-label") or attr(input_tag, "title") or value
        if len(rotulo) > 120:
            rotulo = rotulo[:120]
        ordem = ordem_por_chave.get(chave, 0)
        ordem_por_chave[chave] = ordem + 1
        seen.add(key)
        variacoes.append({"chave": chave, "valor_id": value.strip(), "rotulo": rotulo, "ordem": ordem})

    # Fallback: radios soltos
    for m in re.finditer(r'<input\b([^>]+?)/?>', html, re.IGNORECASE | re.DOTALL):
        blob = m.group(1)
        tipo = attr(blob, "type")
        name = attr(blob, "name")
        value = attr(blob, "value")
        if not name or not value:
            continue
        if tipo and tipo.lower() != "radio":
            continue
        km = re.match(r'var\[([^\]]+)\]', name, re.IGNORECASE)
        if not km:
            continue
        chave = km.group(1).strip().lower()
        key = (chave, value)
        if key in seen:
            continue
        rotulo = attr(blob, "data-label") or attr(blob, "title") or value
        ordem = ordem_por_chave.get(chave, 0)
        ordem_por_chave[chave] = ordem + 1
        seen.add(key)
        variacoes.append({"chave": chave, "valor_id": value.strip(), "rotulo": rotulo, "ordem": ordem})

    # Selects
    for ms in re.finditer(r'<select\b[^>]*?\bname\s*=\s*["\']var\[([^\]]+)\]["\'][^>]*>(.*?)</select>',
                          html, re.IGNORECASE | re.DOTALL):
        chave = ms.group(1).strip().lower()
        corpo = ms.group(2)
        for mo in re.finditer(r'<option\b[^>]*?\bvalue\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</option>',
                              corpo, re.IGNORECASE | re.DOTALL):
            valor_id = mo.group(1).strip()
            rotulo = strip_tags(mo.group(2))
            if (not valor_id or valor_id == "0") and re.search(r'selecione|escolha', rotulo, re.IGNORECASE):
                continue
            key = (chave, valor_id)
            if key in seen:
                continue
            seen.add(key)
            ordem = ordem_por_chave.get(chave, 0)
            ordem_por_chave[chave] = ordem + 1
            if len(rotulo) > 120:
                rotulo = rotulo[:120]
            variacoes.append({"chave": chave, "valor_id": valor_id, "rotulo": rotulo or valor_id, "ordem": ordem})

    return variacoes


# --- SUPABASE --------------------------------------------------------------

def get_catalogo_ids():
    if not SUPABASE_KEY:
        return {}
    url = SUPABASE_URL + "/rest/v1/terceirizacao_catalogo?select=id,url&ativo=eq.true"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    return {row["url"]: row["id"] for row in data if row.get("url")}


def delete_variacoes(catalogo_id):
    if not SUPABASE_KEY:
        return False
    url = SUPABASE_URL + "/rest/v1/terceirizacao_catalogo_variacoes?catalogo_id=eq." + catalogo_id
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Prefer": "return=minimal",
        },
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 204)
    except urllib.error.HTTPError:
        return False


def upsert_variacoes(catalogo_id, variacoes):
    if not variacoes or not SUPABASE_KEY:
        return False
    delete_variacoes(catalogo_id)
    payload = [
        {
            "catalogo_id": catalogo_id,
            "tipo": normalizar_tipo(v["chave"]),
            "valor_id": v["valor_id"],
            "rotulo": v["rotulo"],
            "ordem": v["ordem"],
            "capturado_em": datetime.utcnow().isoformat() + "Z",
        }
        for v in variacoes
    ]
    body = json.dumps(payload).encode("utf-8")
    url = SUPABASE_URL + "/rest/v1/terceirizacao_catalogo_variacoes"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201, 204)
    except urllib.error.HTTPError as e:
        print("  [ERR UPSERT]", e.code, e.read().decode()[:200])
        return False


# --- MAIN ------------------------------------------------------------------

def main():
    global RATE_LIMIT_MS

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--output-json", type=str, default="")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=0)
    parser.add_argument("--rate-ms", type=int, default=RATE_LIMIT_MS)
    args = parser.parse_args()

    RATE_LIMIT_MS = args.rate_ms

    if not SCAN_COOKIES:
        print("ERRO: SCAN_COOKIES nao definida.")
        sys.exit(1)

    if not args.dry_run and not args.output_json and not SUPABASE_KEY:
        print("ERRO: sem SUPABASE_SERVICE_KEY. Use --dry-run ou --output-json.")
        sys.exit(1)

    if not os.path.exists(CATALOGO_JSON):
        print("ERRO: catalogo_final.json nao encontrado em", CATALOGO_JSON)
        sys.exit(1)

    with open(CATALOGO_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)

    produtos = [p for p in catalogo if p.get("url")]
    print("Produtos com URL:", len(produtos))

    start = max(0, args.start)
    end = args.end if args.end > 0 else len(produtos)
    produtos = produtos[start:end]
    if start or args.end:
        print("Slice:", start, "->", end, "(", len(produtos), "produtos)")

    if args.limit:
        produtos = produtos[:args.limit]
        print("Limitando a", args.limit)

    id_map = get_catalogo_ids()
    print("IDs do banco:", len(id_map))

    output_collector = [] if args.output_json else None

    stats = {"ok": 0, "sem_variacoes": 0, "erro": 0, "sem_id": 0, "total_variacoes": 0}
    total = len(produtos)

    for i, produto in enumerate(produtos):
        url = produto["url"]
        nome = produto.get("nome", "?")

        if i > 0 and i % LOG_EVERY == 0:
            print("[" + str(i) + "/" + str(total) + "] ok=" + str(stats["ok"]) +
                  " sem_var=" + str(stats["sem_variacoes"]) +
                  " erro=" + str(stats["erro"]) +
                  " total_var=" + str(stats["total_variacoes"]))

        catalogo_id = id_map.get(url)
        if not catalogo_id:
            stats["sem_id"] += 1
            if args.dry_run or args.output_json:
                catalogo_id = None
            else:
                continue

        try:
            req = urllib.request.Request(url, headers=build_headers(True))
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print("  [ERR fetch]", nome, ":", e)
            stats["erro"] += 1
            time.sleep(RATE_LIMIT_MS / 1000)
            continue

        variacoes = parse_variacoes(html)

        if variacoes:
            tipos = {}
            for v in variacoes:
                t = normalizar_tipo(v["chave"])
                tipos[t] = tipos.get(t, 0) + 1
            resumo = ", ".join(t + "=" + str(n) for t, n in tipos.items())
            print("  [" + str(i + 1) + "/" + str(total) + "] " + nome[:60] +
                  ": " + str(len(variacoes)) + " var (" + resumo + ")")

            if args.verbose:
                for v in variacoes[:15]:
                    print("      " + v["chave"] + "=" + v["valor_id"] + " " + v["rotulo"])

            if output_collector is not None:
                for v in variacoes:
                    output_collector.append({
                        "catalogo_id": catalogo_id,
                        "url": url,
                        "nome_produto": nome,
                        "tipo": normalizar_tipo(v["chave"]),
                        "chave_original": v["chave"],
                        "valor_id": v["valor_id"],
                        "rotulo": v["rotulo"],
                        "ordem": v["ordem"],
                    })
                stats["ok"] += 1
                stats["total_variacoes"] += len(variacoes)
            elif args.dry_run:
                print("  [DRY-RUN] upsert", len(variacoes), "para", catalogo_id)
                stats["ok"] += 1
                stats["total_variacoes"] += len(variacoes)
            else:
                ok = upsert_variacoes(catalogo_id, variacoes)
                if ok:
                    stats["ok"] += 1
                    stats["total_variacoes"] += len(variacoes)
                else:
                    stats["erro"] += 1
        else:
            stats["sem_variacoes"] += 1

        time.sleep(RATE_LIMIT_MS / 1000)

    print("")
    print("=== RESULTADO ===")
    print("Total processado:", total)
    print("Produtos com variacoes:", stats["ok"])
    print("Produtos sem variacoes:", stats["sem_variacoes"])
    print("IDs nao encontrados:", stats["sem_id"])
    print("Erros:", stats["erro"])
    print("Variacoes totais:", stats["total_variacoes"])
    if stats["ok"]:
        print("Media por produto:", round(stats["total_variacoes"] / stats["ok"], 1))
    pct = (stats["ok"] / total * 100) if total else 0
    print("Cobertura:", round(pct, 1), "%")

    if output_collector is not None:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(output_collector, f, ensure_ascii=False, indent=2)
        print("")
        print("JSON salvo em:", args.output_json, "-", len(output_collector), "registros")


if __name__ == "__main__":
    main()
