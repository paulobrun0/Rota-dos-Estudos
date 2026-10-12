import {WEEKDAY_KEYS} from './planner.js';
import {addDaysISO} from './date.js';
import {dailyCapacity,learningCandidates,learningQueue} from './learningTools.js';
import {validatePlanData} from './planValidation.js';

export function planningHours(data,concurso) {
  return Object.fromEntries(WEEKDAY_KEYS.map((day,index)=>[day,
    data.studyPreferences?.dailyHours?.[day] ??
    Math.round(dailyCapacity(data,concurso,addDaysISO('2026-10-11',index))/60*100)/100
  ]));
}

// Apply configuration only, using the latest raw plan rather than a decorated
// UI snapshot. Counts, sessions, links and shared practice remain authoritative.
export function applyLearningPlan(data,draft,hours) {
  if(!data.concursos.some(c=>c.id===draft.id))throw Error('Este edital foi removido. Reabra o planejamento.');
  const dailyHours=Object.fromEntries(WEEKDAY_KEYS.map(day=>{
    const value=hours[day];
    if(value===''||value==null||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>24)
      throw Error(`Informe de 0 a 24 horas para ${day.toUpperCase()}. Use zero para folga.`);
    return [day,Number(value)];
  }));
  const concursos=data.concursos.map(c=>c.id!==draft.id?c:{...c,
    learningBalance:draft.learningBalance,
    materias:c.materias.map(m=>{
      const dm=draft.materias.find(item=>item.id===m.id);if(!dm)return m;
      return {...m,learning:dm.learning,topics:m.topics.map(t=>{
        const dt=dm.topics.find(item=>item.id===t.id);
        return dt?{...t,enabled:dt.enabled,theoryDone:dt.theoryDone,
          criticality:dt.criticality,exerciseMinutes:dt.exerciseMinutes}:t;
      })};
    })
  });
  const c=concursos.find(c=>c.id===draft.id);
  for(const m of c.materias){
    if(!m.learning?.afterMateriaId||m.learning.enabled===false)continue;
    const parent=c.materias.find(p=>p.id===m.learning.afterMateriaId);
    if(!parent||parent.learning?.enabled===false||parent.learning?.mode!=='mixed')
      throw Error(`Confira a dependência de ${m.name}: escolha uma matéria ativa com teoria ou selecione “Sem dependência”.`);
  }
  const next={...data,concursos,studyDays:WEEKDAY_KEYS.filter(day=>dailyHours[day]>0),
    availableHoursPerWeek:Math.round(Object.values(dailyHours).reduce((n,h)=>n+h,0)*1000000)/1000000||null,
    studyPreferences:{...data.studyPreferences,dailyHours}};
  validatePlanData(next);
  return next;
}

export function planningPreview(data,concursoId,date) {
  const c=data.concursos.find(c=>c.id===concursoId);
  const capacity=dailyCapacity(data,c,date);
  const completed=(data.studySessions||[]).filter(s=>s.concursoId===concursoId&&s.date===date).reduce((n,s)=>n+s.minutes,0);
  const candidates=learningCandidates(data,concursoId,date),queue=learningQueue(data,concursoId,date);
  const blocked=c.materias.filter(m=>{
    if(m.learning?.enabled===false)return false;
    const parent=c.materias.find(p=>p.id===m.learning?.afterMateriaId);
    return parent?.learning?.mode==='mixed'&&parent.topics.some(t=>t.enabled!==false&&!(t.theoryDone??t.status==='estudado'));
  }).map(m=>m.name);
  const remaining=Math.max(0,capacity-completed);
  const message=!capacity?'Dia de folga. Informe horas neste dia ou escolha outra data.':
    !remaining?'O tempo deste dia já foi utilizado nas sessões registradas.':
    candidates.length&&!queue.length?`As tarefas disponíveis precisam de pelo menos ${Math.min(...candidates.map(r=>r.minutes))} min. Restam ${remaining} min; aumente as horas ou ajuste a duração dos assuntos.`:
    !queue.length?'Nenhuma tarefa elegível nesta data. Confira os assuntos ativos, a teoria pendente e as datas das revisões.':'';
  return {capacity,completed,remaining,queue,blocked,message,waiting:candidates.length-queue.length};
}
