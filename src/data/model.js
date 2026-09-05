import { uid } from "../lib/id.js";

export const PALETTE = ["#E8A33D", "#4FD1C5", "#E8615F", "#7C9CF0", "#C97FEF", "#6FCF97", "#F2A9C5", "#F0C419", "#5FB0E8", "#F0885A"];

export const defaultSettings = () => ({ materiasPerDay: 0, topicsPerDay: 2, minutesPerMateria: 30, restMinutes: 5 });

export const makeConcurso = (name, colorIndex) => ({
  id: uid(),
  name,
  color: PALETTE[colorIndex % PALETTE.length],
  materias: [],
  settings: defaultSettings(),
  dailyPlans: {},
  // Id of the matéria currently at the front of the study rotation — null
  // means "start from the top of the list". Progress-driven, not tied to a
  // calendar date: it only moves once that matéria's current batch of
  // topics is actually finished, so an unfinished day picks back up on the
  // same matéria instead of the calendar moving on to the next one.
  cycleCursor: null,
});

export const defaultData = () => ({ concursos: [], activeConcursoId: null, activity: {}, questionActivity: {} });

// Older single-concurso saves get wrapped into one concurso so nothing is lost.
export function migrate(raw) {
  if (raw && Array.isArray(raw.concursos)) {
    raw.concursos.forEach((c) => {
      c.settings = { ...defaultSettings(), ...(c.settings || {}) };
      if (c.cycleCursor === undefined) c.cycleCursor = null;
    });
    if (!raw.activity) raw.activity = {};
    if (!raw.questionActivity) raw.questionActivity = {};
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
    };
    return { concursos: [c], activeConcursoId: c.id, activity: {}, questionActivity: {} };
  }
  return defaultData();
}
