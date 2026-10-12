import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,decodePDFRawStream} from 'pdf-lib';
import {documentFingerprint,annotatedPdf,marksMarkdown} from '../src/lib/pdfStudy.js';
import {validatePlanData} from '../src/lib/planValidation.js';
import {reviewStudyMark} from '../src/lib/learningTools.js';
const mark={id:'highlight',concursoId:'c',materiaId:'m',topicId:'t',documentId:'a'.repeat(64),documentName:'material.pdf',page:1,color:'yellow',text:'Trecho próprio',note:'Minha nota de revisão',rects:[{x:40,y:650,width:200,height:15}],date:'2026-10-12'};
const plan=()=>({concursos:[{id:'c',name:'Concurso',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}]}],pdfAnnotations:[structuredClone(mark)]});
test('PDF export preserves original pages, adds highlight and notes appendix, leaves input untouched',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([595,842]).drawText('Material de estudo');const bytes=await pdf.save(),before=bytes.slice();
 const result=await PDFDocument.load(await annotatedPdf(bytes,[mark]));assert.equal(result.getPageCount(),2);assert.deepEqual(bytes,before);
 const contents=result.getPage(0).node.Contents();const streams=contents.asArray().map(ref=>result.context.lookup(ref));const decoded=streams.map(s=>new TextDecoder().decode(decodePDFRawStream(s).decode())).join('');assert.match(decoded,/200 0 l/);assert.match(decoded,/Material|4D6174657269616C/);assert.match(decoded,/gs/);
 const id=await documentFingerprint(bytes);assert.match(id,/^[a-f0-9]{64}$/);assert.equal(await documentFingerprint(before),id);
 assert.match(marksMarkdown([mark]),/página 1/);assert.match(marksMarkdown([mark]),/Minha nota/);
});
test('PDF annotations validate and reject unsafe bounds, invalid files, pages, colors and huge text',()=>{validatePlanData(plan());for(const edit of [m=>m.documentId='x',m=>m.page=0,m=>m.rects[0].width=-1,m=>m.rects[0].x=Infinity,m=>m.color='purple',m=>m.note='x'.repeat(20001)]){const p=plan();edit(p.pdfAnnotations[0]);assert.throws(()=>validatePlanData(p));}});
test('highlight review schedules recall once per day without crediting questions or changing original marks',()=>{const p=plan(),next=reviewStudyMark(p,'pdfAnnotations','highlight','good','2026-10-12');validatePlanData(next);assert.equal(next.pdfAnnotations[0].nextReviewDate,'2026-10-19');assert.equal(p.pdfAnnotations[0].nextReviewDate,undefined);assert.equal(next.questionActivity,undefined);assert.equal(reviewStudyMark(next,'pdfAnnotations','highlight','again','2026-10-12'),next);});

test('PDF search ignores accents, returns page links and stops when cancelled',async()=>{
 const {findPdfPages}=await import('../src/lib/pdfStudy.js');const texts=['Introdução aos estudos','Atos administrativos e revisão','Outro material'];const doc={numPages:3,getPage:async p=>({getTextContent:async()=>({items:[{str:texts[p-1]}]})})};assert.deepEqual((await findPdfPages(doc,'revisao')).map(r=>r.page),[2]);assert.deepEqual(await findPdfPages(doc,'inexistente'),[]);let scanned=0;assert.deepEqual(await findPdfPages(doc,'atos',{onProgress:()=>scanned++,isCancelled:()=>scanned>=1}),[]);assert.equal(scanned,1);
});
test('selection coordinates clip to the page and remain correct after rotated viewport conversion',async()=>{
 const {selectionRectsToPdf}=await import('../src/lib/pdfStudy.js');const bounds={left:10,top:20,right:110,bottom:220},rects=[{left:5,top:30,right:50,bottom:50},{left:200,top:300,right:220,bottom:330}],viewport={convertToPdfPoint:(x,y)=>[y/2,100-x/2]};assert.deepEqual(selectionRectsToPdf(rects,bounds,viewport),[{x:5,y:80,width:10,height:20}]);
});

test('PDF mark creation refuses stale selection from a different page or document and preserves its id for retries',async()=>{const {createPdfAnnotation}=await import('../src/lib/pdfStudy.js');const concurso={id:'c',materias:[{id:'m',topics:[{id:'t'}]}]},selection={id:'stable-mark',documentId:mark.documentId,page:1,text:mark.text,rects:mark.rects};const input={fileId:mark.documentId,fileName:'material.pdf',page:1,selection,concurso,materiaId:'m',topicId:'t',color:'yellow',note:'Nota',date:'2026-10-12'};const annotation=createPdfAnnotation(input);assert.equal(annotation.id,'stable-mark');assert.equal(createPdfAnnotation(input).id,annotation.id);assert.throws(()=>createPdfAnnotation({...input,page:2}),/outra página/);assert.throws(()=>createPdfAnnotation({...input,fileId:'b'.repeat(64)}),/arquivo/);assert.throws(()=>createPdfAnnotation({...input,topicId:'removed'}),/assunto existente/);});
