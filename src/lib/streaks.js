import { addDaysISO, fromISO, todayISO } from "./date.js";

// Current streak (consecutive days with at least one card completed), not
// broken by "today" being still unstudied — it only breaks once a full day
// passes with zero activity. Also returns the longest streak on record.
export function computeStreaks(activity) {
  const today = todayISO();
  let current = 0;
  let cursor = activity[today] > 0 ? today : addDaysISO(today, -1);
  while (activity[cursor] > 0) {
    current++;
    cursor = addDaysISO(cursor, -1);
  }
  const days = Object.keys(activity).filter((k) => activity[k] > 0).sort();
  let longest = 0;
  let run = 0;
  let prevDay = null;
  days.forEach((d) => {
    if (prevDay && addDaysISO(prevDay, 1) === d) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prevDay = d;
  });
  return { current, longest: Math.max(longest, current) };
}

// 18 weeks (Sun→Sat columns, oldest → newest) ending on the current week.
export function buildHeatmapWeeks(activity) {
  const today = todayISO();
  const todayDow = fromISO(today).getDay();
  const gridEnd = addDaysISO(today, 6 - todayDow); // upcoming Saturday
  const gridStart = addDaysISO(gridEnd, -7 * 18 + 1); // 18 weeks back, a Sunday
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 18; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push({ iso: cursor, count: activity[cursor] || 0, future: cursor > today });
      cursor = addDaysISO(cursor, 1);
    }
    weeks.push(days);
  }
  return weeks;
}

export function heatLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}
