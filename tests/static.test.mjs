import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(f)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('saneamento: percentuais municipal, sem desagregação inventada',()=>{
 const j=JSON.parse(read('public/data/saneamento.json'));
 assert.equal(j.abrangencia,'municipal');
 assert.equal(j.indicadores.find(x=>x.id==='agua_atendimento').valor,97.3);
 assert.equal(j.indicadores.find(x=>x.id==='esgoto_atendimento').valor,62);
 assert.ok(j.indicadores.every(x=>typeof x.valor==='number'&&x.referencia));
});
test('GeoJSON e importador presentes',()=>{
 assert.ok(existsSync(new URL('../public/data/bairros-oficiais.geojson',import.meta.url)));
 assert.ok(existsSync(new URL('../public/data/censo2022-setores.geojson',import.meta.url)));
 assert.ok(existsSync(new URL('../scripts/ingest_obras.py',import.meta.url)));
});
test('dados de obras vazios nao usam simulacao',()=>{
 const j=JSON.parse(read('public/data/obras.geojson'));
 assert.equal(j.type,'FeatureCollection');
 assert.ok(j.features.every(f=>typeof f.properties?.url_fonte==='string'));
});
