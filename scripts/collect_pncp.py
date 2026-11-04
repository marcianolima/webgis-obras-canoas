#!/usr/bin/env python3
"""PNCP: coleta contratos da Prefeitura de Canoas e identifica CANDIDATOS por objeto.

Contratos não são comprovantes de execução física, pagamento ou geolocalização.
Dados da Prefeitura (CNPJ 88.577.416/0001-18), e não quaisquer órgãos em Canoas.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/data/contratos.json"
CNPJ = "88577416000118"
BASE = "https://pncp.gov.br/api/consulta/v1/contratos"
def sem_acento(value: object) -> str:
    raw = str(value or "").lower()
    return " ".join("".join(c for c in unicodedata.normalize("NFD", raw) if unicodedata.category(c) != "Mn").split())


def classificar_objeto(objeto: str) -> str | None:
    """Triagem conservadora: obra física, manutenção de infraestrutura ou projeto técnico.

    Palavras 'mão de obra' e 'Secretaria de Obras' isoladas não caracterizam uma obra.
    """
    texto = sem_acento(objeto)
    if re.search(r"\b(desinsetizacao|desratizacao|software|desktop as a service|teatral|banheiros quimicos|conserto e desbloqueio|locacao de maquinas|inversor de frequencia|locacao de moto bomba)\b", texto):
        return None
    if re.search(r"\bconstrucao de (roteiro|cenarios|conteudo|material publicitario)\b", texto):
        return None
    obra = re.search(r"\b(reforma|reformas|construcao|construcoes|restauro|restauracao|recuperacao|reconstituicao|restabelecimento|ampliacao|implantacao|pavimentacao|requalificacao|urbanizacao|revitalizacao)\b", texto)
    if obra:
        return "obra_fisica_candidata"
    if re.search(r"\b(desobstrucao|hidrojateamento|manutencao e conservacao de vias|operacao eletromecanica|casas de bombas|estacoes de bombeamento|residuos descartados irregularmente|capina|rocagem|varricao)\b", texto):
        return "manutencao_infraestrutura"
    if re.search(r"\b(projetos? executivos?|servicos tecnicos de arquitetura|servicos tecnicos de engenharia|levantamento topografico|projeto urbanistico)\b", texto):
        return "projeto_tecnico"
    return None


def extrair_bairro_objeto(objeto: str, nomes: list[str]) -> str | None:
    """Aceita somente bairro explicitamente indicado como 'bairro X' no documento."""
    texto = sem_acento(objeto)
    encontrados = []
    for nome in nomes:
        ident = sem_acento(nome)
        if re.search(r"\bbairro\s+(?:(?:do|da|de)\s+)?" + re.escape(ident) + r"\b", texto):
            encontrados.append(nome)
    return encontrados[0] if len(encontrados) == 1 else None


def reclassificar(item: dict, nomes: list[str]) -> dict | None:
    categoria = classificar_objeto(str(item.get("objeto") or ""))
    if categoria is None:
        return None
    return {**item, "classificacao": categoria, "bairro": extrair_bairro_objeto(str(item.get("objeto") or ""), nomes)}


def periodos(inicio: dt.date, fim: dt.date):
    atual = inicio
    while atual <= fim:
        prox = min(atual + dt.timedelta(days=29), fim)
        yield atual, prox
        atual = prox + dt.timedelta(days=1)


def requisitar(inicio: dt.date, fim: dt.date, pagina: int) -> dict:
    params = urlencode({
        "dataInicial": inicio.strftime("%Y%m%d"),
        "dataFinal": fim.strftime("%Y%m%d"),
        "cnpjOrgao": CNPJ,
        "pagina": pagina,
        "tamanhoPagina": 100,
    })
    url = BASE + "?" + params
    for attempt in range(4):
        try:
            req = Request(url, headers={"Accept": "application/json", "User-Agent": "GeoCanoas-Transparencia/1.0"})
            with urlopen(req, timeout=35) as response:
                if response.status == 204:
                    return {"data": [], "totalPaginas": 0}
                payload = json.load(response)
                if not isinstance(payload, dict):
                    raise RuntimeError("Retorno PNCP não é objeto JSON")
                return payload
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
        except (URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(min(12, 2**attempt + random.random()))
    raise RuntimeError("PNCP indisponível")


def normalize(record: dict) -> dict | None:
    orgao = record.get("orgaoEntidade") or {}
    if str(orgao.get("cnpj") or "").replace(".", "").replace("/", "").replace("-", "") != CNPJ:
        return None
    objeto = str(record.get("objetoContrato") or "").strip()
    classe = classificar_objeto(objeto)
    if classe is None:
        return None
    ano, seq = record.get("anoContrato"), record.get("sequencialContrato")
    ident = str(record.get("numeroControlePNCP") or "")
    if not ident or not ano or seq is None:
        return None
    fornecedor = str(record.get("nomeRazaoSocialFornecedor") or "Não informado")
    if record.get("tipoPessoa") == "PF":
        fornecedor = "Pessoa física (identificação não exibida)"
    bruto_val = record.get("valorGlobal")
    try:
        valor = float(bruto_val) if bruto_val is not None else None
        if valor is not None and (valor < 0 or not valor < float("inf")):
            valor = None
    except (ValueError, TypeError):
        valor = None
    return {
        "id": ident,
        "numero": str(record.get("numeroContratoEmpenho") or ""),
        "objeto": objeto,
        "fornecedor": fornecedor,
        "valor": valor,
        "data": (str(record.get("dataAssinatura") or "")[:10] or None),
        "url_fonte": f"https://pncp.gov.br/api/pncp/v1/orgaos/{CNPJ}/contratos/{ano}/{seq}",
        "obra_id": None,
        "classificacao": classe,
        "codigo_municipio_unidade": (record.get("unidadeOrgao") or {}).get("codigoIbge"),
        "numeroControlePNCP": ident,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inicio", help="AAAA-MM-DD; sem valor usa janela incremental ou 2024 em primeira carga")
    parser.add_argument("--fim", help="AAAA-MM-DD; padrão: hoje UTC")
    parser.add_argument("--destino", type=Path, default=DEST)
    args = parser.parse_args()
    fim = dt.date.fromisoformat(args.fim) if args.fim else dt.datetime.now(dt.timezone.utc).date()
    if args.destino.exists():
        atual = json.loads(args.destino.read_text(encoding="utf-8"))
    else:
        atual = {"items": []}
    bairro_features = json.loads((ROOT / "public/data/bairros-oficiais.geojson").read_text(encoding="utf-8"))["features"]
    nomes = [str(f["properties"]["BAIRRO"]) for f in bairro_features]
    anteriores = [reclassificar(x, nomes) for x in atual.get("items", []) if isinstance(x, dict) and x.get("id")]
    anterior = {x["id"]: x for x in anteriores if x is not None}
    inicio = dt.date.fromisoformat(args.inicio) if args.inicio else (fim - dt.timedelta(days=120) if anterior else dt.date(2024, 1, 1))
    if inicio > fim:
        parser.error("Data inicial maior que final")
    total = 0
    for first, last in periodos(inicio, fim):
        page = 1
        while True:
            result = requisitar(first, last, page)
            data = result.get("data") or []
            if not isinstance(data, list):
                raise RuntimeError("Campo data inválido: não atualizar cadastro")
            for registro in data:
                if not isinstance(registro, dict):
                    continue
                item = normalize(registro)
                if item:
                    anterior[item["id"]] = reclassificar(item, nomes) or item
                    total += 1
            pages = int(result.get("totalPaginas") or 0)
            if page >= pages or not data:
                break
            page += 1
            if page > 100:
                raise RuntimeError("Mais de 100 páginas no período: revisão manual obrigatória")
            time.sleep(0.4)
        time.sleep(0.35)
    payload = {
        "schemaVersion": 1,
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "https://pncp.gov.br/api/consulta/v1/contratos",
        "orgaoCnpj": CNPJ,
        "note": "TRIAGEM CONSERVADORA: contratos candidatos de obras físicas, manutenção de infraestrutura e projetos técnicos. Não são execução física confirmada, despesa paga nem obras geolocalizadas. Bairro somente quando mencionado explicitamente no objeto documental.",
        "items": sorted(anterior.values(), key=lambda x: x.get("data") or "", reverse=True),
        "janelaConsultada": {"inicio": inicio.isoformat(), "fim": fim.isoformat()},
    }
    args.destino.parent.mkdir(parents=True, exist_ok=True)
    temp = args.destino.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(args.destino)
    print(f"Contratos candidatos processados na janela: {total}. Acumulado: {len(anterior)}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Falha de coleta PNCP — arquivo anterior preservado: {exc}", file=sys.stderr)
        raise SystemExit(1)
