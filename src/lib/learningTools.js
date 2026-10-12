import { addDaysISO, weekStart } from './date.js';
import { buildPracticeIndex, decorateConcurso } from './editalCompatibility.js';
import { WEEKDAY_KEYS, weekdayKey } from './planner.js';
export const CRITICALITY = { critical:80, normal:70, low:60 };
export const topicRef = (materiaId,topicId) => JSON.stringify([materiaId,topicId]);
export function dailyCapacity(data,concurso,date) {
  if (data.studyPreferences?.dailyHours) return Math.round((data.studyPreferences.dailyHours[weekdayKey(date)] || 0)*60);
  const days=[...new Set(data.studyDays ?? WEEKDAY_KEYS)];
  if (!days.includes(weekdayKey(date))) return 0;
  return data.availableHoursPerWeek ? Math.floor(data.availableHoursPerWeek*60/Math.max(1,days.length)) : Math.max(30,(concurso.settings?.minutesPerMateria || 30)*(concurso.settings?.materiasPerDay || 1));
}
export function topicDiagnostics(concurso,data,today) {
  const sessions=[...(data.studySessions || []),...(data.questionEvents || [])];
  return concurso.materias.flatMap(m=>m.topics.map(t=>{
    const total=t.crossStudy?.total ?? t.questionsTotal ?? 0,correct=t.crossStudy?.correct ?? t.questionsCorrect ?? 0;
    const entries=sessions.filter(s=>s.concursoId===concurso.id&&s.materiaId===m.id&&s.topicId===t.id&&s.total>0).sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt || 0)-(b.createdAt || 0));
    const recent=entries.slice(-3).reduce((a,s)=>({total:a.total+s.total,correct:a.correct+s.correct}),{total:0,correct:0});
    const threshold=CRITICALITY[t.criticality || 'normal'];
    const accuracy=total?Math.round(correct/total*100):null,recentAccuracy=recent.total?Math.round(recent.correct/recent.total*100):null;
    return {materia:m,topic:t,total,correct,accuracy,recentAccuracy,threshold,consolidated:total>=30&&accuracy>=70,
      alert:total>=10&&accuracy<threshold&&(recentAccuracy===null||recentAccuracy<threshold),
      overdue:Boolean(t.nextReviewDate&&t.nextReviewDate<today),entries};
  }));
}
export function adaptiveInterval({total,correct,criticality='normal',weight=1,step=0,examDate,today}) {
  const accuracy=total?correct/total:0.5;
  const grade=Math.round(Math.max(0,Math.min(100,accuracy*80+Math.min(total,30)/30*20)));
  let days=grade>=85?Math.min(30,3*2**Math.min(step,4)):grade>=65?3:1;
  if(criticality==='critical'||weight>=3) days=Math.max(1,Math.floor(days/2));
  if(examDate){const remaining=Math.floor((Date.parse(examDate)-Date.parse(today))/86400000);if(remaining>0)days=Math.min(days,Math.max(1,Math.floor(remaining/3)));}
  return {grade,days};
}
export function learningQueue(data,concursoId,today) {
  const raw=data.concursos.find(c=>c.id===concursoId);if(!raw)return [];
  const c=decorateConcurso(raw,buildPracticeIndex(data.concursos,data.practiceArchive));
  const done=new Set((data.studySessions || []).filter(s=>s.date===today&&s.concursoId===c.id).map(s=>topicRef(s.materiaId,s.topicId)));
  const rows=[];
  for(const m of c.materias){
    if(m.learning?.enabled===false)continue;
    const parent=c.materias.find(p=>p.id===m.learning?.afterMateriaId);
    if(parent&&parent.learning?.mode==='mixed'&&parent.topics.some(t=>t.enabled!==false&&!(t.theoryDone ?? t.status==='estudado')))continue;
    for(const t of m.topics){
      if(t.enabled===false||done.has(topicRef(m.id,t.id)))continue;
      const theory=m.learning?.mode==='mixed'&&!(t.theoryDone ?? t.status==='estudado');
      const due=t.status==='estudado'&&!t.mastered&&(t.nextReviewDate===undefined||(t.nextReviewDate&&t.nextReviewDate<=today));
      if(!theory&&t.status==='estudado'&&!due)continue;
      const kind=theory?'theory':due?'review':'questions';
      const total=t.crossStudy?.total ?? t.questionsTotal ?? 0,correct=t.crossStudy?.correct ?? t.questionsCorrect ?? 0;
      const minutes=kind==='review'?Math.min(30,t.exerciseMinutes || 15):t.exerciseMinutes || Math.max(15,Math.round((c.settings?.minutesPerMateria || 30)/Math.max(1,c.settings?.topicsPerDay || 1)));
      rows.push({materiaId:m.id,topicId:t.id,materiaName:m.name,topicName:t.name,kind,minutes,topic:t,
        score:(due?1000:0)+(t.criticality==='critical'?100:0)+(1-(total?correct/total:0.7))*100+(m.learning?.frequency || m.weight || 1)*15,
        frequency:m.learning?.frequency || 1});
    }
  }
  rows.sort((a,b)=>b.score-a.score);
  // Each round gives every discipline one turn, followed by the extra
  // turns configured by its relative frequency. Topics never repeat.
  const ordered=[],remaining=[...rows];
  while(remaining.length){
    const ids=[...new Set(remaining.map(r=>r.materiaId))];
    const frequency=new Map(ids.map(id=>[id,remaining.find(r=>r.materiaId===id).frequency]));
    for(let pass=0;pass<Math.max(...frequency.values());pass++)for(const id of ids){
      if(pass>=frequency.get(id))continue;const index=remaining.findIndex(r=>r.materiaId===id);
      if(index>=0)ordered.push(remaining.splice(index,1)[0]);
    }
  }
  const completedMinutes=(data.studySessions || []).filter(s=>s.date===today&&s.concursoId===c.id).reduce((n,s)=>n+s.minutes,0);
  let budget=Math.max(0,dailyCapacity(data,c,today)-completedMinutes);
  const newShare=c.learningBalance?.newPercent ?? 50;
  let reviewBudget=Math.round(budget*(100-newShare)/100),newBudget=budget-reviewBudget;
  const selected=[];
  for(const row of ordered){if(row.minutes>budget)continue;const available=row.kind==='review'?reviewBudget:newBudget;if(row.minutes>available)continue;selected.push(row);budget-=row.minutes;if(row.kind==='review')reviewBudget-=row.minutes;else newBudget-=row.minutes;}
  // Unused reserved time can be filled by the other category.
  for(const row of ordered){if(selected.includes(row)||row.minutes>budget)continue;selected.push(row);budget-=row.minutes;}
  return selected;
}
export function completeLearningSession(data,concursoId,ref,today,result) {
  const sessionId=JSON.stringify([today,concursoId,ref.materiaId,ref.topicId]);
  if((data.studySessions || []).some(s=>s.id===sessionId))return data;
  const current=learningQueue(data,concursoId,today).find(r=>topicRef(r.materiaId,r.topicId)===topicRef(ref.materiaId,ref.topicId));
  if(!current)throw new Error('Esta tarefa mudou ou já foi registrada. Atualize a fila.');
  const {total=0,correct=0}=result;
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(correct)||total<0||correct<0||correct>total)throw new Error('Confira as quantidades de questões e acertos.');
  if(current.kind==='theory'&&total>0)throw new Error('Registre as questões na etapa de prática.');
  const clone=structuredClone(data),c=clone.concursos.find(c=>c.id===concursoId),m=c.materias.find(m=>m.id===ref.materiaId),t=m.topics.find(t=>t.id===ref.topicId);
  const id=JSON.stringify([today,concursoId,m.id,t.id]);
  clone.studySessions ||= [];
  if(clone.studySessions.some(s=>s.id===id))return data;
  const interval=adaptiveInterval({total,correct,criticality:t.criticality,weight:m.weight,step:t.reviewStep || 0,examDate:c.examDate,today});
  if(current.kind==='theory')t.theoryDone=true;
  else {
    t.status='estudado';t.mastered=false;delete t.skippedFromShared;t.reviewStep=current.kind==='review'?(t.reviewStep || 0)+1:0;
    t.nextReviewDate=addDaysISO(today,interval.days);
    t.history ||= [];t.history.push({date:today,tipo:current.kind==='review'?'revisao':'novo',questionsTotal:total,questionsCorrect:correct});
    if(total){t.questionsTotal=(t.questionsTotal || 0)+total;t.questionsCorrect=(t.questionsCorrect || 0)+correct;t.lastPracticeDate=today;
      clone.questionActivity ||= {};const b=clone.questionActivity[today] || {total:0,correct:0};clone.questionActivity[today]={total:b.total+total,correct:b.correct+correct};}
  }
  clone.studySessions.push({id,date:today,concursoId,materiaId:m.id,topicId:t.id,kind:current.kind,minutes:current.minutes,total,correct,createdAt:Date.now(),grade:current.kind==='theory'?null:interval.grade});
  clone.activity ||= {};clone.activity[today]=(clone.activity[today] || 0)+1;
  clone.studyMinutes ||= {};clone.studyMinutes[today]=(clone.studyMinutes[today] || 0)+current.minutes;
  if(c.dailyPlans?.[today])c.dailyPlans[today]=c.dailyPlans[today].filter(card=>card.feito||card.materiaId!==m.id||card.topicId!==t.id);
  return clone;
}
export function weeklyQuestionTotal(data,today){const start=weekStart(today);return Object.entries(data.questionActivity || {}).filter(([date])=>date>=start&&date<=today).reduce((n,[,b])=>n+b.total,0);}
export function reviewExternalEntry(data,id,rating,today) {
  if(!['again','hard','good','easy'].includes(rating))throw new Error('Avaliação inválida.');
  const clone=structuredClone(data),entry=clone.externalReviews?.find(e=>e.id===id);
  if(!entry)throw new Error('Questão não encontrada.');
  if(entry.lastReviewDate===today)return data;
  const old=entry.interval || 1,interval=rating==='again'?1:rating==='hard'?Math.max(1,Math.round(old*1.2)):rating==='good'?Math.max(3,old*2):Math.max(7,old*3);
  entry.interval=Math.min(120,interval);entry.nextReviewDate=addDaysISO(today,entry.interval);entry.lastReviewDate=today;
  entry.reviews ||= [];entry.reviews.push({date:today,rating});return clone;
}

export function reviewStudyMark(data,collection,id,rating,today){
  if(!['studyMarks','pdfAnnotations'].includes(collection))throw Error('Coleção inválida.');
  if(!['again','hard','good','easy'].includes(rating))throw Error('Avaliação inválida.');
  const entry=data[collection]?.find(m=>m.id===id);if(!entry||entry.archived||entry.lastReviewDate===today)return data;
  const interval=Math.min(120,rating==='again'?1:rating==='hard'?3:rating==='good'?Math.max(7,(entry.interval||1)*2):Math.max(14,(entry.interval||1)*3));
  return {...data,[collection]:data[collection].map(m=>m.id===id?{...m,interval,nextReviewDate:addDaysISO(today,interval),lastReviewDate:today}:m)};
}
