import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from collect_siconfi import extrair, normalizar

class SiconfiTest(unittest.TestCase):
    def test_normaliza_coluna(self):
        self.assertEqual(normalizar("Despesas pagas até o bimestre (j)"), "DESPESAS PAGAS ATE O BIMESTRE (J)")
    def test_linha_investimento(self):
        a=[{"cod_conta":"Investimentos","conta":"INVESTIMENTOS","coluna":"DESPESAS PAGAS ATÉ O BIMESTRE (j)","valor":"1234.50"},
           {"cod_conta":"DespesasCapital","conta":"DESPESAS DE CAPITAL","coluna":"DESPESAS PAGAS ATÉ O BIMESTRE","valor":999}]
        r=extrair(a,2025,6,"https://exemplo.com")
        self.assertEqual(len(r),1)
        self.assertEqual(r[0]["valor"],1234.5)
    def test_ignora_intraorcamentario(self):
        a=[{"cod_conta":"Investimentos","conta":"INVESTIMENTOS","coluna":"DESPESAS PAGAS ATÉ O BIMESTRE (j)","valor":1234.5},
           {"cod_conta":"InvestimentosIntra","conta":"INVESTIMENTOS","coluna":"DESPESAS PAGAS ATÉ O BIMESTRE (j)","valor":22.5}]
        r=extrair(a,2025,6,"https://exemplo.com")
        self.assertEqual(len(r),1)
        self.assertEqual(r[0]["valor"],1234.5)
    def test_nunca_soma_duplicatas(self):
        a=[{"conta":"INVESTIMENTOS","coluna":"DESPESAS PAGAS ATÉ O BIMESTRE (j)","valor":1234.5}]*2
        self.assertEqual(extrair(a,2025,6,"https://exemplo.com"),[])
if __name__=="__main__":unittest.main()
