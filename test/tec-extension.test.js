import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {runTecBuilder} from '../browser-extension/tec-dom.js';

const request=()=>({id:'job-1',accountId:'account:1',concursoId:'c',materiaId:'m',topicId:'t',materia:'Português',subject:'Crase',mappedTitle:'',title:'Meu caderno',bank:'Cebraspe',folder:'Teste',quantity:10,yearFrom:null,yearTo:null,onlyUnsolved:false,removeCancelled:false,removeOutdated:false,createdAt:Date.now()});

test('TEC driver selects the matching matter and bank, limits quantity and generates exactly once through visible controls',async()=>{
 const dom=new JSDOM('<body><ul id="tabs"><li>Matéria e assunto</li><li>Banca</li><li>Ano</li><li>Opções</li></ul><a id="search">Pesquisar por nome</a><input placeholder="Digite pelo menos três caracteres"><ul class="arvore"></ul><p><strong>20</strong> questões encontradas</p><a id="quantity">Editar quantidades</a><input id="nomeCadernoId"><select id="pastaCadernosId"><option value="1">Teste</option></select><button id="generate">Gerar Caderno</button></body>',{url:'https://www.tecconcursos.com.br/questoes/filtrar'});
 const {document}=dom.window;dom.window.HTMLElement.prototype.getClientRects=function(){return this.isConnected?[{}]:[];};let section='Matéria e assunto',generated=0,selected=[];const messages=[];
 for(const tab of document.querySelectorAll('#tabs li'))tab.onclick=()=>section=tab.textContent;
 document.querySelector('input[placeholder]').addEventListener('keyup',()=>{const tree=document.querySelector('.arvore');tree.replaceChildren();const options=section==='Banca'?['CEBRASPE (CESPE)']:['Direito Administrativo: Crase','Língua Portuguesa (Português): Crase'];for(const title of options){const li=document.createElement('li');li.className='arvore-item';li.title=title;const content=document.createElement('div');content.className='arvore-item-conteudo';const name=document.createElement('span');name.className='arvore-item-nome';name.textContent=title.includes(':')?title.split(':')[1].trim():title;content.append(name);li.append(content);content.onclick=()=>{li.classList.add('arvore-item-selecionado');selected.push(title);};tree.append(li);}});
 document.querySelector('#quantity').onclick=()=>{const input=document.createElement('input');input.setAttribute('aria-label','Alterar quantidade total de questões do caderno');document.body.append(input);};
 document.querySelector('#generate').onclick=()=>{generated++;assert.equal(document.querySelector('input[aria-label]').value,'10');assert.equal(document.querySelector('#nomeCadernoId').value,'Meu caderno');const a=document.createElement('a');a.href='https://www.tecconcursos.com.br/questoes/cadernos/456';a.textContent='Abrir caderno gerado';document.body.append(a);};
 await runTecBuilder(document,{request:request(),status:'pending'},async message=>{messages.push(message);if(message.type==='TEC_JOB')return {job:{status:messages.some(m=>m.phase==='generating')?'generating':'applying'}};return {ok:true};});
 assert.equal(generated,1);assert.deepEqual(selected,['Língua Portuguesa (Português): Crase','CEBRASPE (CESPE)']);assert.equal(messages.at(-1).type,'TEC_DONE');assert.equal(messages.at(-1).url,'https://www.tecconcursos.com.br/questoes/cadernos/456');assert.ok(messages.some(m=>m.phase==='generating'&&m.mappingTitle.includes('Português')));dom.window.close();
});

test('extension background rejects foreign origins, restores results after the app tab closes and cannot restart a completed job',async()=>{
 let storage={},deliveries=[],created=0;const listeners={};
 globalThis.chrome={runtime:{id:'ritmo-test',onMessage:{addListener(){}}},storage:{local:{get:async()=>structuredClone(storage),set:async value=>Object.assign(storage,structuredClone(value))}},permissions:{contains:async()=>true},scripting:{getRegisteredContentScripts:async()=>[{id:'ritmo-tec-builder'}]},tabs:{create:async()=>({id:++created+10}),sendMessage:async(id,value)=>deliveries.push({id,value}),onUpdated:{addListener:fn=>listeners.updated=fn},onCreated:{addListener:fn=>listeners.created=fn}}};
 const {handleTecMessage}=await import('../browser-extension/tec-background.js');const app={url:'https://app.paulobruno.dev/',tab:{id:1}},tec={url:'https://www.tecconcursos.com.br/questoes/filtrar',tab:{id:11}};
 await assert.rejects(()=>handleTecMessage({type:'TEC_CREATE',request:request()},{url:'https://evil.test',tab:{id:2}}),/plataforma/);
 await handleTecMessage({type:'TEC_CREATE',request:request()},app);await handleTecMessage({type:'TEC_CREATE',request:request()},app);assert.equal(created,1);
 await handleTecMessage({type:'TEC_PHASE',id:'job-1',phase:'applying',mappingTitle:'Português: Crase'},tec);await handleTecMessage({type:'TEC_PHASE',id:'job-1',phase:'generating',mappingTitle:'Português: Crase',folder:'Teste'},tec);
 await assert.rejects(()=>handleTecMessage({type:'TEC_DONE',id:'job-1',url:'https://evil.test/book'},tec),/individual/);
 await handleTecMessage({type:'TEC_DONE',id:'job-1',url:'https://www.tecconcursos.com.br/questoes/cadernos/123'},tec);assert.equal(deliveries.length,1);
 const hello=await handleTecMessage({type:'TEC_HELLO',accountId:'account:1'},{...app,tab:{id:99}});assert.equal(hello.results.length,1);assert.equal(hello.results[0].url,'https://www.tecconcursos.com.br/questoes/cadernos/123');assert.equal((await handleTecMessage({type:'TEC_HELLO',accountId:'account:2'},app)).results.length,0);
 assert.equal((await handleTecMessage({type:'TEC_JOB'},tec)).job,null);await handleTecMessage({type:'TEC_CREATE',request:request()},app);assert.equal(created,1);
 delete globalThis.chrome;
});
