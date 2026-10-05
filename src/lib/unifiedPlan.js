import { buildPracticeIndex, flattenEdital, sharedPractice } from './editalCompatibility.js';
import { studyPriority } from './studyPriorities.js';
import { advanceReview, scheduleFirstReview, weekdayKey, WEEKDAY_KEYS } from './planner.js';

const reference = row => ({ concursoId: row.concursoId, materiaId: row.materiaId, topicId: row.topicId });
const refId = row => JSON.stringify([row.concursoId, row.materiaId, row.topicId]);
const due = (topic, today) => topic.status === 'estudado' && !topic.mastered && (topic.nextReviewDate === undefined || (topic.nextReviewDate !== null && topic.nextReviewDate <= today));
const eligible = (topic, today) => topic.status === 'pendente' || due(topic, today);

export function unifiedCandidates(data, settings, today) {
  const ids = new Set(settings.concursoIds);
  const selected = data.concursos.filter(c => ids.has(c.id) && c.stage !== 'completed' && (!c.examDate || c.examDate >= today));
  const index = buildPracticeIndex(data.concursos, data.practiceArchive);
  const groups = new Map();
  for (const concurso of selected) {
    for (const row of flattenEdital(concurso)) {
      if (!row.key) continue;
      const key = index.aliases.get(row.key) || row.key;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }
  return [...groups].flatMap(([key, rows]) => {
    const targets = rows.filter(row => eligible(row.topic, today));
    if (!targets.length) return [];
    const tipo = targets.some(row => row.topic.status === 'pendente') ? 'novo' : 'revisao';
    const hasDueReview = targets.some(row => due(row.topic, today));
    const priority = Math.max(...targets.map(row => {
      const concurso = selected.find(c => c.id === row.concursoId);
      const materia = concurso.materias.find(m => m.id === row.materiaId);
      const days = concurso.examDate ? Math.max(0, Math.floor((Date.parse(concurso.examDate) - Date.parse(today)) / 86400000)) : null;
      return studyPriority(materia, { ...row.topic, crossStudy: sharedPractice(index, key, row.concursoId) }, today).score
        + (days === null ? 0 : 100 / (days + 1));
    }));
    return [{ key, tipo, hasDueReview, rows, refs: targets.map(reference), materiaName: targets[0].materiaName,
      topicName: targets[0].topic.name, concursoNames: [...new Set(rows.map(row => row.concursoName))],
      minutes: tipo === 'revisao' ? 3 : settings.minutesPerTopic, priority,
      deadline: selected.filter(c => rows.some(row => row.concursoId === c.id)).map(c => c.examDate).filter(Boolean).sort()[0] || null }];
  }).sort((a, b) => Number(b.hasDueReview) - Number(a.hasDueReview) || b.priority - a.priority || a.key.localeCompare(b.key));
}

export function buildUnifiedPlan(data, settings, today) {
  const ids = [...new Set(settings.concursoIds)].filter(id => data.concursos.some(c => c.id === id && c.stage !== 'completed' && (!c.examDate || c.examDate >= today)));
  if (ids.length < 2) throw new Error('Escolha pelo menos dois concursos em preparação e com prazo vigente.');
  if (!(data.availableHoursPerWeek > 0)) throw new Error('Informe suas horas disponíveis por semana.');
  if (!(settings.minutesPerTopic >= 5 && settings.minutesPerTopic <= 180)) throw new Error('Use de 5 a 180 minutos por assunto novo.');
  const days = [...new Set(data.studyDays ?? WEEKDAY_KEYS)];
  if (days.length && data.availableHoursPerWeek > days.length * 24) throw new Error('As horas semanais excedem o tempo dos dias de estudo configurados.');
  const budget = days.includes(weekdayKey(today)) ? Math.floor(data.availableHoursPerWeek * 60 / Math.max(1, days.length)) : 0;
  const done = (data.unifiedPlans?.[today]?.cards || []).filter(card => card.feito);
  const used = done.reduce((sum, card) => sum + card.minutes, 0);
  const previousDate = Object.keys(data.unifiedPlans || {}).filter(date => date < today).sort().at(-1);
  const carried = new Set((data.unifiedPlans?.[previousDate]?.cards || []).filter(card => !card.feito).map(card => card.key));
  const aliases = buildPracticeIndex(data.concursos, data.practiceArchive).aliases;
  const candidates = unifiedCandidates(data, { ...settings, concursoIds: ids }, today)
    .filter(card => !done.some(completed => (aliases.get(completed.key) || completed.key) === card.key));
  // Within each review/new-content category, unfinished work gets precedence.
  candidates.sort((a, b) => Number(b.hasDueReview) - Number(a.hasDueReview)
    || Number(carried.has(b.key)) - Number(carried.has(a.key)) || b.priority - a.priority || a.key.localeCompare(b.key));
  let remaining = Math.max(0, budget - used);
  const cards = [...done];
  for (const row of candidates) {
    if (row.minutes > remaining) continue;
    const { rows, priority, ...card } = row;
    cards.push({ ...card, id: JSON.stringify([today, card.key]), feito: false });
    remaining -= card.minutes;
  }
  return { concursoIds: ids, minutesBudget: budget, cards, remainingCandidates: candidates.length - (cards.length - done.length) };
}

export function saveUnifiedPlan(data, settings, today) {
  const plan = buildUnifiedPlan(data, settings, today);
  return { ...data, unifiedSettings: { ...settings, concursoIds: plan.concursoIds }, unifiedPlans: { ...data.unifiedPlans, [today]: plan } };
}

export function completeUnifiedCard(data, today, cardId, questions = { total: 0, correct: 0 }) {
  const card = data.unifiedPlans?.[today]?.cards.find(card => card.id === cardId);
  if (!card || card.feito) return data;
  if (!Number.isSafeInteger(questions.total) || !Number.isSafeInteger(questions.correct) || questions.total < 0 || questions.correct < 0 || questions.correct > questions.total) throw new Error('Informe quantidades válidas de questões e acertos.');
  const index = buildPracticeIndex(data.concursos, data.practiceArchive);
  const key = index.aliases.get(card.key) || card.key;
  const live = new Map(data.concursos.flatMap(flattenEdital).map(row => [refId(row), row]));
  const rows = card.refs.map(ref => live.get(refId(ref)));
  if (rows.some(row => !row || (index.aliases.get(row.key) || row.key) !== key)) throw new Error('Os assuntos ou vínculos mudaram. Gere o plano novamente.');
  if (rows.some(row => { const concurso = data.concursos.find(c => c.id === row.concursoId); return concurso.stage === 'completed' || (concurso.examDate && concurso.examDate < today); })) throw new Error('Um concurso deste estudo foi encerrado. Gere o plano novamente.');
  const targets = rows.filter(row => eligible(row.topic, today));
  if (!targets.length) throw new Error('Este estudo já foi concluído em outro plano. Gere o plano novamente.');
  const clone = structuredClone(data);
  const source = targets.find(row => row.topic.status === 'pendente') || targets[0];
  const sourceId = refId(source);
  const affected = new Set(targets.map(refId));
  for (const c of clone.concursos) {
    for (const row of flattenEdital(c)) {
      if (!affected.has(refId(row))) continue;
      const topic = row.topic, wasPending = topic.status === 'pendente';
      topic.status = 'estudado'; topic.mastered = false;
      if (wasPending) scheduleFirstReview(topic, today); else { advanceReview(topic, today); delete topic.skippedFromShared; }
      if (refId(row) === sourceId) {
        delete topic.skippedFromShared;
        topic.history ||= [];
        topic.history.push({ date: today, tipo: wasPending ? 'novo' : 'revisao', questionsTotal: questions.total, questionsCorrect: questions.correct });
        if (questions.total) {
          topic.questionsTotal = (topic.questionsTotal || 0) + questions.total;
          topic.questionsCorrect = (topic.questionsCorrect || 0) + questions.correct;
          topic.lastPracticeDate = [topic.lastPracticeDate || '', today].sort().at(-1);
        }
      } else if (wasPending) topic.skippedFromShared = true;
    }
    // Remove stale pending individual cards; do not invent one completion per
    // edital. Completed individual cards stay as their historical evidence.
    if (c.dailyPlans?.[today]) c.dailyPlans[today] = c.dailyPlans[today].filter(item => item.feito || !affected.has(JSON.stringify([c.id, item.materiaId, item.topicId])));
  }
  const savedCard = clone.unifiedPlans[today].cards.find(item => item.id === cardId);
  savedCard.feito = true; savedCard.source = reference(source);
  clone.activity ||= {}; clone.activity[today] = (clone.activity[today] || 0) + 1;
  clone.studyMinutes ||= {}; clone.studyMinutes[today] = Math.round(((clone.studyMinutes[today] || 0) + card.minutes) * 10) / 10;
  if (questions.total) {
    clone.questionActivity ||= {};
    const bucket = clone.questionActivity[today] || { total: 0, correct: 0 };
    clone.questionActivity[today] = { total: bucket.total + questions.total, correct: bucket.correct + questions.correct };
  }
  return clone;
}
