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
