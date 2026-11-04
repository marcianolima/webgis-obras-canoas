#!/usr/bin/env python3
import json
from urllib.parse import urlencode
from urllib.request import Request,urlopen
BASE='https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
for modality in [4,5,6,8,9]:
 params={'dataInicial':'20260901','dataFinal':'20260930','codigoModalidadeContratacao':modality,'cnpj':'88577416000118','pagina':1,'tamanhoPagina':15}
 try:
  with urlopen(Request(BASE+'?'+urlencode(params),headers={'Accept':'application/json'}),timeout=25) as response:
   if response.status==204:
    print('EMPTY',modality);continue
   result=json.load(response)
  print('MODALITY',modality,'PAGES',result.get('totalPaginas'),'SAMPLE',json.dumps((result.get('data') or [])[:2],ensure_ascii=False)[:4500])
 except Exception as exc:print('ERROR',modality,str(exc))
