import { uid } from "../lib/id.js";

export const PALETTE = ["#E8A33D", "#4FD1C5", "#E8615F", "#7C9CF0", "#C97FEF", "#6FCF97", "#F2A9C5", "#F0C419", "#5FB0E8", "#F0885A"];

export const defaultSettings = () => ({ materiasPerDay: 0, topicsPerDay: 2, minutesPerMateria: 30, restMinutes: 5, reviewsPerDay: 3 });

// One entry per weekday key (see WEEKDAY_KEYS in lib/planner.js), each an
// array of matéria ids assigned to that day — empty means "day off" (no new
// topics that day, only whatever spaced reviews are due). Repeats every
// week, unlike the ciclo's progress-driven rotation.
export const makeEmptyCronograma = () => ({ dom: [], seg: [], ter: [], qua: [], qui: [], sex: [], sab: [] });

export const makeConcurso = (name, colorIndex) => ({
  id: uid(),
  name,
  color: PALETTE[colorIndex % PALETTE.length],
  // ISO date (YYYY-MM-DD) or null — drives the "faltam N dias" countdown.
  examDate: null,
  materias: [],
  settings: defaultSettings(),
  dailyPlans: {},
  // Id of the matéria currently at the front of the study rotation — null
  // means "start from the top of the list". Progress-driven, not tied to a
  // calendar date: it only moves once that matéria's current batch of
  // topics is actually finished, so an unfinished day picks back up on the
  // same matéria instead of the calendar moving on to the next one.
  cycleCursor: null,
  // "ciclo" (default) rotates through matérias by progress, ignoring the
  // calendar — see cycleCursor above. "cronograma" instead fixes which
  // matéria(s) are active on each weekday, repeating every week regardless
  // of progress — see cronograma below and buildCronogramaPlan.
  planMode: "ciclo",
  cronograma: makeEmptyCronograma(),
});

// null means "never configured" — every day counts (today's actual
// behavior), and AjustesView/App.jsx use that to show a one-time nudge to
// set it up. Once set, it's an array of weekday keys the user studies on
// (see WEEKDAY_KEYS in lib/planner.js) — any day left out is an excused
// rest day that skips the streak instead of breaking it.
export const defaultData = () => ({ concursos: [], activeConcursoId: null, activity: {}, questionActivity: {}, studyDays: null });

// Older single-concurso saves get wrapped into one concurso so nothing is lost.
export function migrate(raw) {
  if (raw && Array.isArray(raw.concursos)) {
    raw.concursos.forEach((c) => {
      c.settings = { ...defaultSettings(), ...(c.settings || {}) };
      if (c.cycleCursor === undefined) c.cycleCursor = null;
      if (c.examDate === undefined) c.examDate = null;
      if (!c.planMode) c.planMode = "ciclo";
      c.cronograma = { ...makeEmptyCronograma(), ...(c.cronograma || {}) };
    });
    if (!raw.activity) raw.activity = {};
    if (!raw.questionActivity) raw.questionActivity = {};
    if (raw.studyDays === undefined) raw.studyDays = null;
    return raw;
  }
  if (raw && Array.isArray(raw.materias)) {
    const c = {
      id: uid(),
      name: "Meu concurso",
      color: PALETTE[0],
      materias: raw.materias,
      settings: { ...defaultSettings(), ...(raw.settings || {}) },
      dailyPlans: raw.dailyPlans || {},
      cycleCursor: raw.cycleCursor ?? null,
      planMode: raw.planMode || "ciclo",
      cronograma: { ...makeEmptyCronograma(), ...(raw.cronograma || {}) },
    };
    return { concursos: [c], activeConcursoId: c.id, activity: {}, questionActivity: {}, studyDays: null };
  }
  return defaultData();
}
