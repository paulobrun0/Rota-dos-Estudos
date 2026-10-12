import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeTecRequest,queueTecRequest,applyTecResult} from '../src/lib/tecNotebooks.js';
import {subjectMatches,bankMatches,tecNotebookUrl,validateTecRequest} from '../src/lib/tecProtocol.js';
import {validatePlanData} from '../src/lib/planValidation.js';
const ref={concursoId:'c',materiaId:'m',topicId:'t'};
const fixture=()=>({concursos:[{id:'c',name:'Meu edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente',questionsTotal:40,questionsCorrect:30,notes:'Minha nota'}]}]}],activity:{},questionActivity:{},studyMinutes:{}});
const options={title:'Crase · Cebraspe',bank:'Cebraspe',yearFrom:'2021',yearTo:'2026',quantity:30,folder:'Teste',onlyUnsolved:true,removeCancelled:true,removeOutdated:true};
const request=()=>makeTecRequest(fixture(),'account:1',ref,options,'request-1',Date.now());

test('TEC matcher maps the long Portuguese subject but never chooses a different discipline or a vague short substring',()=>{
 const subject='Porque, Por Que, Porquê e Por Quê; Onde, Aonde e Donde; Há e A, etc';
 assert.equal(subjectMatches(`Língua Portuguesa (Português): Fatos da Língua Portuguesa (${subject})`,{materia:'Português',subject,mappedTitle:''}),true);
 assert.equal(subjectMatches('Direito Administrativo: Crase',{materia:'Português',subject:'Crase',mappedTitle:''}),false);
 assert.equal(subjectMatches('Língua Portuguesa (Português): Questões mescladas de Crase',{materia:'Português',subject:'Crase',mappedTitle:''}),false);
 assert.equal(bankMatches('CEBRASPE (CESPE)','Cespe'),true);assert.equal(bankMatches('FGV','Cebraspe'),false);
});
test('TEC request validation rejects missing identities, impossible years and unsafe notebook URLs',()=>{
 const r=request();validateTecRequest(r);
 for(const patch of [{accountId:''},{quantity:0},{quantity:1001},{quantity:1.5},{yearFrom:2027,yearTo:2026},{yearFrom:null},{onlyUnsolved:'yes'}])assert.throws(()=>validateTecRequest({...r,...patch}));
 for(const url of ['https://www.tecconcursos.com.br.evil.test/questoes/cadernos/1','https://user@www.tecconcursos.com.br/questoes/cadernos/1','http://www.tecconcursos.com.br/questoes/cadernos/1','https://www.tecconcursos.com.br/questoes/1','javascript:alert(1)'])assert.throws(()=>tecNotebookUrl(url));
 assert.equal(tecNotebookUrl('https://tecconcursos.com.br/questoes/cadernos/123/?ref=x'),'https://www.tecconcursos.com.br/questoes/cadernos/123');
});
test('a returned TEC notebook binds once to its original account and subject without recording practice',()=>{
 const data=fixture(),r=request(),pending=queueTecRequest(data,r);validatePlanData(pending);const result={id:r.id,accountId:r.accountId,status:'complete',url:'https://www.tecconcursos.com.br/questoes/cadernos/123',mappingTitle:'Língua Portuguesa (Português): Crase',folder:'Teste'};
 assert.throws(()=>applyTecResult(pending,{...result,accountId:'account:2'},'account:1'),/não pertence/);assert.throws(()=>applyTecResult(pending,result,'account:2'),/não pertence/);assert.throws(()=>applyTecResult(pending,{...result,id:'unknown'},'account:1'),/não pertence/);
 const next=applyTecResult(pending,result,'account:1');validatePlanData(next);assert.equal(next.questionNotebooks.length,1);assert.equal(next.questionNotebooks[0].bank,'Cebraspe');assert.equal(next.questionNotebooks[0].yearFrom,2021);assert.equal(next.tecRequests[0].status,'complete');assert.equal(next.concursos[0].materias[0].topics[0].questionsTotal,40);assert.equal(next.concursos[0].materias[0].topics[0].notes,'Minha nota');assert.deepEqual(next.questionActivity,{});assert.deepEqual(next.activity,{});
 assert.equal(applyTecResult(next,result,'account:1'),next);assert.equal(next.studyPreferences.tecFolder,'Teste');
 const again=makeTecRequest(next,'account:1',ref,options,'request-2');assert.equal(again.mappedTitle,result.mappingTitle);
});
test('cancelled or deleted targets never receive a notebook and malformed jobs cannot enter backups',()=>{
 const pending=queueTecRequest(fixture(),request()),result={id:'request-1',accountId:'account:1',status:'complete',url:'https://www.tecconcursos.com.br/questoes/cadernos/123',mappingTitle:'Português: Crase'};
 pending.tecRequests[0].status='cancelled';assert.equal(applyTecResult(pending,result,'account:1'),pending);
 pending.tecRequests[0].status='pending';pending.concursos[0].materias[0].topics=[];assert.throws(()=>applyTecResult(pending,result,'account:1'),/removido/);assert.equal(pending.questionNotebooks,undefined);
 for(const patch of [{status:'anything'},{status:'complete',url:'https://evil.test/123'},{quantity:0}]){const invalid=queueTecRequest(fixture(),request());Object.assign(invalid.tecRequests[0],patch);assert.throws(()=>validatePlanData(invalid));}
});
test('an explicitly pasted link can be recovered without inventing a TEC mapping, and renamed subjects require review',()=>{
 const pending=queueTecRequest(fixture(),request()),result={id:'request-1',accountId:'account:1',status:'complete',url:'https://www.tecconcursos.com.br/questoes/cadernos/123'};
 assert.throws(()=>applyTecResult(pending,result,'account:1'),/Confirme/);
 const manual=applyTecResult(pending,result,'account:1',{allowUnmapped:true});validatePlanData(manual);assert.equal(manual.questionNotebooks.length,1);assert.equal(manual.concursos[0].materias[0].topics[0].tecSubjectTitle,undefined);
 pending.concursos[0].materias[0].topics[0].name='Outro assunto';assert.throws(()=>applyTecResult(pending,{...result,mappingTitle:'Português: Crase'},'account:1'),/mudou/);assert.equal(pending.questionNotebooks,undefined);
});
test('packaged protocol matches the server implementation and host access stays restricted to user activation',async()=>{
 assert.equal(await readFile(new URL('../browser-extension/tec-protocol.js',import.meta.url),'utf8'),await readFile(new URL('../src/lib/tecProtocol.js',import.meta.url),'utf8'));
 const manifest=JSON.parse(await readFile(new URL('../browser-extension/manifest.json',import.meta.url),'utf8'));assert.equal(manifest.host_permissions,undefined);assert.deepEqual(manifest.optional_host_permissions,['https://www.tecconcursos.com.br/*']);assert.deepEqual(manifest.content_scripts[0].matches,['https://app.paulobruno.dev/*']);assert.equal(manifest.permissions.includes('cookies'),false);assert.equal(manifest.permissions.includes('webRequest'),false);
});
