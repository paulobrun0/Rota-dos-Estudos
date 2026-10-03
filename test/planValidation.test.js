import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanData, isSafeStudyLink } from "../src/lib/planValidation.js";
import { defaultData, makeConcurso } from "../src/data/model.js";

test("accepts current plans and legacy single-concurso backups", () => {
  const concurso = makeConcurso("Meu concurso", 0);
  assert.doesNotThrow(() => validatePlanData({ ...defaultData(), concursos: [concurso], activeConcursoId: concurso.id }));
  assert.doesNotThrow(() => validatePlanData({ materias: [], dailyPlans: {} }));
});

test("rejects unrelated JSON, malformed nested lists and impossible question counts", () => {
  for (const value of [null, [], {}, { concursos: {} }, { materias: "oops" }, { concursos: [{ id: "c", name: "C", materias: null }] }, { concursos: [], questionActivity: { "2026-10-03": { total: 1, correct: 2 } } }]) {
    assert.throws(() => validatePlanData(value));
  }
});

test("links accept only web URLs and never script URLs or embedded credentials", () => {
  assert.equal(isSafeStudyLink("https://www.tecconcursos.com.br/cadernos/1"), true);
  assert.equal(isSafeStudyLink(""), true);
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com", "not a URL"]) assert.equal(isSafeStudyLink(value), false);
});
