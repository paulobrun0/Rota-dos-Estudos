import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeConcurso } from '../src/data/model.js';
import { buildPracticeIndex, compareEditais, decorateConcurso, linkEquivalentTopics, normalizeStudyName, removeManualEquivalence, topicQuestionTotals } from '../src/lib/editalCompatibility.js';
import { applySharedSkip } from '../src/lib/sharedSkip.js';
import { validatePlanData } from '../src/lib/planValidation.js';
function fixture() {
  const a = makeConcurso('A', 0), b = makeConcurso('B', 1), c = makeConcurso('C', 2);
  a.id='a'; b.id='b'; c.id='c';
  a.materias=[{id:'am',name:'Português',topics:[{id:'at',name:'1.1 Crase e regência',status:'estudado',questionsTotal:20,questionsCorrect:16},{id:'ax',name:'Pontuação',status:'pendente'}]}];
  b.materias=[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'2.CRASE E REGENCIA',status:'pendente',questionsTotal:5,questionsCorrect:3}]}];
  c.materias=[{id:'cm',name:'Direito Administrativo',topics:[{id:'ct',name:'Crase e regência',status:'pendente',questionsTotal:100,questionsCorrect:100}]}];
  return {concursos:[a,b,c],activeConcursoId:'b',activity:{'2026-10-03':3},questionActivity:{'2026-10-03':{total:25,correct:19}},studyMinutes:{'2026-10-03':60}};
}
const target={concursoId:'b',materiaId:'bm',topicId:'bt'};
test('matches numbering, accents and Portuguese aliases without joining unrelated disciplines',()=>{
  const d=fixture();const result=compareEditais(d.concursos[0],d.concursos[1]);assert.equal(result.common.length,1);assert.equal(result.leftPercent,50);assert.equal(result.rightPercent,100);assert.equal(result.overlapPercent,50);
  assert.equal(compareEditais(d.concursos[0],d.concursos[2]).common.length,0);assert.equal(normalizeStudyName(' 1.2) Regência '),'regencia');assert.notEqual(normalizeStudyName('Linguagem C++'),normalizeStudyName('Linguagem C'));assert.notEqual(normalizeStudyName('Linguagem C#'),normalizeStudyName('Linguagem C++'));
});
test('percentages count distinct subjects and empty editais do not report compatibility',()=>{
 const d=fixture();d.concursos[0].materias[0].topics.push({...d.concursos[0].materias[0].topics[0],id:'duplicate'});assert.equal(compareEditais(d.concursos[0],d.concursos[1]).leftTotal,2);const view=decorateConcurso(d.concursos[0],buildPracticeIndex(d.concursos));assert.equal(topicQuestionTotals(view.materias[0].topics).total,45);const empty=makeConcurso('Empty',0);assert.equal(compareEditais(empty,empty).overlapPercent,0);
});
test('shared counts stay derived, update from either edital and never duplicate activity or local records',()=>{
 const d=fixture();const copy=JSON.stringify(d);let index=buildPracticeIndex(d.concursos);let view=decorateConcurso(d.concursos[1],index);assert.equal(view.materias[0].topics[0].crossStudy.total,25);assert.equal(view.materias[0].topics[0].crossStudy.otherTotal,20);assert.equal(view.materias[0].topics[0].questionsTotal,5);assert.equal(JSON.stringify(d),copy);
 d.concursos[1].materias[0].topics[0].questionsTotal+=2;index=buildPracticeIndex(d.concursos);assert.equal(decorateConcurso(d.concursos[0],index).materias[0].topics[0].crossStudy.otherTotal,7);assert.equal(d.questionActivity['2026-10-03'].total,25);
});
test('manual equivalence merges whole existing groups and can be removed from a topic',()=>{
 const d=fixture();const linked=linkEquivalentTopics(d,{concursoId:'a',materiaId:'am',topicId:'at'},{concursoId:'c',materiaId:'cm',topicId:'ct'},'shared:test');assert.equal(linked.concursos[1].materias[0].topics[0].equivalenceKey,'shared:test');assert.equal(decorateConcurso(linked.concursos[1],buildPracticeIndex(linked.concursos)).materias[0].topics[0].crossStudy.total,125);assert.equal(d.concursos[0].materias[0].topics[0].equivalenceKey,undefined);const newEdital=makeConcurso('Novo',0);newEdital.materias=[{id:'new-m',name:'Português',topics:[{id:'new-t',name:'Crase e regência',status:'pendente'}]}];const all=[...linked.concursos,newEdital];assert.equal(decorateConcurso(newEdital,buildPracticeIndex(all)).materias[0].topics[0].crossStudy.otherTotal,125);
 const unlinked=removeManualEquivalence(linked,{concursoId:'c',materiaId:'cm',topicId:'ct'});assert.equal(compareEditais(unlinked.concursos[0],unlinked.concursos[2]).common.length,0);
});
test('skip is opt-in, reversible, preserves reviews and history without inventing study activity',()=>{
 const d=fixture();const today='2026-10-03';d.concursos[1].dailyPlans[today]=[{id:'card',materiaId:'bm',topicId:'bt',tipo:'novo',feito:false}];d.concursos[1].dailyPlans['2026-10-02']=[{id:'past',materiaId:'bm',topicId:'bt',tipo:'novo',feito:false}];
 const skipped=applySharedSkip(d,target,today);const t=skipped.concursos[1].materias[0].topics[0];assert.equal(t.status,'estudado');assert.equal(t.mastered,false);assert.equal(t.skippedFromShared,true);assert.equal(t.nextReviewDate,'2026-10-04');assert.deepEqual(skipped.activity,d.activity);assert.deepEqual(skipped.studyMinutes,d.studyMinutes);assert.deepEqual(skipped.questionActivity,d.questionActivity);assert.deepEqual(skipped.concursos[1].dailyPlans['2026-10-02'],d.concursos[1].dailyPlans['2026-10-02']);assert.ok(!skipped.concursos[1].dailyPlans[today].some(c=>c.tipo==='novo'&&!c.feito&&c.topicId==='bt'));validatePlanData(skipped);
 const restored=applySharedSkip(skipped,target,today,true);assert.equal(restored.concursos[1].materias[0].topics[0].status,'pendente');assert.equal(restored.concursos[1].materias[0].topics[0].skippedFromShared,undefined);
});
test('an unrelated or unpracticed topic cannot be skipped and optional fields are validated',()=>{
 const d=fixture();assert.equal(applySharedSkip(d,{concursoId:'c',materiaId:'cm',topicId:'ct'},'2026-10-03'),d);d.concursos[1].materias[0].topics[0].skippedFromShared='yes';assert.throws(()=>validatePlanData(d));delete d.concursos[1].materias[0].topics[0].skippedFromShared;d.concursos[1].materias[0].topics[0].equivalenceKey={};assert.throws(()=>validatePlanData(d));
});
