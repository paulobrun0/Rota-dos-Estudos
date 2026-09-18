import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, defaultSettings, makeConcurso, makeEmptyCronograma, migrate } from "../src/data/model.js";

describe("defaultData", () => {
  test("has every top-level field the app reads, none missing", () => {
    const data = defaultData();
    assert.deepEqual(Object.keys(data).sort(), [
      "activeConcursoId", "activity", "concursos", "questionActivity", "studyDays", "studyMinutes",
    ]);
    assert.deepEqual(data.concursos, []);
    assert.equal(data.activeConcursoId, null);
    assert.equal(data.studyDays, null, "null = never configured, not an empty array");
  });
});

describe("makeConcurso", () => {
  test("a fresh concurso starts in ciclo mode with an empty cronograma and no cursor", () => {
    const c = makeConcurso("Meu concurso", 0);
    assert.equal(c.planMode, "ciclo");
    assert.equal(c.cycleCursor, null);
    assert.deepEqual(c.cronograma, makeEmptyCronograma());
    assert.deepEqual(c.settings, defaultSettings());
  });
});

describe("migrate", () => {
  test("unrecognized input falls back to a clean defaultData()", () => {
    assert.deepEqual(migrate(null), defaultData());
    assert.deepEqual(migrate({}), defaultData());
    assert.deepEqual(migrate({ foo: "bar" }), defaultData());
  });

  // Regression: a brand-new account's first save used to hand-list the
  // top-level fields it carried forward, which silently dropped any field
  // added after that list was written (studyDays, at the time) — every
  // future field needs to survive round-tripping through migrate() without
  // migrate() itself having to be updated for each one individually.
  test("a current-shape save round-trips through migrate with every field intact", () => {
    const data = defaultData();
    data.studyDays = ["seg", "ter", "qua"];
    data.concursos.push(makeConcurso("Concurso", 0));
    data.activeConcursoId = data.concursos[0].id;
    data.activity["2026-01-01"] = 3;
    data.studyMinutes["2026-01-01"] = 45;

    const migrated = migrate(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(migrated.studyDays, ["seg", "ter", "qua"]);
    assert.equal(migrated.activity["2026-01-01"], 3);
    assert.equal(migrated.studyMinutes["2026-01-01"], 45);
    assert.equal(migrated.concursos[0].name, "Concurso");
  });

  test("an old save from before studyMinutes/studyDays existed gets them filled in as defaults", () => {
    const legacy = {
      concursos: [{ id: "c1", name: "Antigo", materias: [], dailyPlans: {} }],
      activeConcursoId: "c1",
      activity: { "2026-01-01": 2 },
    };
    const migrated = migrate(legacy);
    assert.deepEqual(migrated.studyMinutes, {});
    assert.equal(migrated.studyDays, null);
    assert.deepEqual(migrated.questionActivity, {});
    assert.equal(migrated.activity["2026-01-01"], 2, "pre-existing data isn't touched");
  });

  test("an old save missing planMode/cronograma on a concurso gets ciclo defaults, not crashes", () => {
    const legacy = { concursos: [{ id: "c1", name: "Antigo", materias: [], dailyPlans: {} }], activeConcursoId: "c1" };
    const migrated = migrate(legacy);
    assert.equal(migrated.concursos[0].planMode, "ciclo");
    assert.deepEqual(migrated.concursos[0].cronograma, makeEmptyCronograma());
    assert.equal(migrated.concursos[0].cycleCursor, null);
  });

  test("the oldest single-concurso shape (no concursos array at all) gets wrapped into one", () => {
    const veryOld = {
      materias: [{ id: "m1", name: "Direito", topics: [] }],
      settings: { topicsPerDay: 3 },
      dailyPlans: { "2026-01-01": [] },
    };
    const migrated = migrate(veryOld);
    assert.equal(migrated.concursos.length, 1);
    assert.equal(migrated.concursos[0].materias[0].name, "Direito");
    assert.equal(migrated.concursos[0].settings.topicsPerDay, 3);
    assert.equal(migrated.activeConcursoId, migrated.concursos[0].id);
    assert.equal(migrated.studyDays, null);
  });
});
