import { flattenEdital } from './editalCompatibility.js';

export const practiceSourceId = row => JSON.stringify([row.concursoId, row.materiaId, row.topicId]);

// Archive only sources that disappear. Live counters remain authoritative,
// including manual corrections; restoring the same source cannot count twice.
export function preservePractice(previous, next) {
  if (!previous || !next || previous === next) return next;
  const live = new Set(next.concursos.flatMap(flattenEdital).map(practiceSourceId));
  const archive = new Map((next.practiceArchive || []).map(row => [row.id, row]));
  for (const row of previous.concursos.flatMap(flattenEdital)) {
    const id = practiceSourceId(row);
    if (!live.has(id) && ((row.topic.questionsTotal || 0) > 0 || row.topic.history?.length)) {
      const topic = structuredClone(row.topic);
      delete topic.crossStudy;
      archive.set(id, { ...row, id, topic });
    }
  }
  for (const id of live) archive.delete(id);
  return { ...next, practiceArchive: [...archive.values()] };
}

export function practiceEvidence(practice, today) {
  const total = practice?.otherTotal || 0;
  const accuracy = total ? Math.round(practice.otherCorrect / total * 100) : null;
  const lastDate = practice?.lastOtherPracticeDate || null;
  const age = lastDate ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(lastDate)) / 86400000)) : null;
  const label = total < 20 ? 'Poucas questões: amplie a amostra' : accuracy < 80 ? 'Vale reforçar os erros' : age === null ? 'Boa amostra; data não registrada' : age > 30 ? 'Boa amostra; prática antiga' : 'Boa amostra e prática recente';
  return { total, accuracy, age, lastDate, label };
}
