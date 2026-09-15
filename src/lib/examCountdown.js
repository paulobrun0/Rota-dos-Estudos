import { daysUntil } from "./date.js";

// Shared text + urgency level for a concurso's exam-date countdown, so every
// view that shows it (concursos list, dia header) agrees on the wording and
// on when it should look urgent — only the color mapping is per-view.
export function examCountdownInfo(examDate) {
  if (!examDate) return null;
  const n = daysUntil(examDate);
  if (n < 0) return { text: "prova já passou", level: "past" };
  if (n === 0) return { text: "a prova é hoje!", level: "critical" };
  if (n <= 7) return { text: `faltam ${n} dia${n !== 1 ? "s" : ""}`, level: "critical" };
  if (n <= 30) return { text: `faltam ${n} dias`, level: "soon" };
  return { text: `faltam ${n} dias`, level: "normal" };
}
