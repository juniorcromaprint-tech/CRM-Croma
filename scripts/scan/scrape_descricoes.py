# -*- coding: utf-8 -*-
"""
scrape_descricoes.py - Fase 4: Descricoes tecnicas resumidas
=============================================================================
Extrai 'produto-pagina-info' e 'produto-pagina-descricao-html' das paginas
Scan e destila em 3-5 frases factuais em voz neutra Croma.

Uso:
  set SCAN_COOKIES=PHPSESSID=xxx
  python scrape_descricoes.py --output-json /tmp/descricoes.json
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from html import unescape

SCAN_COOKIES = os.environ.get("SCAN_COOKIES", "")

CATALOGO_JSON_WINDOWS = r"C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\catalogo_final.json"
CATALOGO_JSON_LINUX = "/sessions/kind-bold-cerf/mnt/JARVIS/parceiros/scan-revenda/catalogo_final.json"

def resolve_catalogo():
    for p in (CATALOGO_JSON_WINDOWS, CATALOGO_JSON_LINUX):
        if os.path.exists(p):
            return p
    return CATALOGO_JSON_WINDOWS

CATALOGO_JSON = resolve_catalogo()
RATE_LIMIT_MS = 200
MAX_CHARS_TOTAL = 400


def build_headers():
    h = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Referer": "https://www.revendascan.com.br/",
    }
    if SCAN_COOKIES:
        h["Cookie"] = SCAN_COOKIES
    return h


def strip_tags(frag):
    txt = re.sub(r"<[^>]+>", " ", frag)
    txt = unescape(txt)
    txt = re.sub(r"\\+", "", txt)
    return re.sub(r"\s+", " ", txt).strip()


def extrair_bloco(html, classe):
    pat = rf'<(\w+)[^>]*class="[^"]*{classe}[^"]*"[^>]*>(.*?)</\1>'
    m = re.search(pat, html, re.DOTALL | re.IGNORECASE)
    return strip_tags(m.group(2)) if m else ""


PALAVRAS_MARKETING = re.compile(
    r'\b(garant[ae]|destaque|imperd[ií]vel|perfeit[ao]|incr[ií]vel|not[aá]vel|'
    r'[oó]tim[ao]|excelente|m[aá]xim[ao]|superior|premium|alta visibilidade|'
    r'impacto visual|profissional|top de linha|melhor custo)',
    re.IGNORECASE
)

# Cabecalhos a remover inteiramente (heading repetidos dentro da descricao)
HEADERS_A_REMOVER = [
    r'CARACTER[IÍ]STICAS DO [A-ZÀ-Úa-zà-ú ]+',
    r'PRINCIPAIS VANTAGENS\s*:',
    r'APLICA[CÇ][OÕ]ES\s*:',
    r'INFORMA[CÇ][OÕ]ES T[EÉ]CNICAS\s*:',
    r'DETALHES DO PRODUTO\s*:',
    r'\bVantagens:',
]


def limpar_descricao_html(texto):
    for pat in HEADERS_A_REMOVER:
        texto = re.sub(pat, '. ', texto, flags=re.IGNORECASE)
    texto = re.sub(r'\s+', ' ', texto)
    texto = re.sub(r'\s*\.\s*\.', '.', texto)
    return texto.strip(' .')


def parse_info_block(info_txt):
    result = {}
    keys = ['Formato', 'Cores', 'Material', 'Revestimento', 'Acabamento',
            'Extras', 'Produção', 'Producao', 'Prazo']
    txt = info_txt
    for k in keys:
        txt = re.sub(rf'(?<!\A)(\s)({k}\s*:)', r'|||\2', txt)
    parts = [p.strip() for p in txt.split('|||') if p.strip()]
    for part in parts:
        m = re.match(r'([A-Za-zçãõéúíâêôÇÃÕÉÚÍÂÊÔ]+)\s*:\s*(.+)', part)
        if m:
            key = m.group(1).strip().lower()
            val = m.group(2).strip()
            if key in ('produção', 'producao'):
                key = 'prazo'
            result[key] = val
    return result


def eh_frase_boa(p):
    if len(p) < 10 or len(p) > 180:
        return False
    # Imperativos / exclamacoes / chamada de compra
    if re.search(r'[!?]$|^(Garanta|Destaque|Veja|Aproveite|Clique|Compre)', p):
        return False
    # Marketing pesado
    if PALAVRAS_MARKETING.search(p):
        return False
    # Frases com muitos adjetivos vazios
    if re.search(r'\b(dur[aá]vel,\s+resistente|pr[aá]tico,\s+dur[aá]vel|resistente,\s+dur[aá]vel)\b', p, re.IGNORECASE):
        return False
    return True


def sentencificar_descricao(texto, max_frases=2):
    texto = limpar_descricao_html(texto)
    partes = re.split(r'(?<=[.!?])\s+|\s+;\s+', texto)
    frases = []
    vistos = set()
    for p in partes:
        p = p.strip(' .,;:!?-')
        if not p:
            continue
        if not eh_frase_boa(p):
            # Ainda assim, tenta extrair subsintagma factual
            m = re.search(r'(?:indicad[ao] para|usad[ao] para|aplicad[ao] em|recomendad[ao] para)\s+([^.!?;,]{5,60})', p, re.IGNORECASE)
            if m:
                sintagma = m.group(1).strip()
                alt = f"Indicado para {sintagma}"
                if alt.lower() not in vistos:
                    vistos.add(alt.lower())
                    frases.append(alt + '.')
            continue
        if p.lower() in vistos:
            continue
        vistos.add(p.lower())
        frases.append(p.rstrip('.') + '.')
        if len(frases) >= max_frases:
            break
    return frases


def compor_descricao(info, descricao_html):
    frases = []

    # Frase 1: material + formato
    material = info.get('material', '').strip()
    formato = info.get('formato', '').strip()
    if material:
        partes = [f"Material: {material}"]
        if formato and formato.lower() not in ('tam. variados', 'tam.variados', 'variado', 'variados', 'variadas'):
            partes.append(f"formato {formato}")
        frases.append("; ".join(partes) + ".")

    # Frase 2: impressao + revestimento + acabamento
    cores = info.get('cores', '').strip()
    revestimento = info.get('revestimento', '').strip()
    acabamento = info.get('acabamento', '').strip()
    extras = info.get('extras', '').strip()
    partes2 = []
    if cores:
        partes2.append(f"impressão {cores}")
    if revestimento:
        partes2.append(revestimento.lower())
    if acabamento and acabamento.lower() not in ('sem acabamento', 'sem refile', '-'):
        partes2.append(f"acabamento {acabamento.lower()}")
    if extras:
        partes2.append(f"extras: {extras.lower()}")
    if partes2:
        s = ", ".join(partes2)
        frases.append(s[0].upper() + s[1:] + ".")

    # Frases 3-4: extraidas da descricao HTML (filtradas)
    if descricao_html:
        extras_desc = sentencificar_descricao(descricao_html, max_frases=2)
        frases.extend(extras_desc)

    # Frase final: prazo
    prazo = info.get('prazo', '').strip()
    if prazo:
        frases.append(f"Produção em {prazo}.")

    texto = " ".join(frases[:5])
    # Cap max chars
    if len(texto) > MAX_CHARS_TOTAL:
        # Manter primeiras N frases que caibam
        acumulado = ""
        for fr in frases:
            if len(acumulado) + len(fr) + 1 > MAX_CHARS_TOTAL:
                break
            acumulado += (" " if acumulado else "") + fr
        texto = acumulado
    return texto.strip()


def extrair_descricao(html):
    info_raw = extrair_bloco(html, 'produto-pagina-info')
    desc_html_raw = extrair_bloco(html, 'produto-pagina-descricao-html')
    # Cortar rodape que grudou
    desc_html_raw = re.split(r'Av(?:enida)?\.?\s+Pires do Rio', desc_html_raw, 1)[0].strip()
    info = parse_info_block(info_raw) if info_raw else {}
    return {
        'descricao': compor_descricao(info, desc_html_raw),
        'fatos': info,
    }


def main():
    global RATE_LIMIT_MS

    parser = argparse.ArgumentParser()
    parser.add_argument("--output-json", type=str, default="")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=0)
    parser.add_argument("--rate-ms", type=int, default=RATE_LIMIT_MS)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    RATE_LIMIT_MS = args.rate_ms

    if not SCAN_COOKIES:
        print("ERRO: SCAN_COOKIES nao definida.")
        sys.exit(1)

    if not os.path.exists(CATALOGO_JSON):
        print("ERRO: catalogo nao encontrado em", CATALOGO_JSON)
        sys.exit(1)

    with open(CATALOGO_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)

    produtos = [p for p in catalogo if p.get("url")]
    print("Produtos:", len(produtos))

    start = max(0, args.start)
    end = args.end if args.end > 0 else len(produtos)
    produtos = produtos[start:end]
    if start or args.end:
        print("Slice:", start, "->", end, "(", len(produtos), "produtos)")
    if args.limit:
        produtos = produtos[:args.limit]

    collector = []
    stats = {"ok": 0, "sem": 0, "erro": 0}

    for i, produto in enumerate(produtos):
        url = produto["url"]
        nome = produto.get("nome", "?")

        try:
            req = urllib.request.Request(url, headers=build_headers())
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"[ERRO] {nome}: {e}")
            stats["erro"] += 1
            time.sleep(RATE_LIMIT_MS / 1000)
            continue

        r = extrair_descricao(html)
        descricao = r['descricao']

        if descricao and len(descricao) >= 40:
            print(f"[{i+1}/{len(produtos)}] {nome[:50]}: {len(descricao)}c")
            if args.verbose:
                print(f"      {descricao}")
            collector.append({
                "url": url,
                "nome_produto": nome,
                "descricao": descricao,
            })
            stats["ok"] += 1
        else:
            stats["sem"] += 1

        time.sleep(RATE_LIMIT_MS / 1000)

    print()
    print("=== RESULTADO ===")
    print("Total:", len(produtos))
    print("Com descricao:", stats["ok"])
    print("Sem:", stats["sem"])
    print("Erros:", stats["erro"])

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(collector, f, ensure_ascii=False, indent=2)
        print("JSON salvo:", args.output_json, "-", len(collector), "registros")


if __name__ == "__main__":
    main()
