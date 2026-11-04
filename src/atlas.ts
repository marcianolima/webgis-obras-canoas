import maplibregl from 'maplibre-gl';
import * as echarts from 'echarts';
import type {Feature,Geometry,Point,FeatureCollection} from 'geojson';
import type {Dados,ObraFederal,ContratoEspacial} from './data';
import {texto,moeda,numero,inteiro,bairroDaFeicao} from './data';

type Fonte='obrasgov'|'pncp'|'municipal';
type Item={
 id:string;fonte:Fonte;titulo:string;tipo:string;status:string;valor:number|null;faseValor:string;
 percentual:number|null;data:string|null;ano:string;orgao:string;bairro:string|null;
 bairroDocumento:string|null;qualidade:string;observacao:string;url:string;
 coords:[number,number][];categoria:string;equipamento:string|null;fornecedor:string|null;
 pagoNotas:number|null;liquidadoNotas:number|null;empenhadoNotas:number|null;rpPagoNotas:number|null;notas:number|null;alertas:string[];
};
type Filtro={q:string;fonte:string;status:string;ano:string;bairro:string;local:string;tipo:string;ordem:string};
type Charts={status:echarts.ECharts|null;bairros:echarts.ECharts|null;valores:echarts.ECharts|null};
const normal=(s:unknown)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const validLink=(s:string)=>s.startsWith('https://')?s:'#';
const categorias:Record<string,string>={obra_fisica_candidata:'Contrato candidato a obra',manutencao_infraestrutura:'Manutenção / infraestrutura',projeto_tecnico:'Projeto / serviço técnico'};
const getPoint=(g:Geometry|null):[number,number][]=>{
 if(g?.type==='Point')return [g.coordinates as [number,number]];
 if(g?.type==='MultiPoint')return g.coordinates as [number,number][];
 return [];
};
const finite=(n:unknown):number|null=>typeof n==='number'&&Number.isFinite(n)?n:null;
const dataYear=(s:string|null)=>/^(19|20)\d{2}/.test(s??'')?(s as string).slice(0,4):'N/D';

export function itensAtlas(d:Dados):Item[]{
 const fed=d.obrasgov.features.map((f):Item=>{
  const p=(f as ObraFederal).properties;
  const coords=getPoint(f.geometry);
  return {id:'GOV:'+p.id,fonte:'obrasgov',titulo:p.titulo,tipo:p.natureza??'Projeto de investimento',
   status:p.situacao??'Não informada',valor:finite(p.valor_previsto),
   faseValor:'Investimento previsto (não pago)',percentual:finite(p.percentual_execucao),
   data:p.data_cadastro,ano:dataYear(p.data_cadastro),orgao:p.organizacao_responsavel??'Obrasgov',
   bairro:coords.length===1?p.bairro:null,bairroDocumento:null,qualidade:p.precisao,
   observacao:coords.length>1?'Projeto com múltiplos locais; valor não é alocado integralmente a um único bairro.':'Local cadastrado oficialmente no Obrasgov; verificar precisão da geometria.',
   url:p.url_fonte,coords,categoria:p.especie??p.natureza??'Projeto',equipamento:null,fornecedor:null,
   pagoNotas:finite(p.execucao_financeira_notas?.valor_pago_notas),
   empenhadoNotas:finite(p.execucao_financeira_notas?.valor_empenhado_notas),
   liquidadoNotas:finite(p.execucao_financeira_notas?.valor_liquidado_notas),
   rpPagoNotas:finite(p.execucao_financeira_notas?.valor_restos_a_pagar_pago_notas),
   notas:p.execucao_financeira_notas?.qtd_notas_unicas??null,alertas:p.alertas_qualidade??[]};
 });
 const pncp=d.intervencoes.features.map((f):Item=>{
  const p=(f as ContratoEspacial).properties;
  return {id:'PNCP:'+p.id,fonte:'pncp',titulo:p.titulo,tipo:categorias[p.classe]??p.classe,
   status:'Não informado (PNCP)',valor:finite(p.valor),faseValor:'Valor global contratado (não pago)',
   percentual:null,data:p.data_assinatura,ano:dataYear(p.data_assinatura),orgao:'Prefeitura de Canoas',
   bairro:p.bairro, bairroDocumento:p.bairro_documentado,
   qualidade:p.qualidade_localizacao,observacao:p.descricao_localizacao??'Sem coordenada confirmada para o objeto. Contrato não comprova execução.',
   url:p.url_fonte,coords:getPoint(f.geometry),categoria:p.classe,equipamento:p.equipamento,fornecedor:p.fornecedor,
   pagoNotas:null,liquidadoNotas:null,empenhadoNotas:null,rpPagoNotas:null,notas:null,alertas:[]};
 });
 const municipal=d.obras.features.map((f):Item=>{
  const p=f.properties;
  const coords=getPoint(f.geometry);
  return {id:'MUNIC:'+p.id,fonte:'municipal',titulo:p.titulo,tipo:p.tipo,
   status:p.status,valor:finite(p.valor_contratado),faseValor:'Contrato de obra municipal validado',
   percentual:finite(p.percentual_execucao),data:p.inicio,ano:dataYear(p.inicio),orgao:p.orgao,
   bairro:p.bairro,bairroDocumento:p.bairro,qualidade:p.localizacao,
   observacao:'Cadastro municipal documentado. Consulte a fonte para confirmar etapa física.',
   url:p.url_fonte,coords,categoria:p.tipo,equipamento:null,fornecedor:null,
   pagoNotas:finite(p.valor_pago),liquidadoNotas:finite(p.valor_liquidado),empenhadoNotas:finite(p.valor_empenhado),rpPagoNotas:null,notas:null,alertas:[]};
 });
 return [...fed,...pncp,...municipal];
}

function options(list:string[],current:string,all:string):string{return '<option value="">'+texto(all)+'</option>'+list.map(v=>'<option value="'+texto(v)+'" '+(current===v?'selected':'')+'>'+texto(v)+'</option>').join('');}
function kpi(title:string,value:string,subtitle:string):string{return '<div class="atlas-kpi"><span>'+texto(title)+'</span><strong>'+texto(value)+'</strong><small>'+texto(subtitle)+'</small></div>';}
function sourceName(s:Fonte):string{return s==='obrasgov'?'Obrasgov · projeto':s==='pncp'?'PNCP · contrato':'Obra municipal';}
function badge(s:Fonte):string{return '<span class="atlas-badge '+s+'">'+sourceName(s)+'</span>';}
function statusName(s:string):string{return ({em_execucao:'Em execução',paralisada:'Paralisada',concluida:'Concluída',licitacao:'Licitação',planejada:'Planejada'} as Record<string,string>)[s]??s;}
function escCsv(v:unknown):string{
 let x=String(v??'');
 if(/^[\s]*[=+@-]/.test(x))x="'"+x;
 return '"'+x.replace(/"/g,'""')+'"';
}
function csv(filename:string,head:string[],rows:unknown[][]):void{
 const content=[head,...rows].map(row=>row.map(escCsv).join(';')).join('\r\n');
 const blob=new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),400);
}
function itemDetalhe(item:Item):string{
 return '<div class="atlas-popup">'+badge(item.fonte)+'<strong>'+texto(item.titulo)+'</strong>'+
 '<div><b>Situação física:</b> '+texto(statusName(item.status))+'</div>'+
 (item.percentual!=null?'<div><b>Execução física:</b> '+numero(item.percentual)+'% (Obrasgov)</div>':'<div><b>Execução física:</b> não informada</div>')+
 '<div><b>'+texto(item.faseValor)+':</b> '+moeda(item.valor)+'</div>'+
 (item.pagoNotas!=null?'<div><b>Pagamento registrado nas notas vinculadas:</b> '+moeda(item.pagoNotas)+'</div>':'')+
 (item.empenhadoNotas!=null?'<div><b>Empenhado nas notas vinculadas:</b> '+moeda(item.empenhadoNotas)+'</div>':'')+
 (item.alertas.length?'<div><b>Alertas de qualidade:</b> '+texto(item.alertas.join('; '))+'</div>':'')+
 '<div><b>Bairro:</b> '+texto(item.bairro??'Não atribuível')+'</div>'+
 (item.equipamento?'<div><b>Equipamento:</b> '+texto(item.equipamento)+'</div>':'')+
 '<small>'+texto(item.observacao)+'</small>'+
 '<a href="'+texto(validLink(item.url))+'" target="_blank" rel="noopener noreferrer">Ver registro oficial ↗</a></div>';
}
const filter0:Filtro={q:'',fonte:'',status:'',ano:'',bairro:'',local:'',tipo:'',ordem:'valor'};
function listar(itens:Item[],f:Filtro):Item[]{
 const filtered=itens.filter(x=>(!f.q||normal([x.titulo,x.id,x.orgao,x.equipamento,x.fornecedor].join(' ')).includes(normal(f.q)))&&
 (!f.fonte||x.fonte===f.fonte)&&(!f.status||x.status===f.status)&&(!f.ano||x.ano===f.ano)&&
 (!f.bairro||normal(x.bairro??'')===normal(f.bairro))&&
 (!f.local||(f.local==='com'&&x.coords.length>0)||(f.local==='sem'&&x.coords.length===0))&&
 (!f.tipo||x.categoria===f.tipo));
 const sorted=[...filtered];
 sorted.sort((a,b)=>f.ordem==='data'?String(b.data??'').localeCompare(a.data??''):
 f.ordem==='nome'?a.titulo.localeCompare(b.titulo,'pt-BR'):
 f.ordem==='status'?a.status.localeCompare(b.status,'pt-BR'):(b.valor??-1)-(a.valor??-1));
 return sorted;
}
type BairroSum={fed:number;pncp:number;valFed:number|null;valPncp:number|null;pagoFed:number|null;liquidadoFed:number|null;empenhadoFed:number|null};
export function bairroStats(list:Item[]):Map<string,BairroSum>{
 const map=new Map<string,BairroSum>();
 for(const item of list){
  if(!item.bairro||item.coords.length!==1)continue;
  const curr=map.get(item.bairro)??{fed:0,pncp:0,valFed:null,valPncp:null,pagoFed:null,liquidadoFed:null,empenhadoFed:null};
  if(item.fonte==='obrasgov'){
   curr.fed++;
   if(item.valor!=null)curr.valFed=(curr.valFed??0)+item.valor;
   if(item.pagoNotas!=null)curr.pagoFed=(curr.pagoFed??0)+item.pagoNotas;
   if(item.liquidadoNotas!=null)curr.liquidadoFed=(curr.liquidadoFed??0)+item.liquidadoNotas;
   if(item.empenhadoNotas!=null)curr.empenhadoFed=(curr.empenhadoFed??0)+item.empenhadoNotas;
  }else if(item.fonte==='pncp'){
   curr.pncp++;
   if(item.valor!=null)curr.valPncp=(curr.valPncp??0)+item.valor;
  }
  map.set(item.bairro,curr);
 }
 return map;
}
function listRows(items:Item[]):string{
 if(!items.length)return '<div class="empty"><h3>Nenhum registro no filtro</h3><p>Revise os critérios. A falta de ponto ou execução física informada não é equivalente à inexistência da intervenção.</p></div>';
 const display=items.slice(0,220);
 return '<div class="table-wrap"><table class="atlas-table"><thead><tr><th>Registro</th><th>Origem / situação</th><th>Bairro e localização</th><th>Valor e natureza</th><th>Execução</th><th>Fonte</th></tr></thead><tbody>'+display.map(item=>
 '<tr><td><b>'+texto(item.titulo)+'</b><small>'+texto(item.id)+' · '+texto(item.orgao)+'</small></td><td>'+badge(item.fonte)+'<small>'+texto(statusName(item.status))+'</small></td>'+
 '<td><b>'+texto(item.bairro??item.bairroDocumento??'Não informado')+'</b><small>'+texto(item.coords.length?(item.fonte==='pncp'?'Referência do equipamento':'Geometria Obrasgov'):'Sem ponto validado')+'</small>'+
 (item.coords.length?'<button class="atlas-map-focus" data-focus="'+texto(item.id)+'">Ver no mapa</button>':'')+'</td>'+
 '<td><b>'+moeda(item.valor)+'</b><small>'+texto(item.faseValor)+'</small></td>'+
 '<td>'+(item.percentual!=null?numero(item.percentual)+'%':'N/D')+'<small>'+texto(item.categoria)+'</small>'+(item.pagoNotas!=null?'<small>Pago em notas: '+moeda(item.pagoNotas)+'</small>':'')+'</td>'+
 '<td><a href="'+texto(validLink(item.url))+'" target="_blank" rel="noopener noreferrer">Documento ↗</a></td></tr>').join('')+'</tbody></table></div>'+
 (items.length>220?'<small class="subtle">Exibidos 220 registros; use os filtros ou exporte o conjunto completo.</small>':'');
}
export function atlasHtml(d:Dados,kind:'mapa'|'obras'|'equipamentos'='mapa'):string{
 const items=itensAtlas(d);
 const gov=items.filter(x=>x.fonte==='obrasgov'),pncp=items.filter(x=>x.fonte==='pncp');
 const withPoint=items.filter(x=>x.coords.length>0).length;
 const statuses=[...new Set(items.map(x=>x.status))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const anos=[...new Set(items.map(x=>x.ano))].sort().reverse();
 const types=[...new Set(items.map(x=>x.categoria))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const bairro=[...new Set(d.bairros.features.map(bairroDaFeicao))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const title=kind==='mapa'?'Atlas georreferenciado de obras, contratos e execução':kind==='obras'?'Cadastro integrado de projetos e obras':'Equipamentos e intervenções públicas';
 return '<div class="page-intro"><div><div class="eyebrow">GeoCanoas / Transparência espacial</div><h2>'+title+'</h2>'+
 '<p>Obrasgov: situação e execução física declaradas. PNCP: contratos candidatos, sem comprovação de execução. Pontos de CNES/INEP são referências dos equipamentos, não as geometrias das intervenções.</p></div></div>'+
 '<div class="atlas-kpis">'+kpi('Projetos Obrasgov',inteiro(gov.length),'Status oficial, quando publicado')+
 kpi('Contratos PNCP candidatos',inteiro(pncp.length),'Sem confirmação física')+
 kpi('Registros com ponto',inteiro(withPoint),'De '+inteiro(items.length)+' registros em todas as bases')+
 kpi('Pendências de localização',inteiro(d.qualidadeGeo.pendencias.length),'Não posicionados artificialmente')+'</div>'+
 '<div class="notice"><span class="notice-mark">i</span><div><b>Atenção à natureza dos valores:</b> Obrasgov publica investimentos previstos; PNCP publica valores globais contratados. <b>Não são valores pagos</b> e não devem ser somados entre bases. O mapa separa as fontes e preserva a qualidade do georreferenciamento.</div></div>'+
 '<section class="panel atlas-filters"><div class="panel-title"><div><span class="tag">CONSULTA TERRITORIAL</span><h3>Filtros integrados</h3></div><button class="btn secondary" id="atlas-clear">Limpar filtros</button></div>'+
 '<div class="atlas-filter-grid"><label>Pesquisar objeto, órgão ou fornecedor<input id="atlas-search" type="search" placeholder="Ex.: UBS, dique, escola, pavimentação" /></label>'+
 '<label>Origem<select id="atlas-source">'+options(['obrasgov','pncp','municipal'],'','Todas as origens').replace('>obrasgov<','>Obrasgov (projetos)<').replace('>pncp<','>PNCP (contratos)<').replace('>municipal<','>Cadastro municipal<')+'</select></label>'+
 '<label>Situação<select id="atlas-status">'+options(statuses,'','Todas as situações')+'</select></label>'+
 '<label>Ano (cadastro ou assinatura)<select id="atlas-year">'+options(anos,'','Todos os anos')+'</select></label>'+
 '<label>Bairro validado<select id="atlas-bairro">'+options(bairro,'','Todos os bairros')+'</select></label>'+
 '<label>Georreferenciamento<select id="atlas-local"><option value="">Todos</option><option value="com">Com ponto validado</option><option value="sem">Sem ponto validado</option></select></label>'+
 '<label>Natureza<select id="atlas-type">'+options(types,'','Todas as naturezas')+'</select></label>'+
 '<label>Ordenar<select id="atlas-order"><option value="valor">Maior valor</option><option value="data">Mais recentes</option><option value="nome">Nome</option><option value="status">Situação</option></select></label></div></section>'+
 '<div class="atlas-layout"><section class="panel atlas-map-panel"><div class="panel-title"><div><span class="tag">MAPA INTERATIVO</span><h3>Localização e distribuição territorial</h3></div><span id="atlas-count-map" class="chip"></span></div>'+
 '<div class="atlas-layer-options"><label><input type="checkbox" id="atlas-choropleth" checked/> Intensidade por bairro</label><label><input type="checkbox" id="atlas-points" checked/> Marcadores e agrupamentos</label><label><input type="checkbox" id="atlas-labels" checked/> Nomes dos bairros</label></div>'+
 '<div class="map-frame atlas-map-canvas"><div id="atlas-map" role="application" aria-label="Mapa de projetos Obrasgov e referências geográficas de contratos PNCP"></div>'+
 '<div class="atlas-map-legend"><div><span class="atlas-dot federal"></span>Obrasgov · ponto oficial</div><div><span class="atlas-dot municipal"></span>PNCP · referência de equipamento</div><div><span class="atlas-dot missing"></span>Sem localização: apenas tabela</div><small>Intensidade do bairro = nº de registros com ponto válido, não nº de obras executadas.</small></div></div>'+
 '<div id="atlas-map-warning" class="subtle" role="status"></div></section>'+
 '<section class="panel atlas-map-side"><div class="panel-title"><div><span class="tag">RESUMO DO FILTRO</span><h3>Indicadores e situação</h3></div></div>'+
 '<div id="atlas-summary" class="atlas-summary"></div><div id="atlas-chart-status" class="atlas-small-chart"></div>'+
 '<button class="btn soft" id="atlas-go-review">Ver pendências de georreferenciamento</button></section></div>'+
 '<div class="atlas-chart-row"><section class="panel"><h3>Registros georreferenciados por bairro</h3><div id="atlas-chart-neighborhood" class="atlas-chart"></div>'+
 '<small class="subtle">Clique em uma barra para filtrar pelo bairro. Contagem por identificador de projeto ou contrato, não de marcadores.</small></section>'+
 '<section class="panel"><h3>Valores conhecidos por bairro e origem</h3><div id="atlas-chart-value" class="atlas-chart"></div>'+
 '<small class="subtle">Barras separadas: investimento previsto (Obrasgov) e valor global contratado (PNCP), sem soma entre séries.</small></section></div>'+
 '<section class="panel"><div class="panel-title"><div><span class="tag">DETALHAMENTO</span><h3>Projetos, contratos e acompanhamento</h3></div>'+
 '<button id="atlas-export" class="btn soft">Exportar registros filtrados (CSV)</button></div>'+
 '<div id="atlas-results" class="results"></div><div id="atlas-table"></div></section>';
}

export function auditHtml(d:Dados):string{
 const total=d.intervencoes.features.length;
 const resolved=d.intervencoes.features.filter(f=>f.geometry!==null).length;
 return '<div class="page-intro"><div><div class="eyebrow">GeoCanoas / Qualidade espacial</div><h2>Auditoria de localização e pendências</h2><p>Cadastros do PNCP sem referência inequívoca de equipamento, com divergência de bairro ou sem geometria precisam de validação humana antes de receber um ponto no WebGIS.</p></div></div>'+
 '<div class="atlas-kpis">'+kpi('Contratos analisados',inteiro(total),'Triagem temática do PNCP')+
 kpi('Equipamentos relacionados',inteiro(resolved),'Ponto de referência, não obra concluída')+
 kpi('Sem coordenada',inteiro(Math.max(0,total-resolved)),'Nenhum ponto sintético')+
 kpi('Casos para revisão',inteiro(d.qualidadeGeo.pendencias.length),'Motivo individualizado')+'</div>'+
 '<div class="notice"><span class="notice-mark">i</span><div>Uma divergência entre bairro informado pelo CNES e o polígono oficial GeoCanoas é tratada como <b>bloqueio</b> de georreferenciamento, não como erro que possa ser resolvido automaticamente por centroide.</div></div>'+
 '<section class="panel"><div class="panel-title"><h3>Fila de conferência documental e cartográfica</h3><button id="geo-review-export" class="btn soft">Exportar pendências CSV</button></div>'+
 '<div class="atlas-filter-grid"><label>Pesquisar registro<input id="geo-review-search" type="search" placeholder="Objeto, contrato ou equipamento"/></label>'+
 '<label>Motivo<select id="geo-review-reason"><option value="">Todos os motivos</option>'+
 [...new Set(d.qualidadeGeo.pendencias.map(x=>x.motivo))].sort().map(x=>'<option value="'+texto(x)+'">'+texto(x.replaceAll('_',' '))+'</option>').join('')+
 '</select></label></div><div id="geo-review-results" class="results"></div><div id="geo-review-table"></div></section>'+
 '<section class="panel"><h3>Critérios de homologação</h3><p>Exigir fonte de coordenada, identificação inequívoca da obra, sistema de referência, correspondência com bairro oficial e vínculo com documento do contrato. Para obras lineares (drenagem, pavimentação, diques), priorizar linha ou polígono de intervenção: um centroide de bairro não representa sua geometria.</p><p>Os pontos CNES e INEP/SEDUC são referências de instalações existentes; a localização final da obra deve ser confirmada com cadastro de fiscalização, projeto executivo ou levantamento de campo.</p></section>';
}
export function mountAudit(d:Dados):void{
 const pending=d.qualidadeGeo.pendencias;
 const update=()=>{
  const q=normal((document.getElementById('geo-review-search') as HTMLInputElement)?.value);
  const r=(document.getElementById('geo-review-reason') as HTMLSelectElement)?.value;
  const arr=pending.filter(x=>(!q||normal([x.titulo,x.id_contrato,...x.equipamentos_candidatos].join(' ')).includes(q))&&(!r||x.motivo===r));
  const num=document.getElementById('geo-review-results');if(num)num.textContent=inteiro(arr.length)+' de '+inteiro(pending.length)+' pendências';
  const wrap=document.getElementById('geo-review-table');if(!wrap)return;
  wrap.innerHTML=arr.length?'<div class="table-wrap"><table><thead><tr><th>ID PNCP / Objeto</th><th>Motivo de revisão</th><th>Bairro declarado</th><th>Candidato de equipamento</th><th>Documento</th></tr></thead><tbody>'+
  arr.map(x=>'<tr><td><b>'+texto(x.id_contrato)+'</b><small>'+texto(x.titulo)+'</small></td><td>'+texto(x.motivo.replaceAll('_',' '))+'</td><td>'+texto(x.bairro_declarado??'Não informado')+'</td><td>'+texto(x.equipamentos_candidatos.join(', ')||'N/D')+'</td><td><a href="'+texto(validLink(x.url_fonte))+'" target="_blank" rel="noopener noreferrer">PNCP ↗</a></td></tr>').join('')+'</tbody></table></div>':'<div class="empty"><h3>Nenhuma pendência neste filtro</h3></div>';
 };
 document.getElementById('geo-review-search')?.addEventListener('input',update);
 document.getElementById('geo-review-reason')?.addEventListener('change',update);
 document.getElementById('geo-review-export')?.addEventListener('click',()=>csv('revisao-localizacao-contratos-canoas.csv',['id','objeto','motivo','bairro_declarado','candidatos','url_fonte'],pending.map(x=>[x.id_contrato,x.titulo,x.motivo,x.bairro_declarado,x.equipamentos_candidatos.join(';'),x.url_fonte])));
 update();
}
export function mountAtlas(d:Dados,goReview:()=>void):()=>void{
 const all=itensAtlas(d);
 const f:Filtro={...filter0};
 const filterNames:Record<keyof Filtro,string>={q:'atlas-search',fonte:'atlas-source',status:'atlas-status',ano:'atlas-year',bairro:'atlas-bairro',local:'atlas-local',tipo:'atlas-type',ordem:'atlas-order'};
 let map:maplibregl.Map|null=null;
 let chart:Charts={status:null,bairros:null,valores:null};
 let alive=true;
 let filtered=all;
 const tbody=document.getElementById('atlas-table');
 const mapContainer=document.getElementById('atlas-map');
 function srcGeo(rows:Item[]):FeatureCollection<Point>{
  const features:Feature<Point>[]=[];
  for(const x of rows)for(const coord of x.coords){
   if(!Number.isFinite(coord[0])||!Number.isFinite(coord[1]))continue;
   features.push({type:'Feature',geometry:{type:'Point',coordinates:coord},properties:{id:x.id,origem:x.fonte,titulo:x.titulo,status:x.status}});
  }
  return {type:'FeatureCollection',features};
 }
 function geoBairros(rows:Item[]):FeatureCollection{
  const stats=bairroStats(rows);
  return {type:'FeatureCollection',features:d.bairros.features.map(x=>{
   const p={...(x.properties??{})};
   const v=stats.get(bairroDaFeicao(x));
   return {...x,properties:{...p,quantidade:(v?.fed??0)+(v?.pncp??0),fed:v?.fed??0,pncp:v?.pncp??0,valor_fed:v?.valFed??null,valor_pncp:v?.valPncp??null}};
  })};
 }
 function vis(layer:string,visible:boolean){if(map?.getLayer(layer))map.setLayoutProperty(layer,'visibility',visible?'visible':'none');}
 const paintVis=()=>{
  vis('atlas-polygons',!!(document.getElementById('atlas-choropleth') as HTMLInputElement)?.checked);
  vis('atlas-points-unclustered',!!(document.getElementById('atlas-points') as HTMLInputElement)?.checked);
  vis('atlas-point-clusters',!!(document.getElementById('atlas-points') as HTMLInputElement)?.checked);
  vis('atlas-cluster-number',!!(document.getElementById('atlas-points') as HTMLInputElement)?.checked);
  vis('atlas-bairro-labels',!!(document.getElementById('atlas-labels') as HTMLInputElement)?.checked);
 };
 function focusItem(item:Item){if(!map||!item.coords.length)return;map.flyTo({center:item.coords[0],zoom:15,essential:true});new maplibregl.Popup({maxWidth:'350px'}).setLngLat(item.coords[0]).setHTML(itemDetalhe(item)).addTo(map);}
 function updateCharts(rows:Item[]):void{
  const color= getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#325264';
  const statusNames=[...new Set(rows.filter(x=>x.fonte==='obrasgov').map(x=>x.status))].sort();
  chart.status?.setOption({tooltip:{trigger:'item'},legend:{type:'scroll',bottom:0,textStyle:{color}},series:[{name:'Situação Obrasgov',type:'pie',radius:['42%','68%'],center:['50%','44%'],label:{show:false},data:statusNames.map(n=>({name:n,value:rows.filter(x=>x.fonte==='obrasgov'&&x.status===n).length}))}]},true);
  const by=bairroStats(rows);
  const names=[...by.keys()].sort((a,b)=>((by.get(b)?.fed??0)+(by.get(b)?.pncp??0))-((by.get(a)?.fed??0)+(by.get(a)?.pncp??0))).slice(0,18).reverse();
  const common={grid:{top:22,right:25,left:12,bottom:12,containLabel:true},tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},legend:{top:0,textStyle:{color}},yAxis:{type:'category',data:names,axisLabel:{color}}};
  chart.bairros?.setOption({...common,xAxis:{type:'value',minInterval:1},series:[{name:'Projetos Obrasgov',type:'bar',data:names.map(x=>by.get(x)?.fed??0),barMaxWidth:17},{name:'Contratos PNCP',type:'bar',data:names.map(x=>by.get(x)?.pncp??0),barMaxWidth:17}]},true);
  chart.valores?.setOption({...common,xAxis:{type:'value',axisLabel:{formatter:(v:number)=>new Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v)}},tooltip:{trigger:'axis',valueFormatter:(v:unknown)=>typeof v==='number'?moeda(v):'N/D'},series:[{name:'Previsto Obrasgov',type:'bar',data:names.map(x=>by.get(x)?.valFed??null),barMaxWidth:15},{name:'Contratos PNCP',type:'bar',data:names.map(x=>by.get(x)?.valPncp??null),barMaxWidth:15}]},true);
 }
 function update(){
  filtered=listar(all,f);
  const gov=filtered.filter(x=>x.fonte==='obrasgov'),pncp=filtered.filter(x=>x.fonte==='pncp');
  const geoloc=filtered.filter(x=>x.coords.length>0);
  const officialProgress=gov.filter(x=>x.percentual!==null);
  const summary=document.getElementById('atlas-summary');
  if(summary)summary.innerHTML='<div><span>Registros no filtro</span><b>'+inteiro(filtered.length)+'</b></div>'+
   '<div><span>Com ponto / referência</span><b>'+inteiro(geoloc.length)+'</b></div>'+
   '<div><span>Obrasgov com execução informada</span><b>'+inteiro(officialProgress.length)+'</b></div>'+
   '<div><span>Em execução no Obrasgov</span><b>'+inteiro(gov.filter(x=>normal(x.status)==='em execucao').length)+'</b></div>'+
   '<div><span>Concluídas no Obrasgov</span><b>'+inteiro(gov.filter(x=>normal(x.status)==='concluida').length)+'</b></div>'+
   '<div><span>Obrasgov com notas financeiras vinculadas</span><b>'+inteiro(gov.filter(x=>(x.notas??0)>0).length)+'</b></div>'+
   '<div><span>Contratos PNCP (status físico N/D)</span><b>'+inteiro(pncp.length)+'</b></div>';
  const count=document.getElementById('atlas-results');if(count)count.textContent=inteiro(filtered.length)+' registros no recorte · '+inteiro(geoloc.length)+' com ponto validado';
  const countMap=document.getElementById('atlas-count-map');if(countMap)countMap.textContent=inteiro(geoloc.length)+' registros localizados';
  if(tbody)tbody.innerHTML=listRows(filtered);
  if(map?.getSource('atlas-records'))(map.getSource('atlas-records') as maplibregl.GeoJSONSource).setData(srcGeo(filtered));
  if(map?.getSource('atlas-neighborhoods'))(map.getSource('atlas-neighborhoods') as maplibregl.GeoJSONSource).setData(geoBairros(filtered));
  updateCharts(filtered);
 }
 for(const [name,id] of Object.entries(filterNames)){
  const input=document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null;
  input?.addEventListener(name==='q'?'input':'change',()=>{(f as unknown as Record<string,string>)[name]=input.value;update();});
 }
 document.getElementById('atlas-clear')?.addEventListener('click',()=>{Object.assign(f,filter0);for(const [name,id] of Object.entries(filterNames)){const el=document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null;if(el)el.value=(f as unknown as Record<string,string>)[name];}update();});
 document.getElementById('atlas-export')?.addEventListener('click',()=>csv('obras-contratos-canoas-filtros.csv',['id','origem','titulo','natureza','situacao','execucao_percentual','valor','natureza_valor','pago_notas','liquidado_notas','empenhado_notas','restos_pagos_notas','quantidade_notas','alertas','ano','bairro_validado','bairro_documentado','qualidade_local','equipamento','fonte'],filtered.map(x=>[x.id,x.fonte,x.titulo,x.tipo,x.status,x.percentual,x.valor,x.faseValor,x.pagoNotas,x.liquidadoNotas,x.empenhadoNotas,x.rpPagoNotas,x.notas,x.alertas.join(';'),x.ano,x.bairro,x.bairroDocumento,x.qualidade,x.equipamento,x.url])));
 document.getElementById('atlas-go-review')?.addEventListener('click',goReview);
 for(const id of ['atlas-choropleth','atlas-points','atlas-labels'])document.getElementById(id)?.addEventListener('change',paintVis);
 document.getElementById('atlas-table')?.addEventListener('click',e=>{
  const target=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-focus]');
  const item=filtered.find(x=>x.id===target?.dataset.focus);if(item)focusItem(item);
 });
 if(mapContainer){
  map=new maplibregl.Map({container:mapContainer,style:'https://tiles.openfreemap.org/styles/liberty',center:[-51.177,-29.916],zoom:11.4,attributionControl:false});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  map.on('load',()=>{
   if(!alive||!map)return;
   map.addSource('atlas-neighborhoods',{type:'geojson',data:geoBairros(filtered)});
   map.addSource('atlas-records',{type:'geojson',data:srcGeo(filtered),cluster:true,clusterRadius:55,clusterMaxZoom:13});
   map.addLayer({id:'atlas-polygons',type:'fill',source:'atlas-neighborhoods',
    paint:{'fill-color':['step',['to-number',['get','quantidade']], '#e6ebef',1,'#bdd9d9',3,'#84bfc0',7,'#2e99a7',15,'#0d5e79'],'fill-opacity':0.42}});
   map.addLayer({id:'atlas-bairro-border',type:'line',source:'atlas-neighborhoods',paint:{'line-color':'#1b6176','line-width':1.5}});
   map.addLayer({id:'atlas-bairro-labels',type:'symbol',source:'atlas-neighborhoods',minzoom:11,layout:{'text-field':['get','BAIRRO'],'text-size':11,'text-font':['Open Sans Bold']},paint:{'text-color':'#143b4c','text-halo-color':'#fff','text-halo-width':1.7}});
   map.addLayer({id:'atlas-point-clusters',type:'circle',source:'atlas-records',filter:['has','point_count'],paint:{'circle-color':'#175e76','circle-radius':['step',['get','point_count'],17,10,23,30,30],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
   map.addLayer({id:'atlas-cluster-number',type:'symbol',source:'atlas-records',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Open Sans Bold'],'text-size':12},paint:{'text-color':'#fff'}});
   map.addLayer({id:'atlas-points-unclustered',type:'circle',source:'atlas-records',filter:['!', ['has','point_count']],
    paint:{'circle-radius':['interpolate',['linear'],['zoom'],10,5,15,9],
     'circle-color':['match',['get','origem'],'obrasgov','#0f758c','pncp','#c88629','municipal','#247b56','#64748b'],
     'circle-stroke-color':'#fff','circle-stroke-width':1.8,'circle-opacity':0.95}});
   map.on('click','atlas-point-clusters',async e=>{
    const hit=map?.queryRenderedFeatures(e.point,{layers:['atlas-point-clusters']})[0];
    const id=Number(hit?.properties?.cluster_id);const source=map?.getSource('atlas-records') as maplibregl.GeoJSONSource;
    if(!Number.isFinite(id)||!source)return;
    const zoom=await source.getClusterExpansionZoom(id);
    const point=(hit?.geometry as Point)?.coordinates;
    if(point)map?.easeTo({center:point as [number,number],zoom});
   });
   map.on('click','atlas-points-unclustered',e=>{
    const hit=e.features?.[0];const id=String(hit?.properties?.id??'');
    const item=filtered.find(x=>x.id===id);if(item){
     new maplibregl.Popup({maxWidth:'350px'}).setLngLat(e.lngLat).setHTML(itemDetalhe(item)).addTo(map!);
    }
   });
   map.on('click','atlas-polygons',e=>{
    const hit=e.features?.[0];const p=hit?.properties??{};
    new maplibregl.Popup({maxWidth:'290px'}).setLngLat(e.lngLat).setHTML('<strong>'+texto(p.BAIRRO)+'</strong><div>Projetos Obrasgov com ponto: '+inteiro(Number(p.fed))+'</div><div>Contratos PNCP com equipamento referenciado: '+inteiro(Number(p.pncp))+'</div><small>Valores monetários de fontes diferentes não são somados.</small>').addTo(map!);
   });
   for(const layer of ['atlas-point-clusters','atlas-points-unclustered','atlas-polygons']){
    map.on('mouseenter',layer,()=>{if(map)map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave',layer,()=>{if(map)map.getCanvas().style.cursor='';});
   }
   map.on('error',e=>{const msg=document.getElementById('atlas-map-warning');if(msg&&String(e.error?.message??'').includes('style'))msg.textContent='Mapa-base temporariamente indisponível. A tabela e as exportações continuam operacionais.';});
   paintVis();
  });
 }
 for(const [key,id] of [['status','atlas-chart-status'],['bairros','atlas-chart-neighborhood'],['valores','atlas-chart-value']] as const){
  const root=document.getElementById(id);if(root)chart[key]=echarts.init(root);
 }
 chart.bairros?.on('click',(e:{name?:string})=>{if(e.name){const select=document.getElementById('atlas-bairro') as HTMLSelectElement|null;if(select){select.value=e.name;f.bairro=e.name;update();}}});
 const resize=()=>{if(!alive)return;for(const c of Object.values(chart))c?.resize();map?.resize();};
 window.addEventListener('resize',resize);
 update();
 return ()=>{alive=false;window.removeEventListener('resize',resize);for(const c of Object.values(chart))c?.dispose();map?.remove();};
}
