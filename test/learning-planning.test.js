import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLearningPlan,planningHours,planningPreview} from '../src/lib/learningPlanning.js';
import {dailyCapacity} from '../src/lib/learningTools.js';

const hours=()=>Object.fromEntries(['dom','seg','ter','qua','qui','sex','sab'].map(d=>[d,1.4]));
const fixture=()=>({concursos:[{id:'c',name:'Meu edital',settings:{minutesPerMateria:30},materias:[
  {id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente',questionsTotal:40,questionsCorrect:30,history:[],tecLink:'https://www.tecconcursos.com.br/cadernos/1'}]},
  {id:'n',name:'Direito',topics:[{id:'u',name:'Atos',status:'pendente'}]}
]}],studyDays:['seg','ter','qua','qui','sex','sab','dom'],availableHoursPerWeek:10,activity:{},questionActivity:{},studyMinutes:{}});

test('initial availability matches the existing capacity and retains fractional hours and rest days',()=>{
  const data=fixture(),c=data.concursos[0];const h=planningHours(data,c);
  assert.equal(Math.round(h.seg*60),dailyCapacity(data,c,'2026-10-12'));
  data.studyPreferences={dailyHours:{seg:1.4,ter:0}};
  assert.equal(planningHours(data,c).seg,1.4);assert.equal(planningHours(data,c).ter,0);assert.equal(planningHours(data,c).qua,0);
});

test('configuration merges into the latest raw plan without replacing practice, links or other editais',()=>{
  const data=fixture(),draft=structuredClone(data.concursos[0]);
  draft.materias[0].learning={mode:'mixed',frequency:2};
  draft.materias[0].topics[0].crossStudy={total:999};draft.materias[0].topics[0].questionsTotal=999;
  draft.materias[0].topics[0].exerciseMinutes=25;
  data.concursos[0].materias[0].topics[0].questionsTotal=45;
  data.concursos.push({id:'other',name:'Outro',materias:[]});
  const before=JSON.stringify(data),next=applyLearningPlan(data,draft,hours()),t=next.concursos[0].materias[0].topics[0];
  assert.equal(t.questionsTotal,45);assert.equal(t.questionsCorrect,30);assert.equal(t.crossStudy,undefined);assert.equal(t.exerciseMinutes,25);assert.ok(t.tecLink);assert.deepEqual(t.history,[]);
  assert.equal(next.concursos[1],data.concursos[1]);assert.equal(JSON.stringify(data),before);
  assert.equal(next.studyPreferences.dailyHours.seg,1.4);assert.equal(next.availableHoursPerWeek,9.8);
  assert.equal(planningPreview(next,'c','2026-10-12').queue[0].kind,'theory');
});

test('invalid availability and unusable prerequisites fail with actionable errors',()=>{
  const data=fixture(),draft=structuredClone(data.concursos[0]);
  for(const value of ['',null,NaN,-1,25])assert.throws(()=>applyLearningPlan(data,draft,{...hours(),seg:value}),/0 a 24 horas/);
  draft.materias[1].learning={afterMateriaId:'m'};
  assert.throws(()=>applyLearningPlan(data,draft,hours()),/dependência de Direito/);
  draft.materias[0].learning={mode:'mixed'};assert.doesNotThrow(()=>applyLearningPlan(data,draft,hours()));
  draft.materias[0].learning.enabled=false;assert.throws(()=>applyLearningPlan(data,draft,hours()),/dependência de Direito/);
  draft.materias[0].learning={mode:'mixed',afterMateriaId:'n'};draft.materias[1].learning.mode='mixed';
  assert.throws(()=>applyLearningPlan(data,draft,hours()),/ciclo/);
});

test('preview explains rest days, exhausted time, oversized tasks and pending theory without mutating history',()=>{
  const data=applyLearningPlan(fixture(),fixture().concursos[0],{...hours(),ter:0});
  const before=JSON.stringify(data);assert.match(planningPreview(data,'c','2026-10-13').message,/folga/);
  data.studyPreferences.dailyHours.seg=0.1;assert.match(planningPreview(data,'c','2026-10-12').message,/pelo menos 30 min/);
  data.studyPreferences.dailyHours.seg=1;data.studySessions=[{concursoId:'c',date:'2026-10-12',minutes:60}];
  assert.match(planningPreview(data,'c','2026-10-12').message,/já foi utilizado/);
  data.studySessions=[];data.concursos[0].materias[0].learning={mode:'mixed'};data.concursos[0].materias[1].learning={afterMateriaId:'m'};
  const preview=planningPreview(data,'c','2026-10-12');assert.deepEqual(preview.blocked,['Direito']);assert.equal(preview.queue[0].kind,'theory');
  data.concursos[0].materias[0].topics[0].theoryDone=true;
  assert.equal(planningPreview(data,'c','2026-10-12').queue.length,2);
  assert.deepEqual(JSON.parse(before).questionActivity,data.questionActivity);
});
