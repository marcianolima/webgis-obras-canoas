#!/usr/bin/env python3
"""Extrai linha 'Investimentos' do RREO-Anexo 01 por exercício, sem somar hierarquias.

Os valores publicados têm escala municipal; nenhum valor é atribuído a bairros.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/data/financas.json"
BASE = "https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt/rreo"
MUNICIPIO = "4304606"
ANEXO = "RREO-Anexo 01"


def normalizar(texto: object) -> str:
    s = str(texto or "").upper()
    return " ".join("".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").split())


def consultar(ano: int, bimestre: int) -> tuple[list[dict], str]:
    params = urlencode({
        "an_exercicio": ano,
        "nr_periodo": bimestre,
        "co_tipo_demonstrativo": "RREO",
        "no_anexo": ANEXO,
        "id_ente": MUNICIPIO,
    })
    url = BASE + "?" + params
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "GeoCanoas-Obras/1.0"})
    with urlopen(request, timeout=45) as response:
        payload = json.load(response)
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        raise ValueError("Retorno SICONFI sem campo items válido")
    if any(x.get("rel") == "next" for x in payload.get("links", []) if isinstance(x, dict)):
        raise ValueError("Consulta SICONFI paginada; completar paginação antes de publicar")
    return payload["items"], url


def extrair(rows: list[dict], ano: int, bimestre: int, fonte: str) -> list[dict]:
    """Se houver ambiguidade para a rubrica, não publica um número impreciso."""
    por_coluna: dict[str, list[dict]] = {"PAGAS": [], "LIQUIDADAS": [], "EMPENHADAS": []}
    for row in rows:
        if not isinstance(row, dict):
            continue
        if normalizar(row.get("conta")) != "INVESTIMENTOS":
            continue
        coluna = normalizar(row.get("coluna"))
        if "ATE O BIMESTRE" not in coluna:
            continue
        for chave in por_coluna:
            if "DESPESAS " + chave in coluna:
                por_coluna[chave].append(row)
                break
    result = []
    for chave, matches in por_coluna.items():
        if len(matches) != 1:
            if matches:
                print(f"Aviso: {ano} {chave}: {len(matches)} linhas; valor omitido por ambiguidade")
            continue
        raw = matches[0].get("valor")
        try:
            val = float(raw.replace(",", ".") if isinstance(raw, str) else raw)
        except (ValueError, TypeError):
            continue
        if not math.isfinite(val) or val < 0:
            continue
        result.append({
            "ano": ano, "categoria": f"Investimentos — despesas {chave.lower()} até {bimestre}º bimestre",
            "valor": round(val, 2), "fonte": fonte,
            "anexo": ANEXO, "bimestre": bimestre, "rubrica": "INVESTIMENTOS",
            "coluna": str(matches[0].get("coluna") or ""),
            "abrangencia": "municipal",
        })
    return result


def main() -> None:
    atual = json.loads(DEST.read_text(encoding="utf-8")) if DEST.exists() else {"observacoes": []}
    anterior = {
        (v.get("ano"), v.get("categoria")): v
        for v in atual.get("observacoes", [])
        if isinstance(v, dict) and v.get("ano") and v.get("categoria")
    }
    hoje = dt.datetime.now(dt.timezone.utc)
    consultas_ok = 0
    for ano in range(2022, hoje.year + 1):
        bimestre = 6 if ano < hoje.year else max(1, min(6, (hoje.month - 1) // 2))
        try:
            rows, url = consultar(ano, bimestre)
        except Exception as exc:
            print(f"Aviso: SICONFI {ano}, bimestre {bimestre}: {exc}", file=sys.stderr)
            time.sleep(1.25)
            continue
        consultas_ok += 1
        for value in extrair(rows, ano, bimestre, url):
            anterior[(value["ano"], value["categoria"])] = value
        time.sleep(1.25)
    if consultas_ok == 0:
        raise RuntimeError("Nenhum demonstrativo acessível: preservar dados anteriores")
    result = {
        "schemaVersion": 1, "updatedAt": hoje.isoformat(),
        "source": "https://apidatalake.tesouro.gov.br/docs/siconfi/",
        "note": "Linha INVESTIMENTOS do RREO-Anexo 01; valores declarados pelo município. Não somar colunas PAGAS/LIQUIDADAS/EMPENHADAS ou atribuir a bairros. Linhas ambíguas são omitidas.",
        "observacoes": sorted(anterior.values(), key=lambda x: (x["ano"], x["categoria"]), reverse=True),
        "anosConsultados": consultas_ok,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DEST.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(DEST)
    print(f"SICONFI: {consultas_ok} consultas; {len(result['observacoes'])} observações verificadas.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Falha SICONFI — arquivo anterior preservado: {exc}", file=sys.stderr)
        raise SystemExit(1)
