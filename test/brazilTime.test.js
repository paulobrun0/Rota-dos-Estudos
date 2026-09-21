import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BRAZIL_UTC_OFFSET_HOURS, brazilIsoDaysAgo } from "../server/brazilTime.js";

describe("brazilIsoDaysAgo", () => {
  test("the offset is 3 hours (Brazil is UTC-3)", () => {
    assert.equal(BRAZIL_UTC_OFFSET_HOURS, 3);
  });

  // Regression: a plain `new Date().toISOString().slice(0, 10)` reads the
  // server's UTC calendar day, which rolls over to "tomorrow" 3 hours
  // before Brazil's own calendar day does — so late-evening Brazil time
  // (already past UTC midnight) used to compare against a cutoff that had
  // already moved on, silently dropping same-evening activity out of
  // /api/ranking's "day" bucket for good.
  test("late Brazil evening (already past UTC midnight) still resolves to Brazil's own, earlier calendar day", () => {
    // 2026-01-05 23:30 in Brazil = 2026-01-06 02:30 UTC.
    const ref = Date.UTC(2026, 0, 6, 2, 30);
    assert.equal(brazilIsoDaysAgo(0, ref), "2026-01-05");
  });

  test("once far enough into the UTC day, both clocks agree", () => {
    // 2026-01-06 10:00 in Brazil = 2026-01-06 13:00 UTC.
    const ref = Date.UTC(2026, 0, 6, 13, 0);
    assert.equal(brazilIsoDaysAgo(0, ref), "2026-01-06");
  });

  test("the exact rollover instant — one second apart lands on different Brazil days", () => {
    // 2026-01-06 02:59:59 UTC is still 2026-01-05 in Brazil...
    assert.equal(brazilIsoDaysAgo(0, Date.UTC(2026, 0, 6, 2, 59, 59)), "2026-01-05");
    // ...but 2026-01-06 03:00:00 UTC is already 2026-01-06 (midnight) in Brazil.
    assert.equal(brazilIsoDaysAgo(0, Date.UTC(2026, 0, 6, 3, 0, 0)), "2026-01-06");
  });

  test("n days ago is computed relative to Brazil's shifted day, not the raw UTC one", () => {
    // Same late-evening instant as above (Brazil day is still the 5th) —
    // 3 days before that is the 2nd, not the 3rd (which a UTC-first
    // subtraction would give, since UTC's own day was already the 6th).
    const ref = Date.UTC(2026, 0, 6, 2, 30);
    assert.equal(brazilIsoDaysAgo(3, ref), "2026-01-02");
  });

  test("with no reference argument, defaults to the real current time", () => {
    const today = brazilIsoDaysAgo(0);
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(brazilIsoDaysAgo(1) < today, "yesterday sorts before today as plain ISO strings");
  });
});
