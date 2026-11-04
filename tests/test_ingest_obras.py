import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ingest_obras import coletar, validar_registro, ring_contains, real


class ImportacaoTest(unittest.TestCase):
    def setUp(self):
        self.bairros = [{"properties": {"BAIRRO": "Teste Oficial"}, "geometry": {"type": "Polygon", "coordinates": [[[-51.2, -30.0], [-51.1, -30.0], [-51.1, -29.9], [-51.2, -29.9], [-51.2, -30.0]]]}}]
        self.row = {
            "id": "1", "titulo": "Obra de teste (não publicada)", "status": "em_execucao",
            "url_fonte": "https://example.org/documento/1", "latitude": "-29.95",
            "longitude": "-51.15", "bairro": "Teste Oficial",
            "valor_contratado": "1.234,50", "percentual_execucao": "35.5",
        }

    def test_moeda_brasileira(self):
        self.assertEqual(real("R$ 1.234,50", "valor"), 1234.5)
        with self.assertRaises(ValueError):
            real("-5", "valor")

    def test_point_in_polygon(self):
        self.assertTrue(ring_contains((-51.15, -29.95), self.bairros[0]["geometry"]["coordinates"][0]))
        self.assertFalse(ring_contains((-50.0, -29.95), self.bairros[0]["geometry"]["coordinates"][0]))

    def test_reconhece_bairro_automaticamente(self):
        row = dict(self.row, bairro="")
        feat = validar_registro(row, self.bairros)
        self.assertEqual(feat["properties"]["bairro"], "Teste Oficial")
        self.assertEqual(feat["geometry"]["type"], "Point")
        self.assertEqual(feat["properties"]["valor_contratado"], 1234.5)

    def test_erro_bairro_divergente(self):
        row = dict(self.row, bairro="Outro bairro")
        with self.assertRaisesRegex(ValueError, "bairro"):
            validar_registro(row, self.bairros)

    def test_sem_coordenadas_eh_valido_mas_nao_mapeado(self):
        f = validar_registro(dict(self.row, latitude="", longitude=""), self.bairros)
        self.assertIsNone(f["geometry"])
        self.assertEqual(f["properties"]["localizacao"], "sem_coordenada")

    def test_rejeita_linhas_duplicadas(self):
        with tempfile.TemporaryDirectory() as tmp:
            csvpath = Path(tmp) / "obras.csv"
            with csvpath.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(self.row))
                writer.writeheader()
                writer.writerows([self.row, self.row])
            with self.assertRaisesRegex(ValueError, "duplicado"):
                coletar(csvpath, self.bairros)

    def test_geografias_reais_existentes(self):
        root = Path(__file__).resolve().parents[1]
        b = json.loads((root / "public/data/bairros-oficiais.geojson").read_text(encoding="utf-8"))
        s = json.loads((root / "public/data/censo2022-setores.geojson").read_text(encoding="utf-8"))
        self.assertEqual(len(b["features"]), 18)
        self.assertEqual(len(s["features"]), 659)
        self.assertTrue(all(f["geometry"] is not None for f in s["features"]))


if __name__ == "__main__":
    unittest.main()
