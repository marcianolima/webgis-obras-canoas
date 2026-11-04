import type {FeatureCollection, Feature, Geometry} from 'geojson';

export type StatusObra = 'planejada'|'licitacao'|'em_execucao'|'paralisada'|'concluida'|'cancelada'|'indeterminada';
export type PropsObra = {id:string;titulo:string;tipo:string;status:StatusObra;orgao:string;bairro:string|null;contrato:string|null;valor_contratado:number|null;valor_empenhado:number|null;valor_liquidado:number|null;valor_pago:number|null;inicio:string|null;prazo_final:string|null;percentual_execucao:number|null;url_fonte:string;atualizado_em:string|null;localizacao:'coordenada_verificada'|'sem_coordenada';};
export type Obra = Feature<Geometry|null,PropsObra>;
export type Indicador={id:string;nome:string;tema:'agua'|'esgoto'|'residuos'|'drenagem';valor:number;unidade:string;descricao?:string;referencia:string};
export type Saneamento={fonte:string;fonteUrl:string;fonteOficial:string;referencia:string;abrangencia:string;observacao:string;indicadores:Indicador[]};
export type Contrato={id:string;objeto:string;numero:string;fornecedor:string;valor:number|null;data:string|null;url_fonte:string;obra_id?:string|null;classificacao?:'obra_fisica_candidata'|'manutencao_infraestrutura'|'projeto_tecnico';bairro?:string|null};
export type Contratos={updatedAt:string|null;note:string;items:Contrato[]};
export type ObraFederalProps={
 id:string;titulo:string;descricao:string;natureza:string|null;especie:string|null;
 situacao:string;status_fonte:string;percentual_execucao:number|null;percentual_meta:{data?:string;instrumento?:string;erro?:string}|null;
 valor_previsto:number|null;valor_natureza:string;organizacao_responsavel:string|null;sistema_responsavel:string|null;
 data_inicio_prevista:string|null;data_fim_prevista:string|null;data_inicio_real:string|null;data_fim_real:string|null;data_cadastro:string|null;
 endereco_declarado:string|null;bairro:string|null;bairros_geometria:string[];quantidade_pontos:number;precisao:string;
 origem_geometria:string[];codigo_ibge_geometria:number;url_fonte:string;
};
export type ContratoEspacialProps={
 id:string;id_contrato:string;numero_contrato:string|null;titulo:string;objeto:string;valor:number|null;
 fornecedor:string|null;data_assinatura:string|null;ano:number;classe:string;
 situacao_execucao:string|null;situacao_rotulo:string;percentual_execucao:number|null;valor_pago:number|null;
 bairro_documentado:string|null;bairro:string|null;id_equipamento:string|null;equipamento:string|null;
 origem_localizacao:string|null;qualidade_localizacao:string;descricao_localizacao?:string;url_fonte:string;camada:string;
};
export type ObraFederal=Feature<Geometry|null,ObraFederalProps>;
export type ContratoEspacial=Feature<Geometry|null,ContratoEspacialProps>;
export type PendenciaLocal={id_contrato:string;numero:string|null;titulo:string;classe:string;bairro_declarado:string|null;motivo:string;equipamentos_candidatos:string[];url_fonte:string};
export type QualidadeGeocodificacao={schemaVersion:number;metadata:{consultadoEm:string|null;totalContratos?:number;comPontoReferencia?:number;semPontoReferencia?:number};pendencias:PendenciaLocal[]};
export type Licitacao={
 id:string;objeto:string;classe:string;modalidade:string;modalidadeId:number|null;
 numero:string;processo:string;situacao:string;situacao_origem:string;
 estimado:number|null;homologado:number|null;publicacao:string|null;
 inicioPropostas:string|null;fimPropostas:string|null;registroOrigem:string;
 urlSistemaOrigem:string|null;geolocalizacao:null;bairro:null;obra_fisica_estado:null;
};
export type Licitacoes={
 schemaVersion:number;updatedAt:string|null;source:string;cnpjOrgao:string;
 note:string;items:Licitacao[];
};
export type Financas={updatedAt:string|null;note:string;observacoes:{ano:number;categoria:string;valor:number;fonte:string}[]};
export type Dados={bairros:FeatureCollection;setores:FeatureCollection;obras:FeatureCollection<Geometry|null,PropsObra>;saneamento:Saneamento;contratos:Contratos;financas:Financas;obrasgov:FeatureCollection<Geometry|null,ObraFederalProps>;intervencoes:FeatureCollection<Geometry|null,ContratoEspacialProps>;qualidadeGeo:QualidadeGeocodificacao;licitacoes:Licitacoes;falhas:string[]};
const url=(name:string)=>import.meta.env.BASE_URL+'data/'+name;
async function read<T>(name:string):Promise<T>{const r=await fetch(url(name));if(!r.ok)throw new Error(name+': HTTP '+r.status);return r.json() as Promise<T>;}
export async function carregar():Promise<Dados>{
 const jobs=await Promise.allSettled([read<FeatureCollection>('bairros-oficiais.geojson'),read<FeatureCollection>('censo2022-setores.geojson'),read<FeatureCollection<Geometry|null,PropsObra>>('obras.geojson'),read<Saneamento>('saneamento.json'),read<Contratos>('contratos.json'),read<Financas>('financas.json'),read<FeatureCollection<Geometry|null,ObraFederalProps>>('obrasgov.geojson'),read<FeatureCollection<Geometry|null,ContratoEspacialProps>>('intervencoes.geojson'),read<QualidadeGeocodificacao>('geocodificacao-pendencias.json'),read<Licitacoes>('licitacoes.json')]);
 const nomes=['Bairros oficiais','Setores 2022','Obras','Saneamento','Contratos','Finanças','Obrasgov','Intervenções PNCP','Pendências de localização','Licitações PNCP'];
 const falhas=jobs.flatMap((x,i)=>x.status==='rejected'?[nomes[i]+': '+String(x.reason)]:[]);
 const take=<T>(i:number,fallback:T):T=>jobs[i].status==='fulfilled'?(jobs[i] as PromiseFulfilledResult<unknown>).value as T:fallback;
 return {bairros:take(0,{type:'FeatureCollection',features:[]}),setores:take(1,{type:'FeatureCollection',features:[]}),obras:take(2,{type:'FeatureCollection',features:[]}),saneamento:take(3,{fonte:'',fonteUrl:'',fonteOficial:'',referencia:'',abrangencia:'',observacao:'',indicadores:[]}),contratos:take(4,{updatedAt:null,note:'',items:[]}),financas:take(5,{updatedAt:null,note:'',observacoes:[]}),obrasgov:take(6,{type:'FeatureCollection',features:[]}),intervencoes:take(7,{type:'FeatureCollection',features:[]}),qualidadeGeo:take(8,{schemaVersion:1,metadata:{consultadoEm:null},pendencias:[]}),licitacoes:take(9,{schemaVersion:1,updatedAt:null,source:'',cnpjOrgao:'88577416000118',note:'',items:[]}),falhas};
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
