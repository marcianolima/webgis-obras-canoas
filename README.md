# GeoCanoas — WebGIS Obras e Saneamento

Plataforma de transparência territorial de obras públicas, investimentos, contratos e saneamento básico de Canoas/RS. Desenvolvida em **Vite + TypeScript + MapLibre GL JS + ECharts**, com identidade visual, menu lateral e abordagem mobile first referenciados no `webgis-educacao-canoas`.

## Links

- Repositório: https://github.com/marcianolima/webgis-obras-canoas
- Endereço de publicação previsto: https://marcianolima.github.io/webgis-obras-canoas/
- CI e implantação: https://github.com/marcianolima/webgis-obras-canoas/actions
- Documentação: [Metodologia e fontes](docs/METODOLOGIA.md).

O código está identificado como **v1.0.0**. O sistema separa aquilo que está integrado daquilo que ainda requer bases oficiais: **cadastro municipal de obras, séries fiscais de execução e geometrias de redes** não são substituídos por estimativas. Confira a situação na página “Fontes e metodologia”.

## Páginas

1. Painel municipal: informações agregadas e situação da cobertura dos dados.
2. Mapa: 18 bairros GeoCanoas, 659 setores IBGE 2022 e obras com localização verificada.
3. Cadastro de obras: busca por obra, órgão, contrato, bairro e situação.
4. Investimentos por bairro: agregações apenas de registros com vínculo territorial documentado; exportação CSV.
5. Equipamentos públicos: obras em escolas, saúde e demais instalações, quando documentadas.
6. Licitações e contratos: banco de candidatos de contratos do PNCP, sem confundir contrato e obra.
7. Finanças: série de investimentos municipais RREO-Anexo 01/SICONFI, por exercício e etapa da despesa, com gráfico e exportação CSV.
8. Saneamento: abastecimento de água, esgoto, resíduos sólidos e drenagem com indicadores **municipais** do SINISA.
9. Atlas censitário: dados de contexto socioespacial do Censo 2022 e exportação CSV.
10. Fontes: proveniência, abrangência e situação da ingestão.

Interface responsiva com temas claro/escuro, mapa OpenFreeMap **sem API key** e dados cartográficos locais.

## Instalação

Requisitos: Node.js 22+ e Python 3.12+.

```sh
npm install
npm run dev
npm run lint
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
npm run build
```

## Importação de obras

Preencha `data/input/obras.csv` com **registros documentais verdadeiros**. Campos: id, titulo, tipo, status, orgao, valor_contratado, valor_empenhado, valor_liquidado, valor_pago, inicio, prazo_final, percentual_execucao, latitude, longitude, bairro, contrato, url_fonte, atualizado_em.

```sh
python scripts/ingest_obras.py --input data/input/obras.csv
```

O validador rejeita ID duplicado, valor negativo, percentuais fora de faixa, datas inválidas, falta de fonte HTTPS, bairro inexistente e coordenadas fora das geometrias oficiais de Canoas. Registros sem coordenadas permanecem em tabela, não no mapa. O workflow `refresh-obras.yml` valida e publica o GeoJSON.

## PNCP

O coletor `scripts/collect_pncp.py` consulta contratos do CNPJ municipal **88.577.416/0001-18**, percorre os resultados com paginação e seleciona **possíveis objetos de obras por palavras-chave**. Ele não declara execução física, não estima pagamentos e não cria pontos no mapa.

```sh
python scripts/collect_pncp.py --inicio 2024-01-01
```

Atualização semanal pelo workflow `refresh-pncp.yml` após a implantação e sob demanda.

## GitHub Pages

O arquivo `.github/workflows/deploy.yml` executa os testes de dados, lint, build e publicação. Em **Settings → Pages**, use **Build and deployment → GitHub Actions**. Publicação em Pages depende de ativação e de pipeline concluído com êxito; endereço previsto não é confirmação de site no ar.

## Regras de integridade

- Nunca criar obras, gastos, contratos, coordenadas, cobertura de rede ou evolução de cronograma fictícios.
- Valor contratado não é valor pago. Identificadores do PNCP são conservados para conferência.
- Índices municipais SINISA não podem ser atribuídos aos bairros ou setores sem dados territoriais específicos.
- Dados censitários indicam contexto territorial, não necessariamente atendimento dos serviços.
- Fontes com referência, abrangência e período documentados. Ausente não é zero.
- Sem divulgação de dados restritos ou dados pessoais desnecessários.

GeoCanoas — Canoas/RS.