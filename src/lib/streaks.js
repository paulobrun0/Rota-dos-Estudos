import { addDaysISO, fromISO, todayISO } from "./date.js";
import { weekdayKey } from "./planner.js";

// `studyDays` (array of weekday keys, e.g. ["seg","ter","qua","qui","sex"])
// is the user's declared week — any weekday NOT in it is an excused rest
// day: it neither adds to the streak nor breaks it, the count just carries
// on to the day before. null/undefined (never configured) or an empty list
// means every day counts, matching the original behavior.
function isRestDay(iso, studyDays) {
  return Array.isArray(studyDays) && studyDays.length > 0 && !studyDays.includes(weekdayKey(iso));
}

// Current streak (consecutive days with at least one card completed, rest
// days skipped over rather than counted or broken), not broken by "today"
// being still unstudied either — it only breaks once a full, non-rest day
// passes with zero activity. Also returns the longest streak on record.
export function computeStreaks(activity, studyDays) {
  const today = todayISO();
  let current = 0;
  let cursor = today;
  let isToday = true;
  // Keeps going while this day has activity, is still today (exempt either
  // way — the day isn't over), or is an excused rest day; the first day
  // that's none of those is a genuine miss and ends the streak right there.
  while ((activity[cursor] || 0) > 0 || isToday || isRestDay(cursor, studyDays)) {
    if ((activity[cursor] || 0) > 0) current++;
    isToday = false;
    cursor = addDaysISO(cursor, -1);
  }

  const days = Object.keys(activity).filter((k) => activity[k] > 0).sort();
  let longest = 0;
  let run = 0;
  let prevDay = null;
  days.forEach((d) => {
    if (prevDay) {
      // Bridge the gap between prevDay and d one day at a time — still the
      // same run if every day in between is an excused rest day, otherwise
      // the gap is real and the run restarts here.
      let cursor = addDaysISO(prevDay, 1);
      let bridged = true;
      while (cursor < d) {
        if (!isRestDay(cursor, studyDays)) { bridged = false; break; }
        cursor = addDaysISO(cursor, 1);
      }
      run = bridged && cursor === d ? run + 1 : 1;
    } else {
      run = 1;
    }
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
