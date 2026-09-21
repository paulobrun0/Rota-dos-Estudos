import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeMateriaStats, computeTopicStats } from "../src/lib/materiaStats.js";

function concursoFixture() {
  return {
    materias: [
      {
        id: "m1",
        name: "Português",
        color: "#fff",
        topics: [
          { id: "t1", name: "Crase", status: "estudado", questionsTotal: 10, questionsCorrect: 8 },
          { id: "t2", name: "Regência", status: "pendente", questionsTotal: 0, questionsCorrect: 0 },
        ],
      },
      {
        id: "m2",
        name: "Direito",
        color: "#000",
        topics: [{ id: "t3", name: "Atos", status: "estudado", questionsTotal: 4, questionsCorrect: 1 }],
      },
    ],
    dailyPlans: {
      "2026-01-01": [
        { id: "c1", materiaId: "m1", topicId: "t1", tipo: "novo", feito: true },
        { id: "c2", materiaId: "m1", topicId: "t2", tipo: "novo", feito: false },
      ],
      "2026-01-02": [
        { id: "c3", materiaId: "m1", topicId: "t1", tipo: "revisao", feito: true },
        { id: "c4", materiaId: "m2", topicId: "t3", tipo: "novo", feito: true },
      ],
    },
  };
}

describe("computeMateriaStats", () => {
  test("a null concurso returns an empty array", () => {
    assert.deepEqual(computeMateriaStats(null), []);
  });

  test("computes total/done/pct and question totals per matéria", () => {
    const stats = computeMateriaStats(concursoFixture());
    const port = stats.find((s) => s.id === "m1");
    assert.equal(port.total, 2);
    assert.equal(port.done, 1);
    assert.equal(port.pct, 50);
    assert.equal(port.questionsTotal, 10);
    assert.equal(port.questionsCorrect, 8);
    assert.equal(port.accuracyPct, 80);
  });

  test("counts novo vs revisão completions across every day ever planned, not just the latest", () => {
    const stats = computeMateriaStats(concursoFixture());
    const port = stats.find((s) => s.id === "m1");
    // c1 (novo, feito) on day 1, c3 (revisao, feito) on day 2 — c2 (not feito) doesn't count.
    assert.equal(port.novoCount, 1);
    assert.equal(port.revisaoCount, 1);
  });

  test("a matéria with zero topics has pct 0 and null accuracy, not NaN", () => {
    const stats = computeMateriaStats({ materias: [{ id: "m1", name: "Vazia", color: "#fff", topics: [] }], dailyPlans: {} });
    assert.equal(stats[0].pct, 0);
    assert.equal(stats[0].accuracyPct, null);
  });
});

describe("computeTopicStats", () => {
  test("a null concurso returns an empty array", () => {
    assert.deepEqual(computeTopicStats(null), []);
  });

  test("only includes topics that actually have questions logged", () => {
    const stats = computeTopicStats(concursoFixture());
    assert.equal(stats.length, 2);
    assert.ok(!stats.some((s) => s.id === "t2"));
  });

  test("sorts weakest accuracy first", () => {
    const stats = computeTopicStats(concursoFixture());
    // t3: 1/4 = 25%, t1: 8/10 = 80%
    assert.deepEqual(stats.map((s) => s.id), ["t3", "t1"]);
  });

  test("ties in accuracy break by more total questions first", () => {
    const concurso = {
      materias: [
        {
          id: "m1",
          name: "M",
          color: "#fff",
          topics: [
            { id: "few", name: "Few", status: "estudado", questionsTotal: 2, questionsCorrect: 1 },
            { id: "many", name: "Many", status: "estudado", questionsTotal: 20, questionsCorrect: 10 },
          ],
        },
      ],
      dailyPlans: {},
    };
    const stats = computeTopicStats(concurso);
    assert.deepEqual(stats.map((s) => s.id), ["many", "few"]);
  });
});
