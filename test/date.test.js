import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, daysUntil, todayISO, weekStart } from "../src/lib/date.js";

describe("addDaysISO", () => {
  test("crosses a month boundary correctly", () => {
    assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  });

  test("crosses a year boundary correctly", () => {
    assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  });

  test("handles a leap-day month correctly", () => {
    assert.equal(addDaysISO("2028-02-28", 1), "2028-02-29"); // 2028 is a leap year
    assert.equal(addDaysISO("2028-02-29", 1), "2028-03-01");
  });

  test("negative n goes backward", () => {
    assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
  });
});

describe("weekStart", () => {
  // Weeks are Monday-anchored here (matching how SemanaView actually lays
  // out its columns: SEG..DOM) — a distinct convention from WEEKDAY_KEYS in
  // planner.js, which is Sunday-first because it mirrors Date#getDay().
  test("a Monday's own week starts on itself", () => {
    // 2026-01-05 is a Monday.
    assert.equal(weekStart("2026-01-05"), "2026-01-05");
  });

  test("a mid-week day rolls back to that same week's Monday", () => {
    // 2026-01-07 is a Wednesday; that week's Monday is 2026-01-05.
    assert.equal(weekStart("2026-01-07"), "2026-01-05");
  });

  test("a Sunday rolls back to the Monday that started its week, not forward", () => {
    // 2026-01-04 is a Sunday — the end of the PREVIOUS week, not the start of a new one.
    assert.equal(weekStart("2026-01-04"), "2025-12-29");
  });
});

describe("daysUntil", () => {
  test("today is 0 days away from itself", () => {
    assert.equal(daysUntil(todayISO()), 0);
  });

  test("a future date is positive, a past date is negative", () => {
    assert.equal(daysUntil(addDaysISO(todayISO(), 10)), 10);
    assert.equal(daysUntil(addDaysISO(todayISO(), -10)), -10);
  });
});
