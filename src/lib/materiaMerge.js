// Pure helpers behind App.jsx's edital-import flows (free-text bulk paste,
// content-bank import) — pulled out of App.jsx so they're plain functions a
// test can import directly, with no React/JSX involved.
import { PALETTE } from "../data/model.js";
import { addDaysISO, todayISO } from "./date.js";
import { uid } from "./id.js";
import { buildCronogramaPlan, buildCyclePlan } from "./planner.js";
import { normalizeMateriaName } from "./rawEditalParser.js";

// When the content bank has an entry for `materiaName`, reorders `topics` to
// follow the bank's order (TecConcursos's real caderno order) instead of
// whatever order the edital text or user typing produced — topics not found
// in the bank are left at the end, in their original relative order.
export function sortTopicsByBank(topics, materiaName, contentBank) {
  const bankEntry = contentBank && contentBank.find((b) => normalizeMateriaName(b.name) === normalizeMateriaName(materiaName));
  if (!bankEntry) return topics;
  const rank = new Map(bankEntry.topics.map((t, i) => [t.trim().toLowerCase(), i]));
  return [...topics].sort((a, b) => {
    const ra = rank.has(a.name.toLowerCase()) ? rank.get(a.name.toLowerCase()) : Infinity;
    const rb = rank.has(b.name.toLowerCase()) ? rank.get(b.name.toLowerCase()) : Infinity;
    return ra - rb;
  });
}

// The cycle only ever needs "whatever was left unfinished the last time the
// concurso had a plan" — this finds that, however many days back it was
// (the user might not have opened the app yesterday, or at all yet).
export function mostRecentPlanBefore(dailyPlans, iso) {
  const keys = Object.keys(dailyPlans).filter((k) => k < iso).sort();
  return keys.length > 0 ? dailyPlans[keys[keys.length - 1]] : null;
}

// Builds one day's plan for a concurso regardless of which planMode it's
// in — ciclo's rotating cursor, or cronograma's fixed weekday assignment.
// Always returns { cards, cursor } so callers can spread cycleCursor
// unconditionally; cronograma has no cursor of its own, so it just passes
// the concurso's existing one through untouched.
export function buildDayPlan(c, base, today) {
  if (c.planMode === "cronograma") {
    const { cards } = buildCronogramaPlan(c.materias, c.settings, c.cronograma, base, today);
    return { cards, cursor: c.cycleCursor };
  }
  return buildCyclePlan(c.materias, c.settings, c.cycleCursor, base, today);
}

// A matéria's createdAt decides (see buildCyclePlan's `m.createdAt > today`
// guard) whether it can join today's rotation the moment its turn arrives,
// or has to wait for tomorrow's rebuild. Today's own date is right when
// nothing real has been shown yet today — first-ever setup, or adding a
// matéria before opening "hoje" at all, but also a brand-new concurso whose
// only "plan" for today is the empty placeholder every fresh concurso starts
// with (dailyPlans[today] = [], set by the very first rebuild, before the
// user has added anything at all) — there's nothing there yet to disturb.
// Once today's plan has actual cards in it, though, a matéria added now is a
// genuine addition mid-session, not part of that plan's original set, so
// it's stamped tomorrow instead — guaranteed deferred regardless of whether
// a card happens to be done yet today.
export function materiaCreationDate(dailyPlans) {
  const today = todayISO();
  return dailyPlans[today]?.length > 0 ? addDaysISO(today, 1) : today;
}

// Shared by the free-text bulk importer and the content-bank importer: given
// {name, topics: [string]} entries, creates/reuses matérias by name and adds
// any topic not already present (case-insensitive), mutating `clone` in place.
export function mergeMateriaEntries(clone, entries, contentBank) {
  let count = 0;
  const createdAt = materiaCreationDate(clone.dailyPlans || {});
  entries.forEach(({ name, topics }) => {
    const materiaName = (name || "").trim();
    const topicNames = (topics || []).map((s) => s.trim()).filter(Boolean);
    if (!materiaName || topicNames.length === 0) return;
    let materia = clone.materias.find((m) => m.name.toLowerCase() === materiaName.toLowerCase());
    if (!materia) {
      materia = { id: uid(), name: materiaName, color: PALETTE[clone.materias.length % PALETTE.length], topics: [], createdAt };
      clone.materias.push(materia);
    }
    const existingNames = new Set(materia.topics.map((t) => t.name.toLowerCase()));
    topicNames.forEach((n) => {
      if (!existingNames.has(n.toLowerCase())) {
        existingNames.add(n.toLowerCase());
        materia.topics.push({ id: uid(), name: n, status: "pendente", mastered: false });
        count++;
      }
    });
    materia.topics = sortTopicsByBank(materia.topics, materiaName, contentBank);
  });
  return count;
}
