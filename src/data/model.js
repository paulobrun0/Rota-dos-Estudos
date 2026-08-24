import { uid } from "../lib/id.js";
import { todayISO } from "../lib/date.js";

export const PALETTE = ["#E8A33D", "#4FD1C5", "#E8615F", "#7C9CF0", "#C97FEF", "#6FCF97", "#F2A9C5", "#F0C419", "#5FB0E8", "#F0885A"];

// rotationAnchor is the date the matéria rotation treats as "day one" — the
// first matéria in the list gets studied starting on this date. It defaults
// to today so a fresh (or freshly migrated) concurso always starts its
// rotation from the top of the list instead of an arbitrary offset.
export const defaultSettings = () => ({ materiasPerDay: 0, topicsPerDay: 2, minutesPerMateria: 30, restMinutes: 5, rotationAnchor: todayISO() });

export const makeConcurso = (name, colorIndex) => ({
  id: uid(),
  name,
  color: PALETTE[colorIndex % PALETTE.length],
  materias: [],
  settings: defaultSettings(),
  dailyPlans: {},
});

export const defaultData = () => ({ concursos: [], activeConcursoId: null, activity: {} });

// Older single-concurso saves get wrapped into one concurso so nothing is lost.
export function migrate(raw) {
  if (raw && Array.isArray(raw.concursos)) {
    raw.concursos.forEach((c) => {
      c.settings = { ...defaultSettings(), ...(c.settings || {}) };
    });
    if (!raw.activity) raw.activity = {};
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
    };
    return { concursos: [c], activeConcursoId: c.id, activity: {} };
  }
  return defaultData();
}
