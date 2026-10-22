import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareEditalTemplate,exportEditalTemplate} from '../src/lib/editalTemplates.js';

test('bizu content is short and personal edits survive template export/import',()=>{
 const content=JSON.parse(readFileSync(new URL('../src/data/pmBizu.json',import.meta.url)));
 assert.equal(Object.keys(content).length,64);
 for(const text of Object.values(content)) {assert.ok(text.length<=1200);assert.ok(text.split('\n').length<=5);}
 const template={name:'PM AL',materias:[{name:'Português',topics:[{name:'Acentuação',bizu:'**Minha regra**',notes:'anotação separada'}]}]};
 const result=prepareEditalTemplate(exportEditalTemplate(prepareEditalTemplate(template)));
 assert.equal(result.materias[0].topics[0].bizu,'**Minha regra**');
 assert.equal(result.materias[0].topics[0].notes,'anotação separada');
 assert.throws(()=>prepareEditalTemplate({...template,materias:[{name:'Português',topics:[{name:'Acentuação',bizu:'a'.repeat(1201)}]}]}),/bizu/);
});
