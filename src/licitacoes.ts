import * as echarts from 'echarts';
import type {Dados,Licitacao} from './data';
import {inteiro,moeda,numero,texto} from './data';

const clean=(x:unknown)=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const valid=(s:string)=>s.startsWith('https://')?s:'#';
const titleClass:Record<string,string>={obra_fisica_candidata:'Obras e intervenções físicas',manutencao_infraestrutura:'Manutenção de infraestrutura',projeto_tecnico:'Projetos e serviços técnicos'};
type State={q:string;status:string;modalidade:string;ano:string;categoria:string;sort:'data'|'estimado'|'homologado'};
const s0:State={q:'',status:'',modalidade:'',ano:'',categoria:'',sort:'data'};
function option(items:string[],label:string):string{return '<option value="">'+texto(label)+'</option>'+items.map(x=>'<option value="'+texto(x)+'">'+texto(x)+'</option>').join('');}
function esc(value:unknown):string{let x=String(value??'');if(/^\s*[=+@-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';}
function csv(name:string,heads:string[],rows:unknown[][]):void{const content=[heads,...rows].map(x=>x.map(esc).join(';')).join('\r\n');const blob=new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function licitacoesHtml(d:Dados):string{
 const all=d.licitacoes.items;
 const modalities=[...new Set(all.map(x=>x.modalidade))].sort();
 const statuses=[...new Set(all.map(x=>x.situacao))].sort();
 const years=[...new Set(all.map(x=>(x.publicacao??'').slice(0,4)).filter(Boolean))].sort().reverse();
 const category=[...new Set(all.map(x=>x.classe))].sort();
 const candidates=all.filter(x=>x.classe==='obra_fisica_candidata').length;
 const withAward=all.filter(x=>x.homologado!==null).length;
 return '<div class="page-intro"><div><div class="eyebrow">GeoCanoas / Compras públicas</div><h2>Licitações e contratações de infraestrutura</h2><p>Editais e contratações diretas publicados no PNCP pelo CNPJ da Prefeitura de Canoas, classificados por objeto e com status de compra independente do andamento das obras.</p></div></div>'+
 '<div class="atlas-kpis"><div class="atlas-kpi"><span>Contratações temáticas publicadas</span><strong>'+inteiro(all.length)+'</strong><small>Triagem automática pelo objeto</small></div>'+
 '<div class="atlas-kpi"><span>Licitações de obras candidatas</span><strong>'+inteiro(candidates)+'</strong><small>Não comprova execução</small></div>'+
 '<div class="atlas-kpi"><span>Registros com valor homologado</span><strong>'+inteiro(withAward)+'</strong><small>Homologado ≠ pagamento</small></div>'+
 '<div class="atlas-kpi"><span>Modalidades pesquisadas</span><strong>'+inteiro(new Set(all.map(x=>x.modalidade)).size)+'</strong><small>Fonte PNCP · Prefeitura de Canoas</small></div></div>'+
 '<div class="notice"><span class="notice-mark">i</span><div><b>Situação da contratação ≠ situação da obra.</b> O edital pode ser publicado, suspenso ou homologado sem que exista execução física. Valores estimados, homologados e contratados têm naturezas distintas. Os editais não recebem coordenada por endereço do órgão ou fornecedor.</div></div>'+
 '<section class="panel"><div class="panel-title"><h3>Busca e filtragem de licitações</h3><button id="licitacoes-limpar" class="btn secondary">Limpar</button></div>'+
 '<div class="atlas-filter-grid"><label>Pesquisar objeto, processo e edital<input type="search" id="lic-busca" placeholder="Ex.: reforma, drenagem, hospital"/></label>'+
 '<label>Ano de publicação<select id="lic-ano">'+option(years,'Todos os anos')+'</select></label>'+
 '<label>Modalidade<select id="lic-modalidade">'+option(modalities,'Todas as modalidades')+'</select></label>'+
 '<label>Situação PNCP<select id="lic-status">'+option(statuses,'Todas as situações')+'</select></label>'+
 '<label>Classificação temática<select id="lic-classe">'+option(category.map(x=>x),'Todas as naturezas').replaceAll('>obra_fisica_candidata<','>Obras físicas<').replaceAll('>manutencao_infraestrutura<','>Manutenção de infraestrutura<').replaceAll('>projeto_tecnico<','>Projeto técnico<')+'</select></label>'+
 '<label>Ordenar por<select id="lic-sort"><option value="data">Mais recentes</option><option value="estimado">Maior estimado</option><option value="homologado">Maior homologado</option></select></label></div></section>'+
 '<section class="panel"><div class="panel-title"><h3>Indicadores do filtro</h3><span id="licitacoes-count" class="chip"></span></div><div id="licitacoes-cards" class="atlas-kpis"></div></section>'+
 '<div class="atlas-chart-row"><section class="panel"><h3>Publicações por modalidade</h3><div id="lic-chart-modalidade" class="atlas-chart"></div><small class="subtle">Quantitativos classificados por categoria de licitação.</small></section>'+
 '<section class="panel"><h3>Valores estimados por ano</h3><div id="lic-chart-ano" class="atlas-chart"></div><small class="subtle">Soma de estimativas de editais distintos do filtro, sem relação com valores pagos; pode haver processos não homologados.</small></section></div>'+
 '<section class="panel"><div class="panel-title"><h3>Quadro de licitações e contratações publicadas</h3><button id="licitacoes-exportar" class="btn soft">Exportar CSV</button></div>'+
 '<div id="lic-table"></div></section>'+
 '<div class="notice"><span class="notice-mark">i</span><div>Referências: <a href="https://pncp.gov.br/api/consulta/swagger-ui/index.html" target="_blank" rel="noopener noreferrer">API PNCP</a>. O status e os valores são declarados na publicação. Para análise espacial futura, o edital deverá ser vinculado de maneira inequívoca ao contrato, projeto executivo ou localização física da intervenção.</div></div>';
}
function rowsHtml(data:Licitacao[]):string{
 if(!data.length)return '<div class="empty"><h3>Não há licitações com estes critérios</h3><p>A ausência de registros não comprova inexistência de licitações fora das modalidades e janelas consultadas.</p></div>';
 const rows=data.slice(0,225).map(x=>'<tr><td><b>'+texto(x.objeto)+'</b><small>'+texto(x.processo)+' · Nº '+texto(x.numero)+'</small></td>'+
 '<td><b>'+texto(x.modalidade)+'</b><small>'+texto(titleClass[x.classe]??x.classe)+'</small></td>'+
 '<td>'+texto(x.situacao)+'<small>Situação da contratação</small></td>'+
 '<td><b>'+moeda(x.estimado)+'</b><small>Estimado (não pago)</small></td>'+
 '<td><b>'+moeda(x.homologado)+'</b><small>Homologado (não pago)</small></td>'+
 '<td>'+texto(x.publicacao??'N/D')+'<small>Encerramento de propostas: '+texto(x.fimPropostas??'N/D')+'</small></td>'+
 '<td><a href="'+texto(valid(x.registroOrigem))+'" target="_blank" rel="noopener noreferrer">PNCP ↗</a>'+
 (x.urlSistemaOrigem?'<small><a href="'+texto(valid(x.urlSistemaOrigem))+'" target="_blank" rel="noopener noreferrer">Sistema de origem ↗</a></small>':'')+
 '</td></tr>');
 return '<div class="table-wrap"><table><thead><tr><th>Objeto / processo</th><th>Modalidade</th><th>Situação</th><th>Valor estimado</th><th>Homologado</th><th>Datas</th><th>Documentos</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'+
 (data.length>225?'<small class="subtle">A tabela mostra 225 registros. Use os filtros ou exporte todos.</small>':'');
}
function filter(items:Licitacao[],q:State):Licitacao[]{
 const result=items.filter(x=>(!q.q||clean([x.objeto,x.processo,x.numero,x.id].join(' ')).includes(clean(q.q)))&&
 (!q.status||x.situacao===q.status)&&(!q.modalidade||x.modalidade===q.modalidade)&&
 (!q.ano||x.publicacao?.slice(0,4)===q.ano)&&(!q.categoria||x.classe===q.categoria));
 return [...result].sort((a,b)=>q.sort==='estimado'?(b.estimado??-1)-(a.estimado??-1):q.sort==='homologado'?(b.homologado??-1)-(a.homologado??-1):String(b.publicacao??'').localeCompare(String(a.publicacao??'')));
}
export function mountLicitacoes(d:Dados):()=>void{
 const all=d.licitacoes.items;
 const state={...s0};
 const chartM=echarts.init(document.getElementById('lic-chart-modalidade')!);
 const chartY=echarts.init(document.getElementById('lic-chart-ano')!);
 let alive=true;
 let shown:Licitacao[]=[];
 const mapIds:{[K in keyof State]:string}={q:'lic-busca',ano:'lic-ano',status:'lic-status',modalidade:'lic-modalidade',categoria:'lic-classe',sort:'lic-sort'};
 function update(){
  shown=filter(all,state);
  const total=shown.length;
  const withEstimate=shown.map(x=>x.estimado).filter((v):v is number=>v!=null);
  const withAward=shown.map(x=>x.homologado).filter((v):v is number=>v!=null);
  const ids=[...new Set(shown.map(x=>x.modalidade))].sort();
  const years=[...new Set(shown.map(x=>x.publicacao?.slice(0,4)||'N/D'))].sort();
  const cnt=document.getElementById('licitacoes-count');if(cnt)cnt.textContent=inteiro(total)+' registros no recorte';
  const cards=document.getElementById('licitacoes-cards');
  if(cards)cards.innerHTML='<div class="atlas-kpi"><span>Contratações no filtro</span><strong>'+inteiro(total)+'</strong><small>Registros de licitação</small></div>'+
   '<div class="atlas-kpi"><span>Valor total estimado conhecido</span><strong>'+moeda(withEstimate.length?withEstimate.reduce((a,b)=>a+b,0):null)+'</strong><small>Não é execução orçamentária</small></div>'+
   '<div class="atlas-kpi"><span>Valor total homologado conhecido</span><strong>'+moeda(withAward.length?withAward.reduce((a,b)=>a+b,0):null)+'</strong><small>Não é despesa paga</small></div>'+
   '<div class="atlas-kpi"><span>Com valor homologado</span><strong>'+inteiro(withAward.length)+'</strong><small>Não implica contrato assinado</small></div>';
  const table=document.getElementById('lic-table');if(table)table.innerHTML=rowsHtml(shown);
  const color=getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#355061';
  chartM.setOption({grid:{top:20,bottom:18,left:12,right:15,containLabel:true},tooltip:{trigger:'axis'},xAxis:{type:'value',minInterval:1},yAxis:{type:'category',data:ids,axisLabel:{color}},series:[{type:'bar',barMaxWidth:22,data:ids.map(x=>shown.filter(s=>s.modalidade===x).length),itemStyle:{color:'#248d9a'}}]},true);
  chartY.setOption({grid:{top:22,bottom:23,left:18,right:17,containLabel:true},tooltip:{trigger:'axis',valueFormatter:(v:unknown)=>typeof v==='number'?moeda(v):'N/D'},xAxis:{type:'category',data:years},yAxis:{type:'value',axisLabel:{formatter:(v:number)=>new Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v)}},series:[{type:'bar',data:years.map(y=>{const vals=shown.filter(x=>x.publicacao?.startsWith(y)).map(x=>x.estimado).filter((v):v is number=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0):null;}),barMaxWidth:28,itemStyle:{color:'#bd853d'}}]},true);
 }
 for(const [k,id] of Object.entries(mapIds)){
  const input=document.getElementById(id) as HTMLInputElement|HTMLSelectElement;
  input?.addEventListener(k==='q'?'input':'change',()=>{(state as unknown as Record<string,string>)[k]=input.value;update();});
 }
 document.getElementById('licitacoes-limpar')?.addEventListener('click',()=>{
  Object.assign(state,s0);
  for(const [k,id] of Object.entries(mapIds)){const el=document.getElementById(id) as HTMLInputElement|HTMLSelectElement;el.value=(state as unknown as Record<string,string>)[k];}
  update();
 });
 document.getElementById('licitacoes-exportar')?.addEventListener('click',()=>csv('licitacoes-obras-pncp-canoas.csv',
 ['id_pncp','objeto','modalidade','classe','situacao_licitacao','valor_estimado','valor_homologado','processo','numero_edital','publicacao','fim_propostas','url_fonte'],
 shown.map(x=>[x.id,x.objeto,x.modalidade,x.classe,x.situacao,x.estimado,x.homologado,x.processo,x.numero,x.publicacao,x.fimPropostas,x.registroOrigem])));
 const resize=()=>{if(alive){chartM.resize();chartY.resize();}};
 window.addEventListener('resize',resize);
 update();
 return ()=>{alive=false;window.removeEventListener('resize',resize);chartM.dispose();chartY.dispose();};
}
