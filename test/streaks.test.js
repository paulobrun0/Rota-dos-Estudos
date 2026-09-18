import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, todayISO } from "../src/lib/date.js";
import { weekdayKey } from "../src/lib/planner.js";
import { computeStreaks, heatLevel } from "../src/lib/streaks.js";

const today = () => todayISO();
const daysAgo = (n) => addDaysISO(today(), -n);

// computeStreaks reads the real wall-clock date internally (todayISO()),
// so every fixture here is built relative to "now" via daysAgo — that
// keeps the tests deterministic regardless of what day they actually run
// on, instead of hardcoding calendar dates that would eventually go stale.

describe("computeStreaks — no studyDays configured (every day counts)", () => {
  test("today having no activity yet doesn't break an ongoing streak", () => {
    const activity = { [daysAgo(1)]: 1, [daysAgo(2)]: 1, [daysAgo(3)]: 1 };
    assert.equal(computeStreaks(activity).current, 3);
  });

  test("a single real gap (non-rest day with zero activity) breaks the current streak", () => {
    const activity = { [daysAgo(1)]: 1, [daysAgo(3)]: 1 }; // daysAgo(2) is missing
    assert.equal(computeStreaks(activity).current, 1);
  });

  test("longest streak is the best historical run, independent of the current one", () => {
    const activity = {
      [daysAgo(10)]: 1, [daysAgo(9)]: 1, [daysAgo(8)]: 1, [daysAgo(7)]: 1, // a 4-day run, long past
      [daysAgo(1)]: 1, // today's run is only 1 day
    };
    const { current, longest } = computeStreaks(activity);
    assert.equal(current, 1);
    assert.equal(longest, 4);
  });

  test("zero activity anywhere means both streaks are zero", () => {
    assert.deepEqual(computeStreaks({}), { current: 0, longest: 0 });
  });
});

describe("computeStreaks — with studyDays configured", () => {
  // Finds a weekday NOT in `studyDays`, well in the past so the fixture
  // below is self-contained and doesn't need to also account for every day
  // between it and "today" — the longest-streak computation only ever
  // looks at the gap between two consecutive logged dates, never at today.
  function findPastRestDay(studyDays) {
    for (let back = 20; back <= 27; back++) {
      const iso = daysAgo(back);
      if (!studyDays.includes(weekdayKey(iso))) return iso;
    }
    throw new Error("no rest day found in the lookback window — studyDays covers every day");
  }

  test("a declared rest day bridges the gap between two logged days into one run", () => {
    const studyDays = ["seg", "ter", "qua", "qui", "sex"]; // no weekend
    const restDay = findPastRestDay(studyDays);
    const before = addDaysISO(restDay, -1);
    const after = addDaysISO(restDay, 1);
    const activity = { [before]: 1, [after]: 1 };
    const { longest } = computeStreaks(activity, studyDays);
    assert.equal(longest, 2, "both logged days count as one continuous run, bridged over the rest day");
  });

  test("a gap wide enough to include a real study day does not bridge", () => {
    const studyDays = ["seg", "ter", "qua", "qui", "sex"];
    // 10 days apart is guaranteed to span at least one real (non-weekend)
    // study day in between, no matter how the weekdays happen to line up.
    const activity = { [daysAgo(30)]: 1, [daysAgo(20)]: 1 };
    const { longest } = computeStreaks(activity, studyDays);
    assert.equal(longest, 1, "a real gap starts a new run instead of bridging");
  });

  test("a real miss on an actual study day still breaks the streak even with studyDays set", () => {
    const studyDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]; // every day, but explicitly configured
    const activity = { [daysAgo(1)]: 1 }; // daysAgo(2), daysAgo(3) missing entirely
    // With every day a study day, a gap is a gap regardless of studyDays being set.
    const { current } = computeStreaks(activity, studyDays);
    assert.equal(current, 1);
  });

  test("null studyDays (never configured) behaves exactly like no studyDays argument", () => {
    const activity = { [daysAgo(1)]: 1, [daysAgo(2)]: 1 };
    assert.deepEqual(computeStreaks(activity, null), computeStreaks(activity));
  });

  test("an empty studyDays array also means every day counts", () => {
    const activity = { [daysAgo(1)]: 1, [daysAgo(2)]: 1 };
    assert.deepEqual(computeStreaks(activity, []), computeStreaks(activity));
  });
});

describe("heatLevel", () => {
  test("buckets a raw count into the 4 heat levels", () => {
    assert.equal(heatLevel(0), 0);
    assert.equal(heatLevel(1), 1);
    assert.equal(heatLevel(2), 1);
    assert.equal(heatLevel(3), 2);
    assert.equal(heatLevel(4), 2);
    assert.equal(heatLevel(5), 3);
    assert.equal(heatLevel(100), 3);
  });
});
