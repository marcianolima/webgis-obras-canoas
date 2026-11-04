import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Dados,PropsObra} from './data';
import type {Feature,Geometry} from 'geojson';
import {texto,numero,inteiro,moeda,nomesStatus,bairroDaFeicao} from './data';

type Metrica='dens_pop'|'perc_vagos'|'renda_media'|'pop';
const METRICAS:Record<Metrica,{titulo:string;unidade:string;stops:[number,number,number,number]}> = {
 dens_pop:{titulo:'Densidade populacional',unidade:'hab./km²',stops:[0,2500,8000,20000]},
 perc_vagos:{titulo:'Domicílios vagos',unidade:'%',stops:[0,10,25,50]},
 renda_media:{titulo:'Renda média dos responsáveis com rendimento',unidade:'R$ (2022)',stops:[0,1500,4000,9000]},
 pop:{titulo:'População residente',unidade:'hab.',stops:[0,100,500,1200]}
};
function cores(m:Metrica):unknown[]{const s=METRICAS[m].stops;return ['interpolate',['linear'],['coalesce',['to-number',['get',m]],0],s[0],'#e9f3f3',s[1],'#97ccc3',s[2],'#288c98',s[3],'#184c78'];}
function fProp(v:unknown):string{return texto(v==null?'Não informado':String(v));}
function htmlSetor(p:Record<string,unknown>,m:Metrica):string{
 const v=typeof p[m]==='number'?numero(p[m] as number,m==='renda_media'?0:1):'N/D';
 return '<strong>Setor '+fProp(p.id??p.CD_SETOR)+'</strong><div>Bairro IBGE: '+fProp(p.bairro_ibge)+'</div><div>'+METRICAS[m].titulo+': <b>'+v+' '+METRICAS[m].unidade+'</b></div><div>População: '+inteiro(typeof p.pop==='number'?p.pop:null)+'</div><small>Censo 2022 · Indicadores do setor, não da rede de saneamento</small>';
}
export function criarMapa(d:Dados,initial:'obras'|'setores'='obras'):maplibregl.Map|null{
 const container=document.getElementById('map-canvas');if(!container)return null;
 const map=new maplibregl.Map({container,style:'https://tiles.openfreemap.org/styles/liberty',center:[-51.177,-29.916],zoom:11.3,attributionControl:false});
 map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
 map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
 let metrica:Metrica='dens_pop';
 const controls=document.getElementById('map-controls');
 const showBairros=document.getElementById('layer-bairros') as HTMLInputElement|null;
 const showSetores=document.getElementById('layer-setores') as HTMLInputElement|null;
 const showObras=document.getElementById('layer-obras') as HTMLInputElement|null;
 const select=document.getElementById('map-metrica') as HTMLSelectElement|null;
 if(showBairros)showBairros.checked=true;
 if(showSetores)showSetores.checked=initial==='setores';
 if(showObras)showObras.checked=true;
 function vis(id:string,yes:boolean){if(map.getLayer(id))map.setLayoutProperty(id,'visibility',yes?'visible':'none');}
 function atualizar(){if(!map.isStyleLoaded())return;
  vis('bairro-preenchimento',!!showBairros?.checked);vis('bairro-contorno',!!showBairros?.checked);vis('bairro-rotulos',!!showBairros?.checked);
  vis('setores-preenchimento',!!showSetores?.checked);vis('setores-contorno',!!showSetores?.checked);vis('obras-pontos',!!showObras?.checked);
  if(map.getLayer('setores-preenchimento'))map.setPaintProperty('setores-preenchimento','fill-color',cores(metrica) as never);
  const legend=document.getElementById('map-legenda');if(legend){legend.hidden=!showSetores?.checked;legend.querySelector('span')!.textContent=METRICAS[metrica].titulo+' · '+METRICAS[metrica].unidade;}
 }
 showBairros?.addEventListener('change',atualizar);showSetores?.addEventListener('change',atualizar);showObras?.addEventListener('change',atualizar);
 select?.addEventListener('change',()=>{if(select.value in METRICAS){metrica=select.value as Metrica;atualizar();}});
 map.on('load',()=>{
  map.addSource('bairros',{type:'geojson',data:d.bairros});
  map.addSource('setores',{type:'geojson',data:d.setores});
  map.addSource('obras',{type:'geojson',data:{type:'FeatureCollection',features:d.obras.features.filter((f):f is Feature<Geometry,PropsObra>=>f.geometry!==null)}});
  map.addLayer({id:'bairro-preenchimento',type:'fill',source:'bairros',paint:{'fill-color':'#41a8b0','fill-opacity':0.065}});
  map.addLayer({id:'setores-preenchimento',type:'fill',source:'setores',paint:{'fill-color':cores(metrica) as never,'fill-opacity':0.73}});
  map.addLayer({id:'setores-contorno',type:'line',source:'setores',paint:{'line-color':'#f8fafc','line-width':0.4,'line-opacity':0.7}});
  map.addLayer({id:'bairro-contorno',type:'line',source:'bairros',paint:{'line-color':'#136e81','line-width':1.75}});
  map.addLayer({id:'bairro-rotulos',type:'symbol',source:'bairros',minzoom:11.3,layout:{'text-field':['get','BAIRRO'],'text-size':11,'text-font':['Open Sans Bold'],'text-allow-overlap':false},paint:{'text-color':'#0d3444','text-halo-color':'#fff','text-halo-width':1.6}});
  map.addLayer({id:'obras-pontos',type:'circle',source:'obras',paint:{'circle-radius':['interpolate',['linear'],['zoom'],10,5,15,10],'circle-color':['match',['get','status'],'em_execucao','#0b98a1','concluida','#27a16c','paralisada','#e78334','planejada','#516a9e','licitacao','#8f65a7','#64748b'],'circle-stroke-color':'#fff','circle-stroke-width':1.5,'circle-opacity':0.94}});
  atualizar();
  map.on('click','bairro-preenchimento',e=>{const f=e.features?.[0];if(!f)return;const b=bairroDaFeicao(f);new maplibregl.Popup({maxWidth:'320px'}).setLngLat(e.lngLat).setHTML('<strong>'+texto(b)+'</strong><p>Limite oficial GeoCanoas. Clique em “Aplicar filtro” na lista de obras para consultar o bairro.</p>').addTo(map);window.dispatchEvent(new CustomEvent('bairro-selecionado',{detail:b}));});
  map.on('click','setores-preenchimento',e=>{const p=e.features?.[0]?.properties;if(!p)return;new maplibregl.Popup({maxWidth:'350px'}).setLngLat(e.lngLat).setHTML(htmlSetor(p,metrica)).addTo(map);});
  map.on('click','obras-pontos',e=>{const p=e.features?.[0]?.properties;if(!p)return;const v=typeof p.valor_contratado==='number'?p.valor_contratado:Number(p.valor_contratado);const status=String(p.status) as keyof typeof nomesStatus;const href=String(p.url_fonte||'');const link=href.startsWith('https://')?'<a href="'+texto(href)+'" target="_blank" rel="noopener noreferrer">Documento de origem</a>':'';new maplibregl.Popup({maxWidth:'350px'}).setLngLat(e.lngLat).setHTML('<strong>'+fProp(p.titulo)+'</strong><p>'+fProp(nomesStatus[status]??'Situação não informada')+'</p><div>Valor contratado: '+moeda(Number.isFinite(v)?v:null)+'</div><div>'+fProp(p.bairro)+'</div>'+link).addTo(map);});
  for(const id of ['bairro-preenchimento','setores-preenchimento','obras-pontos']){map.on('mouseenter',id,()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave',id,()=>{map.getCanvas().style.cursor='';});}
 });
 map.on('error',e=>{const err=document.getElementById('map-error');if(err&&String(e.error?.message||'').includes('style'))err.textContent='A base cartográfica externa está indisponível. Os dados territoriais permanecem disponíveis para exportação.';});
 controls?.classList.add('loaded');
 return map;
}
