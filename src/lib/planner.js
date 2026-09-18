import { uid } from "./id.js";
import { addDaysISO, fromISO, todayISO } from "./date.js";

// Sunday-first, matching Date#getDay() — used to key a concurso's
// cronograma (see makeEmptyCronograma in data/model.js) and to look up
// which weekday a given ISO date falls on.
export const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function weekdayKey(iso) {
  return WEEKDAY_KEYS[fromISO(iso).getDay()];
}

// Days-after-completion before a topic comes back for review, doubling
// roughly every step (the spacing effect: each successful recall of the
// same material pushes the next one further out, since it's stuck better
// than last time). After the last step, a topic stops coming back on its
// own — five clean passes spread over a month is the point where it's
// counted as retained, not a schedule bug.
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30];

// Called the first time a topic is completed ("novo"): puts it on the
// schedule above, due tomorrow.
export function scheduleFirstReview(topic, today) {
  topic.reviewStep = 0;
  topic.nextReviewDate = addDaysISO(today, REVIEW_INTERVALS_DAYS[0]);
}

// Called when a scheduled review card (tipo "revisao") is completed:
// advances to the next, longer interval, or — past the last step — takes
// the topic off the schedule (nextReviewDate null) since it's considered
// retained at that point.
export function advanceReview(topic, today) {
  const nextStep = (topic.reviewStep ?? 0) + 1;
  topic.reviewStep = nextStep;
  topic.nextReviewDate = nextStep < REVIEW_INTERVALS_DAYS.length ? addDaysISO(today, REVIEW_INTERVALS_DAYS[nextStep]) : null;
}

// Which topics are due for a spaced review today, across every matéria in
// the concurso (not just whichever are in today's rotation window — the
// whole point is surfacing matérias that would otherwise sit untouched
// until their turn comes back around). Capped at `reviewsPerDay` and sorted
// weakest-accuracy-first (a topic under 70% correct cuts in line ahead of
// one that's merely more overdue), most-overdue as the tiebreaker — so on a
// day with more due than the cap, the leftover ones simply stay due (their
// nextReviewDate doesn't move) and surface again tomorrow ahead of anything
// newly due — spreading a backlog across the next several days instead of
// dumping it all on one, while making sure a genuinely weak topic isn't
// left waiting behind a strong one just because the strong one happens to
// be a day or two more overdue.
// A topic with no nextReviewDate at all (studied before this feature
// existed) counts as due, so old progress eventually enters the schedule
// instead of being invisible to review forever. A topic with no question
// data yet (never answered any) sorts as if at 70% — neither jumping the
// line nor getting stuck behind topics with a confirmed weakness.
export function pickDueReviews(materias, today, reviewsPerDay, usedTopicIds) {
  if (reviewsPerDay <= 0) return [];
  const due = [];
  for (const m of materias) {
    for (const t of m.topics) {
      if (t.status !== "estudado" || usedTopicIds.has(t.id)) continue;
      if (t.nextReviewDate === undefined || (t.nextReviewDate !== null && t.nextReviewDate <= today)) {
        const accuracyPct = t.questionsTotal > 0 ? Math.round((t.questionsCorrect / t.questionsTotal) * 100) : null;
        due.push({ materiaId: m.id, topicId: t.id, dueDate: t.nextReviewDate || "", accuracyPct });
      }
    }
  }
  due.sort((a, b) => {
    const scoreA = a.accuracyPct ?? 70;
    const scoreB = b.accuracyPct ?? 70;
    return scoreA !== scoreB ? scoreA - scoreB : a.dueDate.localeCompare(b.dueDate);
  });
  return due.slice(0, reviewsPerDay);
}

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

// A matéria is cleared — ready to drop out of the active window and let the
// cursor move past it — once it has no pending topics left anywhere, full
// stop. This deliberately does NOT look at today's assigned batch: when
// topicsPerDay is smaller than the matéria's total pending count (e.g. 1
// assunto/day into a matéria with 4), finishing that one small batch used to
// read as "cleared" even though 3 more pending topics hadn't been touched
// yet — which defeated "matérias por dia = 1" (study one matéria fully
// before the next), since the cursor would jump away after the very first
// day instead of staying until the matéria actually runs out of topics. A
// topic's status and its card's `feito` always flip together (see
// toggleCard), so "no pending topics" already implies any assigned batch is
// done too — nothing is lost by dropping the batch check.
function isMateriaCleared(m) {
  return !m.topics.some((t) => t.status === "pendente");
}

// Picks up to `topicsPerDay` pending topics for a fresh "novo" batch. A
// matéria with nothing pending left contributes nothing here — it's done
// with new content, and isMateriaCleared above already knows to treat that
// as cleared rather than stalling the rotation on it.
export function pickBatch(m, topicsPerDay, usedTopicIds) {
  const candidates = m.topics.filter((t) => t.status === "pendente" && !usedTopicIds.has(t.id));
  return { topics: candidates.slice(0, topicsPerDay), tipo: "novo" };
}

// A same-day decrease to topicsPerDay should show up today too, same as an
// increase — otherwise changing the number reads as "did nothing" until
// the matéria's batch finishes on its own. Only pending (not yet `feito`)
// cards are ever removed, and the newest-assigned ones go first, so a
// completed topic never disappears out from under the user just because
// the quota dropped. Mutates `cards` in place.
function trimExcessNovoCards(cards, materiaId, excessCount) {
  const pending = cards.filter((c) => c.materiaId === materiaId && c.tipo === "novo" && !c.feito);
  const removeIds = new Set(pending.slice(Math.max(0, pending.length - excessCount)).map((c) => c.id));
  for (let i = cards.length - 1; i >= 0; i--) {
    if (removeIds.has(cards[i].id)) cards.splice(i, 1);
  }
}

// Builds "today"'s plan from whatever carried over — cards not yet done,
// regardless of which earlier day they were first assigned — plus the
// current cycle cursor. Advances the cursor past any matéria whose batch is
// now fully cleared and gives newly-active matérias a fresh batch. Returns
// { cards, cursor }; the caller persists both onto the concurso.
export function buildCyclePlan(materias, settings, cursorId, carryOverCards, today = todayISO()) {
  const topicsPerDay = settings?.topicsPerDay || 0;
  if (topicsPerDay === 0 || materias.length === 0) return { cards: [], cursor: cursorId };

  // Keep every carried-over card whose topic still exists AND whose matéria
  // is still in the active window as of the incoming cursor (before this
  // call's own advancement, below, runs) — otherwise a topic finished and
  // dropped out of rotation days ago (or a matéria a metas change moved out
  // of rotation) would linger in the plan forever. This is why an unfinished
  // topic reappears tomorrow (its matéria is still the one at the cursor)
  // while a finished matéria's cards fall away once the cursor moves past it.
  // `manual` cards (added by hand from progresso, or pulled in early via
  // "puxar próxima matéria") deliberately live outside the rotation's normal
  // window, so they're kept regardless of activeIdsAtStart — otherwise the
  // very next rebuild (e.g. just switching tabs) would silently drop them.
  const activeIdsAtStart = new Set(activeMateriaIds(materias, settings, cursorId));
  const cards = (carryOverCards || []).filter((c) => {
    const m = materias.find((x) => x.id === c.materiaId);
    const t = m?.topics.find((x) => x.id === c.topicId);
    return Boolean(t) && (c.manual || activeIdsAtStart.has(c.materiaId));
  });

  let cursor = cursorId;
  const usedTopicIds = new Set(cards.map((c) => c.topicId));

  // Advance past any matéria that's already fully cleared at the front of
  // the window — e.g. its last card got marked done and nothing has
  // rebuilt the plan since, or it simply has no pending topics left at all.
  for (let guard = 0; guard < materias.length; guard++) {
    const frontId = activeMateriaIds(materias, settings, cursor)[0];
    if (frontId === undefined) break;
    const frontMateria = materias.find((m) => m.id === frontId);
    if (frontMateria && isMateriaCleared(frontMateria)) {
      const idx = materias.findIndex((m) => m.id === frontId);
      cursor = materias[(idx + 1) % materias.length].id;
    } else {
      break;
    }
  }

  activeMateriaIds(materias, settings, cursor).forEach((materiaId) => {
    // Tops up to (or trims down to) topicsPerDay rather than leaving today's
    // batch as-is — a mid-day change to "assuntos por matéria" (e.g. 2 → 5,
    // or 5 → 2) would otherwise never show up today, since a rebuild always
    // carries today's existing batch forward. See trimExcessNovoCards for
    // why a decrease only ever removes still-pending cards.
    const already = cards.filter((c) => c.materiaId === materiaId && c.tipo === "novo").length;
    const remaining = topicsPerDay - already;
    if (remaining < 0) {
      trimExcessNovoCards(cards, materiaId, -remaining);
      return;
    }
    if (remaining === 0) return;
    const m = materias.find((x) => x.id === materiaId);
    if (!m) return;
    // A matéria stamped with a future createdAt — see materiaCreationDate in
    // App.jsx — was added after today's plan already existed, so it waits
    // for that date's rebuild instead of jumping into today's rotation the
    // moment a slot opens up. A matéria created today (or earlier) is
    // unaffected regardless of whether progress already happened today —
    // that's the ordinary same-day cascade as the cursor slides through
    // matérias that were already part of the day's set from the start.
    if (m.createdAt > today) return;
    const { topics, tipo } = pickBatch(m, remaining, usedTopicIds);
    topics.forEach((t) => {
      cards.push({ id: uid(), materiaId, topicId: t.id, tipo, feito: false });
      usedTopicIds.add(t.id);
    });
  });

  // Spaced review runs across the whole concurso, independent of today's
  // rotation window — see pickDueReviews. Marked manual so a plain rebuild
  // (e.g. switching tabs) doesn't drop it just for belonging to a matéria
  // that isn't in today's window. The cap is reduced by review cards this
  // day's plan already has (from an earlier rebuild today, or carried over
  // still-pending from a previous day) — without that, rebuilding the same
  // day's plan more than once (which happens constantly: every toggleCard
  // call re-runs this) would keep adding more on top each time instead of
  // topping up to the daily total exactly once.
  const reviewsPerDay = settings?.reviewsPerDay ?? 0;
  const reviewsAlready = cards.filter((c) => c.tipo === "revisao").length;
  pickDueReviews(materias, today, Math.max(0, reviewsPerDay - reviewsAlready), usedTopicIds).forEach(({ materiaId, topicId }) => {
    cards.push({ id: uid(), materiaId, topicId, tipo: "revisao", feito: false, manual: true });
    usedTopicIds.add(topicId);
  });

  return { cards, cursor };
}

// The cronograma counterpart to buildCyclePlan: instead of a rotating
// cursor that only advances once a matéria is actually finished, which
// matéria(s) are "active" today is simply whatever the user assigned to
// today's weekday (see makeEmptyCronograma) — fixed, repeats every week,
// and doesn't care whether that matéria was ever touched before. A matéria
// with nothing pending left just contributes no "novo" cards (pickBatch
// already handles that), so its usual day quietly becomes review-only
// instead of stalling like an unfinished ciclo window would. There's no
// cursor to persist, so the return shape is just the cards.
export function buildCronogramaPlan(materias, settings, cronograma, carryOverCards, today = todayISO()) {
  if (materias.length === 0) return { cards: [] };
  const topicsPerDay = settings?.topicsPerDay || 0;

  const activeIds = (cronograma?.[weekdayKey(today)] || []).filter((id) => materias.some((m) => m.id === id));
  const activeIdsSet = new Set(activeIds);

  // Same carry-over rule as buildCyclePlan: a still-pending card survives
  // into today's plan if its matéria is today's assigned one, or it's
  // `manual` (added by hand, or a due spaced review — see buildCyclePlan's
  // own comment on this for why manual cards are exempt).
  const cards = (carryOverCards || []).filter((c) => {
    const m = materias.find((x) => x.id === c.materiaId);
    const t = m?.topics.find((x) => x.id === c.topicId);
    return Boolean(t) && (c.manual || activeIdsSet.has(c.materiaId));
  });
  const usedTopicIds = new Set(cards.map((c) => c.topicId));

  if (topicsPerDay > 0) {
    activeIds.forEach((materiaId) => {
      // Tops up to (or trims down to) topicsPerDay — see the matching
      // comment in buildCyclePlan for why a mid-day change in either
      // direction should show up today, not just tomorrow.
      const already = cards.filter((c) => c.materiaId === materiaId && c.tipo === "novo").length;
      const remaining = topicsPerDay - already;
      if (remaining < 0) {
        trimExcessNovoCards(cards, materiaId, -remaining);
        return;
      }
      if (remaining === 0) return;
      const m = materias.find((x) => x.id === materiaId);
      if (!m || m.createdAt > today) return;
      const { topics, tipo } = pickBatch(m, remaining, usedTopicIds);
      topics.forEach((t) => {
        cards.push({ id: uid(), materiaId, topicId: t.id, tipo, feito: false });
        usedTopicIds.add(t.id);
      });
    });
  }

  // Spaced review is identical to buildCyclePlan's — it runs across the
  // whole concurso regardless of which matéria today's weekday points to.
  const reviewsPerDay = settings?.reviewsPerDay ?? 0;
  const reviewsAlready = cards.filter((c) => c.tipo === "revisao").length;
  pickDueReviews(materias, today, Math.max(0, reviewsPerDay - reviewsAlready), usedTopicIds).forEach(({ materiaId, topicId }) => {
    cards.push({ id: uid(), materiaId, topicId, tipo: "revisao", feito: false, manual: true });
    usedTopicIds.add(topicId);
  });

  return { cards };
}
