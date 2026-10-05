import test from 'node:test';
import assert from 'node:assert/strict';
import { preservePractice, practiceEvidence } from '../src/lib/practiceHistory.js';
import { buildPracticeIndex, decorateConcurso, compareEditais, linkEquivalentTopics } from '../src/lib/editalCompatibility.js';
import { validatePlanData } from '../src/lib/planValidation.js';
import { applySharedSkip } from '../src/lib/sharedSkip.js';
import { weightedCoverage, conciliationForecast } from '../src/lib/conciliationForecast.js';
import { pickDueReviews } from '../src/lib/planner.js';
import { studyPriority } from '../src/lib/studyPriorities.js';
function fixture() {
 const a = {id:'a',name:'A',settings:{minutesPerMateria:60,topicsPerDay:2},examDate:'2026-10-19',materias:[{id:'am',name:'Português',weight:3,topics:[{id:'at',name:'Crase',status:'pendente',questionsTotal:100,questionsCorrect:80,lastPracticeDate:'2026-10-03',history:[{date:'2026-10-03',questionsTotal:100,questionsCorrect:80}]}]},{id:'ax',name:'Direito',topics:[{id:'ax1',name:'Atos',status:'pendente'}]}]};
 const b = {id:'b',name:'B',settings:{minutesPerMateria:30,topicsPerDay:2},examDate:'2026-10-26',materias:[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'Crase',status:'pendente'}]}]};
 return {concursos:[a,b],activeConcursoId:'b',activity:{},questionActivity:{}};
}
test('deleting edital, matéria or topic preserves practice, errors, recency and history exactly once',()=>{
 for(const level of ['edital','materia','topic']) {
  const before=fixture(), next=structuredClone(before);
  if(level==='edital') next.concursos.shift();
  if(level==='materia') next.concursos[0].materias.shift();
  if(level==='topic') next.concursos[0].materias[0].topics=[];
  const saved=preservePractice(before,next);validatePlanData(saved);
  assert.equal(saved.practiceArchive.length,1);assert.equal(saved.practiceArchive[0].topic.history.length,1);
  const index=buildPracticeIndex(saved.concursos,saved.practiceArchive);
  const evidence=decorateConcurso(saved.concursos.find(c=>c.id==='b'),index).materias[0].topics[0].crossStudy;
  assert.equal(evidence.otherTotal,100);assert.equal(evidence.otherCorrect,80);assert.equal(evidence.lastOtherPracticeDate,'2026-10-03');
  assert.deepEqual(saved.activity,before.activity);assert.deepEqual(saved.questionActivity,before.questionActivity);
  const skipped=applySharedSkip(saved,{concursoId:'b',materiaId:'bm',topicId:'bt'},'2026-10-05');assert.equal(skipped.concursos.find(c=>c.id==='b').materias[0].topics[0].skippedFromShared,true);
  assert.equal(preservePractice(saved,structuredClone(saved)).practiceArchive.length,1);
 }
});
test('restored sources and manual count corrections do not duplicate the archive',()=>{
 const before=fixture();const deleted=preservePractice(before,{...before,concursos:[before.concursos[1]]});
 const restored=preservePractice(deleted,{...deleted,concursos:before.concursos});assert.equal(restored.practiceArchive.length,0);
 const corrected=structuredClone(restored);corrected.concursos[0].materias[0].topics[0].questionsTotal=1;corrected.concursos[0].materias[0].topics[0].questionsCorrect=1;
 const saved=preservePractice(restored,corrected);assert.equal(saved.practiceArchive.length,0);assert.equal(decorateConcurso(saved.concursos[1],buildPracticeIndex(saved.concursos,saved.practiceArchive)).materias[0].topics[0].crossStudy.total,1);
});
test('manual links bring archived equivalent practice into the whole group',()=>{
 const before=fixture();const saved=preservePractice(before,{...before,concursos:[before.concursos[1]]});
 saved.concursos.push({id:'c',name:'C',materias:[{id:'cm',name:'Português',topics:[{id:'ct',name:'Uso da crase',status:'pendente'}]}]});
 const linked=linkEquivalentTopics(saved,{concursoId:'b',materiaId:'bm',topicId:'bt'},{concursoId:'c',materiaId:'cm',topicId:'ct'},'shared:archived');
 assert.equal(decorateConcurso(linked.concursos[1],buildPracticeIndex(linked.concursos,linked.practiceArchive)).materias[0].topics[0].crossStudy.otherTotal,100);
});
test('evidence separates tiny samples, errors, unknown dates and old practice',()=>{
 assert.match(practiceEvidence({otherTotal:1,otherCorrect:1},'2026-10-05').label,/Poucas/);
 assert.match(practiceEvidence({otherTotal:100,otherCorrect:60},'2026-10-05').label,/erros/);
 assert.match(practiceEvidence({otherTotal:100,otherCorrect:80},'2026-10-05').label,/não registrada/);
 assert.match(practiceEvidence({otherTotal:100,otherCorrect:80,lastOtherPracticeDate:'2026-08-01'},'2026-10-05').label,/antiga/);
 assert.match(practiceEvidence({otherTotal:100,otherCorrect:80,lastOtherPracticeDate:'2026-10-03'},'2026-10-05').label,/recente/);
});
test('weighted coverage and workload deduplicate common topics and use the earliest deadline',()=>{
 const d=fixture(),[a,b]=d.concursos,index=buildPracticeIndex(d.concursos),common=compareEditais(a,b,index).common;
 assert.equal(weightedCoverage(a,common,index),75);assert.equal(weightedCoverage(b,common,index),100);
 const low=conciliationForecast(a,b,index,'2026-10-05',0.25);assert.equal(low.minutes,60);assert.equal(low.pending,2);assert.equal(low.deadline,'2026-10-19');assert.equal(low.fits,false);assert.equal(low.requiredHoursPerWeek,0.5);
 assert.equal(conciliationForecast(a,b,index,'2026-10-05',1).fits,true);
 assert.equal(conciliationForecast(a,b,index,'2026-10-05',null).fits,null);
 assert.equal(conciliationForecast(a,b,index,'2026-10-19',1).fits,null);
 a.examDate=null;b.examDate=null;assert.equal(conciliationForecast(a,b,index,'2026-10-05',1).capacity,null);
});
test('review priorities include weight, overdue days and shared accuracy without changing the source',()=>{
 const materias=[{id:'a',weight:1,topics:[{id:'at',status:'estudado',nextReviewDate:'2026-10-05',questionsTotal:10,questionsCorrect:2}]},{id:'b',weight:4,topics:[{id:'bt',status:'estudado',nextReviewDate:'2026-10-04',questionsTotal:10,questionsCorrect:6}]}];
 assert.equal(pickDueReviews(materias,'2026-10-05',1,new Set())[0].topicId,'bt');
 const topic={crossStudy:{total:100,correct:60},nextReviewDate:'2026-10-03'};
 assert.match(studyPriority({weight:3},topic,'2026-10-05').reason,/2 dias de atraso.*60%.*Peso 3/);
});
test('archive, weights, dates, hours and history reject malformed backups',()=>{
 const d=fixture();const saved=preservePractice(d,{...d,concursos:[d.concursos[1]]});
 for(const change of [x=>x.practiceArchive[0].topic.questionsCorrect=101,x=>x.practiceArchive[0].topic.history={},x=>x.practiceArchive[0].id='other',x=>x.practiceArchive[0].topic.lastPracticeDate='yesterday',x=>x.availableHoursPerWeek=169,x=>x.concursos[0].materias[0].weight=-1]) {const invalid=structuredClone(saved);change(invalid);assert.throws(()=>validatePlanData(invalid));}
});

test('today plan selection uses preserved shared performance instead of only local counters',async()=>{
 const {buildDayPlan}=await import('../src/lib/materiaMerge.js');const d=fixture();
 d.concursos[0].materias[0].topics[0].questionsCorrect=20;
 const saved=preservePractice(d,{...d,concursos:[d.concursos[1]]});const target=saved.concursos[0];
 target.settings={topicsPerDay:0,reviewsPerDay:1};target.materias[0].topics[0].status='estudado';target.materias[0].topics[0].nextReviewDate='2026-10-05';
 target.materias.push({id:'other',name:'Direito',topics:[{id:'other-topic',name:'Atos',status:'estudado',nextReviewDate:'2026-10-05',questionsTotal:10,questionsCorrect:5}]});
 const {cards}=buildDayPlan(target,[],'2026-10-05',buildPracticeIndex(saved.concursos,saved.practiceArchive));
 assert.equal(cards.length,1);assert.equal(cards[0].topicId,'bt');assert.equal(target.materias[0].topics[0].questionsTotal,undefined);
});
