#!/usr/bin/env python3
"""Importação conservadora de obras públicas com integridade espacial e monetária.

Somente registros documentalmente identificados. Sem geocodificação sintética.
Execução: python scripts/ingest_obras.py --input data/input/obras.csv
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEOM = ROOT / "public/data/bairros-oficiais.geojson"
TARGET = ROOT / "public/data/obras.geojson"
STATUS = {"planejada", "licitacao", "em_execucao", "paralisada", "concluida", "cancelada", "indeterminada"}
CAMPOS_MONETARIOS = ("valor_contratado", "valor_empenhado", "valor_liquidado", "valor_pago")


def normalizar(valor: str) -> str:
    import unicodedata
    return re.sub(r"\s+", " ", "".join(c for c in unicodedata.normalize("NFD", valor.lower()) if unicodedata.category(c) != "Mn")).strip()


def real(raw: str, field: str) -> float | None:
    s = str(raw or "").strip().replace("R$", "").replace(" ", "")
    if not s:
        return None
    try:
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        number = float(s)
    except ValueError as exc:
        raise ValueError(f"{field}: valor monetário inválido") from exc
    if not math.isfinite(number) or number < 0:
        raise ValueError(f"{field}: número negativo ou não finito")
    return round(number, 2)


def date(raw: str, name: str) -> str | None:
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw).isoformat()
    except ValueError as exc:
        raise ValueError(f"{name}: use AAAA-MM-DD") from exc


def ring_contains(pt: tuple[float, float], ring: list[list[float]]) -> bool:
    px, py = pt
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]
        xj, yj = ring[j][:2]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def contains(geometry: dict, pt: tuple[float, float]) -> bool:
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        return False
    return any(ring_contains(pt, poly[0]) and not any(ring_contains(pt, hole) for hole in poly[1:]) for poly in polygons if poly)


def bairros_oficiais(path: Path = GEOM) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def validar_registro(row: dict[str, str], bairros: list[dict]) -> dict:
    ident = str(row.get("id") or "").strip()
    titulo = str(row.get("titulo") or "").strip()
    fonte = str(row.get("url_fonte") or "").strip()
    if not ident or not titulo:
        raise ValueError("id e titulo são obrigatórios")
    if not fonte.startswith("https://"):
        raise ValueError("url_fonte deve ser HTTPS com documento identificável")
    st = normalizar(str(row.get("status") or "")).replace(" ", "_")
    aliases = {"em_licitacao": "licitacao", "em_andamento": "em_execucao", "concluido": "concluida", "nao_informado": "indeterminada"}
    st = aliases.get(st, st)
    if st not in STATUS:
        raise ValueError("status inválido: " + st)
    bairro_in = str(row.get("bairro") or "").strip()
    canon = {normalizar(str(b["properties"]["BAIRRO"])): str(b["properties"]["BAIRRO"]) for b in bairros}
    if bairro_in and normalizar(bairro_in) not in canon:
        raise ValueError("bairro fora da lista oficial GeoCanoas: " + bairro_in)
    bairro = canon.get(normalizar(bairro_in)) if bairro_in else None
    lat, lon = str(row.get("latitude") or "").strip(), str(row.get("longitude") or "").strip()
    if bool(lat) != bool(lon):
        raise ValueError("latitude e longitude devem ser informadas juntas")
    geometria = None
    if lat and lon:
        try:
            y, x = float(lat.replace(",", ".")), float(lon.replace(",", "."))
        except ValueError as exc:
            raise ValueError("coordenada não numérica") from exc
        if not math.isfinite(x) or not math.isfinite(y) or not -180 <= x <= 180 or not -90 <= y <= 90:
            raise ValueError("coordenada inválida")
        matches = [b for b in bairros if contains(b["geometry"], (x, y))]
        if not matches:
            raise ValueError("coordenadas fora dos bairros oficiais de Canoas")
        local = str(matches[0]["properties"]["BAIRRO"])
        if bairro is not None and bairro != local:
            raise ValueError(f"bairro {bairro!r} difere do bairro da geometria {local!r}")
        bairro = local
        geometria = {"type": "Point", "coordinates": [x, y]}
    valores = {k: real(row.get(k) or "", k) for k in CAMPOS_MONETARIOS}
    progresso = str(row.get("percentual_execucao") or "").strip().replace(",", ".")
    prog = None
    if progresso:
        try:
            prog = float(progresso)
        except ValueError as exc:
            raise ValueError("percentual_execucao não numérico") from exc
        if not math.isfinite(prog) or not 0 <= prog <= 100:
            raise ValueError("percentual_execucao fora da faixa 0 a 100")
    props = {
        "id": ident, "titulo": titulo, "tipo": str(row.get("tipo") or "").strip(),
        "status": st, "orgao": str(row.get("orgao") or "").strip(),
        "bairro": bairro, "contrato": str(row.get("contrato") or "").strip() or None,
        **valores,
        "inicio": date(str(row.get("inicio") or "").strip(), "inicio"),
        "prazo_final": date(str(row.get("prazo_final") or "").strip(), "prazo_final"),
        "percentual_execucao": prog,
        "url_fonte": fonte,
        "atualizado_em": date(str(row.get("atualizado_em") or "").strip(), "atualizado_em"),
        "localizacao": "coordenada_verificada" if geometria else "sem_coordenada",
    }
    return {"type": "Feature", "geometry": geometria, "properties": props}


def coletar(path: Path, bairros: list[dict]) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        mandatory = {"id", "titulo", "status", "url_fonte"}
        if not mandatory.issubset(reader.fieldnames or []):
            raise ValueError("Cabeçalhos obrigatórios ausentes: " + ", ".join(sorted(mandatory)))
        features, ids = [], set()
        for line_no, row in enumerate(reader, 2):
            if not any(str(v or "").strip() for v in row.values()):
                continue
            try:
                f = validar_registro(row, bairros)
            except ValueError as exc:
                raise ValueError(f"Linha {line_no}: {exc}") from exc
            ident = f["properties"]["id"]
            if ident in ids:
                raise ValueError(f"Linha {line_no}: id duplicado {ident}")
            ids.add(ident)
            features.append(f)
    return features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "data/input/obras.csv")
    parser.add_argument("--output", type=Path, default=TARGET)
    args = parser.parse_args()
    features = coletar(args.input, bairros_oficiais())
    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "schemaVersion": 1,
            "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "status": "registros_validados" if features else "aguardando-dados-validados",
            "note": "Ausência de registros não significa inexistência de obras. Sem pontos sintéticos.",
            "source": str(args.input.relative_to(ROOT)) if args.input.is_relative_to(ROOT) else str(args.input),
            "featureCount": len(features),
            "georeferencedCount": sum(f["geometry"] is not None for f in features),
        },
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(".geojson.tmp")
    temp.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(args.output)
    print(f"{len(features)} registros validados; {collection['metadata']['georeferencedCount']} georreferenciados.")


if __name__ == "__main__":
    main()
