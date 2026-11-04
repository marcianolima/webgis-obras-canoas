#!/usr/bin/env python3
"""Licitações e contratações públicas publicadas: PNCP da Prefeitura de Canoas.

GET /api/consulta/v1/contratacoes/publicacao, modalidades principais 4,5,6,8,9.
Valores estimados/homologados NUNCA representam pagamentos, e a situação de
licitação NUNCA equivale ao andamento da obra. Não inventar geolocalizações.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import random
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from collect_pncp import classificar_objeto

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/data/licitacoes.json"
CNPJ="88577416000118"
URL="https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"
MODALIDADES=(4,5,6,8,9)


def consultar(start:dt.date,end:dt.date,mod:int,page:int=1)->dict:
    params={"dataInicial":start.strftime("%Y%m%d"),"dataFinal":end.strftime("%Y%m%d"),
       "codigoModalidadeContratacao":mod,"cnpj":CNPJ,"pagina":page,"tamanhoPagina":100}
    url=URL+"?"+urlencode(params)
    for i in range(4):
        try:
            with urlopen(Request(url,headers={"Accept":"application/json","User-Agent":"GeoCanoas-obras/1.1"}),timeout=35) as resp:
                if resp.status==204:
                    return {"data":[],"totalPaginas":0}
                j=json.load(resp)
            if not isinstance(j,dict) or not isinstance(j.get("data"),list):
                raise ValueError("PNCP sem array data")
            if "totalPaginas" not in j:
                raise ValueError("Resposta não informa totalPaginas")
            return j
        except HTTPError as exc:
            if exc.code not in (408,429,500,502,503,504) or i>=3:
                print("PNCP_HTTP",exc.code,url,"BODY",exc.read(1200).decode("utf-8","replace"),file=sys.stderr)
                raise
        except (URLError,TimeoutError):
            if i>=3:raise
        time.sleep(1.5*(2**i)+random.random())
    raise RuntimeError("PNCP sem resposta")


def periodos(start:dt.date,end:dt.date):
    current=start
    while current<=end:
        last=min(end,current+dt.timedelta(days=29))
        yield current,last
        current=last+dt.timedelta(days=1)


def number(raw:object)->float|None:
    try:
        value=float(raw)
        return round(value,2) if math.isfinite(value) and value>=0 else None
    except (ValueError,TypeError):
        return None


def normalize(raw:dict)->dict|None:
    organ=raw.get("orgaoEntidade") or {}
    if "".join(c for c in str(organ.get("cnpj") or "") if c.isdigit())!=CNPJ:
        return None
    obj=str(raw.get("objetoCompra") or "").strip()
    classe=classificar_objeto(obj)
    if not classe:
        return None
    id_=str(raw.get("numeroControlePNCP") or "").strip()
    year=raw.get("anoCompra")
    seq=raw.get("sequencialCompra")
    if not id_ or not str(year).isdigit() or seq is None:
        return None
    pub=str(raw.get("dataPublicacaoPncp") or "")[:10] or None
    return {
        "id":id_,"objeto":obj,"classe":classe,"modalidade":str(raw.get("modalidadeNome") or ""),
        "modalidadeId":raw.get("modalidadeId"),
        "numero":str(raw.get("numeroCompra") or ""),
        "processo":str(raw.get("processo") or ""),
        "situacao":str(raw.get("situacaoCompraNome") or "Não informada"),
        "situacao_origem":"PNCP — situação da contratação, não do andamento físico",
        "estimado":number(raw.get("valorTotalEstimado")),
        "homologado":number(raw.get("valorTotalHomologado")),
        "publicacao":pub,
        "inicioPropostas":str(raw.get("dataAberturaProposta") or "")[:10] or None,
        "fimPropostas":str(raw.get("dataEncerramentoProposta") or "")[:10] or None,
        "registroOrigem":f"https://pncp.gov.br/api/pncp/v1/orgaos/{CNPJ}/compras/{year}/{seq}",
        "urlSistemaOrigem":raw.get("linkSistemaOrigem") if str(raw.get("linkSistemaOrigem") or "").startswith("https://") else None,
        "geolocalizacao":None,
        "bairro":None,
        "obra_fisica_estado":None,
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inicio",help="Data inicial AAAA-MM-DD (carga histórica inicial: 2025-01-01)")
    parser.add_argument("--fim",help="Data final AAAA-MM-DD")
    parser.add_argument("--saida",type=Path,default=OUT)
    args=parser.parse_args()
    today=dt.datetime.now(dt.timezone.utc).date()
    end=dt.date.fromisoformat(args.fim) if args.fim else today
    old=json.loads(args.saida.read_text(encoding="utf-8")) if args.saida.exists() else {"items":[]}
    previous={str(x["id"]):x for x in old.get("items",[]) if isinstance(x,dict) and x.get("id")}
    start=dt.date.fromisoformat(args.inicio) if args.inicio else (end-dt.timedelta(days=135) if previous else dt.date(2025,1,1))
    if start>end:
        parser.error("Data inicial maior que data final")
    stats={"consultas":0,"lidos":0,"elegiveis":0,"modalidades":list(MODALIDADES)}
    for first,last in periodos(start,end):
        for mod in MODALIDADES:
            page=1
            while True:
                j=consultar(first,last,mod,page)
                stats["consultas"]+=1
                data=j["data"]
                stats["lidos"]+=len(data)
                for raw in data:
                    if isinstance(raw,dict):
                        item=normalize(raw)
                        if item:
                            previous[item["id"]]=item
                            stats["elegiveis"]+=1
                pages=int(j.get("totalPaginas") or 0)
                if not data or page>=pages:
                    break
                page+=1
                if page>80:
                    raise RuntimeError("Mais de 80 páginas por consulta: não publicar base truncada")
                time.sleep(0.3)
            time.sleep(0.25)
    payload={
        "schemaVersion":1,
        "updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
        "source":URL,
        "cnpjOrgao":CNPJ,
        "janelaAtualizacao":{"inicio":start.isoformat(),"fim":end.isoformat()},
        "modalidades":list(MODALIDADES),
        "note":"Contratações/licitacoes temáticas selecionadas por descrição. Situação é da contratação e não da execução da obra. Valores estimados/homologados não são pagos; geocodificação desabilitada sem endereço validado.",
        "coleta":stats,
        "items":sorted(previous.values(),key=lambda v:v.get("publicacao") or "",reverse=True),
    }
    args.saida.parent.mkdir(parents=True,exist_ok=True)
    tmp=args.saida.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(args.saida)
    print("PNCP_LICITACOES_OK",json.dumps({"total":len(payload["items"]),**stats},ensure_ascii=False))


if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("PNCP_LICITACOES_FAILED",repr(exc),file=sys.stderr)
        raise SystemExit(1)
