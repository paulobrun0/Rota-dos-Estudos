import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareEditalTemplate,exportEditalTemplate} from '../src/lib/editalTemplates.js';

test('bizu content is short and personal edits survive template export/import',()=>{
 const content=JSON.parse(readFileSync(new URL('../src/data/pmBizu.json',import.meta.url)));
 assert.equal(Object.keys(content).length,487);
 for(const text of Object.values(content)) {assert.ok(text.length<=1200);assert.ok(text.split('\n').length<=5);}
 const template={name:'PM AL',materias:[{name:'Português',topics:[{name:'Acentuação',bizu:'**Minha regra**',notes:'anotação separada'}]}]};
 const result=prepareEditalTemplate(exportEditalTemplate(prepareEditalTemplate(template)));
 assert.equal(result.materias[0].topics[0].bizu,'**Minha regra**');
 assert.equal(result.materias[0].topics[0].notes,'anotação separada');
 assert.throws(()=>prepareEditalTemplate({...template,materias:[{name:'Português',topics:[{name:'Acentuação',bizu:'a'.repeat(1201)}]}]}),/bizu/);
});

test('PM corpus covers every guide subtopic except mathematics with valid source references',()=>{
 const content=JSON.parse(readFileSync(new URL('../src/data/pmBizu.json',import.meta.url)));
 const guide=JSON.parse(readFileSync(new URL('./fixtures/pm-bizu-topics.json',import.meta.url)));
 const refs=JSON.parse(readFileSync(new URL('../src/data/pmBizuReferences.json',import.meta.url)));
 const expected=guide.filter(m=>!/matem[aá]tica/i.test(m.name)).flatMap(m=>m.topics);
 assert.deepEqual(Object.keys(content).sort(),expected.sort());
 assert.deepEqual(Object.keys(refs.topics).sort(),expected.sort());
 for(const m of guide.filter(m=>/matem[aá]tica/i.test(m.name))) for(const name of m.topics) assert.equal(content[name],undefined);
 for(const [name,ids] of Object.entries(refs.topics)) {
  assert.ok(content[name].trim().length>50,name);
  for(const id of ids) {assert.ok(refs.sources[id]?.label,id);assert.equal(new URL(refs.sources[id].url).protocol,'https:');}
 }
});
