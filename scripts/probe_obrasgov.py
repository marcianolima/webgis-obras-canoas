#!/usr/bin/env python3
"""Diagnóstico de esquema da NOVA API Obrasgov. Somente GET e payloads truncados."""
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from urllib.error import URLError,HTTPError
import json
BASE="https://api-publica.obrasgov.gestao.gov.br/obras/"
cases=[
 ("geometria",{"cod_ibge":4304606,"pagina":1,"tamanho_da_pagina":2}),
 ("geometria",{"no_municipio":"Canoas","sg_uf":"RS","pagina":1,"tamanho_da_pagina":2}),
 ("projeto-investimento",{"uf_principal":"RS","pagina":1,"tamanho_da_pagina":2}),
 ("projeto-investimento",{"id_projeto_investimento":"4843.43-60","pagina":1,"tamanho_da_pagina":2}),
 ("execucao-fisica",{"id_projeto_investimento":"4843.43-60","pagina":1,"tamanho_da_pagina":2}),
 ("empenho",{"id_projeto_investimento":"4843.43-60","pagina":1,"tamanho_da_pagina":2}),
 ("geometria",{"cod_ibge":4304606,"pagina":1,"tamanho_da_pagina":200}),
 ("data-atualizacao",{})
]
for endpoint,args in cases:
 url=BASE+endpoint+("?"+urlencode(args) if args else "")
 try:
  with urlopen(Request(url,headers={"Accept":"application/json","User-Agent":"GeoCanoas-obras-canoas/1.0 (public data research)"}),timeout=25) as r:
   j=json.load(r)
  print("RESOURCE",endpoint,args)
  print("META", {k:v for k,v in j.items() if k!="data"} if isinstance(j,dict) else str(type(j)))
  if endpoint=="geometria" and args.get("tamanho_da_pagina")==200:
   print("GEO_SUMMARY",len(j["data"]),len(set(x["id_projeto_investimento"] for x in j["data"])), [x["id_projeto_investimento"] for x in j["data"][:25]])
  if isinstance(j,dict):
   for obj in (j.get("data") or [])[:2]:
    print("RECORD",json.dumps(obj,ensure_ascii=False)[:6500])
 except Exception as e:print("API_ERROR",endpoint,args,repr(e))
