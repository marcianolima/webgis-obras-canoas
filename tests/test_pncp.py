import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from collect_pncp import classificar_objeto, extrair_bairro_objeto, reclassificar

class PncpTest(unittest.TestCase):
    def test_reforma_de_ubs(self):
        self.assertEqual(classificar_objeto("Contratação de execução de obra de reforma da UBS Mato Grande"),"obra_fisica_candidata")
    def test_execucao_dique(self):
        self.assertEqual(classificar_objeto("Execução do Dique do Araçá"),"obra_fisica_candidata")
    def test_exclui_mao_de_obra_sem_obra_fisica(self):
        self.assertIsNone(classificar_objeto("Serviço de desinsetização com fornecimento de mão de obra e equipamentos"))
    def test_exclui_softwares_de_obras(self):
        self.assertIsNone(classificar_objeto("Licenciamento de software para gestão de obras públicas"))
    def test_exclui_roteiros_teatrais(self):
        self.assertIsNone(classificar_objeto("Construção de roteiro e apresentação de esquetes"))
    def test_identifica_manutencao(self):
        self.assertEqual(classificar_objeto("Desobstrução e limpeza das redes pluviais por hidrojateamento"),"manutencao_infraestrutura")
    def test_nao_georreferencia_por_nome_do_equipamento(self):
        self.assertIsNone(extrair_bairro_objeto("Reforma da UBS Harmonia",["Harmonia","Centro"]))
    def test_bairro_explicito(self):
        self.assertEqual(extrair_bairro_objeto("Reforma da quadra coberta, bairro Mathias Velho, Canoas/RS",["Mathias Velho","Centro"]),"Mathias Velho")
    def test_mais_de_um_bairro(self):
        self.assertIsNone(extrair_bairro_objeto("Obras no bairro Centro e bairro Mathias Velho",["Mathias Velho","Centro"]))
    def test_reclassifica_registros(self):
        item={"id":"1","objeto":"Execução de reforma da UBS, bairro Centro", "classificacao":"candidato_por_palavra_chave_na_descricao"}
        r=reclassificar(item,["Centro"])
        self.assertEqual(r["classificacao"],"obra_fisica_candidata")
        self.assertEqual(r["bairro"],"Centro")

if __name__=="__main__": unittest.main()
