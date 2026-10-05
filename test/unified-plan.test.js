import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedPlan, saveUnifiedPlan, completeUnifiedCard, unifiedCandidates } from '../src/lib/unifiedPlan.js';
import { buildPracticeIndex, decorateConcurso } from '../src/lib/editalCompatibility.js';
import { validatePlanData } from '../src/lib/planValidation.js';

const today='2026-10-05';
const settings={concursoIds:['a','b'],minutesPerTopic:30};
function fixture(){
 return {concursos:[
  {id:'a',name:'Tribunal',examDate:'2026-11-01',materias:[{id:'am',name:'Português',weight:2,topics:[{id:'at',name:'Crase',status:'pendente'},{id:'ax',name:'Pontuação',status:'pendente'}]}],dailyPlans:{[today]:[{id:'single',materiaId:'am',topicId:'at',tipo:'novo',feito:false}]}},
  {id:'b',name:'Prefeitura',examDate:'2026-12-01',materias:[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'1. Crase',status:'pendente'},{id:'bx',name:'Verbos',status:'pendente'}]}],dailyPlans:{}},
  {id:'c',name:'Outro',materias:[{id:'cm',name:'Português',topics:[{id:'ct',name:'Crase',status:'pendente'}]}]}
 ],activeConcursoId:'a',availableHoursPerWeek:3,studyDays:['seg','qua','sex'],activity:{},questionActivity:{},studyMinutes:{}};
}
test('common subjects appear once with all selected editais and exclusive content remains eligible',()=>{
 const d=fixture(),plan=buildUnifiedPlan(d,settings,today),candidates=unifiedCandidates(d,settings,today);
 assert.equal(plan.minutesBudget,60);assert.equal(plan.cards.length,2);assert.equal(plan.remainingCandidates,1);assert.equal(candidates.length,3);
 const common=plan.cards.find(card=>card.refs.length===2);assert.ok(common);assert.deepEqual(common.concursoNames,['Tribunal','Prefeitura']);assert.equal(common.refs.some(ref=>ref.concursoId==='c'),false);validatePlanData(saveUnifiedPlan(d,settings,today));
});
test('one completion records activity, minutes, history and questions once but covers selected equivalent pending topics',()=>{
 const d=fixture(),saved=saveUnifiedPlan(d,settings,today),card=saved.unifiedPlans[today].cards.find(card=>card.refs.length===2);
 const completed=completeUnifiedCard(saved,today,card.id,{total:10,correct:8});validatePlanData(completed);
 assert.equal(completed.activity[today],1);assert.equal(completed.studyMinutes[today],30);assert.deepEqual(completed.questionActivity[today],{total:10,correct:8});
 const [a,b,c]=completed.concursos;assert.equal(a.materias[0].topics[0].questionsTotal,10);assert.equal(a.materias[0].topics[0].history.length,1);assert.equal(b.materias[0].topics[0].questionsTotal,undefined);assert.equal(b.materias[0].topics[0].history,undefined);assert.equal(b.materias[0].topics[0].skippedFromShared,true);assert.equal(c.materias[0].topics[0].status,'pendente');
 for(const concurso of [a,b]){assert.equal(concurso.materias[0].topics[0].status,'estudado');assert.equal(concurso.materias[0].topics[0].nextReviewDate,'2026-10-06');}
 assert.deepEqual(a.dailyPlans[today],[]);assert.equal(decorateConcurso(b,buildPracticeIndex(completed.concursos)).materias[0].topics[0].crossStudy.total,10);
 assert.equal(completeUnifiedCard(completed,today,card.id,{total:10,correct:8}),completed);assert.equal(d.concursos[0].materias[0].topics[0].status,'pendente');
 const updated=saveUnifiedPlan(completed,settings,today);assert.deepEqual(updated.activity,completed.activity);assert.equal(updated.unifiedPlans[today].cards.filter(card=>card.feito).length,1);assert.ok(updated.unifiedPlans[today].cards.reduce((sum,card)=>sum+card.minutes,0)<=60);
});
test('review completion advances each due selected topic once, without changing a future review',()=>{
 const d=fixture();d.availableHoursPerWeek=0.3;
 for(const c of d.concursos){const t=c.materias[0].topics[0];t.status='estudado';t.nextReviewDate=today;t.reviewStep=0;}
 d.concursos[2].materias[0].topics[0].nextReviewDate='2026-10-20';
 const saved=saveUnifiedPlan(d,{...settings,concursoIds:['a','b','c']},today);const card=saved.unifiedPlans[today].cards[0];assert.equal(card.tipo,'revisao');assert.equal(card.minutes,3);assert.equal(card.refs.length,2);
 const completed=completeUnifiedCard(saved,today,card.id);assert.equal(completed.activity[today],1);assert.equal(completed.studyMinutes[today],3);assert.deepEqual(completed.questionActivity,{});
 assert.equal(completed.concursos[0].materias[0].topics[0].nextReviewDate,'2026-10-08');assert.equal(completed.concursos[1].materias[0].topics[0].reviewStep,1);assert.equal(completed.concursos[2].materias[0].topics[0].nextReviewDate,'2026-10-20');
});
test('daily budget respects rest days, insufficient time and preserves completed cards when reduced',()=>{
 const d=fixture();assert.equal(buildUnifiedPlan(d,settings,'2026-10-06').cards.length,0);
 d.availableHoursPerWeek=0.1;assert.equal(buildUnifiedPlan(d,settings,today).cards.length,0);d.studyDays=[];assert.equal(buildUnifiedPlan(d,settings,today).minutesBudget,0);
 d.availableHoursPerWeek=3;d.studyDays=['seg'];let saved=saveUnifiedPlan(d,settings,today);saved=completeUnifiedCard(saved,today,saved.unifiedPlans[today].cards[0].id);saved.studyDays=[];
 assert.equal(saveUnifiedPlan(saved,settings,today).unifiedPlans[today].cards.length,1);
});
test('review priority, weights, deadlines and carryover guide selection',()=>{
 const d=fixture();d.availableHoursPerWeek=1.5;d.concursos[1].materias[0].topics[1].status='estudado';d.concursos[1].materias[0].topics[1].nextReviewDate='2026-10-01';
 const plan=buildUnifiedPlan(d,settings,today);assert.equal(plan.cards[0].tipo,'revisao');assert.ok(plan.cards.reduce((sum,card)=>sum+card.minutes,0)<=plan.minutesBudget);
 d.availableHoursPerWeek=3;const saved=saveUnifiedPlan(d,settings,today);const next=buildUnifiedPlan(saved,settings,'2026-10-07');assert.equal(next.cards[0].tipo,'revisao');assert.ok(next.cards.some(card=>saved.unifiedPlans[today].cards.some(old=>old.key===card.key&&!old.feito)));
});
test('changed or deleted references cannot silently apply a stale plan and invalid quantities leave data unchanged',()=>{
 const d=saveUnifiedPlan(fixture(),settings,today),id=d.unifiedPlans[today].cards.find(card=>card.refs.length===2).id;
 const renamed=structuredClone(d);renamed.concursos[1].materias[0].topics[0].name='Outro assunto';assert.throws(()=>completeUnifiedCard(renamed,today,id),/mudaram/);
 const deleted=structuredClone(d);deleted.concursos.shift();assert.throws(()=>completeUnifiedCard(deleted,today,id),/mudaram/);
 assert.throws(()=>completeUnifiedCard(d,today,id,{total:1,correct:2}),/válidas/);assert.deepEqual(d.activity,{});
});
test('manual equivalences merge different names and past or finished concursos are excluded',()=>{
 const d=fixture();d.concursos[0].materias[0].topics[0].equivalenceKey='shared:manual';d.concursos[1].materias[0].topics[0].name='Emprego da crase';d.concursos[1].materias[0].topics[0].equivalenceKey='shared:manual';
 assert.ok(buildUnifiedPlan(d,settings,today).cards.some(card=>card.refs.length===2));
 d.concursos[1].examDate='2026-10-04';assert.throws(()=>buildUnifiedPlan(d,settings,today),/dois concursos/);d.concursos[1].examDate=null;d.concursos[1].stage='completed';assert.throws(()=>buildUnifiedPlan(d,settings,today));
 assert.throws(()=>buildUnifiedPlan(fixture(),{...settings,minutesPerTopic:0},today));
});
test('malformed integrated plans cannot be imported or stored',()=>{
 const d=saveUnifiedPlan(fixture(),settings,today);
 for(const change of [x=>x.unifiedSettings.minutesPerTopic=181,x=>x.unifiedPlans[today].cards[0].feito='true',x=>x.unifiedPlans[today].cards[0].refs=[],x=>x.unifiedPlans[today].cards[0].minutes=-1,x=>x.unifiedPlans[today].cards[0].refs.push(x.unifiedPlans[today].cards[0].refs[0])]){const invalid=structuredClone(d);change(invalid);assert.throws(()=>validatePlanData(invalid));}
});

test('a mixed group receives review priority and stale closed editais cannot be completed',()=>{
 const d=fixture();d.concursos[1].materias[0].topics[0].status='estudado';d.concursos[1].materias[0].topics[0].nextReviewDate=today;d.availableHoursPerWeek=1.5;
 const saved=saveUnifiedPlan(d,settings,today),card=saved.unifiedPlans[today].cards[0];assert.equal(card.topicName,'Crase');assert.equal(card.hasDueReview,true);assert.equal(card.tipo,'novo');
 const completed=completeUnifiedCard(saved,today,card.id);assert.equal(completed.concursos[0].materias[0].topics[0].nextReviewDate,'2026-10-06');assert.equal(completed.concursos[1].materias[0].topics[0].nextReviewDate,'2026-10-08');
 saved.concursos[1].stage='completed';assert.throws(()=>completeUnifiedCard(saved,today,card.id),/encerrado/);
 const excessive=fixture();excessive.availableHoursPerWeek=100;assert.throws(()=>buildUnifiedPlan(excessive,settings,today),/excedem/);
});
