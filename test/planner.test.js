import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO } from "../src/lib/date.js";
import {
  activeMateriaIds,
  buildCronogramaPlan,
  buildCyclePlan,
  pickDueReviews,
} from "../src/lib/planner.js";

const ANCHOR = "2026-01-01"; // any fixed date works — every test below passes `today` explicitly

function makeMateria(id, topicCount, { createdAt = "2020-01-01" } = {}) {
  return {
    id,
    name: `Materia ${id}`,
    createdAt,
    topics: Array.from({ length: topicCount }, (_, i) => ({
      id: `${id}-t${i}`,
      name: `${id} topic ${i}`,
      status: "pendente",
      questionsTotal: 0,
      questionsCorrect: 0,
    })),
  };
}

function settings(overrides = {}) {
  return { materiasPerDay: 0, topicsPerDay: 2, reviewsPerDay: 0, ...overrides };
}

function markDone(materia, topicId) {
  materia.topics.find((t) => t.id === topicId).status = "estudado";
}

// Mirrors App.jsx's refreshTodayPlan: a completed "novo" card and any
// `manual` card (a pulled-in review) don't ride along into the next day's
// carry-over — see the big comment on this in App.jsx for why that matters.
function rollover(cards) {
  return cards.filter((c) => !c.manual && !c.feito);
}

describe("buildCyclePlan", () => {
  test("topicsPerDay = 0 hands out no new novo cards", () => {
    const { cards } = buildCyclePlan([makeMateria("A", 3)], settings({ topicsPerDay: 0, reviewsPerDay: 0 }), null, [], ANCHOR);
    assert.deepEqual(cards, []);
  });

  // Regression: topicsPerDay = 0 used to bail out of the whole function
  // immediately, which also silently suppressed spaced reviews — pausing
  // new content for a day shouldn't also hide reviews that are due.
  test("topicsPerDay = 0 still surfaces spaced reviews — the two are independent", () => {
    const materias = [makeMateria("A", 0)];
    materias[0].topics = [
      { id: "A-t0", status: "estudado", nextReviewDate: ANCHOR, questionsTotal: 0, questionsCorrect: 0 },
    ];
    const { cards } = buildCyclePlan(materias, settings({ topicsPerDay: 0, reviewsPerDay: 3 }), null, [], ANCHOR);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].tipo, "revisao");
  });

  test("hands out exactly topicsPerDay fresh cards for the front matéria", () => {
    const { cards } = buildCyclePlan([makeMateria("A", 5)], settings({ topicsPerDay: 2 }), null, [], ANCHOR);
    assert.equal(cards.length, 2);
    assert.ok(cards.every((c) => c.materiaId === "A" && c.tipo === "novo" && !c.feito));
  });

  test("a matéria with fewer pending topics than the quota just gives what it has, no crash", () => {
    const { cards } = buildCyclePlan([makeMateria("A", 2)], settings({ topicsPerDay: 10 }), null, [], ANCHOR);
    assert.equal(cards.length, 2);
  });

  // Regression: increasing topicsPerDay mid-day used to never show up until
  // the next rebuild happened to re-run from scratch — `already > 0` alone
  // was enough to skip topping up entirely.
  test("increasing topicsPerDay mid-day tops up today's batch immediately", () => {
    const materias = [makeMateria("A", 5)];
    let { cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 1 }), null, [], ANCHOR);
    assert.equal(cards.length, 1);

    ({ cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 3 }), cursor, cards, ANCHOR));
    assert.equal(cards.filter((c) => c.tipo === "novo").length, 3);
  });

  // Regression: decreasing topicsPerDay mid-day silently did nothing —
  // today's already-assigned batch just sat there unchanged, which reads
  // as "the setting has no effect" from the user's side.
  test("decreasing topicsPerDay mid-day trims today's still-pending cards", () => {
    const materias = [makeMateria("A", 5)];
    let { cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 3 }), null, [], ANCHOR);
    assert.equal(cards.length, 3);

    ({ cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 1 }), cursor, cards, ANCHOR));
    assert.equal(cards.filter((c) => c.tipo === "novo").length, 1);
  });

  test("decreasing topicsPerDay never removes an already-completed card", () => {
    const materias = [makeMateria("A", 5)];
    let { cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 3 }), null, [], ANCHOR);
    cards[0].feito = true;
    markDone(materias[0], cards[0].topicId);

    ({ cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 1 }), cursor, cards, ANCHOR));
    const novo = cards.filter((c) => c.tipo === "novo");
    assert.equal(novo.length, 1, "trims down to the new quota");
    assert.equal(novo[0].feito, true, "but keeps the one that was already done");
  });

  test("decreasing below the number of already-completed cards leaves the done ones alone", () => {
    const materias = [makeMateria("A", 5)];
    let { cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 3 }), null, [], ANCHOR);
    cards.forEach((c) => { c.feito = true; markDone(materias[0], c.topicId); });

    ({ cards, cursor } = buildCyclePlan(materias, settings({ topicsPerDay: 1 }), cursor, cards, ANCHOR));
    assert.equal(cards.filter((c) => c.tipo === "novo").length, 3, "can't trim below what's already done");
  });

  // Regression: isMateriaCleared used to check whether TODAY's batch was
  // finished rather than whether the matéria had any pending topics left at
  // all, so "materiasPerDay = 1" (study one matéria fully before the next)
  // jumped to the next matéria after the very first small batch.
  test("a matéria stays the only active one across many days until it truly runs out of topics", () => {
    const materias = [makeMateria("A", 6), makeMateria("B", 3)];
    const s = settings({ topicsPerDay: 1, materiasPerDay: 1 });
    let cursor = null;
    let carry = [];
    let day = ANCHOR;

    for (let i = 0; i < 6; i++) {
      const { cards, cursor: next } = buildCyclePlan(materias, s, cursor, carry, day);
      cursor = next;
      assert.equal(cards.length, 1, `day ${i}: exactly one card`);
      assert.equal(cards[0].materiaId, "A", `day ${i}: still matéria A`);
      cards[0].feito = true;
      markDone(materias[0], cards[0].topicId);
      carry = rollover(cards);
      day = addDaysISO(day, 1);
    }

    const { cards } = buildCyclePlan(materias, s, cursor, carry, day);
    assert.equal(cards[0].materiaId, "B", "only rotates to B once A has no pending topics left");
  });

  test("a same-day decrease never breaks the multi-day matéria guarantee above", () => {
    const materias = [makeMateria("A", 6), makeMateria("B", 3)];
    let s = settings({ topicsPerDay: 3, materiasPerDay: 1 });
    let { cards, cursor } = buildCyclePlan(materias, s, null, [], ANCHOR);
    assert.equal(cards.length, 3);

    // Mid-day, the quota drops to 1 — trims down to 1 pending card.
    s = settings({ topicsPerDay: 1, materiasPerDay: 1 });
    ({ cards, cursor } = buildCyclePlan(materias, s, cursor, cards, ANCHOR));
    assert.equal(cards.length, 1, "trimmed to the new quota");
    assert.equal(cards[0].materiaId, "A");

    // Finish that one card, then walk the remaining 5 days at the new quota
    // — matéria A (6 topics, 1 done so far) must hold the rotation the
    // whole way, same as the plain multi-day test above.
    cards[0].feito = true;
    markDone(materias[0], cards[0].topicId);
    let carry = rollover(cards);
    let day = addDaysISO(ANCHOR, 1);
    for (let i = 0; i < 5; i++) {
      const { cards: dayCards, cursor: next } = buildCyclePlan(materias, s, cursor, carry, day);
      cursor = next;
      assert.equal(dayCards[0]?.materiaId, "A", `day ${i}: matéria A still holds the rotation`);
      dayCards.forEach((c) => { c.feito = true; markDone(materias[0], c.topicId); });
      carry = rollover(dayCards);
      day = addDaysISO(day, 1);
    }

    const { cards: finalCards } = buildCyclePlan(materias, s, cursor, carry, day);
    assert.equal(finalCards[0].materiaId, "B", "rotates to B once A is genuinely done");
  });

  test("cursor advances past a matéria with zero topics without looping forever", () => {
    const materias = [makeMateria("A", 0), makeMateria("B", 2)];
    const { cards } = buildCyclePlan(materias, settings({ topicsPerDay: 1, materiasPerDay: 1 }), null, [], ANCHOR);
    assert.equal(cards[0]?.materiaId, "B");
  });

  test("reviewsPerDay caps spaced-review cards and doesn't duplicate them on a same-day rebuild", () => {
    const materias = [makeMateria("A", 0)];
    materias[0].topics = [
      { id: "A-t0", status: "estudado", nextReviewDate: ANCHOR, questionsTotal: 0, questionsCorrect: 0 },
      { id: "A-t1", status: "estudado", nextReviewDate: ANCHOR, questionsTotal: 0, questionsCorrect: 0 },
      { id: "A-t2", status: "estudado", nextReviewDate: ANCHOR, questionsTotal: 0, questionsCorrect: 0 },
    ];
    const s = settings({ topicsPerDay: 0, reviewsPerDay: 2 });
    let { cards, cursor } = buildCyclePlan(materias, s, null, [], ANCHOR);
    assert.equal(cards.length, 2, "capped at reviewsPerDay");

    // Re-running the same day (e.g. toggling an unrelated card elsewhere)
    // must not pile on more review cards on top of the existing ones.
    ({ cards, cursor } = buildCyclePlan(materias, s, cursor, cards, ANCHOR));
    assert.equal(cards.length, 2);
  });
});

describe("buildCronogramaPlan", () => {
  const cronograma = { dom: [], seg: ["A"], ter: [], qua: ["A"], qui: [], sex: ["A"], sab: [] };

  test("only the matéria assigned to that weekday gets fresh cards", () => {
    const materias = [makeMateria("A", 5), makeMateria("B", 5)];
    // 2026-01-05 is a Monday ("seg").
    const { cards } = buildCronogramaPlan(materias, settings({ topicsPerDay: 2 }), cronograma, [], "2026-01-05");
    assert.equal(cards.length, 2);
    assert.ok(cards.every((c) => c.materiaId === "A"));
  });

  test("a day with no matéria assigned yields no novo cards", () => {
    const materias = [makeMateria("A", 5)];
    // 2026-01-04 is a Sunday ("dom"), unassigned in `cronograma` above.
    const { cards } = buildCronogramaPlan(materias, settings({ topicsPerDay: 2 }), cronograma, [], "2026-01-04");
    assert.equal(cards.filter((c) => c.tipo === "novo").length, 0);
  });

  test("decreasing topicsPerDay mid-day trims pending cards here too", () => {
    const materias = [makeMateria("A", 5)];
    let { cards } = buildCronogramaPlan(materias, settings({ topicsPerDay: 3 }), cronograma, [], "2026-01-05");
    assert.equal(cards.length, 3);

    ({ cards } = buildCronogramaPlan(materias, settings({ topicsPerDay: 1 }), cronograma, cards, "2026-01-05"));
    assert.equal(cards.filter((c) => c.tipo === "novo").length, 1);
  });
});

describe("activeMateriaIds", () => {
  test("materiasPerDay = 0 means every matéria is active", () => {
    const materias = [makeMateria("A", 1), makeMateria("B", 1), makeMateria("C", 1)];
    assert.deepEqual(activeMateriaIds(materias, settings({ materiasPerDay: 0 }), "A"), ["A", "B", "C"]);
  });

  test("a window wraps around the end of the list back to the start", () => {
    const materias = [makeMateria("A", 1), makeMateria("B", 1), makeMateria("C", 1)];
    assert.deepEqual(activeMateriaIds(materias, settings({ materiasPerDay: 2 }), "C"), ["C", "A"]);
  });

  test("an unknown cursor id falls back to the start of the list", () => {
    const materias = [makeMateria("A", 1), makeMateria("B", 1)];
    assert.deepEqual(activeMateriaIds(materias, settings({ materiasPerDay: 1 }), "does-not-exist"), ["A"]);
  });
});

describe("pickDueReviews", () => {
  function topic(id, { status = "estudado", nextReviewDate = "2026-01-01", total = 0, correct = 0 } = {}) {
    return { id, status, nextReviewDate, questionsTotal: total, questionsCorrect: correct };
  }

  test("sorts the weakest accuracy first, ahead of a merely more-overdue topic", () => {
    const materias = [{
      id: "A",
      topics: [
        topic("strong", { nextReviewDate: "2025-12-01", total: 10, correct: 9 }), // 90%, very overdue
        topic("weak", { nextReviewDate: "2026-01-01", total: 10, correct: 2 }), // 20%, barely due
      ],
    }];
    const due = pickDueReviews(materias, "2026-01-01", 2, new Set());
    assert.equal(due[0].topicId, "weak");
    assert.equal(due[1].topicId, "strong");
  });

  test("a topic with no question data yet sorts as if at 70%, not first and not last", () => {
    const materias = [{
      id: "A",
      topics: [
        topic("weak", { total: 10, correct: 1 }), // 10%
        topic("neutral", { total: 0, correct: 0 }), // no data -> treated as 70%
        topic("strong", { total: 10, correct: 10 }), // 100%
      ],
    }];
    const due = pickDueReviews(materias, "2026-01-01", 3, new Set());
    assert.deepEqual(due.map((d) => d.topicId), ["weak", "neutral", "strong"]);
  });

  test("respects the cap and excludes topics already used elsewhere today", () => {
    const materias = [{
      id: "A",
      topics: [topic("t1"), topic("t2"), topic("t3")],
    }];
    const due = pickDueReviews(materias, "2026-01-01", 1, new Set(["t1"]));
    assert.equal(due.length, 1);
    assert.notEqual(due[0].topicId, "t1");
  });

  test("a topic not yet due (nextReviewDate in the future) is excluded", () => {
    const materias = [{ id: "A", topics: [topic("t1", { nextReviewDate: "2026-06-01" })] }];
    assert.deepEqual(pickDueReviews(materias, "2026-01-01", 5, new Set()), []);
  });

  test("a topic with no nextReviewDate at all (pre-dates the review feature) counts as due", () => {
    const materias = [{ id: "A", topics: [{ id: "t1", status: "estudado", questionsTotal: 0, questionsCorrect: 0 }] }];
    const due = pickDueReviews(materias, "2026-01-01", 5, new Set());
    assert.equal(due.length, 1);
  });

  test("reviewsPerDay = 0 returns nothing regardless of what's due", () => {
    const materias = [{ id: "A", topics: [topic("t1")] }];
    assert.deepEqual(pickDueReviews(materias, "2026-01-01", 0, new Set()), []);
  });
});
