import { uid } from "./id.js";

// Which matérias are being worked on right now — starting at `cursorId` (a
// matéria id, persisted per concurso as concurso.cycleCursor) and wrapping
// around the list. The cursor stays put on a matéria until it's actually
// finished — see buildCyclePlan — so a bad day just means tomorrow picks up
// the exact same matéria where it left off, instead of the calendar moving
// on to whatever the rotation says is "due" next.
export function activeMateriaIds(materias, settings, cursorId) {
  if (materias.length === 0) return [];
  const raw = settings?.materiasPerDay || 0;
  const per = raw > 0 ? Math.min(raw, materias.length) : materias.length;
  let start = materias.findIndex((m) => m.id === cursorId);
  if (start === -1) start = 0;
  const ids = [];
  for (let i = 0; i < per; i++) {
    ids.push(materias[(start + i) % materias.length].id);
  }
  return ids;
}

// Estimated preview of which matérias would be active `dayOffset` days from
// now (0 = today, which is always exact — it's just activeMateriaIds).
// Days after that assume every active matéria gets fully finished on
// schedule, i.e. the cursor advances by a full window each day. It's only
// ever a display projection: the real cursor above only moves when a
// matéria is actually completed, so an off day just means the next real
// day looks like today instead of matching this preview.
export function projectActiveMateriaIds(materias, settings, cursorId, dayOffset) {
  if (materias.length === 0 || dayOffset === 0) return activeMateriaIds(materias, settings, cursorId);
  const raw = settings?.materiasPerDay || 0;
  const per = raw > 0 ? Math.min(raw, materias.length) : materias.length;
  let start = materias.findIndex((m) => m.id === cursorId);
  if (start === -1) start = 0;
  const projectedStart = (((start + dayOffset * per) % materias.length) + materias.length) % materias.length;
  const ids = [];
  for (let i = 0; i < per; i++) {
    ids.push(materias[(projectedStart + i) % materias.length].id);
  }
  return ids;
}

// A matéria's current batch — its "novo"/"revisão" cards in `cards` — is
// cleared once every card in it is done, meaning it's ready to drop out of
// the active window and let the cursor move past it.
function isMateriaCleared(materiaId, cards) {
  const batch = cards.filter((c) => c.materiaId === materiaId && (c.tipo === "novo" || c.tipo === "revisao"));
  return batch.length > 0 && batch.every((c) => c.feito);
}

// Picks up to `topicsPerDay` topics for a fresh batch: pending topics
// first; once none are left (every topic in the matéria has been studied
// at least once), falls back to a revisão pass over the whole matéria.
function pickBatch(m, topicsPerDay, usedTopicIds) {
  let candidates = m.topics.filter((t) => t.status === "pendente" && !usedTopicIds.has(t.id));
  let tipo = "novo";
  if (candidates.length === 0 && m.topics.length > 0) {
    candidates = m.topics.filter((t) => !usedTopicIds.has(t.id));
    tipo = "revisao";
  }
  return { topics: candidates.slice(0, topicsPerDay), tipo };
}

// Builds "today"'s plan from whatever carried over — cards not yet done,
// regardless of which earlier day they were first assigned — plus the
// current cycle cursor. Advances the cursor past any matéria whose batch is
// now fully cleared and gives newly-active matérias a fresh batch. Returns
// { cards, cursor }; the caller persists both onto the concurso.
export function buildCyclePlan(materias, settings, cursorId, carryOverCards) {
  const topicsPerDay = settings?.topicsPerDay || 0;
  if (topicsPerDay === 0 || materias.length === 0) return { cards: [], cursor: cursorId };

  // Keep every carried-over card whose topic still exists AND whose matéria
  // is still in the active window as of the incoming cursor (before this
  // call's own advancement, below, runs) — otherwise a topic finished and
  // dropped out of rotation days ago (or a matéria a metas change moved out
  // of rotation) would linger in the plan forever. This is why an unfinished
  // topic reappears tomorrow (its matéria is still the one at the cursor)
  // while a finished matéria's cards fall away once the cursor moves past it.
  const activeIdsAtStart = new Set(activeMateriaIds(materias, settings, cursorId));
  const cards = (carryOverCards || []).filter((c) => {
    const m = materias.find((x) => x.id === c.materiaId);
    const t = m?.topics.find((x) => x.id === c.topicId);
    return Boolean(t) && activeIdsAtStart.has(c.materiaId);
  });

  let cursor = cursorId;
  const usedTopicIds = new Set(cards.map((c) => c.topicId));

  // Advance past any matéria that's already fully cleared at the front of
  // the window — e.g. its last card got marked done and nothing has
  // rebuilt the plan since.
  for (let guard = 0; guard < materias.length; guard++) {
    const frontId = activeMateriaIds(materias, settings, cursor)[0];
    if (frontId === undefined) break;
    if (cards.some((c) => c.materiaId === frontId) && isMateriaCleared(frontId, cards)) {
      const idx = materias.findIndex((m) => m.id === frontId);
      cursor = materias[(idx + 1) % materias.length].id;
    } else {
      break;
    }
  }

  activeMateriaIds(materias, settings, cursor).forEach((materiaId) => {
    const already = cards.filter((c) => c.materiaId === materiaId && (c.tipo === "novo" || c.tipo === "revisao")).length;
    if (already > 0) return; // already has a batch — carried over, don't top it up mid-batch
    const m = materias.find((x) => x.id === materiaId);
    if (!m) return;
    const { topics, tipo } = pickBatch(m, topicsPerDay, usedTopicIds);
    topics.forEach((t) => {
      cards.push({ id: uid(), materiaId, topicId: t.id, tipo, feito: false });
      usedTopicIds.add(t.id);
    });
  });

  return { cards, cursor };
}
