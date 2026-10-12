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
