// Similar words alone do not prove equivalence. Automatic matches require the
// same normalized subject and discipline; explicit links handle other names.
export function normalizeStudyName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/, '')
    .replace(/[^a-z0-9+#%]+/g, ' ').trim();
}
function disciplineName(name) {
  const value = normalizeStudyName(name);
  return ['portugues', 'lingua portuguesa'].includes(value) ? 'lingua portuguesa' : value;
}
export function topicIdentity(materia, topic) {
  const discipline = disciplineName(materia.name), subject = normalizeStudyName(topic.name);
  return discipline && subject ? JSON.stringify([discipline, subject]) : null;
}
export function flattenEdital(concurso) {
  return (concurso?.materias || []).flatMap(materia => materia.topics.map(topic => ({
    concursoId: concurso.id, concursoName: concurso.name, materiaId: materia.id,
    materiaName: materia.name, topicId: topic.id, topic, key: topicIdentity(materia, topic),
  })));
}
export function buildPracticeIndex(concursos) {
  const rows = (concursos || []).flatMap(flattenEdital).filter(r => r.key);
  const parents = new Map();
  function root(key) {
    if (!parents.has(key)) parents.set(key, key);
    let result = key;
    while (parents.get(result) !== result) result = parents.get(result);
    while (parents.get(key) !== key) { const next = parents.get(key); parents.set(key, result); key = next; }
    return result;
  }
  for (const row of rows) {
    root(row.key);
    if (row.topic.equivalenceKey) parents.set(root(row.key), root(row.topic.equivalenceKey));
  }
  const index = new Map();
  for (const row of rows) {
    const key = root(row.key);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ ...row, key });
  }
  index.aliases = new Map([...parents.keys()].map(key => [key, root(key)]));
  return index;
}
export function sharedPractice(index, key, concursoId) {
  key = index.aliases.get(key) || key;
  const rows = index.get(key) || [];
  const others = rows.filter(r => r.concursoId !== concursoId);
  const sum = (items, field) => items.reduce((n, r) => n + (r.topic[field] || 0), 0);
  return { key, total: sum(rows, 'questionsTotal'), correct: sum(rows, 'questionsCorrect'),
    otherTotal: sum(others, 'questionsTotal'), otherCorrect: sum(others, 'questionsCorrect'),
    sources: [...new Set(others.filter(r => r.topic.questionsTotal > 0).map(r => r.concursoName))] };
}
export function decorateConcurso(concurso, index) {
  if (!concurso) return null;
  return { ...concurso, materias: concurso.materias.map(m => ({ ...m, topics: m.topics.map(t => ({
    ...t, crossStudy: sharedPractice(index, topicIdentity(m, t), concurso.id),
  })) })) };
}
export function compareEditais(a, b, index = buildPracticeIndex([a, b])) {
  const unique = c => new Map(flattenEdital(c).filter(r => r.key).map(r => { const key = index.aliases.get(r.key) || r.key; return [key, { ...r, key }]; }));
  const left = unique(a), right = unique(b);
  const common = [...left].filter(([key]) => right.has(key)).map(([key, row]) => ({ key, left: row, right: right.get(key) }));
  const percent = (n, d) => d ? Math.round(n / d * 1000) / 10 : 0;
  return { common, leftTotal: left.size, rightTotal: right.size,
    leftPercent: percent(common.length, left.size), rightPercent: percent(common.length, right.size),
    overlapPercent: percent(common.length, left.size + right.size - common.length),
    leftOnly: [...left].filter(([key]) => !right.has(key)).map(([, row]) => row),
    rightOnly: [...right].filter(([key]) => !left.has(key)).map(([, row]) => row) };
}
export function linkEquivalentTopics(data, left, right, equivalenceKey) {
  const index = buildPracticeIndex(data.concursos);
  const find = ref => [...index.values()].flat().find(r => r.concursoId === ref.concursoId && r.materiaId === ref.materiaId && r.topicId === ref.topicId);
  const a = find(left), b = find(right);
  if (!a || !b || a.concursoId === b.concursoId) throw new Error('Selecione assuntos de dois editais diferentes.');
  const keys = new Set([a.key, b.key]);
  return { ...data, concursos: data.concursos.map(c => ({ ...c, materias: c.materias.map(m => ({
    ...m, topics: m.topics.map(t => keys.has(index.aliases.get(topicIdentity(m, t)) || topicIdentity(m, t)) ? { ...t, equivalenceKey } : t),
  })) })) };
}

export function removeManualEquivalence(data, ref) {
  return { ...data, concursos: data.concursos.map(c => c.id !== ref.concursoId ? c : ({ ...c,
    materias: c.materias.map(m => m.id !== ref.materiaId ? m : ({ ...m, topics: m.topics.map(t => {
      if (t.id !== ref.topicId) return t;
      const copy = { ...t }; delete copy.equivalenceKey; return copy;
    }) })) })) };
}

export function topicQuestionTotals(topics) {
  const unique = new Map(topics.map(t => [t.crossStudy?.key || t, t]));
  return [...unique.values()].reduce((sum, t) => ({ total: sum.total + (t.crossStudy?.total ?? t.questionsTotal ?? 0), correct: sum.correct + (t.crossStudy?.correct ?? t.questionsCorrect ?? 0) }), { total: 0, correct: 0 });
}
