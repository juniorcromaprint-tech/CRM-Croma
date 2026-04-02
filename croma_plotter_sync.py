#!/usr/bin/env python3
"""
croma_plotter_sync.py — Coleta automática de dados da HP Latex 365 para o CRM Croma

MODELO DE CUSTEIO: "LM Âncora"
- Tinta paralela: bag 3L a R$1.560 → R$0,52/ml
- Cartucho LM (Magenta Claro) = único original, reporta ml reais
- Consumo total = lm_ml_real × 21,5316 (proporções históricas)
- Fallback: 9,86 ml/m² quando LM não está disponível

Uso:
    python croma_plotter_sync.py                    # coleta e salva localmente
    python croma_plotter_sync.py --supabase         # coleta e grava no Supabase
    python croma_plotter_sync.py --ip 192.168.0.100 # IP diferente
    python croma_plotter_sync.py --output-dir ./out # diretório de saída

Dependências: pip install requests beautifulsoup4 supabase
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERRO: pip install requests beautifulsoup4")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════

DEFAULT_PRINTER_IP = "192.168.0.136"
TIMEOUT_SECONDS = 15

# ─── Custo de tinta (bag paralela) ───────────────────────────
PRECO_BAG_BRL   = 1560.00
VOLUME_BAG_ML   = 3000
PRECO_POR_ML    = PRECO_BAG_BRL / VOLUME_BAG_ML  # R$0,52/ml

# ─── Modelo LM Âncora ────────────────────────────────────────
# Proporções derivadas do histórico de 9.976 m² / 98.368 ml
PROPORCOES_RELATIVAS_AO_LM = {
    "M":  5.7447,   # Magenta
    "LM": 1.0000,   # Magenta Claro (âncora)
    "LC": 0.8521,   # Ciano Claro
    "C":  3.5775,   # Ciano
    "OP": 2.3980,   # Otimizador para Látex
    "Y":  5.3389,   # Amarelo
    "K":  2.6204,   # Preto
}
FATOR_TOTAL_SOBRE_LM = sum(PROPORCOES_RELATIVAS_AO_LM.values())  # 21.5316

# ─── Fallback (quando LM indisponível) ───────────────────────
CONSUMO_MEDIO_ML_M2 = 9.86  # ml/m² — média histórica da máquina

# ─── Custo de substrato por m² ───────────────────────────────
SUBSTRATO_PADRAO_CUSTO_M2 = 11.64  # Vinil fosco SM790 — preço real catálogo Mubisys

SUBSTRATOS_CUSTO_M2 = {
    "filme pet pp sy sol": 15.00,
    "bagum": 4.86,
    "ritrama fosco": 8.50,
    "avery fosco": 6.40,
    "vinil fosco sp media sm790": SUBSTRATO_PADRAO_CUSTO_M2,
}

# ─── Custo de máquina consumíveis por m² ─────────────────────
# Inclui: depreciação, cabeçotes de impressão, cartucho de manutenção
# NÃO inclui tinta nem substrato (calculados separadamente)
CUSTO_MAQUINA_M2 = 2.40  # R$/m² — valor definido na tabela maquinas

# ─── Supabase ────────────────────────────────────────────────
SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA2NTY5NywiZXhwIjoyMDg4NjQxNjk3fQ.6whq3LBigRxMdlwIKKii_HsmVpNWgK-9mWNz9B755VY"


# ═══════════════════════════════════════════════════════════════
# FUNÇÕES DE PARSING
# ═══════════════════════════════════════════════════════════════

def fetch_page(url: str) -> str | None:
    """Busca página HTML do EWS. Se impressora em sleep, encerra sem insistir."""
    try:
        r = requests.get(url, timeout=TIMEOUT_SECONDS, allow_redirects=True)
        r.encoding = "utf-8"

        # Impressora em sleep — nada novo para coletar, sai silenciosamente
        if "wakeup" in r.url.lower():
            print(f"[OK] Impressora em sleep. Nada para coletar.")
            return None

        print(f"[OK] {url} ({len(r.text)} bytes)")
        return r.text
    except requests.ConnectionError:
        print(f"[OK] Impressora desligada ou fora da rede. Nada para coletar.")
        return None
    except requests.Timeout:
        print(f"[OK] Impressora nao respondeu (timeout). Nada para coletar.")
        return None


def parse_m2(text: str) -> float:
    """Converte '6,5451 m²' para float."""
    m = re.search(r"[\d,\.]+", text.replace(",", "."))
    return float(m.group()) if m else 0.0


def parse_ml(text: str) -> float | None:
    """Converte '0,68 ml' para float. Retorna None se 'Tinta alterada'."""
    if not text or "alterada" in text.lower() or "aplicável" in text.lower():
        return None
    m = re.search(r"[\d,\.]+", text.replace(",", "."))
    return float(m.group()) if m else None


def extrair_cliente(nome_arquivo: str) -> str:
    """Extrai nome do cliente do nome do arquivo."""
    nome = re.sub(r"\.(pdf|jpg|png|tif|tiff|bmp)$", "", nome_arquivo, flags=re.IGNORECASE)
    for sep in ["_", " "]:
        if sep in nome:
            return nome.split(sep)[0].strip().upper()
    return nome.strip().upper()


def get_substrato_custo(nome: str) -> float:
    """Retorna custo/m² do substrato."""
    nl = nome.lower()
    for key, val in SUBSTRATOS_CUSTO_M2.items():
        if key in nl:
            return val
    return SUBSTRATO_PADRAO_CUSTO_M2


def estimar_consumo(lm_ml: float | None, area_m2: float) -> tuple[float, str]:
    """Estima consumo total de tinta. Retorna (ml, metodo)."""
    if lm_ml and lm_ml > 0:
        return round(lm_ml * FATOR_TOTAL_SOBRE_LM, 3), "LM_ancora"
    return round(area_m2 * CONSUMO_MEDIO_ML_M2, 3), "media_historica"


def make_hash(documento: str, data: str, area: float) -> str:
    """Gera hash único para deduplicação."""
    s = f"{documento}|{data}|{area}"
    return hashlib.sha256(s.encode()).hexdigest()[:16]


def detectar_anomalias(job: dict) -> list[str]:
    """Detecta anomalias no job e retorna lista de alertas."""
    alertas = []
    if "cancelado" in job["estado"]:
        alertas.append(f"JOB CANCELADO — custo desperdiçado: R${job['custo_total_brl']:.2f}")
    if job["custo_por_m2_tinta"] > 5.0:
        alertas.append(f"ALTO CUSTO/m² DE TINTA: R${job['custo_por_m2_tinta']:.2f}/m² (normal: R$1-2/m²)")
    if "ink-110" in job.get("modo_impressao", "").lower():
        alertas.append("MODO INK-110 DETECTADO — consumo elevado, verificar necessidade")
    if job["area_m2"] < 0.5 and job["estado"] == "impresso":
        alertas.append(f"ÁREA MUITO PEQUENA ({job['area_m2']:.4f} m²)")
    return alertas


# ═══════════════════════════════════════════════════════════════
# PARSE DA TABELA DE CONTABILIZAÇÃO
# ═══════════════════════════════════════════════════════════════

def parse_accounting_table(html: str) -> list[dict]:
    """Faz parse da tabela de contabilização do EWS e retorna lista de jobs."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="dataTable")
    if not table:
        print("[ERRO] Tabela dataTable não encontrada no HTML.")
        return []

    jobs = []
    current_job = None
    in_tinta_section = False

    for row in table.find_all("tr"):
        cls = " ".join(row.get("class", []))
        cells = row.find_all("td")
        if not cells:
            continue

        get = lambda i: cells[i].get_text(strip=True) if i < len(cells) else ""

        # ── Linha principal do job (top level) ────────────────
        if "treeTableTopLevel" in cls:
            estado_raw = get(3).strip()
            # Normalizar estado
            if "cancelado pelo" in estado_raw.lower():
                estado = "cancelado_usuario"
            elif "cancelado" in estado_raw.lower():
                estado = "cancelado"
            else:
                estado = "impresso"

            area = parse_m2(get(11))

            # Parse da data: "01/04/2026 17:38:53" → ISO
            data_raw = get(13)
            try:
                data_dt = datetime.strptime(data_raw, "%d/%m/%Y %H:%M:%S")
                data_iso = data_dt.isoformat()
            except ValueError:
                data_iso = data_raw

            current_job = {
                "documento": get(0),
                "estado": estado,
                "area_m2": area,
                "substrato": get(10),
                "modo_impressao": get(14),
                "data_impressao": data_iso,
                "data_raw": data_raw,
                "tinta_status": "alterada",  # default — atualiza se encontrar tinta normal
                "lm_ml_real": None,
                "tintas_detalhe": {},
                "cliente_extraido": extrair_cliente(get(0)),
                "hash_job": make_hash(get(0), data_raw, area),
            }
            jobs.append(current_job)
            in_tinta_section = False

        # ── Sublinha de seção (Tinta / Substrato) ─────────────
        elif "treeTableTitle" in cls and current_job:
            section_text = row.get_text(strip=True).lower()
            in_tinta_section = "tinta" in section_text

        # ── Linha de detalhe de tinta ─────────────────────────
        elif "contentsRow" in cls and current_job and in_tinta_section:
            cor = get(4).strip()
            if cor in PROPORCOES_RELATIVAS_AO_LM:
                vol_ml = parse_ml(get(11))
                if vol_ml is not None:
                    current_job["tintas_detalhe"][cor] = {"ml": vol_ml, "status": "normal"}
                    if cor == "LM":
                        current_job["lm_ml_real"] = vol_ml
                else:
                    current_job["tintas_detalhe"][cor] = {"ml": None, "status": "alterada"}

    # ── Pós-processamento: calcular custos (3 componentes) ─────
    for job in jobs:
        total_ml, metodo = estimar_consumo(job["lm_ml_real"], job["area_m2"])
        custo_tinta = round(total_ml * PRECO_POR_ML, 2)
        custo_sub = round(job["area_m2"] * get_substrato_custo(job["substrato"]), 2)
        custo_maquina = round(job["area_m2"] * CUSTO_MAQUINA_M2, 2)
        custo_total = round(custo_tinta + custo_sub + custo_maquina, 2)
        custo_m2_tinta = round(custo_tinta / job["area_m2"], 2) if job["area_m2"] > 0 else 0

        job["tinta_total_estimada_ml"] = total_ml
        job["metodo_custeio"] = metodo
        job["custo_tinta_brl"] = custo_tinta
        job["custo_substrato_brl"] = custo_sub
        job["custo_maquina_brl"] = custo_maquina
        job["custo_total_brl"] = custo_total
        job["custo_por_m2_tinta"] = custo_m2_tinta
        job["alertas"] = detectar_anomalias(job)

    return jobs


# ═══════════════════════════════════════════════════════════════
# SAÍDA: JSON, CSV, SUPABASE
# ═══════════════════════════════════════════════════════════════

def save_json(jobs: list, filepath: str):
    """Salva jobs em JSON (formato compatível com MCP croma_registrar_jobs_impressora)."""
    output = []
    for j in jobs:
        output.append({
            "documento": j["documento"],
            "estado": j["estado"],
            "area_m2": j["area_m2"],
            "substrato": j["substrato"],
            "modo_impressao": j["modo_impressao"],
            "data_impressao": j["data_impressao"],
            "tinta_status": j["tinta_status"],
            "lm_ml_real": j["lm_ml_real"],
            "tinta_total_estimada_ml": j["tinta_total_estimada_ml"],
            "metodo_custeio": j["metodo_custeio"],
            "custo_tinta_brl": j["custo_tinta_brl"],
            "custo_substrato_brl": j["custo_substrato_brl"],
            "custo_maquina_brl": j["custo_maquina_brl"],
            "custo_total_brl": j["custo_total_brl"],
            "custo_por_m2_tinta": j["custo_por_m2_tinta"],
            "cliente_extraido": j["cliente_extraido"],
            "tintas_detalhe": j["tintas_detalhe"],
            "alertas": j["alertas"],
            "hash_job": j["hash_job"],
        })
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"[OK] JSON salvo: {filepath} ({len(output)} jobs)")


def save_csv(jobs: list, filepath: str):
    """Salva jobs em CSV (delimitador ;, UTF-8 BOM)."""
    campos = [
        "data_impressao", "cliente_extraido", "documento", "estado", "area_m2",
        "lm_ml_real", "tinta_total_estimada_ml", "metodo_custeio",
        "custo_tinta_brl", "custo_substrato_brl", "custo_maquina_brl", "custo_total_brl",
        "custo_por_m2_tinta", "substrato", "modo_impressao", "alertas", "hash_job",
    ]
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for j in jobs:
            row = dict(j)
            row["data_impressao"] = j.get("data_raw", j["data_impressao"])
            row["alertas"] = " | ".join(j["alertas"]) if j["alertas"] else ""
            w.writerow(row)
    print(f"[OK] CSV salvo: {filepath} ({len(jobs)} jobs)")


def send_to_supabase(jobs: list):
    """Envia jobs para o Supabase via REST API (upsert com deduplicação por hash_job)."""

    # Usa service_role JWT — bypassa RLS, sem necessidade de login
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    print(f"[OK] Conectando ao Supabase com service_role key...")

    inseridos = 0
    erros = 0
    for j in jobs:
        payload = {
            "documento": j["documento"],
            "estado": j["estado"],
            "area_m2": j["area_m2"],
            "substrato": j["substrato"],
            "modo_impressao": j["modo_impressao"],
            "data_impressao": j["data_impressao"],
            "tinta_status": j["tinta_status"],
            "lm_ml_real": j["lm_ml_real"],
            "tinta_total_estimada_ml": j["tinta_total_estimada_ml"],
            "metodo_custeio": j["metodo_custeio"],
            "custo_tinta_brl": j["custo_tinta_brl"],
            "custo_substrato_brl": j["custo_substrato_brl"],
            "custo_maquina_brl": j["custo_maquina_brl"],
            "custo_total_brl": j["custo_total_brl"],
            "custo_por_m2_tinta": j["custo_por_m2_tinta"],
            "cliente_extraido": j["cliente_extraido"],
            "tintas_detalhe": j["tintas_detalhe"],
            "alertas": j["alertas"],
            "hash_job": j["hash_job"],
            "printer_ip": DEFAULT_PRINTER_IP,
            "maquina_id": "f7f320c9-baa8-4658-a178-fa67f8de3b9e",  # HP Latex 365
        }

        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/impressora_jobs",
            json=payload,
            headers=headers,
            params={"on_conflict": "hash_job"},
            timeout=15,
        )

        if resp.ok or resp.status_code == 201:
            inseridos += 1
        else:
            erros += 1
            if erros <= 3:
                print(f"[ERRO] {j['documento']}: {resp.status_code} {resp.text[:100]}")

    print(f"[OK] Supabase: {inseridos} inseridos/atualizados, {erros} erros")


# ═══════════════════════════════════════════════════════════════
# RESUMO NO TERMINAL
# ═══════════════════════════════════════════════════════════════

def print_summary(jobs: list):
    """Imprime resumo formatado no terminal."""
    impressos = [j for j in jobs if j["estado"] == "impresso"]
    cancelados = [j for j in jobs if j["estado"] != "impresso"]

    total_area = sum(j["area_m2"] for j in impressos)
    total_lm = sum(j["lm_ml_real"] or 0 for j in impressos)
    total_ml = sum(j["tinta_total_estimada_ml"] for j in impressos)
    total_tinta = sum(j["custo_tinta_brl"] for j in impressos)
    total_sub = sum(j["custo_substrato_brl"] for j in impressos)
    total_maq = sum(j["custo_maquina_brl"] for j in impressos)
    total_geral = sum(j["custo_total_brl"] for j in impressos)
    custo_canc = sum(j["custo_total_brl"] for j in cancelados)

    print("\n" + "=" * 60)
    print("  CROMA — HP Latex 365 — RESUMO DE PRODUÇÃO")
    print("  Modelo: LM Âncora | Tinta: R$0,52/ml (paralela)")
    print("  Custo = Tinta + Substrato + Máquina (R$2,40/m²)")
    print("=" * 60)
    print(f"  Jobs impressos : {len(impressos)}")
    print(f"  Jobs cancelados: {len(cancelados)} (desperdiçado: R${custo_canc:.2f})")
    print(f"  Área impressa  : {total_area:.2f} m²")
    print(f"  LM medido real : {total_lm:.3f} ml")
    print(f"  Tinta estimada : {total_ml:.1f} ml (×{FATOR_TOTAL_SOBRE_LM:.4f})")
    print(f"  -- Custos (3 componentes) --")
    print(f"  Tinta          : R$ {total_tinta:.2f}")
    print(f"  Substrato      : R$ {total_sub:.2f}")
    print(f"  Máquina (cons.): R$ {total_maq:.2f}")
    print(f"  CUSTO TOTAL    : R$ {total_geral:.2f}")
    if total_area > 0:
        print(f"  Custo/m² total : R$ {total_geral / total_area:.2f}")
        print(f"  Custo/m² tinta : R$ {total_tinta / total_area:.2f}")
    print("=" * 60)

    # Alertas
    alertas = [(j["cliente_extraido"], j["documento"][:35], a)
               for j in jobs for a in j["alertas"]]
    if alertas:
        print("\n  ALERTAS:")
        for cli, doc, a in alertas:
            print(f"   [{cli}] {doc}: {a}")

    # Clientes
    clientes = {}
    for j in impressos:
        c = j["cliente_extraido"]
        clientes[c] = clientes.get(c, 0) + j["area_m2"]
    if clientes:
        print("\n  CLIENTES:")
        for cli, area in sorted(clientes.items(), key=lambda x: -x[1]):
            pct = (area / total_area * 100) if total_area > 0 else 0
            print(f"   {cli}: {area:.2f} m² ({pct:.0f}%)")
    print()


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Coleta jobs da HP Latex 365 → JSON/CSV/Supabase",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python croma_plotter_sync.py                    # coleta e salva local
  python croma_plotter_sync.py --supabase         # coleta e grava no banco
  python croma_plotter_sync.py --ip 10.0.0.50     # outra impressora

Variáveis de ambiente:
  SUPABASE_USER_PASSWORD   Senha do usuário Supabase (obrigatório para --supabase)
""",
    )
    parser.add_argument("--ip", default=DEFAULT_PRINTER_IP, help="IP da impressora")
    parser.add_argument("--supabase", action="store_true", help="Gravar no Supabase")
    parser.add_argument("--output-dir", default=".", help="Diretório para JSON/CSV")
    parser.add_argument("--no-local", action="store_true", help="Não salvar JSON/CSV local")
    args = parser.parse_args()

    print(f"[INFO] Coletando dados da HP Latex 365 ({args.ip})...")

    # 1. Buscar HTML do EWS
    url = f"http://{args.ip}/hp/device/webAccess/index.htm?content=accounting"
    html = fetch_page(url)
    if not html:
        # Impressora em sleep/desligada/fora da rede — situacao normal, sai sem erro
        sys.exit(0)

    # 2. Parse dos jobs
    jobs = parse_accounting_table(html)
    if not jobs:
        print("[OK] Nenhum job novo na tabela.")
        sys.exit(0)

    print(f"[OK] {len(jobs)} jobs extraídos.")

    # 3. Salvar localmente
    if not args.no_local:
        output_dir = Path(args.output_dir)
        save_json(jobs, str(output_dir / "jobs_plotter.json"))
        save_csv(jobs, str(output_dir / "jobs_plotter.csv"))

    # 4. Enviar para Supabase
    if args.supabase:
        send_to_supabase(jobs)

    # 5. Resumo
    print_summary(jobs)

    print("[OK] Coleta concluída.")


if __name__ == "__main__":
    main()
