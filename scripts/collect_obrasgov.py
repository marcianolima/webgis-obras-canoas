#!/usr/bin/env python3
"""Obrasgov 2026: obras/projetos públicos com geografia vinculada a Canoas.

Consulta apenas GET da API NOVA. Importa projetos únicos a partir do filtro
geográfico oficial cod_ibge=4304606, valida os pins contra bairros oficiais
e associa execução física real, sem inferir execução a partir de contratação.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://api-publica.obrasgov.gestao.gov.br/obras"
GEO = ROOT / "public/data/bairros-oficiais.geojson"
OUT = ROOT / "public/data/obrasgov.geojson"
UA = "GeoCanoas-obras-canoas/1.0 (public-data; https://github.com/marcianolima/webgis-obras-canoas)"
LOCK = threading.Lock()
LAST_REQUEST = [0.0]


def requisitar(recurso: str, filtros: dict | None = None) -> dict:
    """Limita a no máximo 55 solicitações/min; falhas não alteram o catálogo anterior."""
    params = urlencode({**(filtros or {}), "pagina": 1, "tamanho_da_pagina": 200}) if recurso != "data-atualizacao" else ""
    url = f"{BASE}/{recurso}" + ("?" + params if params else "")
    for retry in range(3):
        with LOCK:
            wait = max(0, 1.10 - (time.monotonic() - LAST_REQUEST[0]))
            if wait:
                time.sleep(wait)
            LAST_REQUEST[0] = time.monotonic()
        try:
            with urlopen(Request(url, headers={"Accept": "application/json", "User-Agent": UA}), timeout=40) as r:
                data = json.load(r)
            if not isinstance(data, dict):
                raise ValueError("Payload não é objeto JSON")
            if recurso == "data-atualizacao":
                return data
            if not isinstance(data.get("data"), list):
                raise ValueError("Resposta sem array data")
            if data.get("total_pages") is None or data.get("total_items") is None:
                raise ValueError("API sem total_pages/total_items, paginação não verificável")
            if int(data["total_pages"]) > 1:
                raise ValueError(f"Resultado paginado ({data['total_pages']} páginas); reduzir consulta ou paginar")
            return data
        except (HTTPError, URLError, TimeoutError) as exc:
            if retry == 2 or isinstance(exc, HTTPError) and exc.code not in (408, 429, 500, 502, 503, 504):
                raise
            time.sleep(2 * (retry + 1))
    raise RuntimeError("Falha repetida ao consultar Obrasgov")


def dentro_anel(pt: tuple[float, float], pts: list) -> bool:
    x, y = pt
    inside = False
    for i in range(len(pts)):
        j = i - 1
        a, b = pts[i], pts[j]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def bairro_ponto(pt: tuple[float, float], bairros: list[dict]) -> str | None:
    for b in bairros:
        geo = b["geometry"]
        polys = [geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"]
        for poly in polys:
            if dentro_anel(pt, poly[0]) and not any(dentro_anel(pt, hole) for hole in poly[1:]):
                return str(b["properties"]["BAIRRO"])
    return None


def coordenadas_pin(pin: dict) -> tuple[float, float] | None:
    """WKT POINT prevalece sobre campos quebrados; ambos devem ser coerentes se numéricos."""
    wkt = re.fullmatch(
        r"\s*POINT\s*\(\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*\)\s*",
        str(pin.get("pin") or ""), re.IGNORECASE
    )
    point = None
    if wkt:
        point = (float(wkt.group(1)), float(wkt.group(2)))
    else:
        try:
            point = float(pin["longitude"]), float(pin["latitude"])
        except (KeyError, ValueError, TypeError):
            pass
    if point and all(math.isfinite(v) for v in point) and -180 <= point[0] <= 180 and -90 <= point[1] <= 90:
        return point
    return None


def num(value: object) -> float | None:
    try:
        v = float(value)
        return v if math.isfinite(v) and v >= 0 else None
    except (TypeError, ValueError):
        return None


def fisica_atual(registros: list[dict]) -> tuple[float | None, dict | None]:
    """Última observação; empate de datas com percentuais divergentes = inconclusivo."""
    valid = [r for r in registros if isinstance(r, dict) and num(r.get("percentual_execucao_fisica")) is not None
             and num(r.get("percentual_execucao_fisica")) <= 100]
    if not valid:
        return None, None
    valid.sort(key=lambda x: str(x.get("dt_atualizacao_execucao") or x.get("dt_cadastro_execucao") or ""), reverse=True)
    stamp = str(valid[0].get("dt_atualizacao_execucao") or valid[0].get("dt_cadastro_execucao") or "")
    latest = [x for x in valid if str(x.get("dt_atualizacao_execucao") or x.get("dt_cadastro_execucao") or "") == stamp]
    values = {num(x.get("percentual_execucao_fisica")) for x in latest}
    if len(values) != 1:
        return None, {"erro": "multiplas_medicoes_mais_recentes_divergentes", "data": stamp}
    return values.pop(), {"data": stamp, "instrumento": latest[0].get("tipo_instrumento")}


def normalizar_projeto(p: dict, origens: list[dict], bairros: list[dict], fisica: list[dict]) -> dict:
    pins = []
    for item in p.get("pins") or []:
        if not isinstance(item, dict):
            continue
        point = coordenadas_pin(item)
        if point is None or bairro_ponto(point, bairros) is None:
            continue
        if point not in pins:
            pins.append(point)
    bairro = bairro_ponto(pins[0], bairros) if len(pins) == 1 else None
    # Dois ou mais pins podem representar intervenções em bairros distintos.
    areas = sorted({bairro_ponto(pt, bairros) for pt in pins if bairro_ponto(pt, bairros)})
    investimentos = [num(i.get("vl_investimento_previsto")) for i in p.get("investimentos_previstos") or [] if isinstance(i, dict)]
    previstos = [x for x in investimentos if x is not None]
    valor_prev = round(sum(previstos), 2) if previstos else None
    execucao, meta_exec = fisica_atual(fisica)
    situacao = str(p.get("situacao") or "").strip() or "Não informada"
    # Não apresentar porcentagem ou estado inferido como se fosse declarado.
    props = {
        "id": str(p["id_projeto_investimento"]),
        "titulo": str(p.get("desc_nome") or p.get("desc_projeto") or "Projeto sem título"),
        "descricao": str(p.get("desc_projeto") or ""),
        "natureza": p.get("natureza_intervencao"),
        "especie": p.get("especie_intervencao"),
        "situacao": situacao,
        "status_fonte": "Obrasgov — declaração do órgão gestor",
        "percentual_execucao": execucao,
        "percentual_meta": meta_exec,
        "valor_previsto": valor_prev,
        "valor_natureza": "investimento previsto (não despesa executada)",
        "organizacao_responsavel": p.get("organizacao_resp"),
        "sistema_responsavel": p.get("sistema_resp"),
        "data_inicio_prevista": p.get("dt_inicial_prevista"),
        "data_fim_prevista": p.get("dt_final_prevista"),
        "data_inicio_real": p.get("dt_inicial_efetiva"),
        "data_fim_real": p.get("dt_final_efetiva"),
        "data_cadastro": p.get("dt_cadastro"),
        "endereco_declarado": p.get("desc_endereco"),
        "bairro": bairro,
        "bairros_geometria": areas,
        "quantidade_pontos": len(pins),
        "precisao": "pin_oficial_obrasgov" if pins else "sem_pin_valido",
        "origem_geometria": sorted({str(x.get("origem_geometria") or "") for x in origens}),
        "codigo_ibge_geometria": 4304606,
        "url_fonte": f"{BASE}/projeto-investimento?id_projeto_investimento={p['id_projeto_investimento']}&pagina=1&tamanho_da_pagina=200",
    }
    geometry = {"type": "Point", "coordinates": pins[0]} if len(pins) == 1 else (
        {"type": "MultiPoint", "coordinates": pins} if len(pins) > 1 else None)
    return {"type": "Feature", "id": str(p["id_projeto_investimento"]), "geometry": geometry, "properties": props}


def carregar_referencias() -> list[dict]:
    return json.loads(GEO.read_text(encoding="utf-8"))["features"]


def consultar_projeto(id_: str, origens: list[dict], bairros: list[dict], detalhar_exec: bool) -> dict:
    project = requisitar("projeto-investimento", {"id_projeto_investimento": id_}).get("data") or []
    if len(project) != 1 or str(project[0].get("id_projeto_investimento")) != id_:
        raise ValueError(f"Projeto {id_} sem identidade única verificável")
    fisica = []
    if detalhar_exec:
        fisica = requisitar("execucao-fisica", {"id_projeto_investimento": id_}).get("data") or []
    return normalizar_projeto(project[0], origens, bairros, fisica)


def coletar(detalhar_exec: bool = True) -> dict:
    geos = requisitar("geometria", {"cod_ibge": 4304606})["data"]
    if any(str(g.get("cod_ibge")) != "4304606" or str(g.get("no_municipio") or "").lower() != "canoas" for g in geos):
        raise ValueError("Filtro geográfico retornou município divergente")
    d: dict[str, list[dict]] = {}
    for g in geos:
        id_ = str(g.get("id_projeto_investimento") or "")
        if id_:
            d.setdefault(id_, []).append(g)
    bairros = carregar_referencias()
    # Retém observações anteriores se o coletor mudar a disponibilidade de algum campo opcional.
    features, errors = [], []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(consultar_projeto, i, gs, bairros, detalhar_exec): i for i, gs in d.items()}
        for future in as_completed(futures):
            id_ = futures[future]
            try:
                features.append(future.result())
            except Exception as exc:
                errors.append(f"{id_}: {exc}")
    if errors:
        raise RuntimeError(f"{len(errors)} projetos com falha; preservado arquivo anterior. Exemplos: {errors[:3]}")
    features.sort(key=lambda f: f["properties"]["id"])
    if len(features) != len(d):
        raise RuntimeError("Contagem de projetos divergente; não publicar")
    return {"type": "FeatureCollection", "metadata": {
        "fonte": BASE, "codigoMunicipio": 4304606,
        "consultadoEm": dt.datetime.now(dt.timezone.utc).isoformat(),
        "totalGeometriasIndexadas": len(geos),
        "totalProjetos": len(features),
        "comPontosValidos": sum(f["geometry"] is not None for f in features),
        "semPontosValidos": sum(f["geometry"] is None for f in features),
        "comExecucaoFisica": sum(f["properties"]["percentual_execucao"] is not None for f in features),
        "nota": "Obrasgov: projetos cadastrados com geometria associada a Canoas; pontos internos à malha oficial GeoCanoas. Valor previsto não é pago nem contratado. Situação declarada pode estar desatualizada."
    }, "features": features}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sem-execucao", action="store_true", help="Somente projeto, sem consultas de execução física")
    parser.add_argument("--saida", type=Path, default=OUT)
    args = parser.parse_args()
    geojson = coletar(detalhar_exec=not args.sem_execucao)
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.saida.with_suffix(".tmp")
    tmp.write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(args.saida)
    print("OBRASGOV_OK", json.dumps(geojson["metadata"], ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"OBRASGOV_FAILED: {e}", file=sys.stderr)
        raise SystemExit(1)
