import { uid } from "./id.js";
import { daysSinceEpoch } from "./date.js";

// Which matérias get "novo" cards on a given day. Rotation always spans every
// registered matéria (no need to "activate" each one manually) — with
// materiasPerDay = N, day 0 gets matérias [0..N-1], day 1 gets [N..2N-1], and
// so on, wrapping back to the start once every matéria has had its turn.
export function rotationMateriaIds(materias, settings, iso) {
  if (materias.length === 0) return [];
  const raw = settings?.materiasPerDay || 0;
  const per = raw > 0 ? Math.min(raw, materias.length) : materias.length;
  const dayIdx = daysSinceEpoch(iso);
  const totalBlocks = Math.ceil(materias.length / per);
  const block = dayIdx % totalBlocks;
  const start = block * per;
  const ids = [];
  for (let i = 0; i < per; i++) {
    const idx = start + i;
    if (idx < materias.length) ids.push(materias[idx].id);
  }
  return ids;
}

// Builds one day's plan. A shared reservation set consumes each matéria's
// topics once; when that matéria is exhausted, its next appearance starts a
// new cycle instead of repeating topics in the same cycle.
export function buildDayPlan(materias, settings, iso, oldPlan, reserved) {
  const kept = [];
  const usedTopicIds = new Set();

  (oldPlan || [])
    .filter((c) => c.feito)
    .forEach((c) => {
      const m = materias.find((x) => x.id === c.materiaId);
      const t = m?.topics.find((x) => x.id === c.topicId);
      if (t) {
        kept.push({ ...c });
        usedTopicIds.add(c.topicId);
      }
    });

  const topicsPerDay = settings?.topicsPerDay || 0;
  const rotationIds = new Set(rotationMateriaIds(materias, settings, iso));
  if (topicsPerDay > 0) {
    materias.forEach((m) => {
      if (!rotationIds.has(m.id)) return;
      const already = kept.filter((c) => c.materiaId === m.id && c.tipo === "novo").length;
      const need = Math.max(0, topicsPerDay - already);
      if (need > 0) {
        let candidates = m.topics.filter((t) => t.status === "pendente" && !usedTopicIds.has(t.id) && !reserved?.has(t.id));
        let tipo = "novo";
        const cycleComplete = m.topics.length > 0 && m.topics.every((t) => reserved?.has(t.id));
        if (candidates.length === 0 && cycleComplete) {
          m.topics.forEach((t) => reserved.delete(t.id));
          candidates = m.topics.filter((t) => !usedTopicIds.has(t.id));
          tipo = "revisao";
        }
        candidates.slice(0, need).forEach((t) => {
          kept.push({ id: uid(), materiaId: m.id, topicId: t.id, tipo, feito: false });
          usedTopicIds.add(t.id);
          reserved?.add(t.id);
        });
      }
    });
  }

  return kept;
}
