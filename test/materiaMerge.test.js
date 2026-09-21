import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildDayPlan, materiaCreationDate, mergeMateriaEntries, mostRecentPlanBefore, sortTopicsByBank } from "../src/lib/materiaMerge.js";
import { buildCronogramaPlan, buildCyclePlan } from "../src/lib/planner.js";
import { addDaysISO, todayISO } from "../src/lib/date.js";

describe("sortTopicsByBank", () => {
  test("reorders topics to match the bank's order, pushing unknown topics to the end", () => {
    const topics = [{ name: "Zulu" }, { name: "Alpha" }, { name: "Mystery" }];
    const bank = [{ name: "Fonética", topics: ["Alpha", "Zulu"] }];
    const sorted = sortTopicsByBank(topics, "Fonética", bank);
    assert.deepEqual(sorted.map((t) => t.name), ["Alpha", "Zulu", "Mystery"]);
  });

  test("matches a bank entry case-insensitively and ignoring its parenthetical qualifier", () => {
    const topics = [{ name: "B" }, { name: "A" }];
    const bank = [{ name: "Raciocínio Lógico (RLM)", topics: ["a", "b"] }];
    const sorted = sortTopicsByBank(topics, "raciocínio lógico", bank);
    assert.deepEqual(sorted.map((t) => t.name), ["A", "B"]);
  });

  test("no matching bank entry returns the exact same array, untouched", () => {
    const topics = [{ name: "Z" }, { name: "A" }];
    const result = sortTopicsByBank(topics, "Não Existe No Banco", []);
    assert.equal(result, topics);
  });
});

describe("mostRecentPlanBefore", () => {
  test("returns the plan from the most recent date strictly before iso", () => {
    const dailyPlans = { "2026-01-01": ["a"], "2026-01-03": ["b"] };
    assert.deepEqual(mostRecentPlanBefore(dailyPlans, "2026-01-05"), ["b"]);
  });

  test("ignores dates on or after iso", () => {
    const dailyPlans = { "2026-01-05": ["today"], "2026-01-06": ["future"] };
    assert.equal(mostRecentPlanBefore(dailyPlans, "2026-01-05"), null);
  });

  test("returns null when there is no earlier plan at all", () => {
    assert.equal(mostRecentPlanBefore({}, "2026-01-05"), null);
  });
});

describe("materiaCreationDate", () => {
  test("today, when today's plan doesn't exist yet", () => {
    assert.equal(materiaCreationDate({}), todayISO());
  });

  test("today, when today's plan exists but is still empty", () => {
    assert.equal(materiaCreationDate({ [todayISO()]: [] }), todayISO());
  });

  test("tomorrow, once today's plan already has real cards in it", () => {
    assert.equal(materiaCreationDate({ [todayISO()]: [{ id: "x" }] }), addDaysISO(todayISO(), 1));
  });
});

// Cards get a fresh uid() every time a plan is built, so two independently
// built plans never share card ids even when they're otherwise identical —
// strip ids before comparing "delegated to X" against "called X directly".
function withoutIds(cards) {
  return cards.map(({ id, ...rest }) => rest);
}

describe("buildDayPlan", () => {
  test("ciclo mode delegates straight to buildCyclePlan", () => {
    const materias = [{ id: "A", name: "A", createdAt: "2020-01-01", topics: [{ id: "t1", name: "T1", status: "pendente" }] }];
    const settings = { topicsPerDay: 1, materiasPerDay: 0, reviewsPerDay: 0 };
    const c = { planMode: "ciclo", materias, settings, cycleCursor: null };
    const direct = buildCyclePlan(materias, settings, null, [], "2026-01-01");
    const result = buildDayPlan(c, [], "2026-01-01");
    assert.deepEqual(withoutIds(result.cards), withoutIds(direct.cards));
    assert.equal(result.cursor, direct.cursor);
  });

  test("cronograma mode delegates to buildCronogramaPlan and passes the concurso's own cursor through untouched", () => {
    const materias = [{ id: "A", name: "A", createdAt: "2020-01-01", topics: [{ id: "t1", name: "T1", status: "pendente" }] }];
    const settings = { topicsPerDay: 1, materiasPerDay: 0, reviewsPerDay: 0 };
    const cronograma = { dom: [], seg: ["A"], ter: [], qua: [], qui: [], sex: [], sab: [] };
    const c = { planMode: "cronograma", materias, settings, cronograma, cycleCursor: "whatever-was-there" };
    // 2026-01-05 is a Monday ("seg").
    const direct = buildCronogramaPlan(materias, settings, cronograma, [], "2026-01-05");
    const result = buildDayPlan(c, [], "2026-01-05");
    assert.deepEqual(withoutIds(result.cards), withoutIds(direct.cards));
    assert.equal(result.cursor, "whatever-was-there", "cronograma has no cursor of its own — the concurso's existing one passes through");
  });
});

describe("mergeMateriaEntries", () => {
  function emptyClone() {
    return { materias: [], dailyPlans: {} };
  }

  test("creates a new matéria from an entry that doesn't exist yet", () => {
    const clone = emptyClone();
    const count = mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos", "Poderes"] }], []);
    assert.equal(count, 2);
    assert.equal(clone.materias.length, 1);
    assert.equal(clone.materias[0].name, "Direito");
    assert.deepEqual(clone.materias[0].topics.map((t) => t.name), ["Atos", "Poderes"]);
    assert.ok(clone.materias[0].topics.every((t) => t.status === "pendente" && t.mastered === false));
  });

  test("merges into an existing matéria by case-insensitive name instead of duplicating it", () => {
    const clone = emptyClone();
    mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos"] }], []);
    const count = mergeMateriaEntries(clone, [{ name: "DIREITO", topics: ["Poderes"] }], []);
    assert.equal(count, 1);
    assert.equal(clone.materias.length, 1, "no duplicate matéria created");
    assert.deepEqual(clone.materias[0].topics.map((t) => t.name), ["Atos", "Poderes"]);
  });

  test("a topic already present (case-insensitive) isn't added again and doesn't count", () => {
    const clone = emptyClone();
    mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos"] }], []);
    const count = mergeMateriaEntries(clone, [{ name: "Direito", topics: ["atos", "Poderes"] }], []);
    assert.equal(count, 1, "only Poderes is genuinely new");
    assert.equal(clone.materias[0].topics.length, 2);
  });

  test("an entry with a blank name or no real topics is skipped, not turned into an empty matéria", () => {
    const clone = emptyClone();
    const count = mergeMateriaEntries(
      clone,
      [{ name: "  ", topics: ["X"] }, { name: "Y", topics: ["  ", ""] }],
      [],
    );
    assert.equal(count, 0);
    assert.equal(clone.materias.length, 0);
  });

  test("applies the content bank's order to the merged topics when the matéria name matches a bank entry", () => {
    const clone = emptyClone();
    const bank = [{ id: 1, name: "Direito", topics: ["Poderes", "Atos"] }];
    mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos", "Poderes"] }], bank);
    assert.deepEqual(clone.materias[0].topics.map((t) => t.name), ["Poderes", "Atos"]);
  });

  test("stamps a new matéria with today's date while today's plan is still empty", () => {
    const clone = { materias: [], dailyPlans: { [todayISO()]: [] } };
    mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos"] }], []);
    assert.equal(clone.materias[0].createdAt, todayISO());
  });

  test("stamps a new matéria with tomorrow's date once today's plan already has real cards", () => {
    const clone = { materias: [], dailyPlans: { [todayISO()]: [{ id: "c1" }] } };
    mergeMateriaEntries(clone, [{ name: "Direito", topics: ["Atos"] }], []);
    assert.equal(clone.materias[0].createdAt, addDaysISO(todayISO(), 1));
  });
});
