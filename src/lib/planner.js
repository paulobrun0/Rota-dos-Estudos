import { uid } from "./id.js";
import { daysSinceEpoch } from "./date.js";

// Which matérias get "novo" cards on a given day. Rotation always spans every
// registered matéria (no need to "activate" each one manually) — with
// materiasPerDay = N, day 0 (settings.rotationAnchor, normally the day the
// concurso started) gets matérias [0..N-1] in registration order, day 1 gets
// the next N, and so on, wrapping around the list (not just resetting to the
// end of it) so every day gets exactly N matérias even when the total isn't
// a multiple of N. Anchoring to a fixed start date — instead of days since
// the Unix epoch — is what makes the first matéria in the list actually be
// the first one studied, rather than landing on an arbitrary offset that
// depends on which absolute calendar day "today" happens to be.
export function rotationMateriaIds(materias, settings, iso) {
  if (materias.length === 0) return [];
  const raw = settings?.materiasPerDay || 0;
  const per = raw > 0 ? Math.min(raw, materias.length) : materias.length;
  const anchor = settings?.rotationAnchor || iso;
  const dayIdx = daysSinceEpoch(iso) - daysSinceEpoch(anchor);
  const start = (((dayIdx * per) % materias.length) + materias.length) % materias.length;
  const ids = [];
  for (let i = 0; i < per; i++) {
    const idx = (start + i) % materias.length;
    ids.push(materias[idx].id);
  }
  return ids;
}

// Builds one day's plan. A shared reservation set consumes each matéria's
// topics once; when that matéria is exhausted, its next appearance starts a
// new cycle instead of repeating topics in the same cycle.
export function buildDayPlan(materias, settings, iso, oldPlan, reserved) {
  const kept = [];
  const usedTopicIds = new Set();
  const rotationIds = new Set(rotationMateriaIds(materias, settings, iso));

  // Keep every card from the old plan whose topic still exists. This
  // function reruns on every topic status change anywhere in the concurso
  // (not just when this specific day is opened), so a not-yet-done card has
  // to survive that rerun with the same id and stay slotted into this same
  // day: otherwise completing one card regenerates its siblings with fresh
  // ids (breaking "mark as done" for whichever card the UI still has a
  // stale reference to) and unmarking a card can make its topic drop out of
  // today's plan entirely instead of just flipping back to pending. Done
  // cards are a record of what was actually studied and are always kept;
  // not-done cards are only kept if their matéria is still in today's
  // rotation (e.g. a metas change can legitimately move a matéria to a
  // different day, and a not-done card shouldn't survive that).
  (oldPlan || []).forEach((c) => {
    const m = materias.find((x) => x.id === c.materiaId);
    const t = m?.topics.find((x) => x.id === c.topicId);
    if (!t) return;
    if (!c.feito && !rotationIds.has(c.materiaId)) return;
    kept.push({ ...c });
    usedTopicIds.add(c.topicId);
    reserved?.add(c.topicId);
  });

  const topicsPerDay = settings?.topicsPerDay || 0;
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
