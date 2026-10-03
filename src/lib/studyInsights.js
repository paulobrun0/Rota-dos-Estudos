import { todayISO } from './date.js';
import { computeMateriaStats } from './materiaStats.js';

export function examScore(exam) {
  const rows = exam.rows || [];
  const total = rows.reduce((sum, row) => sum + row.total * (row.weight || 1), 0);
  const correct = rows.reduce((sum, row) => sum + row.correct * (row.weight || 1), 0);
  return { total, correct, percent: total ? Math.round(correct / total * 1000) / 10 : 0 };
}
export function sortedExams(concurso) {
  return [...(concurso?.simulados || [])].sort((a, b) => a.date.localeCompare(b.date));
}
export function reviewRows(concurso, today = todayISO()) {
  const plan = concurso?.dailyPlans?.[today] || [];
  return (concurso?.materias || []).flatMap(m => m.topics.filter(t => t.status === 'estudado' && !t.mastered).map(t => {
    const accuracy = t.questionsTotal ? Math.round((t.questionsCorrect || 0) / t.questionsTotal * 100) : null;
    const due = t.nextReviewDate && t.nextReviewDate <= today;
    const weak = accuracy !== null && accuracy < 70;
    return { ...t, materiaId: m.id, materiaName: m.name, accuracy, due: Boolean(due), weak,
      planned: plan.some(card => card.topicId === t.id), completedToday: plan.some(card => card.topicId === t.id && card.feito),
      priority: due ? 0 : weak ? 1 : 2 };
  })).sort((a, b) => a.priority - b.priority || (a.nextReviewDate || '9999').localeCompare(b.nextReviewDate || '9999') || (a.accuracy ?? 101) - (b.accuracy ?? 101));
}
export function concursoSummary(concurso) {
  const rows = computeMateriaStats(concurso);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const done = rows.reduce((s, r) => s + r.done, 0);
  const questions = rows.reduce((s, r) => s + r.questionsTotal, 0);
  const correct = rows.reduce((s, r) => s + r.questionsCorrect, 0);
  let estimatedMinutes = 0;
  for (const plan of Object.values(concurso?.dailyPlans || {})) {
    const groups = {};
    for (const card of plan) if (card.tipo === 'novo') groups[card.materiaId] = (groups[card.materiaId] || 0) + 1;
    for (const card of plan) if (card.feito) estimatedMinutes += card.tipo === 'revisao' ? 3 : (concurso.settings?.minutesPerMateria || 0) / (groups[card.materiaId] || 1);
  }
  return { rows, total, done, questions, correct, coverage: total ? Math.round(done / total * 100) : 0, accuracy: questions ? Math.round(correct / questions * 100) : null, estimatedMinutes: Math.round(estimatedMinutes) };
}
export function filterTopics(topics, { query = '', status = 'all', sort = 'original', today = todayISO() } = {}) {
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const needle = normalize(query.trim());
  const rows = topics.filter(t => normalize(t.name).includes(needle) && (status === 'all' || status === 'pending' && t.status !== 'estudado' || status === 'studied' && t.status === 'estudado' || status === 'due' && !t.mastered && t.nextReviewDate && t.nextReviewDate <= today));
  const accuracy = t => t.questionsTotal ? (t.questionsCorrect || 0) / t.questionsTotal : Infinity;
  if (sort === 'accuracy') rows.sort((a, b) => accuracy(a) - accuracy(b));
  if (sort === 'review') rows.sort((a, b) => (a.nextReviewDate || '9999').localeCompare(b.nextReviewDate || '9999'));
  if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return rows;
}
