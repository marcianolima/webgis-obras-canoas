import type {FeatureCollection, Feature, Geometry} from 'geojson';

export type StatusObra = 'planejada'|'licitacao'|'em_execucao'|'paralisada'|'concluida'|'cancelada'|'indeterminada';
export type PropsObra = {id:string;titulo:string;tipo:string;status:StatusObra;orgao:string;bairro:string|null;contrato:string|null;valor_contratado:number|null;valor_empenhado:number|null;valor_liquidado:number|null;valor_pago:number|null;inicio:string|null;prazo_final:string|null;percentual_execucao:number|null;url_fonte:string;atualizado_em:string|null;localizacao:'coordenada_verificada'|'sem_coordenada';};
export type Obra = Feature<Geometry|null,PropsObra>;
export type Indicador={id:string;nome:string;tema:'agua'|'esgoto'|'residuos'|'drenagem';valor:number;unidade:string;descricao?:string;referencia:string};
export type Saneamento={fonte:string;fonteUrl:string;fonteOficial:string;referencia:string;abrangencia:string;observacao:string;indicadores:Indicador[]};
export type Contrato={id:string;objeto:string;numero:string;fornecedor:string;valor:number|null;data:string|null;url_fonte:string;obra_id?:string|null};
export type Contratos={updatedAt:string|null;note:string;items:Contrato[]};
export type Financas={updatedAt:string|null;note:string;observacoes:{ano:number;categoria:string;valor:number;fonte:string}[]};
export type Dados={bairros:FeatureCollection;setores:FeatureCollection;obras:FeatureCollection<Geometry|null,PropsObra>;saneamento:Saneamento;contratos:Contratos;financas:Financas;falhas:string[]};
const url=(name:string)=>import.meta.env.BASE_URL+'data/'+name;
async function read<T>(name:string):Promise<T>{const r=await fetch(url(name));if(!r.ok)throw new Error(name+': HTTP '+r.status);return r.json() as Promise<T>;}
export async function carregar():Promise<Dados>{
 const jobs=await Promise.allSettled([read<FeatureCollection>('bairros-oficiais.geojson'),read<FeatureCollection>('censo2022-setores.geojson'),read<FeatureCollection<Geometry|null,PropsObra>>('obras.geojson'),read<Saneamento>('saneamento.json'),read<Contratos>('contratos.json'),read<Financas>('financas.json')]);
 const nomes=['Bairros oficiais','Setores 2022','Obras','Saneamento','Contratos','Finanças'];
 const falhas=jobs.flatMap((x,i)=>x.status==='rejected'?[nomes[i]+': '+String(x.reason)]:[]);
 const take=<T>(i:number,fallback:T):T=>jobs[i].status==='fulfilled'?(jobs[i] as PromiseFulfilledResult<unknown>).value as T:fallback;
 return {bairros:take(0,{type:'FeatureCollection',features:[]}),setores:take(1,{type:'FeatureCollection',features:[]}),obras:take(2,{type:'FeatureCollection',features:[]}),saneamento:take(3,{fonte:'',fonteUrl:'',fonteOficial:'',referencia:'',abrangencia:'',observacao:'',indicadores:[]}),contratos:take(4,{updatedAt:null,note:'',items:[]}),financas:take(5,{updatedAt:null,note:'',observacoes:[]}),falhas};
}
export function texto(valor:unknown):string{return String(valor??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));}
export const inteiro=(n:number|null|undefined):string=>n==null?'N/D':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(n);
export const numero=(n:number|null|undefined,casas=1):string=>n==null?'N/D':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:casas}).format(n);
export const moeda=(n:number|null|undefined):string=>n==null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
export const nomesStatus:Record<StatusObra,string>={planejada:'Planejada',licitacao:'Em licitação',em_execucao:'Em execução',paralisada:'Paralisada',concluida:'Concluída',cancelada:'Cancelada',indeterminada:'Situação não informada'};
export const nomesTemas:Record<Indicador['tema'],string>={agua:'Abastecimento de água',esgoto:'Esgotamento sanitário',residuos:'Resíduos sólidos',drenagem:'Drenagem urbana'};
export function obrasList(d:Dados):Obra[]{return d.obras.features.filter((x):x is Obra=>!!x.properties&&typeof x.properties.id==='string');}
export function totalVerificado(obras:Obra[],campo:keyof Pick<PropsObra,'valor_contratado'|'valor_empenhado'|'valor_liquidado'|'valor_pago'>):number|null{const validos=obras.map(o=>o.properties[campo]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));return validos.length?validos.reduce((a,b)=>a+b,0):null;}
export function bairroDaFeicao(f:Feature):string{return String(f.properties?.BAIRRO??f.properties?.bairro??f.properties?.NM_BAIRRO??'Não identificado');}
export function idSetor(f:Feature):string{return String(f.properties?.id??f.properties?.CD_SETOR??'');}
export function nomeCurto(s:string,lim=76):string{return s.length>lim?s.slice(0,lim-1)+'…':s;}
export function anoRef(s:string|null|undefined):string{return s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'Não informado';}
