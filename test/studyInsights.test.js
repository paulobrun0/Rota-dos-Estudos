import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examScore, sortedExams, reviewRows, concursoSummary, filterTopics } from '../src/lib/studyInsights.js';
import { prepareEditalTemplate, exportEditalTemplate } from '../src/lib/editalTemplates.js';
import { validatePlanData } from '../src/lib/planValidation.js';
const topic=(id,extra={})=>({id,name:id,status:'estudado',questionsTotal:10,questionsCorrect:8,...extra});
const concurso={id:'c',name:'Demo',settings:{minutesPerMateria:30},materias:[{id:'m',name:'Português',topics:[topic('Crase'),topic('Regência',{questionsCorrect:4,nextReviewDate:'2026-10-01'}),topic('Pontuação',{nextReviewDate:'2026-10-05'})]}],dailyPlans:{'2026-10-03':[{id:'a',materiaId:'m',topicId:'Crase',tipo:'novo',feito:true},{id:'b',materiaId:'m',topicId:'Pontuação',tipo:'novo',feito:false},{id:'r',materiaId:'m',topicId:'Regência',tipo:'revisao',feito:true}]}};
test('simulado scores are weighted by available points and same-day chronology is stable',()=>{
 assert.deepEqual(examScore({rows:[{total:10,correct:5,weight:2},{total:10,correct:10,weight:1}]}),{total:30,correct:20,percent:66.7});
 assert.deepEqual(sortedExams({simulados:[{id:'z',date:'2026-10-03'},{id:'a',date:'2026-10-03'}]}).map(e=>e.id),['z','a']);
 assert.equal(examScore({rows:[]}).percent,0);
});
test('concurso summary does not mix simulations into practice or global time totals',()=>{
 const summary=concursoSummary({...concurso,simulados:[{rows:[{total:100,correct:100,weight:1}]}]});
 assert.equal(summary.questions,30);assert.equal(summary.accuracy,67);assert.equal(summary.estimatedMinutes,18);assert.equal(summary.coverage,100);
});
test('review queue honors mastery, due dates and existing plan cards',()=>{
 const rows=reviewRows({...concurso,materias:[{...concurso.materias[0],topics:[...concurso.materias[0].topics,topic('dominado',{mastered:true,nextReviewDate:'2020-01-01'})]}]},'2026-10-03');
 assert.equal(rows[0].id,'Regência');assert.equal(rows[0].due,true);assert.equal(rows[0].planned,true);assert.equal(rows[0].completedToday,true);assert.equal(rows.length,3);
});
test('edital filtering ignores accents and sorts missing accuracy last without mutating the edital',()=>{
 const rows=[topic('Regência'),topic('Crase',{status:'pendente',questionsTotal:0,questionsCorrect:0}),topic('Pontuação',{questionsCorrect:1})];
 assert.deepEqual(filterTopics(rows,{query:'regencia'}).map(t=>t.id),['Regência']);
 assert.deepEqual(filterTopics(rows,{sort:'accuracy'}).map(t=>t.id),['Pontuação','Regência','Crase']);
 assert.deepEqual(rows.map(t=>t.id),['Regência','Crase','Pontuação']);
});
test('template imports preserve linked materials and create fresh ids and progress',()=>{
 const raw={name:'Tribunal',banca:'FGV',materias:[{name:'Português',topics:[{name:'Crase',status:'estudado',questionsTotal:90,links:{tec:'https://www.tecconcursos.com.br/'},materials:[{id:'old',name:'Aula',url:'https://example.com/a.pdf',type:'pdf'}]}]}]};
 const a=prepareEditalTemplate(raw), b=prepareEditalTemplate(raw);assert.notEqual(a.id,b.id);assert.notEqual(a.materias[0].topics[0].id,b.materias[0].topics[0].id);
 const t=a.materias[0].topics[0];assert.equal(t.questionsTotal,0);assert.equal(t.status,'pendente');assert.equal(t.materials[0].name,'Aula');assert.notEqual(t.materials[0].id,'old');assert.equal(raw.materias[0].topics[0].status,'estudado');
 assert.equal(exportEditalTemplate(a).materias[0].topics[0].materials[0].url,'https://example.com/a.pdf');
});
test('invalid template material links and unrelated backups are rejected before import',()=>{
 assert.throws(()=>prepareEditalTemplate({something:1}));
 assert.throws(()=>prepareEditalTemplate({name:'Demo',materias:[{name:'Português',topics:[{name:'Crase',materials:[{name:'Malicioso',type:'pdf',url:'javascript:alert(1)'}]}]}]}),/link do material/);
});
test('plan validation rejects malformed simulations and metadata while accepting older saves',()=>{
 validatePlanData({concursos:[concurso]});
 const valid={id:'exam',name:'Simulado',date:'2026-10-03',minutes:60,banca:'FGV',rows:[{materiaId:'m',materiaName:'Português',total:20,correct:12,weight:2}]};
 validatePlanData({concursos:[{...concurso,simulados:[valid]}]});
 assert.throws(()=>validatePlanData({concursos:[{...concurso,simulados:[{...valid,rows:[{...valid.rows[0],correct:21}]}]}]}),/resultado/);
 assert.throws(()=>validatePlanData({concursos:[{...concurso,stage:'unknown'}]}),/fase/);
 assert.throws(()=>validatePlanData({concursos:[{...concurso,editalUrl:'javascript:alert(1)'}]}),/link/);
});
