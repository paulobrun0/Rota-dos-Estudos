import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen, CalendarDays, ChevronRight, Flame, GraduationCap, ListChecks, Menu, Settings, ShieldCheck, Sparkles, Target, Trophy, UserCircle, X,
} from "lucide-react";
import { colors } from "./styles/colors.js";
import { PALETTE, defaultSettings, defaultData, makeConcurso, migrate } from "./data/model.js";
import { addDaysISO, todayISO, weekStart } from "./lib/date.js";
import { buildCyclePlan } from "./lib/planner.js";
import { computeStreaks } from "./lib/streaks.js";
import { uid } from "./lib/id.js";
import { useTheme } from "./lib/useTheme.js";
import { useSessionTimers } from "./lib/useSessionTimers.js";
import { useRestTimers } from "./lib/useRestTimers.js";
import { useSoundEnabled } from "./lib/useSoundEnabled.js";
import { playCompleteSound, playRestOverSound } from "./lib/sound.js";
import { fetchPlanData, savePlanData } from "./api/planData.js";
import { fetchContentBank } from "./api/contentBank.js";
import { looksLikeNumberedEdital, normalizeMateriaName, parseRawEdital } from "./lib/rawEditalParser.js";
import { NavItem } from "./components/NavItem.jsx";
import { EmptyConcursoState } from "./components/EmptyConcursoState.jsx";
import { DiaView } from "./views/DiaView.jsx";
import { SemanaView } from "./views/SemanaView.jsx";
import { EditalView } from "./views/EditalView.jsx";
import { MetasView } from "./views/MetasView.jsx";
import { ConcursosView } from "./views/ConcursosView.jsx";
import { ProgressoView } from "./views/ProgressoView.jsx";
import { AjustesView } from "./views/AjustesView.jsx";
import { AdminView } from "./views/AdminView.jsx";
import { RankingView } from "./views/RankingView.jsx";
import { ProfileView } from "./views/ProfileView.jsx";

// When the content bank has an entry for `materiaName`, reorders `topics` to
// follow the bank's order (TecConcursos's real caderno order) instead of
// whatever order the edital text or user typing produced — topics not found
// in the bank are left at the end, in their original relative order.
function sortTopicsByBank(topics, materiaName, contentBank) {
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
function mostRecentPlanBefore(dailyPlans, iso) {
  const keys = Object.keys(dailyPlans).filter((k) => k < iso).sort();
  return keys.length > 0 ? dailyPlans[keys[keys.length - 1]] : null;
}

// Shared by the free-text bulk importer and the content-bank importer: given
// {name, topics: [string]} entries, creates/reuses matérias by name and adds
// any topic not already present (case-insensitive), mutating `clone` in place.
function mergeMateriaEntries(clone, entries, contentBank) {
  let count = 0;
  entries.forEach(({ name, topics }) => {
    const materiaName = (name || "").trim();
    const topicNames = (topics || []).map((s) => s.trim()).filter(Boolean);
    if (!materiaName || topicNames.length === 0) return;
    let materia = clone.materias.find((m) => m.name.toLowerCase() === materiaName.toLowerCase());
    if (!materia) {
      materia = { id: uid(), name: materiaName, color: PALETTE[clone.materias.length % PALETTE.length], topics: [] };
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

const TAB_TITLES = {
  dia: "hoje",
  semana: "semana",
  edital: "edital",
  metas: "metas",
  progresso: "progresso",
  ranking: "ranking",
  concursos: "concursos",
  perfil: "perfil",
  ajustes: "ajustes",
  admin: "admin",
};

export default function App({ user, onLogout, onUserUpdate }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dia");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekAnchor, setWeekAnchor] = useState(weekStart(todayISO()));
  const [bulkText, setBulkText] = useState("");
  const [newMateriaName, setNewMateriaName] = useState("");
  const [newConcursoName, setNewConcursoName] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({});
  const [error, setError] = useState("");
  const [bulkHintMatches, setBulkHintMatches] = useState([]);
  const [theme, setTheme] = useTheme();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  // materiaId -> cardId whose questions prompt the auto-timer is waiting on
  // before it can move to the next segment.
  const [pendingQuestions, setPendingQuestions] = useState({});
  const [contentBank, setContentBank] = useState([]);
  const loaded = useRef(false);

  useEffect(() => {
    fetchContentBank()
      .then((res) => setContentBank(res.materias || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // React 18 StrictMode mounts every effect twice in dev (mount, simulated
    // unmount, mount again) to surface impure ones — with no cleanup here,
    // that fired two concurrent fetchPlanData() calls. Harmless on its own,
    // but the first mount's fetch can resolve AFTER today's plan has
    // already been rebuilt from it (cycleCursor advanced, a fresh batch
    // handed out), and applying that stale response would silently wipe the
    // rebuild back out. `cancelled` makes only the surviving mount's fetch
    // actually apply.
    let cancelled = false;
    (async () => {
      try {
        const value = await fetchPlanData();
        if (cancelled) return;
        let parsed = value ? migrate(JSON.parse(value)) : defaultData();
        if (parsed.concursos.length === 0) {
          const c = makeConcurso("Meu concurso", 0);
          parsed = { concursos: [c], activeConcursoId: c.id, activity: parsed.activity || {} };
        }
        if (!parsed.concursos.some((c) => c.id === parsed.activeConcursoId)) {
          parsed.activeConcursoId = parsed.concursos[0].id;
        }
        setData(parsed);
      } catch (e) {
        if (cancelled) return;
        const c = makeConcurso("Meu concurso", 0);
        setData({ concursos: [c], activeConcursoId: c.id, activity: {} });
      }
      if (!cancelled) loaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current || !data) return;
    savePlanData(JSON.stringify(data));
  }, [data]);

  const activeConcurso = data ? data.concursos.find((c) => c.id === data.activeConcursoId) || null : null;

  function updateActive(updater) {
    setData((prev) => {
      if (!prev || !prev.activeConcursoId) return prev;
      return { ...prev, concursos: prev.concursos.map((c) => (c.id === prev.activeConcursoId ? updater(c) : c)) };
    });
  }

  // Today's plan is the only one ever (re)built: past days are frozen
  // history (whatever they ended up with) and future days aren't knowable
  // in advance anymore — what's "next" depends on real progress, not the
  // calendar. Carries over whatever's unfinished from the last day the
  // concurso had a plan (which might be several days back), and lets
  // buildCyclePlan advance the cursor / hand out fresh batches as needed.
  function refreshTodayPlan() {
    const today = todayISO();
    setData((prev) => {
      if (!prev || !prev.activeConcursoId) return prev;
      return {
        ...prev,
        concursos: prev.concursos.map((c) => {
          if (c.id !== prev.activeConcursoId) return c;
          const base = c.dailyPlans[today] || mostRecentPlanBefore(c.dailyPlans, today) || [];
          const { cards, cursor } = buildCyclePlan(c.materias, c.settings, c.cycleCursor, base);
          return { ...c, cycleCursor: cursor, dailyPlans: { ...c.dailyPlans, [today]: cards } };
        }),
      };
    });
  }

  // Re-check today's plan on genuinely structural changes only — a new
  // matéria, a topic added/removed, matérias reordered, or the daily goals
  // changing. Deliberately NOT keyed on activeConcurso.materias directly:
  // that object also changes shape on every topic status flip, and
  // toggleCard already runs this same rebuild synchronously as part of the
  // toggle — running it again here afterwards would reuse the
  // just-advanced cursor to prune the very cards that advance just added.
  const structuralKey = activeConcurso
    ? `${activeConcurso.materias.map((m) => `${m.id}:${m.topics.length}`).join(",")}|${activeConcurso.settings?.materiasPerDay}|${activeConcurso.settings?.topicsPerDay}`
    : "";
  useEffect(() => {
    if (activeConcurso) refreshTodayPlan();
    // eslint-disable-next-line
  }, [activeConcurso?.id, structuralKey]);

  useEffect(() => {
    if (activeConcurso && tab === "dia" && selectedDate === todayISO()) refreshTodayPlan();
    // eslint-disable-next-line
  }, [tab, selectedDate, activeConcurso?.id]);

  function toggleCard(iso, cardId, questions) {
    if (!activeConcurso) return;
    const activeId = activeConcurso.id;
    const currentItem = activeConcurso.dailyPlans[iso]?.find((x) => x.id === cardId);
    const willComplete = currentItem && !currentItem.feito;
    if (willComplete && soundEnabled) playCompleteSound();

    if (currentItem) {
      const materiaId = currentItem.materiaId;
      const materiaCards = activeConcurso.dailyPlans[iso]?.filter((c) => c.materiaId === materiaId) || [];

      // Marking a card done/undone by hand — not by letting the running
      // clock cross into it — still has to move the clock: otherwise
      // finishing a topic before ever pressing "iniciar" leaves the full
      // time on the display, as if nothing had happened yet.
      const doneAfter = materiaCards.filter((c) => (c.id === cardId ? willComplete : c.feito)).length;
      sessionTimers.syncSegments(materiaId, doneAfter);

      if (willComplete) {
        const isLastPending = materiaCards.every((c) => c.id === cardId || c.feito);
        const restMinutes = activeConcurso.settings?.restMinutes || 0;
        if (isLastPending && restMinutes > 0) {
          restTimers.ensureTimer(materiaId, restMinutes);
          restTimers.start(materiaId);
        }

        // This card was the one the auto-timer paused on to ask about
        // questions — now that it's resolved (answered or skipped), clear
        // the prompt and, if the matéria still has more topics today,
        // resume the clock for the next slice.
        if (pendingQuestions[materiaId] === cardId) {
          setPendingQuestions((prev) => {
            const next = { ...prev };
            delete next[materiaId];
            return next;
          });
          if (!isLastPending) sessionTimers.start(materiaId);
        }
      }
    }

    setData((prev) => {
      if (!prev) return prev;
      const clone = JSON.parse(JSON.stringify(prev));
      const c = clone.concursos.find((x) => x.id === activeId);
      if (!c) return prev;
      const plan = c.dailyPlans[iso];
      if (!plan) return prev;
      const item = plan.find((x) => x.id === cardId);
      if (!item) return prev;
      const materia = c.materias.find((m) => m.id === item.materiaId);
      const topic = materia?.topics.find((t) => t.id === item.topicId);
      if (!topic) return prev;

      if (!item.feito) {
        item.feito = true;
        if (item.tipo === "novo") {
          topic.status = "estudado";
          topic.mastered = false;
        } else {
          topic.status = "estudado";
          topic.mastered = false;
        }
        if (questions) {
          topic.questionsTotal = (topic.questionsTotal || 0) + questions.total;
          topic.questionsCorrect = (topic.questionsCorrect || 0) + questions.correct;
          clone.questionActivity = clone.questionActivity || {};
          const bucket = clone.questionActivity[iso] || { total: 0, correct: 0 };
          clone.questionActivity[iso] = { total: bucket.total + questions.total, correct: bucket.correct + questions.correct };
        }
        clone.activity = clone.activity || {};
        clone.activity[iso] = (clone.activity[iso] || 0) + 1;
      } else {
        item.feito = false;
        if (item.tipo === "novo") {
          topic.status = "pendente";
          topic.mastered = false;
        } else {
          topic.status = "estudado";
          topic.mastered = false;
        }
        clone.activity = clone.activity || {};
        clone.activity[iso] = Math.max(0, (clone.activity[iso] || 0) - 1);
        if (clone.activity[iso] === 0) delete clone.activity[iso];
      }

      // Only today's plan drives the live rotation — a retroactive edit to
      // a past day's history shouldn't reach forward and move the cursor.
      if (iso === todayISO()) {
        const { cards, cursor } = buildCyclePlan(c.materias, c.settings, c.cycleCursor, plan);
        c.dailyPlans[iso] = cards;
        c.cycleCursor = cursor;
      }

      return clone;
    });
  }

  // Called when the session timer's clock crosses a topic's slice boundary.
  // The timer has already paused itself (see useSessionTimers) — this just
  // records which card is waiting on a questions prompt. toggleCard is what
  // actually marks it done and resumes the clock, once the prompt in
  // TopicRow is answered or skipped.
  function handleSegmentComplete(materiaId) {
    if (!activeConcurso) return;
    const plan = activeConcurso.dailyPlans[selectedDate] || [];
    const currentCard = plan.find((c) => c.materiaId === materiaId && !c.feito);
    if (!currentCard) return;
    setPendingQuestions((prev) => ({ ...prev, [materiaId]: currentCard.id }));
  }

  const sessionTimers = useSessionTimers(handleSegmentComplete);

  function handleRestFinished() {
    if (soundEnabled) playRestOverSound();
  }

  const restTimers = useRestTimers(handleRestFinished);

  function addMateria(name) {
    const trimmed = name.trim();
    if (!trimmed || !activeConcurso) return;
    const exists = activeConcurso.materias.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    const materia = { id: uid(), name: trimmed, color: PALETTE[activeConcurso.materias.length % PALETTE.length], topics: [] };
    updateActive((c) => ({ ...c, materias: [...c.materias, materia] }));
  }

  function addTopics(materiaId, names) {
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const m = clone.materias.find((x) => x.id === materiaId);
      if (!m) return c;
      const existingNames = new Set(m.topics.map((t) => t.name.toLowerCase()));
      names
        .map((n) => n.trim())
        .filter((n) => n && !existingNames.has(n.toLowerCase()))
        .forEach((n) => {
          existingNames.add(n.toLowerCase());
          m.topics.push({ id: uid(), name: n, status: "pendente", mastered: false });
        });
      m.topics = sortTopicsByBank(m.topics, m.name, contentBank);
      return clone;
    });
  }

  function removeMateria(id) {
    updateActive((c) => ({ ...c, materias: c.materias.filter((m) => m.id !== id) }));
  }

  // Matéria order drives the cycle (activeMateriaIds walks the array in
  // order from the cursor), so moving a matéria up/down changes when it's
  // studied relative to the others.
  function moveMateria(id, direction) {
    updateActive((c) => {
      const idx = c.materias.findIndex((m) => m.id === id);
      const newIdx = idx + direction;
      if (idx === -1 || newIdx < 0 || newIdx >= c.materias.length) return c;
      const materias = [...c.materias];
      [materias[idx], materias[newIdx]] = [materias[newIdx], materias[idx]];
      return { ...c, materias };
    });
  }

  function removeTopic(materiaId, topicId) {
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const m = clone.materias.find((x) => x.id === materiaId);
      if (!m) return c;
      m.topics = m.topics.filter((t) => t.id !== topicId);
      return clone;
    });
  }

  function updateTopicNotes(materiaId, topicId, notes) {
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const m = clone.materias.find((x) => x.id === materiaId);
      const t = m?.topics.find((x) => x.id === topicId);
      if (!t) return c;
      t.notes = notes;
      return clone;
    });
  }

  function updateTopicLink(materiaId, topicId, link) {
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const m = clone.materias.find((x) => x.id === materiaId);
      const t = m?.topics.find((x) => x.id === topicId);
      if (!t) return c;
      t.link = link;
      return clone;
    });
  }

  function setTopicQuestions(materiaId, topicId, total, correct) {
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const m = clone.materias.find((x) => x.id === materiaId);
      const t = m?.topics.find((x) => x.id === topicId);
      if (!t) return c;
      const safeTotal = Math.max(0, total);
      t.questionsTotal = safeTotal;
      t.questionsCorrect = Math.min(safeTotal, Math.max(0, correct));
      return clone;
    });
  }

  function updateSettings(field, value) {
    updateActive((c) => ({ ...c, settings: { ...c.settings, [field]: value } }));
  }

  function parseBulk() {
    setError("");
    setBulkHintMatches([]);
    if (!activeConcurso) return;
    if (!bulkText.trim()) {
      setError("Cole o edital no formato indicado antes de importar.");
      return;
    }
    // Accepts either the raw numbered edital text pasted verbatim (e.g.
    // "LÍNGUA PORTUGUESA: 1 Compreensão... 2 Reconhecimento..."), the same
    // numbered text with no matéria header at all (uses "nome da matéria"
    // below as the name), or the plain "Matéria: assunto 1; assunto 2"
    // format — whichever the pasted text looks like.
    const rawEntries = parseRawEdital(bulkText, newMateriaName);
    if (!rawEntries && looksLikeNumberedEdital(bulkText) && !newMateriaName.trim()) {
      setError('Esse texto não tem o nome da matéria. Digite o nome no campo "nome da matéria" (abaixo) e clique em importar de novo.');
      return;
    }
    let entries = rawEntries || bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const sepIndex = line.indexOf(":");
        if (sepIndex === -1) return null;
        return { name: line.slice(0, sepIndex), topics: line.slice(sepIndex + 1).split(";") };
      })
      .filter(Boolean);
    // Texto de edital colado é uma extração mecânica do texto da banca — por
    // melhor que o parser fique, não tem como bater com a granularidade real
    // de estudo (itens "guarda-chuva" que o parser não reconhece, redações
    // diferentes da banca, etc). Quando a matéria já tem uma entrada
    // validada no banco compartilhado, usamos ela por completo em vez do que
    // foi extraído do texto — só se aplica ao formato numerado do edital;
    // o formato manual "Matéria: assunto 1; assunto 2" é curadoria
    // deliberada do usuário e nunca é substituído.
    if (rawEntries) {
      entries = entries.map((entry) => {
        const bankEntry = contentBank.find((b) => normalizeMateriaName(b.name) === normalizeMateriaName(entry.name));
        return bankEntry ? { name: entry.name, topics: bankEntry.topics } : entry;
      });
    }
    // Counted against a read-only snapshot first, not from inside the
    // updater passed to updateActive: React (in dev/StrictMode) can invoke
    // that updater more than once, and since mergeMateriaEntries is
    // dedupe-safe that's harmless for the data, but a counter read from
    // inside it would reflect only the last run — which often finds nothing
    // new left to add and reports 0 even though the import worked.
    const dryRun = JSON.parse(JSON.stringify(activeConcurso));
    const count = mergeMateriaEntries(dryRun, entries, contentBank);
    if (count === 0) {
      setError("Nenhum assunto novo encontrado. Confira o formato: Matéria: assunto 1; assunto 2");
      return;
    }
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      mergeMateriaEntries(clone, entries, contentBank);
      return clone;
    });
    setBulkText("");

    // No formato numerado (rawEntries), matérias com match no banco já foram
    // substituídas acima — não sobra gap pra avisar. Isso só ainda dispara
    // para o formato manual "Matéria: assunto 1; assunto 2", que é curadoria
    // deliberada do usuário: aí só avisamos e deixamos a troca por completo
    // opcional (o botão "usar os N do banco"), sem forçar.
    const richerMatches = entries
      .map((entry) => {
        const normalized = normalizeMateriaName(entry.name);
        const bankEntry = contentBank.find((b) => normalizeMateriaName(b.name) === normalized);
        if (!bankEntry || bankEntry.topics.length <= entry.topics.length) return null;
        return { materiaName: entry.name, importedCount: entry.topics.length, bankEntry };
      })
      .filter(Boolean);
    setBulkHintMatches(richerMatches);
  }

  // Swaps a matéria's topic list for the shared bank's version of it — used
  // when the raw-edital parser only produced a shallow reading (banca não
  // detalhou, ou o item era um "guarda-chuva" que o parser não sabia
  // expandir) and the bank already has the real, validated granularity.
  // Any topic whose name still matches keeps its progress (status/mastered);
  // topics not in the bank list are dropped, new ones start "pendente".
  function useContentBankTopicsFor(materiaName, bankId) {
    if (!activeConcurso) return;
    const bankEntry = contentBank.find((b) => b.id === bankId);
    if (!bankEntry) return;
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      const materia = clone.materias.find((m) => m.name.toLowerCase() === materiaName.toLowerCase());
      if (!materia) return clone;
      const existingByName = new Map(materia.topics.map((t) => [t.name.toLowerCase(), t]));
      materia.topics = bankEntry.topics.map((name) => existingByName.get(name.toLowerCase()) || { id: uid(), name, status: "pendente", mastered: false });
      return clone;
    });
    setBulkHintMatches((matches) => matches.filter((m) => m.materiaName !== materiaName));
  }

  // Imports one or more matérias (with their topics) from the shared content
  // bank into the active concurso, merging into existing matérias by name.
  function importFromBank(bankIds) {
    if (!activeConcurso || bankIds.length === 0) return 0;
    const idSet = new Set(bankIds);
    const entries = contentBank.filter((m) => idSet.has(m.id));
    const dryRun = JSON.parse(JSON.stringify(activeConcurso));
    const count = mergeMateriaEntries(dryRun, entries, contentBank);
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      mergeMateriaEntries(clone, entries, contentBank);
      return clone;
    });
    return count;
  }

  function addConcurso(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((d) => {
      const novo = makeConcurso(trimmed, d.concursos.length);
      return { ...d, concursos: [...d.concursos, novo], activeConcursoId: novo.id };
    });
    setNewConcursoName("");
    setSelectedDate(todayISO());
  }

  function selectConcurso(id) {
    setData((d) => ({ ...d, activeConcursoId: id }));
    setSelectedDate(todayISO());
    setTab("dia");
  }

  function removeConcurso(id) {
    setData((d) => {
      const remaining = d.concursos.filter((c) => c.id !== id);
      let activeId = d.activeConcursoId;
      if (activeId === id) activeId = remaining[0]?.id || null;
      return { ...d, concursos: remaining, activeConcursoId: activeId };
    });
  }

  function renameConcurso(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((d) => ({ ...d, concursos: d.concursos.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) }));
  }

  function importData(imported) {
    setData(imported);
    setSelectedDate(todayISO());
    setTab("dia");
  }

  // Switches tabs and, on mobile, closes the slide-out nav drawer — used by
  // every nav item so tapping a destination also dismisses the menu.
  function goTab(t) {
    setTab(t);
    setMobileNavOpen(false);
  }

  if (!data) {
    return (
      <div style={{ background: colors.bg, color: colors.textMuted, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        carregando seu plano...
      </div>
    );
  }

  const plan = (activeConcurso && activeConcurso.dailyPlans[selectedDate]) || [];
  const doneCount = plan.filter((c) => c.feito).length;
  const totalCount = plan.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const materiaById = (id) => activeConcurso?.materias.find((m) => m.id === id);
  const topicById = (materia, id) => materia?.topics.find((t) => t.id === id);
  const materiasOrder = activeConcurso ? activeConcurso.materias.map((m) => m.id) : [];
  const weekDays = Array.from({ length: 35 }, (_, i) => addDaysISO(weekAnchor, i));

  return (
    <div style={{ background: colors.bg, color: colors.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input, textarea { font-family: inherit; }
        ::placeholder { color: ${colors.textFaint}; }
        button { cursor: pointer; }
        .mobile-topbar, .nav-backdrop { display: none; }
        @media (max-width: 860px) {
          .app-nav {
            position: fixed; top: 0; left: 0; height: 100vh; z-index: 101;
            background: ${colors.bg}; transform: translateX(-100%); transition: transform 0.2s ease;
          }
          .app-nav.open { transform: translateX(0); }
          .mobile-topbar {
            display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10;
            background: ${colors.bg}; border-bottom: 1px solid ${colors.border}; padding: 14px 16px;
          }
          .nav-backdrop.open {
            display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
          }
          .app-main { padding: 16px !important; }
        }
      `}</style>

      <div className={`nav-backdrop${mobileNavOpen ? " open" : ""}`} onClick={() => setMobileNavOpen(false)} />

      <nav className={`app-nav${mobileNavOpen ? " open" : ""}`} style={{ width: 210, minHeight: "100vh", boxSizing: "border-box", flexShrink: 0, borderRight: `1px solid ${colors.border}`, padding: "24px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="sg" style={{ fontSize: 17, fontWeight: 700, padding: "0 10px 16px", color: colors.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color={colors.amber} />
          ciclo de estudos
        </div>

        <button
          onClick={() => goTab("concursos")}
          style={{
            display: "flex", alignItems: "center", gap: 8, background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 8, padding: "9px 10px", marginBottom: 16, textAlign: "left",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: activeConcurso?.color || colors.textFaint, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>estudando</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeConcurso?.name || "nenhum concurso"}
            </div>
          </div>
          <ChevronRight size={14} color={colors.textFaint} />
        </button>

        <NavItem icon={<CalendarDays size={16} />} label="hoje" active={tab === "dia"} onClick={() => { setSelectedDate(todayISO()); goTab("dia"); }} />
        <NavItem icon={<ListChecks size={16} />} label="semana" active={tab === "semana"} onClick={() => goTab("semana")} />
        <NavItem icon={<BookOpen size={16} />} label="edital" active={tab === "edital"} onClick={() => goTab("edital")} />
        <NavItem icon={<Target size={16} />} label="metas" active={tab === "metas"} onClick={() => goTab("metas")} />
        <NavItem icon={<Flame size={16} />} label="progresso" active={tab === "progresso"} onClick={() => goTab("progresso")} />
        <NavItem icon={<Trophy size={16} />} label="ranking" active={tab === "ranking"} onClick={() => goTab("ranking")} />
        <div style={{ height: 1, background: colors.border, margin: "8px 6px" }} />
        <NavItem icon={<GraduationCap size={16} />} label="concursos" active={tab === "concursos"} onClick={() => goTab("concursos")} />
        <NavItem icon={<UserCircle size={16} />} label="perfil" active={tab === "perfil"} onClick={() => goTab("perfil")} />
        <NavItem icon={<Settings size={16} />} label="ajustes" active={tab === "ajustes"} onClick={() => goTab("ajustes")} />
        {user?.isAdmin && (
          <NavItem icon={<ShieldCheck size={16} />} label="admin" active={tab === "admin"} onClick={() => goTab("admin")} />
        )}

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginTop: 8 }}>
          <button
            onClick={() => goTab("perfil")}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "0 10px 6px", textAlign: "left" }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: colors.surface2,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: colors.textFaint,
            }}>
              {user?.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (user?.username || user?.email || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: colors.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.username || user?.email}
            </div>
          </button>
          <button
            onClick={onLogout}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent",
              border: "none", borderRadius: 8, padding: "9px 10px", color: colors.textMuted, fontSize: 13, textAlign: "left",
            }}
          >
            sair
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="mobile-topbar">
          <button onClick={() => setMobileNavOpen(true)} style={{ background: "transparent", border: "none", color: colors.text, display: "flex" }}>
            <Menu size={20} />
          </button>
          <span className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{TAB_TITLES[tab] || "ciclo de estudos"}</span>
        </div>

        <main className="app-main" style={{ flex: 1, minWidth: 0, padding: "28px 36px" }}>
        {tab === "concursos" && (
          <ConcursosView
            concursos={data.concursos}
            activeConcursoId={data.activeConcursoId}
            newConcursoName={newConcursoName}
            setNewConcursoName={setNewConcursoName}
            addConcurso={addConcurso}
            selectConcurso={selectConcurso}
            removeConcurso={removeConcurso}
            renameConcurso={renameConcurso}
          />
        )}

        {tab === "progresso" && <ProgressoView activity={data.activity || {}} activeConcurso={activeConcurso} />}

        {tab === "ajustes" && (
          <AjustesView
            theme={theme}
            setTheme={setTheme}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            data={data}
            onImport={importData}
            user={user}
            onUserUpdate={onUserUpdate}
          />
        )}

        {tab === "ranking" && (
          <RankingView currentDisplayName={user?.username || user?.email?.split("@")[0]} onGoToSettings={() => setTab("ajustes")} />
        )}

        {tab === "perfil" && <ProfileView user={user} onUserUpdate={onUserUpdate} />}

        {tab === "admin" && user?.isAdmin && <AdminView currentUserEmail={user.email} />}

        {tab !== "concursos" && tab !== "progresso" && tab !== "ajustes" && tab !== "admin" && tab !== "ranking" && tab !== "perfil" && !activeConcurso && (
          <EmptyConcursoState onGo={() => setTab("concursos")} />
        )}

        {tab === "dia" && activeConcurso && (
          <DiaView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            plan={plan}
            doneCount={doneCount}
            totalCount={totalCount}
            pct={pct}
            materiaById={materiaById}
            topicById={topicById}
            materiasOrder={materiasOrder}
            minutesPerMateria={activeConcurso.settings?.minutesPerMateria || 0}
            toggleCard={toggleCard}
            streak={computeStreaks(data.activity || {}).current}
            sessionTimers={sessionTimers}
            restTimers={restTimers}
            pendingQuestions={pendingQuestions}
            updateTopicNotes={updateTopicNotes}
            updateTopicLink={updateTopicLink}
            setTopicQuestions={setTopicQuestions}
          />
        )}

        {tab === "semana" && activeConcurso && (
          <SemanaView
            concurso={activeConcurso}
            weekAnchor={weekAnchor}
            setWeekAnchor={setWeekAnchor}
            weekDays={weekDays}
            onOpenDay={(iso) => { setSelectedDate(iso); setTab("dia"); }}
          />
        )}

        {tab === "edital" && activeConcurso && (
          <EditalView
            concurso={activeConcurso}
            bulkText={bulkText}
            setBulkText={setBulkText}
            parseBulk={parseBulk}
            error={error}
            bulkHintMatches={bulkHintMatches}
            useContentBankTopicsFor={useContentBankTopicsFor}
            newMateriaName={newMateriaName}
            setNewMateriaName={setNewMateriaName}
            addMateria={addMateria}
            addTopics={addTopics}
            removeMateria={removeMateria}
            removeTopic={removeTopic}
            moveMateria={moveMateria}
            updateTopicNotes={updateTopicNotes}
            updateTopicLink={updateTopicLink}
            topicDrafts={topicDrafts}
            setTopicDrafts={setTopicDrafts}
            contentBank={contentBank}
            importFromBank={importFromBank}
          />
        )}

        {tab === "metas" && activeConcurso && <MetasView concurso={activeConcurso} updateSettings={updateSettings} />}
        </main>
      </div>
    </div>
  );
}
