import * as echarts from 'echarts';
import {carregar,obrasList,texto,inteiro,numero,moeda,nomesStatus,nomesTemas,bairroDaFeicao,totalVerificado,anoRef} from './data';
import type {Dados,Obra,StatusObra,Indicador} from './data';
import {criarMapa} from './map';
import './style.css';

type Page='painel'|'mapa'|'obras'|'investimentos'|'equipamentos'|'contratos'|'financas'|'saneamento'|'setores'|'fontes';
const LINKS:[Page,string,string][]=[
 ['painel','Painel municipal','▦'],['mapa','Mapa de obras','⌖'],['obras','Cadastro de obras','▤'],
 ['investimentos','Investimentos por bairro','▥'],['equipamentos','Equipamentos públicos','▧'],['contratos','Licitações e contratos','◈'],
 ['financas','Finanças públicas','◫'],['saneamento','Saneamento básico','≈'],['setores','Atlas censitário 2022','▩'],['fontes','Fontes e metodologia','ⓘ']
];
const TITULOS:Record<Page,string>={painel:'Panorama territorial',mapa:'Mapa de obras e infraestrutura',obras:'Cadastro de obras públicas',investimentos:'Investimentos por bairro',equipamentos:'Equipamentos públicos',contratos:'Licitações e contratos',financas:'Finanças e execução orçamentária',saneamento:'Indicadores de saneamento básico',setores:'Atlas censitário 2022',fontes:'Fontes, métodos e qualidade'};
const AGRUPAMENTOS=[{name:'VISÃO TERRITORIAL',pages:['painel','mapa','obras','investimentos','equipamentos']},{name:'GESTÃO E TRANSPARÊNCIA',pages:['contratos','financas']},{name:'SANEAMENTO E TERRITÓRIO',pages:['saneamento','setores']},{name:'SOBRE OS DADOS',pages:['fontes']}];
const app=document.querySelector<HTMLDivElement>('#app');
if(!app)throw new Error('Elemento #app não encontrado');
const dados:Dados=await carregar(),obras=obrasList(dados);
const bairros=dados.bairros.features.map(bairroDaFeicao).sort((a,b)=>a.localeCompare(b,'pt-BR'));
let pagina:Page='painel',busca='',bairro='',status='',mapa:ReturnType<typeof criarMapa>=null,charts:echarts.ECharts[]=[];
let tema=localStorage.getItem('obras-tema')==='escuro'?'escuro':'claro';
document.documentElement.dataset.theme=tema;
const slug=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
function painelFalhas():string{return dados.falhas.length?'<div class="warning" role="alert"><b>Falha de carregamento de dados:</b> '+dados.falhas.map(texto).join(' · ')+'</div>':'';}
const head=(title:string,description:string)=>'<div class="page-intro"><div><div class="eyebrow">GeoCanoas / Obras e Saneamento</div><h2>'+texto(title)+'</h2><p>'+texto(description)+'</p></div></div>';
function fonte(href:string,label:string):string{return '<a href="'+texto(href)+'" target="_blank" rel="noopener noreferrer">'+texto(label)+' <span aria-hidden="true">↗</span></a>';}
function vazio(titulo:string,desc:string):string{return '<section class="empty"><div class="empty-icon">◇</div><h3>'+texto(titulo)+'</h3><p>'+texto(desc)+'</p></section>';}
function card(nome:string,valor:string,sub:string,icone:string,cor='teal'):string{return '<article class="kpi '+cor+'"><div class="kpi-top"><span>'+texto(nome)+'</span><span class="kpi-icon" aria-hidden="true">'+icone+'</span></div><strong>'+texto(valor)+'</strong><small>'+texto(sub)+'</small></article>';}
function nota(text:string):string{return '<div class="notice"><span class="notice-mark">i</span><div>'+text+'</div></div>';}
function seloStatus(s:string):string{return '<span class="status '+texto(s)+'">'+texto(nomesStatus[s as StatusObra]??'Não informado')+'</span>';}
function matches(o:Obra):boolean{const p=o.properties;return (!status||p.status===status)&&(!bairro||slug(p.bairro??'')===slug(bairro))&&(!busca||slug([p.titulo,p.id,p.orgao,p.contrato,p.bairro].join(' ')).includes(slug(busca)));}
function choosePage(p:Page):void{pagina=p;window.location.hash=p;busca='';status='';document.body.classList.remove('menu-open');render();window.scrollTo({top:0,behavior:'instant'});}
function bairroOptions():string{return '<option value="">Todos os bairros</option>'+bairros.map(x=>'<option value="'+texto(x)+'" '+(bairro===x?'selected':'')+'>'+texto(x)+'</option>').join('');}
function tabelaObras(rows:Obra[]):string{
 if(!rows.length)return vazio('Nenhuma obra disponível neste recorte','Ainda não há registros de obras verificados para exibir ou os filtros não encontraram correspondências. A ausência no painel não significa inexistência de obras.');
 return '<div class="table-wrap"><table><thead><tr><th>Obra / órgão</th><th>Bairro</th><th>Andamento</th><th>Valor contratado</th><th>Prazo final</th><th>Fonte</th></tr></thead><tbody>'+rows.map(o=>{const p=o.properties;return '<tr><td><strong>'+texto(p.titulo)+'</strong><small>'+texto(p.orgao)+' · '+texto(p.id)+'</small></td><td>'+texto(p.bairro??'Não identificado')+'</td><td>'+seloStatus(p.status)+(p.percentual_execucao!=null?'<small>'+numero(p.percentual_execucao)+'% de execução informada</small>':'')+'</td><td>'+moeda(p.valor_contratado)+'</td><td>'+anoRef(p.prazo_final)+'</td><td>'+fonte(p.url_fonte,'Documento')+'</td></tr>';}).join('')+'</tbody></table></div>';
}
function filteredWorks():Obra[]{return obras.filter(matches);}
function statusFilters():string{return '<label>Andamento<select id="status-filter"><option value="">Todos os status</option>'+Object.entries(nomesStatus).map(([v,n])=>'<option value="'+v+'" '+(v===status?'selected':'')+'>'+texto(n)+'</option>').join('')+'</select></label>';}
function filters():string{return '<div class="filters"><label>Buscar obra, código, órgão ou contrato<input id="search-filter" type="search" placeholder="Buscar no cadastro..." value="'+texto(busca)+'"/></label><label>Bairro<select id="bairro-filter">'+bairroOptions()+'</select></label>'+statusFilters()+'<button id="clear-filters" class="btn secondary">Limpar</button></div>';}
function renderPainel():string{
 const q=obras.length;
 const obraVal=totalVerificado(obras,'valor_contratado');
 const comCoord=obras.filter(x=>!!x.geometry).length;
 const agua=dados.saneamento.indicadores.find(i=>i.id==='agua_atendimento'),esgoto=dados.saneamento.indicadores.find(i=>i.id==='esgoto_atendimento');
 return head('Investimentos, obras e serviços em seu território','Informações integradas com indicação de fonte, escala geográfica e limites de cobertura.')+
 painelFalhas()+'<div class="kpis">'+card('Obras cadastradas',String(q),q?'Registros documentados':'Base de obras aguardando integração','▤')+
 card('Valor contratado identificado',moeda(obraVal),obraVal==null?'Não calculável sem contratos':'Soma apenas valores registrados','R$','blue')+
 card('Obras com geometria',String(comCoord),q?'Coordenadas de origem verificadas':'Sem pontos de obras publicados','⌖','gold')+
 card('Bairros / setores',bairros.length+' / '+inteiro(dados.setores.features.length),'GeoCanoas e IBGE 2022','▩','purple')+'</div>'+
 '<div class="two-col"><section class="panel"><div class="panel-title"><div><span class="tag">OBRAS</span><h3>Transparência territorial</h3></div><button class="btn soft" data-go="mapa">Abrir mapa</button></div>'+
 (q?tabelaObras(obras.slice(0,6)):vazio('Obras municipais: integração pendente','O cadastro está tecnicamente preparado, mas não há registros públicos municipais incorporados com comprovação documental.'))+
 '</section><section class="panel"><div class="panel-title"><div><span class="tag">SANEAMENTO · MUNICÍPIO</span><h3>Cobertura dos serviços</h3></div><button class="btn soft" data-go="saneamento">Detalhes</button></div>'+
 '<div class="bars"><div class="bar-row"><div><span>Abastecimento de água</span><b>'+numero(agua?.valor)+'%</b></div><div class="bar-track"><span style="width:'+Number(agua?.valor??0)+'%"></span></div></div><div class="bar-row"><div><span>Esgotamento sanitário</span><b>'+numero(esgoto?.valor)+'%</b></div><div class="bar-track"><span style="width:'+Number(esgoto?.valor??0)+'%"></span></div></div></div>'+
 nota('Esses percentuais são <b>municipais</b>. Não há estimativas de cobertura por bairro ou setor nesta base, evitando falsa precisão territorial.')+
 '<small class="source">Fonte: '+fonte(dados.saneamento.fonteUrl,'SINISA 2024 · Instituto Água e Saneamento')+'</small></section></div>'+
 '<section class="panel"><div class="panel-title"><div><span class="tag">TERRITÓRIO</span><h3>Cartografia oficial e contexto censitário</h3></div><button class="btn soft" data-go="setores">Explorar setores</button></div><p>Os <b>18 bairros oficiais</b> do GeoCanoas e os <b>659 setores do Censo 2022</b> estão disponíveis para análises espaciais, incluindo população, densidade, domicílios e renda. São dados de contexto; não constituem localização de obras ou cadastro de redes.</p></section>';
}
function mapControls(initial:'obras'|'setores'):string{return '<div id="map-controls" class="map-controls"><div class="control-line"><label><input id="layer-bairros" type="checkbox" checked/> Bairros oficiais</label><label><input id="layer-setores" type="checkbox" '+(initial==='setores'?'checked':'')+'/> Setores censitários</label><label><input id="layer-obras" type="checkbox" checked/> Obras localizadas</label></div><label class="metric">Colorir setores por <select id="map-metrica"><option value="dens_pop">Densidade populacional</option><option value="pop">População residente</option><option value="perc_vagos">Domicílios vagos (%)</option><option value="renda_media">Renda média dos responsáveis (2022)</option></select></label></div>';}
function mapaPanel(initial:'obras'|'setores'):string{return '<section class="panel map-panel">'+mapControls(initial)+'<div class="map-frame"><div id="map-canvas" role="application" aria-label="Mapa interativo de Canoas com bairros, setores censitários e obras"></div><div id="map-error" class="map-error" role="status"></div><div id="map-legenda" class="map-legend" '+(initial!=='setores'?'hidden':'')+'><span>Densidade populacional</span><div class="gradient"></div><small>Escala relativa de visualização; consulte a informação do setor ao clicar.</small></div></div></section>';}
function renderMapa():string{return head('Mapa de obras e territórios','Camadas oficiais com seleção espacial e acesso aos dados censitários. Apenas coordenadas verificadas são exibidas como obras.')+
 painelFalhas()+nota('A camada de obras está '+(obras.length?'carregada com '+inteiro(obras.length)+' registros.':'sem registros verificados. Não foram criados pontos ilustrativos ou coordenadas aproximadas.')+' Selecione os bairros e os setores no mapa para explorar informações.')+
 mapaPanel('obras')+'<div class="subtle">Fonte de bairros: GeoCanoas / BAIRROSOFICIAL. Setores: IBGE Censo 2022. Mapa-base: OpenFreeMap.</div>';
}
function renderObras():string{return head('Obras públicas por bairro e situação','Cadastro auditável: valores, prazos, execução, localização e referência documental sempre que disponíveis.')+
 painelFalhas()+nota('Uma obra só aparece no mapa quando possui geometria válida e fonte conferida. Registros sem coordenada permanecem na tabela, sem geocodificação inventada.')+
 '<section class="panel">'+filters()+'<div id="obras-count" class="results">'+inteiro(filteredWorks().length)+' registro(s) no filtro · '+inteiro(obras.length)+' no cadastro</div><div id="obras-table">'+tabelaObras(filteredWorks())+'</div></section>';
}
function tabelaValores():string{
 const porBairro=new Map<string,Obra[]>();for(const b of bairros)porBairro.set(b,[]);
 for(const o of obras){const b=bairros.find(x=>slug(x)===slug(o.properties.bairro??''));if(b)porBairro.get(b)!.push(o);}
 const rows=[...porBairro.entries()].map(([b,arr])=>({b,arr,count:arr.length,total:totalVerificado(arr,'valor_contratado')})).sort((a,b)=>(b.total??-1)-(a.total??-1));
 return '<div class="table-wrap"><table><thead><tr><th>Bairro oficial</th><th>Obras com bairro validado</th><th>Valor contratado conhecido</th><th>Com localização</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+texto(x.b)+'</b></td><td>'+(x.count?inteiro(x.count):'Não disponível')+'</td><td>'+moeda(x.total)+'</td><td>'+(x.arr.length?inteiro(x.arr.filter(o=>!!o.geometry).length):'N/D')+'</td></tr>').join('')+'</tbody></table></div>';
}
function renderInvestimentos():string{
 const geobairro=obras.filter(o=>o.properties.bairro&&bairros.some(b=>slug(b)===slug(o.properties.bairro??'')));
 const total=totalVerificado(geobairro,'valor_contratado');
 return head('Distribuição territorial dos investimentos','Agregação por bairro apenas de obras com bairro comprovado, sem rateio de orçamento municipal.')+
 '<div class="kpis">'+card('Bairros oficiais',inteiro(bairros.length),'Referência cartográfica','▩')+card('Obras associadas a bairro',inteiro(geobairro.length),'Cadastro rastreável','⌖')+card('Valor atribuível aos bairros',moeda(total),'Sem imputações territoriais','R$','blue')+'</div>'+
 nota('Sem localização ou bairro validado, despesas de âmbito municipal <b>não podem ser distribuídas</b> entre os bairros. “Não disponível” não significa valor zero.')+
 '<section class="panel"><div class="panel-title"><h3>Investimentos por bairro</h3><button id="export-invest" class="btn soft">Exportar CSV</button></div>'+tabelaValores()+'</section>';
}
function renderEquipamentos():string{
 const eq=obras.filter(o=>/escola|emei|ubs|hospital|posto de sa[uú]de|creche|quadra|centro comunit[aá]rio|pra[cç]a|gin[aá]sio/i.test(o.properties.tipo+' '+o.properties.titulo));
 return head('Equipamentos públicos construídos ou em construção','Escolas, unidades de saúde, lazer e outros equipamentos vinculados a contratos de obras verificáveis.')+
 nota('O filtro abaixo usa a descrição/tipologia do <b>cadastro de obras</b>, não o inventário de equipamentos existentes na cidade. Uma escola existente não é automaticamente uma obra.')+
 '<section class="panel"><div class="panel-title"><h3>Intervenções em equipamentos públicos</h3><span class="chip">'+inteiro(eq.length)+' registros</span></div>'+tabelaObras(eq)+'</section>';
}
function renderContratos():string{
 const c=dados.contratos.items;return head('Licitações, contratos e execução','Referências documentais e vinculação a obras somente quando houver identificador confiável.')+
 '<div class="kpis">'+card('Contratos documentados',inteiro(c.length),'Fonte vinculada','◈')+card('Valores contratuais conhecidos',moeda(c.length?c.reduce((s,x)=>s+(x.valor??0),0):null),'Não equivale a pagamento','R$','blue')+'</div>'+
 nota('Contrato <b>não é despesa paga</b>, proposta de licitação <b>não é obra executada</b>, e a localização do fornecedor <b>não é localização da obra</b>.')+
 '<section class="panel">'+(c.length?'<div class="table-wrap"><table><thead><tr><th>Objeto / ID</th><th>Fornecedor</th><th>Valor</th><th>Publicado</th><th>Origem</th></tr></thead><tbody>'+c.map(x=>'<tr><td><b>'+texto(x.objeto)+'</b><small>'+texto(x.numero)+'</small></td><td>'+texto(x.fornecedor)+'</td><td>'+moeda(x.valor)+'</td><td>'+anoRef(x.data)+'</td><td>'+fonte(x.url_fonte,'PNCP / origem')+'</td></tr>').join('')+'</tbody></table></div>':vazio('Contratos aguardando ingestão','O modelo de dados está preparado, mas nenhum contrato foi validado e incorporado à base publicada.'))+'</section>'+
 '<div class="link-grid"><div class="source-tile"><b>PNCP</b><p>Contratações e contratos públicos, com identificadores oficiais.</p>'+fonte('https://pncp.gov.br/app/contratos','Consultar portal')+'</div><div class="source-tile"><b>Obrasgov</b><p>Investimentos federais com informações físicas e georreferenciadas quando disponíveis.</p>'+fonte('https://www.gov.br/obrasgov/pt-br/acesso-a-informacao/dados-abertos-obrasgov','Acessar API')+'</div></div>';
}
function renderFinancas():string{
 const f=dados.financas.observacoes;
 const anos=[...new Set(f.map(x=>x.ano))].sort((a,b)=>b-a);
 const ult=anos[0];
 const pago=f.find(x=>x.ano===ult&&x.categoria.includes('pagas'));
 const empenhado=f.find(x=>x.ano===ult&&x.categoria.includes('empenhadas'));
 return head('Finanças públicas e execução orçamentária','Investimentos municipais extraídos do SICONFI, com segregação por etapa de execução e período de referência.')+
 nota('Dados do <b>RREO-Anexo 01 do Tesouro Nacional</b>, linha “Investimentos” (excluídas as linhas intraorçamentárias). São valores acumulados no exercício até o bimestre informado, <b>não</b> despesas por bairro nem custos de obras específicas. Valores empenhados, liquidados e pagos não devem ser somados.')+
 '<div class="kpis">'+card('Exercícios com observações',inteiro(anos.length),'RREO municipal · SICONFI','▥')+
 card('Investimentos pagos '+(ult??''),moeda(pago?.valor),pago?('Até '+((f.find(x=>x===pago) as typeof pago & {bimestre?:number})?.bimestre??'último')+'º bimestre'):'Sem dado verificado','R$','blue')+
 card('Investimentos empenhados '+(ult??''),moeda(empenhado?.valor),'Não equivale a despesa paga','◈','gold')+
 card('Linhas documentadas',inteiro(f.length),'Valores publicados com fonte direta','▤','purple')+'</div>'+
 (f.length?'<section class="panel"><div class="panel-title"><div><span class="tag">SICONFI / INVESTIMENTOS</span><h3>Execução por exercício</h3></div></div><div class="chart" id="fin-chart" role="img" aria-label="Barras comparativas de investimentos empenhados, liquidados e pagos por ano"></div><small class="subtle">Períodos incompletos não são diretamente comparáveis com exercícios encerrados. As três etapas não são parcelas acumuláveis entre si.</small></section>':'')+
 '<section class="panel"><div class="panel-title"><h3>Demonstrativos incorporados</h3><div class="panel-actions"><span class="chip">'+inteiro(f.length)+' observações</span> <button id="export-financas" class="btn soft" '+(f.length?'':'disabled')+'>Exportar CSV</button></div></div>'+
 (f.length?'<div class="table-wrap"><table><thead><tr><th>Ano</th><th>Rubrica e fase da despesa</th><th>Valor declarado</th><th>Documento</th></tr></thead><tbody>'+f.map(x=>'<tr><td>'+x.ano+'</td><td>'+texto(x.categoria)+'</td><td>'+moeda(x.valor)+'</td><td>'+fonte(x.fonte,'RREO oficial')+'</td></tr>').join('')+'</tbody></table></div>':vazio('Série fiscal em preparação','Nenhuma série foi importada sem confirmar demonstrativo, rubrica, periodicidade e natureza dos valores.'))+'</section>'+
 '<div class="link-grid"><div class="source-tile"><h3>SICONFI / Tesouro Nacional</h3><p>RREO, DCA e matrizes contábeis de Canoas (IBGE 4304606), com coleta automatizada e proveniência do anexo.</p>'+fonte('https://apidatalake.tesouro.gov.br/docs/siconfi/','Documentação da API')+'</div><div class="source-tile"><h3>Obras e pagamentos territorializados</h3><p>Pagamentos por contrato e obra dependem de chaves municipais verificadas; não são inferidos dos valores globais do RREO.</p>'+fonte('https://www.canoas.rs.gov.br/','Prefeitura de Canoas')+'</div></div>';
}
function indicadorCard(i:Indicador):string{
 const val=i.unidade==='%'?numero(i.valor)+'%':inteiro(i.valor)+' '+i.unidade;
 return '<article class="indicator"><div><div class="indicator-label">'+texto(i.nome)+'</div><strong>'+texto(val)+'</strong></div><p>'+texto(i.descricao??i.referencia)+'</p><small>'+texto(i.referencia)+' · Escala municipal</small></article>';
}
function renderSaneamento():string{
 const temas:Indicador['tema'][]=['agua','esgoto','residuos','drenagem'];
 return head('Saneamento básico de Canoas','Indicadores sobre água, esgotamento, resíduos e drenagem. Séries de escala municipal, sem inferência por setor.')+
 nota('<b>Escala geográfica: município inteiro.</b> Dados SINISA 2024, conforme síntese pública do Instituto Água e Saneamento. Cobertura de água, coleta de esgoto e tratamento são conceitos diferentes; consulte a definição individual.')+
 '<div class="kpis">'+['agua_atendimento','esgoto_atendimento','residuos_coleta','drenagem_risco'].map((id,i)=>{const x=dados.saneamento.indicadores.find(j=>j.id===id);return card(x?.nome??id,x?numero(x.valor)+'%':'N/D','SINISA 2024 · Canoas',['≈','≋','♻','◉'][i],['teal','blue','gold','purple'][i]);}).join('')+'</div>'+
 '<section class="panel"><div class="panel-title"><div><span class="tag">COBERTURA E RISCO</span><h3>Comparação de indicadores percentuais selecionados</h3></div></div><div id="saneamento-chart" class="chart" role="img" aria-label="Gráfico percentual de indicadores municipais selecionados"></div><small class="subtle">São dimensões diferentes exibidas para comparação visual, não parcelas de um mesmo total.</small></section>'+
 temas.map(t=>'<section class="panel"><div class="panel-title"><div><span class="tag">'+t.toUpperCase()+'</span><h3>'+texto(nomesTemas[t])+'</h3></div></div><div class="indicators">'+dados.saneamento.indicadores.filter(x=>x.tema===t).map(indicadorCard).join('')+'</div></section>').join('')+
 '<section class="panel"><h3>Interpretação territorial</h3><p>Os dados disponíveis informam a cobertura global de Canoas. Para mapas de atendimento bairro a bairro, é necessário obter redes de distribuição de água, coletores de esgoto, drenagem, trechos atendidos ou bases setoriais verificadas junto aos prestadores e ao município. O percentual municipal não pode ser aplicado a cada setor.</p><p>'+fonte(dados.saneamento.fonteUrl,'Painel de saneamento · Canoas')+' · '+fonte(dados.saneamento.fonteOficial,'Resultados oficiais do SINISA')+'</p></section>';
}
function renderSetores():string{
 const setorValues=dados.setores.features.map(f=>f.properties??{}).filter(p=>typeof p.id==='string');
 const ranked=[...setorValues].filter(p=>typeof p.dens_pop==='number').sort((a,b)=>Number(b.dens_pop)-Number(a.dens_pop)).slice(0,25);
 return head('Censo 2022 — setores de Canoas','Cartografia de contexto: população, densidade, domicílios e rendimento conforme agregados oficiais.')+
 '<div class="kpis">'+card('Setores disponíveis',inteiro(dados.setores.features.length),'Malha 2022 · IBGE','▩')+card('Bairros oficiais',inteiro(bairros.length),'Malha GeoCanoas','⌖')+
 card('População censitária',inteiro(setorValues.reduce((s,p)=>s+(typeof p.pop==='number'?p.pop:0),0)),'Somatório setorial disponível · 2022','◉','blue')+'</div>'+
 nota('Indicadores censitários são referências de <b>contexto socioespacial</b>. Não medem a cobertura das redes de água, esgoto, drenagem ou a execução de obras em cada setor.')+
 mapaPanel('setores')+
 '<section class="panel"><div class="panel-title"><h3>Setores com maior densidade populacional</h3><button id="export-setores" class="btn soft">Exportar CSV (659)</button></div><div class="table-wrap"><table><thead><tr><th>Setor IBGE</th><th>Bairro IBGE</th><th>População</th><th>Densidade (hab./km²)</th><th>Domicílios vagos</th></tr></thead><tbody>'+ranked.map(p=>'<tr><td>'+texto(p.id)+'</td><td>'+texto(p.bairro_ibge??'N/D')+'</td><td>'+inteiro(Number(p.pop))+'</td><td>'+numero(Number(p.dens_pop),0)+'</td><td>'+numero(typeof p.perc_vagos==='number'?p.perc_vagos:null)+'%</td></tr>').join('')+'</tbody></table></div></section>';
}
function renderFontes():string{
 const sources=[
 ['Bairros oficiais (18)','GeoCanoas — BAIRROSOFICIAL / FeatureServer','https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0','Geometria municipal oficial importada do projeto WebGIS Empreender.','Integrada'],
 ['Setores 2022 (659)','IBGE — malha definitiva e agregados de setores','https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html','GeoJSON recortado e simplificado; indicadores do Censo 2022.','Integrada'],
 ['Saneamento municipal','SINISA 2024 / Instituto Água e Saneamento',dados.saneamento.fonteUrl,'Indicadores por município; módulos água, esgoto, resíduos e drenagem.','Integrada'],
 ['Obras municipais','Prefeitura de Canoas / documentação de obras','https://www.canoas.rs.gov.br/','Cadastro e localização pendentes de extração documental verificada.','Pendente'],
 ['Contratos e licitações','Portal Nacional de Contratações Públicas','https://pncp.gov.br/api/consulta/swagger-ui/index.html','Requer conciliação entre órgão, objeto, obra e localização.','Pendente'],
 ['Investimentos federais','Obrasgov.br — georreferenciamento e execução','https://www.gov.br/obrasgov/pt-br/acesso-a-informacao/dados-abertos-obrasgov','Potencial integração por obra, com atenção ao vínculo territorial.','Pendente'],
 ['Finanças municipais','SICONFI — API Tesouro Nacional','https://apidatalake.tesouro.gov.br/docs/siconfi/','RREO/DCA/MSC: dados fiscais agregados não geocodificáveis automaticamente.','Pendente']
 ];
 return head('Fontes, proveniência e qualidade','Metadados, conceitos e o que ainda depende de validação documental.')+
 nota('Nunca confundir <b>ausência de dado</b> com ausência de obra, despesa, rede ou serviço. O projeto não publica geometrias, valores ou percentuais territorializados sem fonte.')+
 '<section class="panel"><div class="table-wrap"><table><thead><tr><th>Base</th><th>Origem</th><th>Cobertura e limitações</th><th>Situação</th></tr></thead><tbody>'+sources.map(x=>'<tr><td><b>'+texto(x[0])+'</b></td><td>'+fonte(x[2],x[1])+'</td><td>'+texto(x[3])+'</td><td><span class="chip">'+texto(x[4])+'</span></td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="panel"><h3>Política de transparência territorial</h3><p>Atribuição de investimentos somente por georreferenciamento da própria intervenção ou bairro explicitamente documentado, nunca pelo endereço da sede do fornecedor. Valores contratados não representam execução financeira. Dados setoriais do Censo 2022 não devem ser utilizados como distribuição espacial fictícia dos indicadores municipais do SINISA.</p><p>O cadastro de obras usa uma rotina reprodutível de importação em CSV, com validação de coordenadas, faixa de valores, identificadores e origem. Consulte o README e o guia de metodologia do repositório.</p><p>'+fonte('https://github.com/marcianolima/webgis-obras-canoas','Código e documentação do projeto')+'</p></section>';
}
function contentPage():string{switch(pagina){case 'painel':return renderPainel();case 'mapa':return renderMapa();case 'obras':return renderObras();case 'investimentos':return renderInvestimentos();case 'equipamentos':return renderEquipamentos();case 'contratos':return renderContratos();case 'financas':return renderFinancas();case 'saneamento':return renderSaneamento();case 'setores':return renderSetores();case 'fontes':return renderFontes();}}
function navHtml():string{return AGRUPAMENTOS.map(g=>'<div class="nav-group"><div class="nav-label">'+g.name+'</div>'+g.pages.map(p=>{const [id,n,ic]=LINKS.find(x=>x[0]===p)!;return '<button data-nav="'+id+'" class="nav-item '+(pagina===id?'active':'')+'" aria-current="'+(pagina===id?'page':'false')+'"><span class="nav-icon">'+ic+'</span><span>'+n+'</span></button>';}).join('')+'</div>').join('');}
function render():void{
 mapa?.remove();mapa=null;for(const c of charts)c.dispose();charts=[];
 app!.innerHTML='<div class="layout"><aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">⌖</div><div><b>GeoCanoas</b><small>OBRAS E SANEAMENTO</small></div></div><nav aria-label="Navegação principal">'+navHtml()+'</nav><div class="sidebar-footer"><b>Transparência territorial</b><p>Canoas / Rio Grande do Sul</p><small>Dados oficiais, sem localizações simuladas</small></div></aside><div id="mobile-backdrop" class="backdrop"></div><div class="main"><header class="topbar"><div class="top-left"><button class="icon-button mobile-menu" id="menu-toggle" aria-label="Abrir navegação" aria-controls="sidebar">☰</button><div><small>WEBGIS / CANOAS</small><h1>'+texto(TITULOS[pagina])+'</h1></div></div><div class="top-actions"><span class="data-badge">Dados rastreáveis</span><button class="icon-button" id="theme-toggle" aria-label="Alternar tema" title="Alternar tema">'+(tema==='claro'?'☾':'☼')+'</button></div></header><main id="workspace" class="workspace">'+contentPage()+'</main><footer>GeoCanoas · Cartografia oficial / IBGE · Fontes com indicação de ano e abrangência · <a href="https://github.com/marcianolima/webgis-obras-canoas" target="_blank" rel="noopener noreferrer">Código aberto ↗</a></footer></div></div>';
 app!.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(b=>b.addEventListener('click',()=>choosePage(b.dataset.nav as Page)));
 app!.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b=>b.addEventListener('click',()=>choosePage(b.dataset.go as Page)));
 document.getElementById('menu-toggle')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
 document.getElementById('mobile-backdrop')?.addEventListener('click',()=>document.body.classList.remove('menu-open'));
 document.getElementById('theme-toggle')?.addEventListener('click',()=>{tema=tema==='claro'?'escuro':'claro';document.documentElement.dataset.theme=tema;localStorage.setItem('obras-tema',tema);render();});
 if(pagina==='mapa'||pagina==='setores')mapa=criarMapa(dados,pagina==='mapa'?'obras':'setores');
 if(pagina==='saneamento')criarGrafico();
 if(pagina==='financas'){criarGraficoFinancas();document.getElementById('export-financas')?.addEventListener('click',exportarFinancas);}
 if(pagina==='obras')bindFiltros();
 if(pagina==='investimentos')document.getElementById('export-invest')?.addEventListener('click',exportarInvestimentos);
 if(pagina==='setores')document.getElementById('export-setores')?.addEventListener('click',exportarSetores);
}
function bindFiltros():void{
 const update=()=>{document.getElementById('obras-count')!.textContent=inteiro(filteredWorks().length)+' registro(s) no filtro · '+inteiro(obras.length)+' no cadastro';document.getElementById('obras-table')!.innerHTML=tabelaObras(filteredWorks());};
 document.getElementById('search-filter')?.addEventListener('input',e=>{busca=(e.target as HTMLInputElement).value;update();});
 document.getElementById('bairro-filter')?.addEventListener('change',e=>{bairro=(e.target as HTMLSelectElement).value;update();});
 document.getElementById('status-filter')?.addEventListener('change',e=>{status=(e.target as HTMLSelectElement).value;update();});
 document.getElementById('clear-filters')?.addEventListener('click',()=>{bairro='';busca='';status='';render();});
}
function criarGrafico():void{
 const root=document.getElementById('saneamento-chart');if(!root)return;const chart=echarts.init(root);charts.push(chart);
 const ids=['agua_atendimento','esgoto_atendimento','residuos_coleta','drenagem_risco'];
 const vals=ids.map(id=>dados.saneamento.indicadores.find(x=>x.id===id));
 chart.setOption({grid:{top:20,left:12,right:24,bottom:14,containLabel:true},tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:(params:unknown)=>{const a=params as {name:string;value:number}[];return a.map(p=>texto(p.name)+': '+numero(p.value)+'%').join('<br/>');}},xAxis:{type:'value',min:0,max:100,axisLabel:{formatter:'{value}%'}},yAxis:{type:'category',data:['Água','Esgoto','Coleta domiciliar','Risco de inundação'],axisLabel:{color:tema==='escuro'?'#d2e4ed':'#355061'}},series:[{type:'bar',data:vals.map(v=>v?.valor??null),barMaxWidth:22,itemStyle:{color:'#138b95',borderRadius:[0,6,6,0]},label:{show:true,position:'right',formatter:'{c}%'}}]});
 const resize=()=>{if(document.getElementById('saneamento-chart')===root)chart.resize();else window.removeEventListener('resize',resize);};window.addEventListener('resize',resize);
}
function criarGraficoFinancas():void{
 const root=document.getElementById('fin-chart');if(!root)return;
 const chart=echarts.init(root);charts.push(chart);
 const data=dados.financas.observacoes;
 const years=[...new Set(data.map(d=>d.ano))].sort((a,b)=>a-b);
 const tipos=[{id:'empenhadas',label:'Empenhadas'},{id:'liquidadas',label:'Liquidadas'},{id:'pagas',label:'Pagas'}];
 const format=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
 chart.setOption({grid:{left:20,right:18,top:40,bottom:40,containLabel:true},legend:{top:4,textStyle:{color:tema==='escuro'?'#d2e4ed':'#355061'}},tooltip:{trigger:'axis',valueFormatter:(v:unknown)=>typeof v==='number'?format(v):'N/D'},xAxis:{type:'category',data:years.map(String)},yAxis:{type:'value',axisLabel:{formatter:(v:number)=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(v)}},series:tipos.map(t=>({name:t.label,type:'bar',barMaxWidth:24,data:years.map(ano=>data.find(x=>x.ano===ano&&x.categoria.includes(t.id))?.valor??null)}))});
 const resize=()=>{if(document.getElementById('fin-chart')===root)chart.resize();else window.removeEventListener('resize',resize);};window.addEventListener('resize',resize);
}
function exportarFinancas():void{
 csvDownload('investimentos-municipais-siconfi-canoas.csv',['ano','categoria','valor','fonte'],dados.financas.observacoes.map(x=>[x.ano,x.categoria,x.valor,x.fonte]));
}
function csvDownload(filename:string,header:string[],rows:(string|number|null|undefined)[][]):void{
 const q=(x:unknown)=>'"'+String(x??'').replace(/"/g,'""')+'"';const txt=[header,...rows].map(row=>row.map(q).join(';')).join('\r\n');const blob=new Blob(['\ufeff',txt],{type:'text/csv;charset=utf-8'});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),200);
}
function exportarInvestimentos():void{
 csvDownload('investimentos-bairros-canoas.csv',['bairro','obras_com_bairro_validado','valor_contratado_conhecido'],bairros.map(b=>{const arr=obras.filter(o=>slug(o.properties.bairro??'')===slug(b));return [b,arr.length||null,totalVerificado(arr,'valor_contratado')];}));
}
function exportarSetores():void{
 csvDownload('setores-censo2022-canoas.csv',['id_setor','bairro_ibge','populacao','densidade_hab_km2','domicilios_vagos_pct','renda_media_responsaveis_2022'],dados.setores.features.map(f=>{const p=f.properties??{};return [String(p.id??''),String(p.bairro_ibge??''),p.pop,p.dens_pop,p.perc_vagos,p.renda_media];}));
}
window.addEventListener('hashchange',()=>{const p=window.location.hash.replace('#','') as Page;if(LINKS.some(x=>x[0]===p)&&p!==pagina){pagina=p;render();}});
window.addEventListener('bairro-selecionado',e=>{const b=(e as CustomEvent<string>).detail;if(bairros.some(x=>slug(x)===slug(b)))bairro=b;});
const initial=window.location.hash.slice(1) as Page;if(LINKS.some(x=>x[0]===initial))pagina=initial;
render();
