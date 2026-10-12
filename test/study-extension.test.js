import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('capture extension stores selected text locally, renders it as text and uses only active-tab permissions',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../browser-extension/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);
 const html=await readFile(new URL('../browser-extension/popup.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../browser-extension/popup.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.com/extension-test'});
 let storage={marks:[]},scriptCalls=0;
 dom.window.chrome={storage:{local:{get:async()=>structuredClone(storage),set:async value=>{storage=structuredClone(value);}}},tabs:{query:async()=>[{id:1,url:'https://example.com/material'}]},scripting:{executeScript:async()=>{scriptCalls++;return [{result:{text:'<img src=x onerror=alert(1)> Trecho próprio',title:'Material próprio',url:'https://example.com/material'}}];}}};
 dom.window.eval(script);const doc=dom.window.document;
 doc.getElementById('capture').click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(scriptCalls,1);assert.match(doc.getElementById('text').value,/Trecho próprio/);
 doc.getElementById('note').value='Minha nota';doc.getElementById('save').click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(storage.marks.length,1);assert.equal(storage.marks[0].note,'Minha nota');assert.equal(doc.querySelector('#entries img'),null);assert.match(doc.getElementById('entries').textContent,/Trecho próprio/);
 dom.window.close();
});

test('page highlights restore across nodes, preserve text, skip ambiguous passages and remove deleted marks',async()=>{
 const dom=new JSDOM('<body><p>Um trecho <b>importante</b> aqui.</p><p>repetido repetido</p><script>secreto</script></body>',{url:'https://example.com/material',runScripts:'outside-only'});let listener;
 const marks=[{id:'a',text:'trecho importante',url:'https://example.com/material',color:'yellow',note:'Nota'},{id:'b',text:'repetido',url:'https://example.com/material',color:'pink'}];
 dom.window.chrome={storage:{local:{get:async()=>({marks})},onChanged:{addListener:fn=>listener=fn}}};
 dom.window.eval(await readFile(new URL('../browser-extension/content.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,0));
 assert.equal(dom.window.document.querySelectorAll('mark').length,2);assert.equal(dom.window.document.querySelector('b').textContent,'importante');assert.equal(dom.window.document.querySelectorAll('p mark').length,2);
 listener({marks:{newValue:[]}},'local');assert.equal(dom.window.document.querySelectorAll('mark').length,0);assert.equal(dom.window.document.querySelector('p').textContent,'Um trecho importante aqui.');dom.window.close();
});
