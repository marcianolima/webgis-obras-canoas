#!/usr/bin/env python3
"""Relaciona objetos de contrato PNCP a referências oficiais CNES/INEP/SEDUC.

Sem geocodificação por nome do bairro ou centroide, sem extrapolar obra a partir do
contrato. Uma correspondência aprovada aponta para o EQUIPAMENTO EXISTENTE, não
para a localização exata dos serviços. Informações conflitantes não são publicadas
como pontos: entram na fila de revisão.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CONTRATOS=ROOT/"public/data/contratos.json"
REFERENCIAS=ROOT/"public/data/equipamentos-referencia.geojson"
BAIRROS=ROOT/"public/data/bairros-oficiais.geojson"
OUT=ROOT/"public/data/intervencoes.geojson"
PENDENCIAS=ROOT/"public/data/geocodificacao-pendencias.json"


def norm(text: object)->str:
    s="".join(c for c in unicodedata.normalize("NFD",str(text or "").upper()) if unicodedata.category(c)!="Mn")
    return " ".join(re.sub(r"[^A-Z0-9]+"," ",s).split())


def match_named(contract: str, equipment: dict) -> bool:
    text=norm(contract)
    p=equipment["properties"]
    name=norm(p["name"])
    kind=p["categoria"]
    if kind=="ubs":
        suffix=name.removeprefix("UNIDADE DE SAUDE ").strip()
        if not suffix or len(suffix)<4:
            return False
        name_re=re.escape(suffix).replace(r"\ ",r"\s+")
        # Proximity of category and distinctive name is essential: avoids bairro-only matches.
        pattern=rf"\b(?:UBS|UNIDADE\s+BASICA\s+DE\s+SAUDE|UNIDADE\s+DE\s+SAUDE)(?:\s+[A-Z]{{0,5}})?\s+{name_re}\b"
        return re.search(pattern,text) is not None
    if kind=="urgencia" and name.startswith("UPA "):
        suffix=name.replace("UPA 24 HORAS ","",1).replace("UPA 24H ","",1)
        return re.search(r"\bUPA(?:\s+24\s+HORAS)?\s+"+re.escape(suffix)+r"\b",text) is not None
    if kind=="hospital":
        if name=="HOSPITAL UNIVERSITARIO DE CANOAS":
            return "HOSPITAL UNIVERSITARIO" in text
        return len(name)>20 and name in text
    if kind=="escola":
        if name.startswith("EMEI "):
            suffix=name[5:]
            return re.search(r"\b(?:EMEI|ESCOLA\s+MUNICIPAL\s+DE\s+EDUCACAO\s+INFANTIL)\s+"+re.escape(suffix)+r"\b",text) is not None
        if name.startswith("EMEF "):
            suffix=name[5:]
            return re.search(r"\b(?:EMEF|ESCOLA\s+MUNICIPAL\s+DE\s+ENSINO\s+FUNDAMENTAL)\s+"+re.escape(suffix)+r"\b",text) is not None
    return False


def named_candidates(contract: dict, equipamentos: list[dict]) -> list[dict]:
    return [eq for eq in equipamentos if match_named(str(contract["objeto"]),eq)]


def confianca(equipment: dict) -> str:
    c=equipment["geometry"]["coordinates"]
    decimals=[len(str(n).split(".")[1]) if "." in str(n) else 0 for n in c]
    if min(decimals)<4:
        return "referencia_aproximada_cadastro"
    return "referencia_equipamento_cadastro"


def geocodificar_contrato(c: dict, equipamentos: list[dict]) -> tuple[dict,dict|None]:
    candidates=named_candidates(c,equipamentos)
    kind=c.get("classificacao") or "nao_classificado"
    p={
        "id":c["id"], "id_contrato":c["id"],
        "numero_contrato":c.get("numero"),"titulo":c.get("objeto"),
        "objeto":c.get("objeto"),"valor":c.get("valor"),
        "fornecedor":c.get("fornecedor"),"data_assinatura":c.get("data"),
        "ano":int(str(c.get("data") or "0")[:4] or 0),
        "classe":kind,
        "situacao_execucao":None,
        "situacao_rotulo":"Execução física não informada no PNCP",
        "percentual_execucao":None,"valor_pago":None,
        "bairro_documentado":c.get("bairro"),
        "bairro":None, "id_equipamento":None,"equipamento":None,
        "origem_localizacao":None,"qualidade_localizacao":"sem_referencia_verificada",
        "url_fonte":c.get("url_fonte"),
        "camada":"PNCP",
    }
    reason="sem_equipamento_ou_endereco_com_ponto_verificado"
    chosen=None
    if len(candidates)>1:
        reason="equipamentos_ambiguos"
    elif len(candidates)==1:
        eq=candidates[0]
        pp=eq["properties"]
        bairro_off=pp.get("bairroOficial")
        declarado=pp.get("bairroInformado")
        if declarado and norm(declarado)!=norm(bairro_off):
            reason="conflito_bairro_cnes_x_cartografia_oficial"
        elif c.get("bairro") and norm(c["bairro"])!=norm(bairro_off):
            reason="conflito_bairro_documento_x_equipamento"
        else:
            chosen=eq
            p.update({
                "bairro":bairro_off,
                "id_equipamento":pp["id"],"equipamento":pp["name"],
                "origem_localizacao":pp["fonte"],
                "qualidade_localizacao":confianca(eq),
                "descricao_localizacao":"Ponto cadastral do equipamento relacionado ao objeto; NÃO é perímetro ou posição exata da obra.",
            })
            reason=""
    return (
        {"type":"Feature","id":p["id"],"geometry":chosen["geometry"] if chosen else None,"properties":p},
        None if chosen else {
            "id_contrato":c["id"],"numero":c.get("numero"),
            "titulo":c.get("objeto"),"classe":kind,
            "bairro_declarado":c.get("bairro"),
            "motivo":reason,
            "equipamentos_candidatos":[e["properties"]["name"] for e in candidates],
            "url_fonte":c.get("url_fonte"),
        }
    )


def build(contracts: list[dict], equipment: list[dict]) -> tuple[dict,dict]:
    valid=[c for c in contracts if c.get("classificacao") in ("obra_fisica_candidata","manutencao_infraestrutura","projeto_tecnico")]
    points,review=[],[]
    for c in valid:
        f,p=geocodificar_contrato(c,equipment)
        points.append(f)
        if p:
            review.append(p)
    points.sort(key=lambda x:x["properties"]["id"])
    review.sort(key=lambda x:x["id_contrato"])
    meta={"fonte":"PNCP + CNES/SEDUC via WebGIS Saúde/Educação Canoas",
          "consultadoEm":dt.datetime.now(dt.timezone.utc).isoformat(),
          "totalContratos":len(points),
          "comPontoReferencia":sum(x["geometry"] is not None for x in points),
          "semPontoReferencia":sum(x["geometry"] is None for x in points),
          "aviso":"Os pontos são REFERÊNCIAS DO EQUIPAMENTO, não evidência de obra iniciada, executada, concluída ou de pagamento. Não são adicionadas coordenadas artificiais."}
    return {"type":"FeatureCollection","metadata":meta,"features":points},{"schemaVersion":1,"metadata":meta,"pendencias":review}


def main():
    contracts=json.loads(CONTRATOS.read_text(encoding="utf-8"))["items"]
    source=json.loads(REFERENCIAS.read_text(encoding="utf-8"))["features"]
    valid=[f for f in source if f.get("geometry",{}).get("type")=="Point" and f.get("properties",{}).get("bairroOficial")]
    output,review=build(contracts,valid)
    for path,data in [(OUT,output),(PENDENCIAS,review)]:
        tmp=path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        tmp.replace(path)
    print("PNCP_GEO_OK",json.dumps(output["metadata"],ensure_ascii=False))
    print("PENDENCIAS",review["pendencias"][:6])


if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("PNCP_GEO_FAILED",repr(exc),file=sys.stderr)
        raise SystemExit(1)
