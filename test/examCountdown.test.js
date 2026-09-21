import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { examCountdownInfo } from "../src/lib/examCountdown.js";
import { addDaysISO, todayISO } from "../src/lib/date.js";

describe("examCountdownInfo", () => {
  test("no exam date set returns null", () => {
    assert.equal(examCountdownInfo(null), null);
    assert.equal(examCountdownInfo(undefined), null);
  });

  test("today is the critical 'a prova é hoje!' case", () => {
    assert.deepEqual(examCountdownInfo(todayISO()), { text: "a prova é hoje!", level: "critical" });
  });

  test("a past exam date is level 'past'", () => {
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), -1)), { text: "prova já passou", level: "past" });
  });

  test("1 day away uses the singular 'dia'", () => {
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 1)), { text: "faltam 1 dia", level: "critical" });
  });

  test("2-7 days away stays 'critical' with the plural 'dias'", () => {
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 2)), { text: "faltam 2 dias", level: "critical" });
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 7)), { text: "faltam 7 dias", level: "critical" });
  });

  test("8-30 days away is level 'soon'", () => {
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 8)), { text: "faltam 8 dias", level: "soon" });
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 30)), { text: "faltam 30 dias", level: "soon" });
  });

  test("more than 30 days away is level 'normal'", () => {
    assert.deepEqual(examCountdownInfo(addDaysISO(todayISO(), 31)), { text: "faltam 31 dias", level: "normal" });
  });
});
