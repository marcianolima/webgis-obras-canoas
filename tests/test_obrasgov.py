import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from collect_obrasgov import coordenadas_pin, fisica_atual,normalizar_projeto,bairro_ponto
class ObrasGovTests(unittest.TestCase):
 def setUp(self):
  self.bairros=[{"properties":{"BAIRRO":"Teste"},"geometry":{"type":"Polygon","coordinates":[[[-51.30,-30],[-51.00,-30],[-51.00,-29.8],[-51.30,-29.8],[-51.30,-30]]]}}]
 def test_wkt_prevalece_campo_quebrado(self):
  p={"pin":"POINT(-51.13316 -29.93489)","longitude":"29.93489)","latitude":"-29.93489"}
  self.assertEqual(coordenadas_pin(p),(-51.13316,-29.93489))
 def test_coord_invalida(self):
  self.assertIsNone(coordenadas_pin({"pin":"POINT(999 -29)"}))
 def test_bairro_real(self):
  self.assertEqual(bairro_ponto((-51.13,-29.93),self.bairros),"Teste")
  self.assertIsNone(bairro_ponto((-51.13,-29.3),self.bairros))
 def test_percentual_sempre_oficial(self):
  value,meta=fisica_atual([{"percentual_execucao_fisica":45.0,"dt_atualizacao_execucao":"2025-01-01"},{"percentual_execucao_fisica":49.0,"dt_atualizacao_execucao":"2026-01-01"}])
  self.assertEqual(value,49.0)
  self.assertEqual(meta["data"],"2026-01-01")
 def test_empate_conflitante_indeterminado(self):
  self.assertIsNone(fisica_atual([{"percentual_execucao_fisica":12,"dt_atualizacao_execucao":"2026-01-01"},{"percentual_execucao_fisica":13,"dt_atualizacao_execucao":"2026-01-01"}])[0])
 def test_sem_pin_nao_inventa(self):
  p={"id_projeto_investimento":"123","desc_nome":"Projeto","situacao":"Cadastrada","investimentos_previstos":[{"vl_investimento_previsto":100.0}],"pins":[{"pin":"POINT(-50 -28)"}]}
  f=normalizar_projeto(p,[],self.bairros,[])
  self.assertIsNone(f["geometry"])
  self.assertEqual(f["properties"]["valor_previsto"],100)
  self.assertIsNone(f["properties"]["percentual_execucao"])
if __name__=="__main__":unittest.main()
