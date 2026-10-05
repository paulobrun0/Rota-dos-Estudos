import { flattenEdital } from './editalCompatibility.js';

export function weightedCoverage(concurso, common, index) {
  const rows = new Map();
  for (const row of flattenEdital(concurso).filter(r => r.key)) {
    const key = index.aliases.get(row.key) || row.key;
    const materia = concurso.materias.find(m => m.id === row.materiaId);
    rows.set(key, Math.max(rows.get(key) || 0, materia.weight || 1));
  }
  const keys = new Set(common.map(row => row.key));
  const sum = [...rows.values()].reduce((a, b) => a + b, 0);
  return sum ? Math.round([...rows].reduce((n, [key, weight]) => n + (keys.has(key) ? weight : 0), 0) / sum * 1000) / 10 : 0;
}

export function conciliationForecast(left, right, index, today, hours, studyDays) {
  const pending = new Map();
  for (const concurso of [left, right]) {
    const minutes = (concurso.settings?.minutesPerMateria ?? 30) / Math.max(1, concurso.settings?.topicsPerDay ?? 2);
    for (const row of flattenEdital(concurso)) {
      if (!row.key || row.topic.status === 'estudado') continue;
      const key = index.aliases.get(row.key) || row.key;
      pending.set(key, Math.max(pending.get(key) || 0, minutes));
    }
  }
  const minutes = [...pending.values()].reduce((a, b) => a + b, 0);
  const dates = [left.examDate, right.examDate].filter(Boolean).sort();
  const deadline = dates[0] || null;
  const days = deadline ? Math.floor((Date.parse(deadline) - Date.parse(today)) / 86400000) : null;
  const capacity = days !== null && days > 0 && hours ? days / 7 * hours * 60 : null;
  const noStudyDays = Array.isArray(studyDays) && studyDays.length === 0;
  return { pending: pending.size, minutes, deadline, days,
    capacity: noStudyDays && capacity !== null ? 0 : capacity,
    fits: capacity === null ? null : !noStudyDays && minutes <= capacity,
    requiredHoursPerWeek: days > 0 ? Math.ceil(minutes / 60 * 7 / days * 10) / 10 : null };
}
