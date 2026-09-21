import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildStatsSeries, defaultRangeFor } from "../src/lib/statsRange.js";
import { addDaysISO, todayISO } from "../src/lib/date.js";

describe("defaultRangeFor", () => {
  test("dia looks back 29 days", () => {
    assert.deepEqual(defaultRangeFor("dia"), { start: addDaysISO(todayISO(), -29), end: todayISO() });
  });

  test("semana looks back 11 weeks (77 days)", () => {
    assert.deepEqual(defaultRangeFor("semana"), { start: addDaysISO(todayISO(), -77), end: todayISO() });
  });

  test("mes looks back 364 days", () => {
    assert.deepEqual(defaultRangeFor("mes"), { start: addDaysISO(todayISO(), -364), end: todayISO() });
  });

  test("ano looks back 4 years (1460 days)", () => {
    assert.deepEqual(defaultRangeFor("ano"), { start: addDaysISO(todayISO(), -1460), end: todayISO() });
  });

  test("personalizado has no default of its own — falls back to the dia lookback", () => {
    assert.deepEqual(defaultRangeFor("personalizado"), defaultRangeFor("dia"));
  });
});

describe("buildStatsSeries", () => {
  test("dia: one bucket per day, gaps filled with zero, labeled with the weekday", () => {
    // 2026-01-05/06/07 are Monday/Tuesday/Wednesday.
    const series = buildStatsSeries(
      { "2026-01-05": 2, "2026-01-07": 1 },
      {},
      { granularity: "dia", start: "2026-01-05", end: "2026-01-07" },
    );
    assert.deepEqual(series.map((s) => s.key), ["2026-01-05", "2026-01-06", "2026-01-07"]);
    assert.deepEqual(series.map((s) => s.cards), [2, 0, 1]);
    assert.deepEqual(series.map((s) => s.label), ["seg 05", "ter 06", "qua 07"]);
    assert.equal(series[1].accuracyPct, null, "no questions logged that day");
  });

  test("dia: question totals accumulate per day and accuracy is rounded", () => {
    const series = buildStatsSeries(
      {},
      { "2026-01-05": { total: 4, correct: 3 } },
      { granularity: "dia", start: "2026-01-05", end: "2026-01-05" },
    );
    assert.equal(series[0].questionsTotal, 4);
    assert.equal(series[0].questionsCorrect, 3);
    assert.equal(series[0].accuracyPct, 75);
  });

  test("semana: buckets by the Monday that starts each week, labeled DD/MM", () => {
    // 05 (Mon) and 08 (Thu) fall in the same week; 12 (next Mon) starts a new one.
    const series = buildStatsSeries(
      { "2026-01-05": 1, "2026-01-08": 2, "2026-01-12": 3 },
      {},
      { granularity: "semana", start: "2026-01-05", end: "2026-01-12" },
    );
    assert.deepEqual(series.map((s) => s.key), ["2026-01-05", "2026-01-12"]);
    assert.deepEqual(series.map((s) => s.cards), [3, 3]);
    assert.deepEqual(series.map((s) => s.label), ["05/01", "12/01"]);
  });

  test("mes: buckets by calendar month, labeled abbreviated month/year", () => {
    const series = buildStatsSeries(
      { "2026-01-15": 1, "2026-01-20": 2, "2026-02-01": 3 },
      {},
      { granularity: "mes", start: "2026-01-15", end: "2026-02-01" },
    );
    assert.deepEqual(series.map((s) => s.key), ["2026-01", "2026-02"]);
    assert.deepEqual(series.map((s) => s.cards), [3, 3]);
    assert.deepEqual(series.map((s) => s.label), ["jan/26", "fev/26"]);
  });

  test("ano: buckets by calendar year, labeled as the year itself", () => {
    const series = buildStatsSeries(
      { "2026-12-31": 1, "2027-01-01": 2 },
      {},
      { granularity: "ano", start: "2026-12-31", end: "2027-01-01" },
    );
    assert.deepEqual(series.map((s) => s.key), ["2026", "2027"]);
    assert.deepEqual(series.map((s) => s.cards), [1, 2]);
    assert.deepEqual(series.map((s) => s.label), ["2026", "2027"]);
  });

  test("personalizado: buckets per day like dia, but labels DD/MM with no weekday prefix", () => {
    const series = buildStatsSeries(
      { "2026-01-05": 5 },
      {},
      { granularity: "personalizado", start: "2026-01-05", end: "2026-01-05" },
    );
    assert.deepEqual(series, [{ key: "2026-01-05", label: "05/01", cards: 5, questionsTotal: 0, questionsCorrect: 0, accuracyPct: null }]);
  });
});
