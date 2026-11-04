# Metodologia, dados e governança de qualidade

## 1. Objeto e escala

O WebGIS integra transparência territorial de obras e contratos públicos com indicadores de saneamento, finanças e contexto censitário de Canoas. As entidades não são intercambiáveis: **contrato** é instrumento jurídico; **obra** é intervenção; **despesa empenhada/liquidada/paga** representa fases contábeis; **investimento territorial** requer identificação explícita do local de aplicação.

A falta de um registro ou geometria não indica inexistência física da obra ou do serviço. Não se somam valores de contratos e de gastos como se fossem parcelas independentes de uma mesma execução.

## 2. Cartografia geográfica

**Bairros oficiais:** 18 feições GeoJSON do serviço GeoCanoas [BAIRROSOFICIAL](https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0), armazenadas localmente em `public/data/bairros-oficiais.geojson`, reproduzidas do projeto webgis-empreender-canoas (extração de outubro/2026).

**Setores:** 659 polígonos e atributos do [Censo 2022 do IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html), em `public/data/censo2022-setores.geojson`. Geometrias derivadas da malha definitiva já tratada no [WebGIS Empreender](https://github.com/marcianolima/webgis-empreender-canoas). Os atributos são do setor do Censo, nunca substitutos de cadastros técnicos de água, esgoto ou drenagem. Para mapa, geometrias em EPSG:4326; simplificação espacial apenas para visualização.

**Obras:** pontos apenas com latitude/longitude EPSG:4326 documentadas e testadas contra limites oficiais dos bairros. A inserção do ponto não cria vínculo contratual automaticamente. Registros sem ponto seguem disponíveis na tabela, sem posicionamento ilustrativo.

## 3. Saneamento

Fonte: [SINISA — resultados oficiais do Ministério das Cidades](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa), síntese de [Canoas do Instituto Água e Saneamento](https://www.aguaesaneamento.org.br/municipios-e-saneamento/rs/canoas). O ciclo de divulgação SINISA 2024 não deve ser confundido automaticamente com o ano-base de cada módulo. A série precisa de metadados antes de comparação temporal.

Indicadores municipais informados na síntese consultada: população atendida por água **97,3%**, esgoto **62%**, coleta domiciliar **100%**, domicílios sujeitos a risco de inundação **43,5%**; perdas de água **46,6%**, esgoto coletado **21,9%**, tratado em relação ao gerado **21,9%**, vias urbanas com rede pluvial subterrânea **96,8%**. São conceitos e denominadores distintos. O painel identifica a escala como municipal e não calcula falsas taxas por bairro.

Para produzir cobertura espacial por bairro ou setor, são necessários georreferenciamentos reais de trechos de rede, lotes atendidos, unidades ou cobertura oficial por unidade territorial, com validação da regra de agregação. Os setores do IBGE são úteis como denominadores **somente após** definir corretamente o numerador e sua geografia.

## 4. Contratos e licitações

A [API de Consulta do PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html) permite a coleta dos contratos publicados por CNPJ de órgão. `scripts/collect_pncp.py` usa o CNPJ cadastrado para a Prefeitura de Canoas, janela temporal e paginação; conserva número de controle PNCP e URL de origem; classifica **candidatos a obras** por termos da descrição. É uma triagem, não classificação probatória. Pode haver contratos relevantes não capturados por palavras-chave e falsos positivos, que demandam revisão. Não é apropriado geolocalizar pelo endereço da contratada ou da sede do órgão.

## 5. Obras e execução

`data/input/obras.csv` registra os campos documentais. A importação exige `id`, `titulo`, `status` e `url_fonte` HTTPS. Coordenadas são opcionais, mas, se presentes, precisam estar dentro de bairro oficial e compatíveis com bairro informado. Valor contratual, empenho, liquidação, pagamento e percentual de execução são facultativos e jamais presumidos. Prazo e datas no padrão ISO YYYY-MM-DD.

Status aceitos: `planejada`, `licitacao`, `em_execucao`, `paralisada`, `concluida`, `cancelada`, `indeterminada`.

## 6. Finanças

Fonte prevista: [SICONFI / Tesouro Nacional](https://apidatalake.tesouro.gov.br/docs/siconfi/) (RREO, DCA, MSC) e os demonstrativos municipais. Dados fiscais são, em princípio, municipais. Atributos como demonstrativo, anexo, exercício, período, rubrica, valor e coluna contábil precisam estar presentes antes de integrar. Não somar linhas hierárquicas de demonstrativos; não converter investimento municipal em valor por bairro sem correspondência direta com intervenções.

## 7. Linhagem, estados e proteção

No estado inicial, os arquivos de obras, contratos e séries fiscais podem estar **vazios por falta de dados validados**. Isso é intencional e divulgado na UI. Publicação apenas com documentação, atualização explícita e fonte verificável. Coletas sob falha preservam a última versão confirmada. O sistema não publica CPF ou localização de pessoas físicas.

## 8. Integração pendente para cobertura administrativa completa

A expansão até cobertura operacional do conjunto de obras requer custódia dos órgãos de Canoas: cadastro de intervenções, fiscalização, licitações, cronogramas e medições, desembolsos, identificadores de contrato e localização por obra. Para saneamento: redes técnicas dos prestadores, medições, obras de drenagem e base geoespacial de ocorrências de alagamento e coleta de resíduos. Em cada caso, validar licença, periodicidade, precisão e privacidade antes de disponibilizar dados no GitHub Pages.

**A implementação de navegação e dos conectores não deve ser confundida com a publicação de dados ainda não disponibilizados pelos responsáveis.**