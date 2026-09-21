// Brazil is UTC-3 (no DST currently) and the VPS itself runs in UTC — shared
// by dailyReminder.js (converts a user's local reminder hour to UTC) and the
// /api/ranking route in index.js (needs "today" to mean the same calendar
// day a Brazilian user's browser would call "today", not the server's own
// UTC day).
export const BRAZIL_UTC_OFFSET_HOURS = 3;

// The calendar date `n` days before "now" as Brazil would read it off a
// clock, regardless of what timezone the server process itself runs in.
// `referenceMs` is only for tests — production calls always take the real
// current time.
//
// Plain `new Date().toISOString().slice(0, 10)` (UTC) runs about 3 hours
// AHEAD of Brazil's own calendar — UTC's day rolls over at what's still
// 21:00 the previous day in Brazil. Comparing that UTC date against dates
// the client keyed in its own (Brazil) local time — see todayISO in
// src/lib/date.js, which uses the browser's local getters — meant activity
// logged between 21:00 and 23:59 Brazil time got compared against a cutoff
// that had already rolled over to "tomorrow", and so silently dropped out
// of /api/ranking's "day" bucket for good (it's a fixed cutoff comparison;
// once missed, it never re-qualifies). Shifting the reference instant back
// by the offset before reading its date fixes that at the source.
export function brazilIsoDaysAgo(n = 0, referenceMs = Date.now()) {
  const shifted = new Date(referenceMs - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  shifted.setUTCDate(shifted.getUTCDate() - n);
  return shifted.toISOString().slice(0, 10);
}
