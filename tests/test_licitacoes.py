import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from collect_licitacoes import normalize, number, periodos
import datetime as dt
class LicitacoesTests(unittest.TestCase):
 def setUp(self):
  self.base={"orgaoEntidade":{"cnpj":"88577416000118"},"objetoCompra":"EDITAL: reforma da Unidade Básica de Saúde","numeroControlePNCP":"id","anoCompra":2026,"sequencialCompra":12,"valorTotalEstimado":250000,"valorTotalHomologado":None,"situacaoCompraNome":"Divulgada no PNCP"}
 def test_filtra_objeto_e_organ(self):
  self.assertIsNotNone(normalize(self.base))
  self.assertIsNone(normalize({**self.base,"orgaoEntidade":{"cnpj":"00000000000000"}}))
  self.assertIsNone(normalize({**self.base,"objetoCompra":"Compra de material de escritório"}))
 def test_nao_inventa_execucao(self):
  x=normalize(self.base)
  self.assertIsNone(x["obra_fisica_estado"])
  self.assertIsNone(x["geolocalizacao"])
  self.assertIsNone(x["homologado"])
  self.assertEqual(x["estimado"],250000)
 def test_faixa_periodo(self):
  pairs=list(periodos(dt.date(2026,1,1),dt.date(2026,2,2)))
  self.assertEqual(len(pairs),2)
  self.assertEqual(pairs[1][1],dt.date(2026,2,2))
 def test_valores_invalidos(self):
  self.assertIsNone(number("-5"))
  self.assertIsNone(number("nan"))
if __name__=="__main__":unittest.main()
