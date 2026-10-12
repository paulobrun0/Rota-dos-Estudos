import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionNotebooks,tecQuestionUrl,addSessionReview} from '../src/lib/studySession.js';
import {completeLearningSession} from '../src/lib/learningTools.js';

const today='2026-10-12',ref={materiaId:'m',topicId:'t'};
const fixture=()=>({concursos:[{id:'c',name:'Meu edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente',questionsTotal:10,questionsCorrect:8}]}],settings:{minutesPerMateria:30}}],studyPreferences:{dailyHours:{seg:2}},activity:{},questionActivity:{},studyMinutes:{}});

test('session groups saved notebooks without duplicate links and puts the edital bank first',()=>{
 const topic={links:{tec:'https://www.tecconcursos.com.br/cadernos/1',qconcursos:'https://www.qconcursos.com/cadernos/2'},notebookLinks:[{id:'a',title:'FGV',bank:'FGV',url:'https://www.tecconcursos.com.br/cadernos/1'},{id:'b',title:'Cespe',bank:'Cebraspe',url:'https://www.tecconcursos.com.br/cadernos/3'},{id:'bad',url:'javascript:alert(1)'}]};
 const before=JSON.stringify(topic),books=sessionNotebooks(topic,'CEBRASPE');assert.equal(books.length,3);assert.equal(books[0].bank,'Cebraspe');assert.equal(new Set(books.map(n=>n.url)).size,3);assert.equal(JSON.stringify(topic),before);
});
test('TEC question IDs and individual links canonicalize to the same review URL',()=>{
 const expected='https://www.tecconcursos.com.br/questoes/1234567';
 for(const value of ['1234567',' 1234567 ',expected,'https://tecconcursos.com.br/questoes/1234567/?source=caderno#top'])assert.equal(tecQuestionUrl(value),expected);
 for(const value of ['',0,'0','1.5','-1','https://evil.test/questoes/12','https://www.tecconcursos.com.br.evil.test/questoes/12','https://user@www.tecconcursos.com.br/questoes/12','http://www.tecconcursos.com.br/questoes/12','https://www.tecconcursos.com.br/cadernos/12','javascript:alert(1)'])assert.throws(()=>tecQuestionUrl(value));
});
test('session reviews save separately, deduplicate per subject and restore archived entries without replacing history',()=>{
 const data=fixture(),before=JSON.stringify(data);const next=addSessionReview(data,'c',ref,'1234567','Rever a regra',today);
 assert.equal(next.externalReviews.length,1);assert.equal(next.externalReviews[0].note,'Rever a regra');assert.deepEqual(next.questionActivity,{});assert.deepEqual(next.activity,{});assert.equal(next.studySessions,undefined);assert.equal(JSON.stringify(data),before);
 assert.equal(addSessionReview(next,'c',ref,'https://tecconcursos.com.br/questoes/1234567/','Outra nota',today),next);
 next.externalReviews[0].archived=true;next.externalReviews[0].reviews=[{date:today,rating:'good'}];next.externalReviews[0].interval=3;
 const restored=addSessionReview(next,'c',ref,'1234567','',today);assert.equal(restored.externalReviews.length,1);assert.equal(restored.externalReviews[0].archived,false);assert.equal(restored.externalReviews[0].reviews.length,1);assert.equal(restored.externalReviews[0].interval,3);
 assert.throws(()=>addSessionReview(data,'c',{...ref,topicId:'removed'},'123','',today),/removido/);
});
test('manual session time overrides measured time once and invalid values never change progress',()=>{
 const data=fixture();const next=completeLearningSession(data,'c',ref,today,{total:5,correct:4,elapsedSeconds:125,minutes:90});
 assert.equal(next.studyMinutes[today],90);assert.equal(next.studySessions[0].elapsedSeconds,125);assert.equal(next.studySessions[0].minutes,90);assert.deepEqual(next.questionActivity[today],{total:5,correct:4});assert.equal(next.concursos[0].materias[0].topics[0].questionsTotal,15);
 assert.equal(completeLearningSession(next,'c',ref,today,{total:5,correct:4,minutes:90}),next);
 for(const minutes of [0,-1,1.5,1441,NaN,'30'])assert.throws(()=>completeLearningSession(data,'c',ref,today,{total:5,correct:4,minutes}),/1440 minutos/);
 assert.deepEqual(data.studyMinutes,{});
});
