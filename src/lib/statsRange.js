import { addDaysISO, fromISO, toISO, todayISO, weekStart } from "./date.js";

export const GRANULARITIES = ["dia", "semana", "mes", "ano", "personalizado"];

// Default lookback window (in days, ending today) for each granularity when
// the user hasn't picked a custom range — long enough to show a meaningful
// trend at that resolution without the bucket count getting unwieldy.
const DEFAULT_LOOKBACK_DAYS = { dia: 29, semana: 7 * 11, mes: 364, ano: 365 * 4 };

const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_ABR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// The default [start, end] (both ISO, inclusive) for a granularity that
// isn't "personalizado" — which instead keeps whatever the user picked.
export function defaultRangeFor(granularity) {
  const end = todayISO();
  const days = DEFAULT_LOOKBACK_DAYS[granularity] ?? DEFAULT_LOOKBACK_DAYS.dia;
  return { start: addDaysISO(end, -days), end };
}

function monthKey(iso) {
  return iso.slice(0, 7);
}
function yearKey(iso) {
  return iso.slice(0, 4);
}

function bucketKeyFor(iso, granularity) {
  if (granularity === "semana") return weekStart(iso);
  if (granularity === "mes") return monthKey(iso);
  if (granularity === "ano") return yearKey(iso);
  return iso; // "dia" and "personalizado" both bucket by individual day
}

function labelFor(key, granularity) {
  if (granularity === "semana" || (granularity === "personalizado" && key.length === 10)) {
    const d = fromISO(key);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "dia") {
    const d = fromISO(key);
    return `${DIAS_ABR[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
  }
  if (granularity === "mes") {
    const [y, m] = key.split("-");
    return `${MESES_ABR[Number(m) - 1]}/${y.slice(2)}`;
  }
  if (granularity === "ano") return key;
  return key;
}

// Walks every ISO day in [start, end], accumulating `activity` (day -> cards
// done) and `questionActivity` (day -> {total, correct}) into ordered
// buckets sized by `granularity`. Days with no activity still produce a
// (zero-valued) bucket, so the chart's x-axis has no silent gaps.
export function buildStatsSeries(activity, questionActivity, { granularity, start, end }) {
  const effectiveGranularity = granularity === "personalizado" ? "dia" : granularity;
  const order = [];
  const byKey = new Map();

  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 3700) {
    const key = bucketKeyFor(cursor, effectiveGranularity);
    if (!byKey.has(key)) {
      byKey.set(key, { key, label: labelFor(key, granularity), cards: 0, questionsTotal: 0, questionsCorrect: 0 });
      order.push(key);
    }
    const bucket = byKey.get(key);
    bucket.cards += activity[cursor] || 0;
    const qa = questionActivity[cursor];
    if (qa) {
      bucket.questionsTotal += qa.total || 0;
      bucket.questionsCorrect += qa.correct || 0;
    }
    cursor = addDaysISO(cursor, 1);
    guard++;
  }

  return order.map((key) => {
    const b = byKey.get(key);
    const accuracyPct = b.questionsTotal > 0 ? Math.round((b.questionsCorrect / b.questionsTotal) * 100) : null;
    return { ...b, accuracyPct };
  });
}
