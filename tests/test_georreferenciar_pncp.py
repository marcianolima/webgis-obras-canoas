import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from georreferenciar_pncp import norm,match_named,geocodificar_contrato,build
class PncpGeoTest(unittest.TestCase):
 def setUp(self):
  self.eq={"geometry":{"type":"Point","coordinates":[-51.194,-29.914]},"properties":{"id":"CNES-1","name":"UNIDADE DE SAUDE HARMONIA","categoria":"ubs","bairroOficial":"Harmonia","bairroInformado":"HARMONIA","fonte":"CNES"}}
  self.contract={"id":"x","numero":"1","objeto":"Obra de reforma da UBS Harmonia em Canoas","classificacao":"obra_fisica_candidata","bairro":None,"valor":50000,"url_fonte":"https://pncp.gov.br/x","data":"2026-01-03"}
 def test_match_tipo_e_nome(self):
  self.assertTrue(match_named(self.contract["objeto"],self.eq))
  self.assertFalse(match_named("Reforma do bairro Harmonia, sem unidade básica de saúde",self.eq))
 def test_localizacao_referencia(self):
  feature,pending=geocodificar_contrato(self.contract,[self.eq])
  self.assertEqual(feature["geometry"]["coordinates"],[-51.194,-29.914])
  self.assertIsNone(feature["properties"]["situacao_execucao"])
  self.assertIsNone(feature["properties"]["valor_pago"])
  self.assertIsNone(pending)
 def test_conflito_bairro_exclui_ponto(self):
  eq={**self.eq,"properties":{**self.eq["properties"],"bairroInformado":"NITERÓI"}}
  f,review=geocodificar_contrato(self.contract,[eq])
  self.assertIsNone(f["geometry"])
  self.assertEqual(review["motivo"],"conflito_bairro_cnes_x_cartografia_oficial")
 def test_geometria_nao_inventada(self):
  f,p=geocodificar_contrato({**self.contract,"objeto":"Reforma do dique do Araçá"},[self.eq])
  self.assertIsNone(f["geometry"])
  self.assertIsNotNone(p)
 def test_build_sem_duplicidade(self):
  coll,review=build([self.contract],[self.eq])
  self.assertEqual(len(coll["features"]),1)
  self.assertEqual(coll["metadata"]["comPontoReferencia"],1)
  self.assertEqual(review["pendencias"],[])
if __name__=="__main__":unittest.main()
