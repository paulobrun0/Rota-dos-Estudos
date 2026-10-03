import { buildPracticeIndex, sharedPractice, topicIdentity } from './editalCompatibility.js';
import { scheduleFirstReview } from './planner.js';
import { buildDayPlan } from './materiaMerge.js';
export function applySharedSkip(data, ref, today, undo = false) {
  if (!data) return data;
  const clone = structuredClone(data);
  const c = clone.concursos.find(c => c.id === ref.concursoId);
  const m = c?.materias.find(m => m.id === ref.materiaId);
  const t = m?.topics.find(t => t.id === ref.topicId);
  if (!t) return data;
  if (undo) {
    if (!t.skippedFromShared) return data;
    t.status = 'pendente'; t.reviewStep = 0; t.nextReviewDate = null;
    delete t.skippedFromShared;
  } else {
    const practice = sharedPractice(buildPracticeIndex(data.concursos), topicIdentity(m, t), c.id);
    if (t.status !== 'pendente' || practice.otherTotal <= 0) return data;
    t.status = 'estudado'; t.mastered = false; t.skippedFromShared = true;
    scheduleFirstReview(t, today);
  }
  if (c.dailyPlans?.[today]) {
    const base = c.dailyPlans[today].filter(card => card.topicId !== t.id || card.materiaId !== m.id || card.feito);
    const { cards, cursor } = buildDayPlan(c, base, today);
    c.dailyPlans[today] = cards; c.cycleCursor = cursor;
  }
  return clone;
}
