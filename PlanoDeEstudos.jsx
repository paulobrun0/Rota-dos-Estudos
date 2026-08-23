import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Check, RotateCcw, ChevronLeft, ChevronRight,
  Target, BookOpen, CalendarDays, ListChecks, X, Clock, Sparkles, Play, Pause,
  Layers, GraduationCap, Pencil, Flame, Trophy,
} from "lucide-react";

const STORAGE_KEY = "plano-estudos-v1";
const PALETTE = ["#E8A33D", "#4FD1C5", "#E8615F", "#7C9CF0", "#C97FEF", "#6FCF97", "#F2A9C5", "#F0C419", "#5FB0E8", "#F0885A"];

const storage = {
  get: (...args) => window.storage?.get?.(...args) || Promise.resolve({ value: window.localStorage.getItem(args[0]) }),
  set: (...args) => window.storage?.set?.(...args) || Promise.resolve(window.localStorage.setItem(args[0], args[1])),
};

const colors = {
  bg: "#12141C",
  surface: "#191D28",
  surface2: "#212636",
  border: "#2B3143",
  borderSoft: "#232838",
  text: "#EDEFF4",
  textMuted: "#8A93AC",
  textFaint: "#5D6478",
  amber: "#E8A33D",
  amberSoft: "#3A2E1A",
  teal: "#4FD1C5",
  tealSoft: "#173330",
  red: "#E8615F",
  redSoft: "#3A1E1E",
};

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fromISO(iso) {
  return new Date(iso + "T00:00:00");
}
function addDaysISO(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function todayISO() {
  return toISO(new Date());
}
function formatDatePretty(iso) {
  const d = fromISO(iso);
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function weekStart(iso) {
  const d = fromISO(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}
function daysSinceEpoch(iso) {
  return Math.floor(fromISO(iso).getTime() / 86400000);
}
function fmtClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Which matérias get "novo" cards on a given day. Rotation always spans every
// registered matéria (no need to "activate" each one manually) — with
// materiasPerDay = N, day 0 gets matérias [0..N-1], day 1 gets [N..2N-1], and
// so on, wrapping back to the start once every matéria has had its turn.
function rotationMateriaIds(materias, settings, iso) {
  if (materias.length === 0) return [];
  const raw = settings?.materiasPerDay || 0;
  const per = raw > 0 ? Math.min(raw, materias.length) : materias.length;
  const dayIdx = daysSinceEpoch(iso);
  const totalBlocks = Math.ceil(materias.length / per);
  const block = dayIdx % totalBlocks;
  const start = block * per;
  const ids = [];
  for (let i = 0; i < per; i++) {
    const idx = start + i;
    if (idx < materias.length) ids.push(materias[idx].id);
  }
  return ids;
}

// Builds one day's plan. A shared reservation set consumes each matéria's
// topics once; when that matéria is exhausted, its next appearance starts a
// new cycle instead of repeating topics in the same cycle.
function buildDayPlan(materias, settings, iso, oldPlan, reserved) {
  const kept = [];
  const usedTopicIds = new Set();

  (oldPlan || [])
    .filter((c) => c.feito)
    .forEach((c) => {
      const m = materias.find((x) => x.id === c.materiaId);
      const t = m?.topics.find((x) => x.id === c.topicId);
      if (t) {
        kept.push({ ...c });
        usedTopicIds.add(c.topicId);
      }
    });

  const topicsPerDay = settings?.topicsPerDay || 0;
  const rotationIds = new Set(rotationMateriaIds(materias, settings, iso));
  if (topicsPerDay > 0) {
    materias.forEach((m) => {
      if (!rotationIds.has(m.id)) return;
      const already = kept.filter((c) => c.materiaId === m.id && c.tipo === "novo").length;
      const need = Math.max(0, topicsPerDay - already);
      if (need > 0) {
        let candidates = m.topics.filter((t) => t.status === "pendente" && !usedTopicIds.has(t.id) && !reserved?.has(t.id));
        let tipo = "novo";
        const cycleComplete = m.topics.length > 0 && m.topics.every((t) => reserved?.has(t.id));
        if (candidates.length === 0 && cycleComplete) {
          m.topics.forEach((t) => reserved.delete(t.id));
          candidates = m.topics.filter((t) => !usedTopicIds.has(t.id));
          tipo = "revisao";
        }
        candidates.slice(0, need).forEach((t) => {
          kept.push({ id: uid(), materiaId: m.id, topicId: t.id, tipo, feito: false });
          usedTopicIds.add(t.id);
          reserved?.add(t.id);
        });
      }
    });
  }

  return kept;
}

const defaultSettings = () => ({ materiasPerDay: 0, topicsPerDay: 2, minutesPerMateria: 30 });
const makeConcurso = (name, colorIndex) => ({
  id: uid(),
  name,
  color: PALETTE[colorIndex % PALETTE.length],
  materias: [],
  settings: defaultSettings(),
  dailyPlans: {},
});
const defaultData = () => ({ concursos: [], activeConcursoId: null, activity: {} });

// Older single-concurso saves get wrapped into one concurso so nothing is lost.
function migrate(raw) {
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

// Current streak (consecutive days with at least one card completed), not
// broken by "today" being still unstudied — it only breaks once a full day
// passes with zero activity. Also returns the longest streak on record.
function computeStreaks(activity) {
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
function buildHeatmapWeeks(activity) {
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
function heatLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekAnchor, setWeekAnchor] = useState(weekStart(todayISO()));
  const [bulkText, setBulkText] = useState("");
  const [newMateriaName, setNewMateriaName] = useState("");
  const [newConcursoName, setNewConcursoName] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({});
  const [error, setError] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY, false);
        let parsed = res ? migrate(JSON.parse(res.value)) : defaultData();
        if (parsed.concursos.length === 0) {
          const c = makeConcurso("Meu concurso", 0);
          parsed = { concursos: [c], activeConcursoId: c.id, activity: parsed.activity || {} };
        }
        if (!parsed.concursos.some((c) => c.id === parsed.activeConcursoId)) {
          parsed.activeConcursoId = parsed.concursos[0].id;
        }
        setData(parsed);
      } catch (e) {
        const c = makeConcurso("Meu concurso", 0);
        setData({ concursos: [c], activeConcursoId: c.id, activity: {} });
      }
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !data) return;
    (async () => {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify(data), false);
      } catch (e) {
        // ignore transient storage errors
      }
    })();
  }, [data]);

  const activeConcurso = data ? data.concursos.find((c) => c.id === data.activeConcursoId) || null : null;

  function updateActive(updater) {
    setData((prev) => {
      if (!prev || !prev.activeConcursoId) return prev;
      return { ...prev, concursos: prev.concursos.map((c) => (c.id === prev.activeConcursoId ? updater(c) : c)) };
    });
  }

  function withPlan(iso) {
    setData((prev) => {
      if (!prev || !prev.activeConcursoId) return prev;
      return {
        ...prev,
        concursos: prev.concursos.map((c) => {
          if (c.id !== prev.activeConcursoId) return c;
          const isFrozen = iso < todayISO();
          if (isFrozen && c.dailyPlans[iso]) return c;
          const newPlan = buildDayPlan(c.materias, c.settings, iso, c.dailyPlans[iso], new Set());
          return { ...c, dailyPlans: { ...c.dailyPlans, [iso]: newPlan } };
        }),
      };
    });
  }

  // Whenever the active concurso's matérias or metas change, pre-build the
  // next 35 days in one pass so future cycles are ready without opening each
  // day manually.
  useEffect(() => {
    if (!activeConcurso) return;
    const activeId = activeConcurso.id;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        concursos: prev.concursos.map((c) => {
          if (c.id !== activeId) return c;
          const start = todayISO();
          const reserved = new Set();
          const newPlans = { ...c.dailyPlans };
          for (let i = 0; i < 35; i++) {
            const iso = addDaysISO(start, i);
            newPlans[iso] = buildDayPlan(c.materias, c.settings, iso, newPlans[iso], reserved);
          }
          return { ...c, dailyPlans: newPlans };
        }),
      };
    });
    // eslint-disable-next-line
  }, [activeConcurso?.id, activeConcurso?.materias, activeConcurso?.settings]);

  useEffect(() => {
    if (activeConcurso && tab === "dia") withPlan(selectedDate);
    // eslint-disable-next-line
  }, [tab, selectedDate, activeConcurso?.id]);

  function toggleCard(iso, cardId) {
    if (!activeConcurso) return;
    const activeId = activeConcurso.id;
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
      return clone;
    });
  }

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
      return clone;
    });
  }

  function removeMateria(id) {
    updateActive((c) => ({ ...c, materias: c.materias.filter((m) => m.id !== id) }));
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

  function updateSettings(field, value) {
    updateActive((c) => ({ ...c, settings: { ...c.settings, [field]: value } }));
  }

  function parseBulk() {
    setError("");
    if (!activeConcurso) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError("Cole o edital no formato indicado antes de importar.");
      return;
    }
    let count = 0;
    updateActive((c) => {
      const clone = JSON.parse(JSON.stringify(c));
      lines.forEach((line) => {
        const sepIndex = line.indexOf(":");
        if (sepIndex === -1) return;
        const materiaName = line.slice(0, sepIndex).trim();
        const topicsRaw = line.slice(sepIndex + 1);
        const topicNames = topicsRaw.split(";").map((s) => s.trim()).filter(Boolean);
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
      });
      return clone;
    });
    if (count === 0) {
      setError("Nenhum assunto novo encontrado. Confira o formato: Matéria: assunto 1; assunto 2");
      return;
    }
    setBulkText("");
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

  if (!data) {
    return (
      <div style={{ background: colors.bg, color: colors.textMuted, minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
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
    <div style={{ background: colors.bg, color: colors.text, minHeight: 600, fontFamily: "Inter, system-ui, sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        html, body, #root { margin: 0; min-height: 100%; }
        body { background: ${colors.bg}; }
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input, textarea { font-family: inherit; }
        ::placeholder { color: ${colors.textFaint}; }
        button { cursor: pointer; }
      `}</style>

      <nav style={{ width: 210, minHeight: "100vh", boxSizing: "border-box", flexShrink: 0, borderRight: `1px solid ${colors.border}`, padding: "24px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="sg" style={{ fontSize: 17, fontWeight: 700, padding: "0 10px 16px", color: colors.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color={colors.amber} />
          ciclo de estudos
        </div>

        <button
          onClick={() => setTab("concursos")}
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

        <NavItem icon={<CalendarDays size={16} />} label="hoje" active={tab === "dia"} onClick={() => { setSelectedDate(todayISO()); setTab("dia"); }} />
        <NavItem icon={<ListChecks size={16} />} label="semana" active={tab === "semana"} onClick={() => setTab("semana")} />
        <NavItem icon={<BookOpen size={16} />} label="edital" active={tab === "edital"} onClick={() => setTab("edital")} />
        <NavItem icon={<Target size={16} />} label="metas" active={tab === "metas"} onClick={() => setTab("metas")} />
        <NavItem icon={<Flame size={16} />} label="progresso" active={tab === "progresso"} onClick={() => setTab("progresso")} />
        <div style={{ height: 1, background: colors.border, margin: "8px 6px" }} />
        <NavItem icon={<GraduationCap size={16} />} label="concursos" active={tab === "concursos"} onClick={() => setTab("concursos")} />
      </nav>

      <main style={{ flex: 1, minWidth: 0, padding: "28px 36px" }}>
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

        {tab === "progresso" && <ProgressoView activity={data.activity || {}} />}

        {tab !== "concursos" && tab !== "progresso" && !activeConcurso && (
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
            newMateriaName={newMateriaName}
            setNewMateriaName={setNewMateriaName}
            addMateria={addMateria}
            addTopics={addTopics}
            removeMateria={removeMateria}
            removeTopic={removeTopic}
            topicDrafts={topicDrafts}
            setTopicDrafts={setTopicDrafts}
          />
        )}

        {tab === "metas" && activeConcurso && <MetasView concurso={activeConcurso} updateSettings={updateSettings} />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
        borderRadius: 8, border: "none", background: active ? colors.surface2 : "transparent",
        color: active ? colors.text : colors.textMuted, fontSize: 14, fontWeight: 500,
        textAlign: "left", width: "100%",
      }}
    >
      <span style={{ color: active ? colors.amber : colors.textFaint }}>{icon}</span>
      {label}
    </button>
  );
}

function EmptyConcursoState({ onGo }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px", color: colors.textMuted }}>
      <GraduationCap size={28} color={colors.textFaint} style={{ marginBottom: 12 }} />
      <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 6 }}>nenhum concurso selecionado</div>
      <div style={{ fontSize: 13.5, marginBottom: 16 }}>crie ou escolha um concurso para ver o cronograma.</div>
      <button onClick={onGo} style={{ ...primaryBtnStyle, marginTop: 0, display: "inline-flex" }}>ir para concursos</button>
    </div>
  );
}

function Ring({ pct, size = 88 }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surface2} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.amber} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="sg" fontSize="18" fontWeight="700" fill={colors.text}>
        {pct}%
      </text>
    </svg>
  );
}

function DiaView({ selectedDate, setSelectedDate, plan, doneCount, totalCount, pct, materiaById, topicById, materiasOrder, minutesPerMateria, toggleCard, streak }) {
  const isToday = selectedDate === todayISO();
  const novos = plan.filter((c) => c.tipo === "novo");
  const revisoes = plan.filter((c) => c.tipo === "revisao");

  const groupsMap = {};
  plan.forEach((card) => {
    if (!groupsMap[card.materiaId]) groupsMap[card.materiaId] = [];
    groupsMap[card.materiaId].push(card);
  });
  const orderedMateriaIds = materiasOrder.filter((id) => groupsMap[id]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))} style={navBtnStyle}><ChevronLeft size={16} /></button>
          <div>
            <div className="sg" style={{ fontSize: 20, fontWeight: 700, textTransform: "capitalize" }}>
              {isToday ? "hoje" : formatDatePretty(selectedDate)}
            </div>
            {isToday && <div style={{ fontSize: 12.5, color: colors.textMuted, textTransform: "capitalize" }}>{formatDatePretty(selectedDate)}</div>}
          </div>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))} style={navBtnStyle}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isToday && streak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: colors.amberSoft, color: colors.amber, borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>
              <Flame size={14} /> {streak} dia{streak !== 1 ? "s" : ""}
            </div>
          )}
          {!isToday && (
            <button onClick={() => setSelectedDate(todayISO())} style={{ ...navBtnStyle, width: "auto", padding: "0 12px", fontSize: 13, color: colors.amber }}>
              voltar para hoje
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 28 }}>
        <Ring pct={pct} />
        <div>
          <div className="sg" style={{ fontSize: 15, fontWeight: 600 }}>
            {totalCount === 0 ? "nada planejado" : `${doneCount} de ${totalCount} cards concluídos`}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
            {totalCount === 0
              ? "defina metas nas matérias para gerar o plano do dia."
              : `${novos.length} assunto${novos.length !== 1 ? "s" : ""} novo${novos.length !== 1 ? "s" : ""} · ${revisoes.length} revisão${revisoes.length !== 1 ? "ões" : ""}`}
          </div>
        </div>
      </div>

      {plan.length === 0 && (
        <div style={{ color: colors.textFaint, fontSize: 14, padding: "12px 2px" }}>
          nenhum card para este dia ainda. vá em <b style={{ color: colors.textMuted }}>metas</b> para definir quantos assuntos por matéria você quer estudar por dia.
        </div>
      )}

      {orderedMateriaIds.map((materiaId) => (
        <MateriaGroupCard
          key={materiaId}
          materia={materiaById(materiaId)}
          minutesPerMateria={minutesPerMateria}
          cards={groupsMap[materiaId]}
          topicById={topicById}
          onToggle={(cardId) => toggleCard(selectedDate, cardId)}
        />
      ))}
    </div>
  );
}

function MateriaGroupCard({ materia, minutesPerMateria, cards, topicById, onToggle }) {
  if (!materia) return null;
  const totalMinutes = minutesPerMateria || 0;
  const perTopic = cards.length > 0 && totalMinutes > 0 ? totalMinutes / cards.length : null;
  const doneInGroup = cards.filter((c) => c.feito).length;
  const allDone = doneInGroup === cards.length;

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${materia.color}`, borderRadius: 12, padding: 16, marginBottom: 14, opacity: allDone ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: materia.color }}>{materia.name}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {doneInGroup}/{cards.length} concluído{cards.length !== 1 ? "s" : ""}
            {totalMinutes > 0 ? ` · ${totalMinutes} min no total` : ""}
            {perTopic ? ` · ~${Math.round(perTopic)} min por assunto` : ""}
          </div>
        </div>
        {totalMinutes > 0 && !allDone && <SessionTimer key={`${materia.id}-${totalMinutes}`} totalMinutes={totalMinutes} />}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.map((card) => {
          const topic = topicById(materia, card.topicId);
          if (!topic) return null;
          return <TopicRow key={card.id} card={card} topic={topic} onToggle={() => onToggle(card.id)} />;
        })}
      </div>

      {totalMinutes === 0 && (
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 10 }}>
          defina os minutos por matéria em metas para ativar o cronômetro.
        </div>
      )}
    </div>
  );
}

function TopicRow({ card, topic, onToggle }) {
  const isRevisao = card.tipo === "revisao";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: colors.surface2, borderRadius: 8, padding: "10px 12px", opacity: card.feito ? 0.55 : 1 }}>
      <button
        onClick={onToggle}
        aria-label={card.feito ? "marcar como não estudado" : "marcar como estudado"}
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${card.feito ? colors.amber : colors.border}`,
          background: card.feito ? colors.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {card.feito && <Check size={13} color={colors.bg} strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, fontSize: 14, textDecoration: card.feito ? "line-through" : "none", color: colors.text }}>{topic.name}</div>
      <div
        className="mono"
        style={{
          fontSize: 10.5, padding: "2px 8px", borderRadius: 20, flexShrink: 0,
          background: isRevisao ? colors.tealSoft : colors.amberSoft,
          color: isRevisao ? colors.teal : colors.amber,
        }}
      >
        {isRevisao ? "revisão · ciclo" : "novo"}
      </div>
    </div>
  );
}

function SessionTimer({ totalMinutes }) {
  const totalSeconds = Math.max(1, Math.round(totalMinutes * 60));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const finished = secondsLeft === 0;
  const started = secondsLeft !== totalSeconds;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: finished ? colors.teal : colors.text, minWidth: 62 }}>
        {fmtClock(secondsLeft)}
      </div>
      {!finished && !running && (
        <button onClick={() => setRunning(true)} style={{ ...primaryBtnStyle, marginTop: 0, padding: "7px 14px" }}>
          <Play size={13} /> {started ? "continuar" : "iniciar"}
        </button>
      )}
      {running && (
        <button onClick={() => setRunning(false)} style={{ ...secondaryBtnStyle, padding: "7px 14px" }}>
          <Pause size={13} /> pausar
        </button>
      )}
      {started && (
        <button
          onClick={() => { setRunning(false); setSecondsLeft(totalSeconds); }}
          aria-label="reiniciar cronômetro"
          style={iconBtnStyle}
        >
          <RotateCcw size={14} />
        </button>
      )}
      {finished && <span style={{ fontSize: 12, color: colors.teal }}>tempo esgotado</span>}
    </div>
  );
}

function SectionLabel({ text }) {
  return <div style={{ fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint, margin: "18px 2px 10px", fontWeight: 600 }}>{text}</div>;
}

const navBtnStyle = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface,
  color: colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
};

function SemanaView({ concurso, weekAnchor, setWeekAnchor, weekDays, onOpenDay }) {
  const today = todayISO();
  const weeks = Array.from({ length: Math.ceil(weekDays.length / 7) }, (_, index) => weekDays.slice(index * 7, index * 7 + 7));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={() => setWeekAnchor(addDaysISO(weekAnchor, -7))} style={navBtnStyle}><ChevronLeft size={16} /></button>
        <div className="sg" style={{ fontSize: 20, fontWeight: 700 }}>semana</div>
        <button onClick={() => setWeekAnchor(addDaysISO(weekAnchor, 7))} style={navBtnStyle}><ChevronRight size={16} /></button>
        <button onClick={() => setWeekAnchor(weekStart(today))} style={{ ...navBtnStyle, width: "auto", padding: "0 12px", fontSize: 13, color: colors.amber, marginLeft: 4 }}>
          semana atual
        </button>
      </div>

      {weeks.map((days) => {
        const firstDay = fromISO(days[0]);
        const lastDay = fromISO(days[days.length - 1]);
        return (
          <section key={days[0]} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11.5, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, margin: "0 2px 10px" }}>
              {firstDay.getDate()} - {lastDay.getDate()} de {firstDay.toLocaleDateString("pt-BR", { month: "long" })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
              {days.map((iso) => {
          const plan = concurso.dailyPlans[iso];
          const isToday = iso === today;
          const isFuture = iso > today;
          const done = plan ? plan.filter((c) => c.feito).length : 0;
          const total = plan ? plan.length : null;
          const d = fromISO(iso);
          const diaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
                return (
                  <button
              key={iso}
              onClick={() => onOpenDay(iso)}
              style={{
                textAlign: "left", background: isToday ? colors.surface2 : colors.surface,
                border: `1px solid ${isToday ? colors.amber : colors.border}`, borderRadius: 12,
                padding: "12px 10px", minHeight: 108, display: "flex", flexDirection: "column", gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: colors.textFaint, textTransform: "uppercase", fontWeight: 600 }}>{diaSemana}</div>
                <div className="sg" style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
              </div>
              {total === null ? (
                <div style={{ fontSize: 11.5, color: colors.textFaint }}>{isFuture ? "a gerar" : "sem plano"}</div>
              ) : total === 0 ? (
                <div style={{ fontSize: 11.5, color: colors.textFaint }}>vazio</div>
              ) : (
                <div>
                  <div className="mono" style={{ fontSize: 13, color: done === total ? colors.teal : colors.text }}>{done}/{total}</div>
                  <div style={{ height: 4, background: colors.borderSoft, borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: 4, width: `${total ? (done / total) * 100 : 0}%`, background: colors.amber, borderRadius: 2 }} />
                  </div>
                </div>
              )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EditalView({ concurso, bulkText, setBulkText, parseBulk, error, newMateriaName, setNewMateriaName, addMateria, addTopics, removeMateria, removeTopic, topicDrafts, setTopicDrafts }) {
  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>edital</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        matérias e assuntos de <b style={{ color: colors.text }}>{concurso.name}</b>. cadastre manualmente ou importe várias de uma vez.
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>importar em lote</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 10 }}>
          uma matéria por linha, no formato <span className="mono" style={{ color: colors.textMuted }}>matéria: assunto 1; assunto 2; assunto 3</span>
        </div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Direito Administrativo: Regime Jurídico da Administração; Poderes Administrativos\nPortuguês: Ortografia - Casos Gerais; Crase"}
          rows={5}
          style={{
            width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8,
            color: colors.text, fontSize: 13, padding: 10, resize: "vertical", boxSizing: "border-box",
          }}
        />
        {error && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 6 }}>{error}</div>}
        <button onClick={parseBulk} style={primaryBtnStyle}><Plus size={14} /> importar</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={newMateriaName}
          onChange={(e) => setNewMateriaName(e.target.value)}
          placeholder="nome da matéria"
          onKeyDown={(e) => { if (e.key === "Enter" && newMateriaName.trim()) { addMateria(newMateriaName); setNewMateriaName(""); } }}
          style={inputStyle}
        />
        <button
          onClick={() => { if (newMateriaName.trim()) { addMateria(newMateriaName); setNewMateriaName(""); } }}
          style={{ ...primaryBtnStyle, marginTop: 0 }}
        >
          <Plus size={14} /> matéria
        </button>
      </div>

      {concurso.materias.length === 0 && (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>nenhuma matéria cadastrada ainda.</div>
      )}

      {concurso.materias.map((m) => {
        const pendentes = m.topics.filter((t) => t.status === "pendente").length;
        const estudados = m.topics.length - pendentes;
        return (
          <div key={m.id} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${m.color}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: colors.textMuted }}>{estudados}/{m.topics.length} estudados</span>
                <button onClick={() => removeMateria(m.id)} style={iconBtnStyle}><Trash2 size={14} /></button>
              </div>
            </div>

            {m.topics.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {m.topics.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5, padding: "6px 8px", borderRadius: 6, background: colors.surface2 }}>
                    <span style={{ color: t.status === "estudado" ? colors.textMuted : colors.text, textDecoration: t.mastered ? "line-through" : "none" }}>{t.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {t.mastered && <span style={{ fontSize: 11, color: colors.teal }}>dominado</span>}
                      <button onClick={() => removeTopic(m.id, t.id)} style={iconBtnStyle}><X size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={topicDrafts[m.id] || ""}
                onChange={(e) => setTopicDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                placeholder="novo assunto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (topicDrafts[m.id] || "").trim()) {
                    addTopics(m.id, [topicDrafts[m.id]]);
                    setTopicDrafts((d) => ({ ...d, [m.id]: "" }));
                  }
                }}
                style={{ ...inputStyle, fontSize: 13, padding: "7px 10px" }}
              />
              <button
                onClick={() => { if ((topicDrafts[m.id] || "").trim()) { addTopics(m.id, [topicDrafts[m.id]]); setTopicDrafts((d) => ({ ...d, [m.id]: "" })); } }}
                style={{ ...secondaryBtnStyle, marginTop: 0 }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetasView({ concurso, updateSettings }) {
  const settings = concurso.settings || defaultSettings();
  const materiasPerDay = settings.materiasPerDay || 0;
  const topicsPerDay = settings.topicsPerDay || 0;
  const minutesPerMateria = settings.minutesPerMateria || 0;
  const totalMaterias = concurso.materias.length;
  const effectivePerDay = materiasPerDay > 0 ? Math.min(materiasPerDay, totalMaterias) : totalMaterias;

  const preview = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(todayISO(), i);
    const ids = rotationMateriaIds(concurso.materias, settings, iso);
    const names = ids.map((id) => concurso.materias.find((m) => m.id === id)?.name).filter(Boolean);
    return { iso, names };
  });

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>metas</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        três números só, para <b style={{ color: colors.text }}>{concurso.name}</b>. o app decide sozinho quais matérias entram em cada dia, revezando entre todas as cadastradas no edital, e monta a semana inteira automaticamente.
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        <GlobalGoalRow
          icon={<Layers size={15} color={colors.amber} />}
          label="matérias por dia"
          hint={materiasPerDay === 0 ? `0 = todas as ${totalMaterias || 0} matérias, todo dia (sem revezamento)` : `revezando de ${effectivePerDay} em ${effectivePerDay}, entre as ${totalMaterias} matérias cadastradas`}
          value={materiasPerDay}
          onChange={(v) => updateSettings("materiasPerDay", v)}
        />
        <GlobalGoalRow
          icon={<Target size={15} color={colors.amber} />}
          label="assuntos por matéria"
          hint="quantos assuntos novos puxar de cada matéria escalada para o dia"
          value={topicsPerDay}
          onChange={(v) => updateSettings("topicsPerDay", v)}
        />
        <GlobalGoalRow
          icon={<Clock size={15} color={colors.amber} />}
          label="minutos por matéria"
          hint="tempo total da sessão daquela matéria — dividido entre os assuntos do dia"
          value={minutesPerMateria}
          onChange={(v) => updateSettings("minutesPerMateria", v)}
          step={5}
        />
      </div>

      {concurso.materias.length === 0 ? (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>cadastre matérias na aba edital para ver a prévia da semana aqui.</div>
      ) : (
        <>
          <SectionLabel text="prévia do revezamento" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {preview.map(({ iso, names }, i) => (
              <div key={iso} style={{ display: "flex", gap: 12, alignItems: "baseline", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 14px" }}>
                <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 70, flexShrink: 0, textTransform: "capitalize" }}>
                  {i === 0 ? "hoje" : formatDatePretty(iso).split(",")[0]}
                </div>
                <div style={{ fontSize: 13, color: names.length ? colors.text : colors.textFaint }}>
                  {names.length ? names.join(" · ") : "nenhuma matéria elegível"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GlobalGoalRow({ icon, label, hint, value, onChange, step = 1 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <input
        type="number" min={0} step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{ ...inputStyle, width: 64, padding: "8px 10px", fontSize: 14, flex: "none", fontWeight: 600, textAlign: "center" }}
      />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>{icon}{label}</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{hint}</div>
      </div>
    </div>
  );
}

function ConcursosView({ concursos, activeConcursoId, newConcursoName, setNewConcursoName, addConcurso, selectConcurso, removeConcurso, renameConcurso }) {
  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>concursos</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        cada concurso tem seu próprio edital, metas e cronograma. clique num concurso para estudar por ele.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={newConcursoName}
          onChange={(e) => setNewConcursoName(e.target.value)}
          placeholder="nome do concurso, ex: PM-AL 2026"
          onKeyDown={(e) => { if (e.key === "Enter" && newConcursoName.trim()) addConcurso(newConcursoName); }}
          style={inputStyle}
        />
        <button onClick={() => { if (newConcursoName.trim()) addConcurso(newConcursoName); }} style={{ ...primaryBtnStyle, marginTop: 0 }}>
          <Plus size={14} /> concurso
        </button>
      </div>

      {concursos.length === 0 && <div style={{ color: colors.textFaint, fontSize: 14 }}>nenhum concurso cadastrado ainda.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {concursos.map((c) => (
          <ConcursoCard
            key={c.id}
            concurso={c}
            isActive={c.id === activeConcursoId}
            onSelect={() => selectConcurso(c.id)}
            onDelete={() => removeConcurso(c.id)}
            onRename={(name) => renameConcurso(c.id, name)}
            canDelete={concursos.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

function ConcursoCard({ concurso, isActive, onSelect, onDelete, onRename, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(concurso.name);

  const totalTopics = concurso.materias.reduce((sum, m) => sum + m.topics.length, 0);
  const doneTopics = concurso.materias.reduce((sum, m) => sum + m.topics.filter((t) => t.status === "estudado").length, 0);

  function saveEdit() {
    if (draft.trim()) onRename(draft);
    else setDraft(concurso.name);
    setEditing(false);
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${isActive ? colors.amber : colors.border}`, borderLeft: `3px solid ${concurso.color}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { setDraft(concurso.name); setEditing(false); } }}
            style={{ ...inputStyle, padding: "6px 8px", fontSize: 14 }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{concurso.name}</div>
            {isActive && (
              <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: colors.amberSoft, color: colors.amber }}>ativo</span>
            )}
          </div>
        )}
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
          {concurso.materias.length} matéria{concurso.materias.length !== 1 ? "s" : ""} · {doneTopics}/{totalTopics} assuntos estudados
        </div>
      </div>

      {!isActive && (
        <button onClick={onSelect} style={{ ...secondaryBtnStyle, padding: "8px 14px", fontSize: 13 }}>estudar este</button>
      )}
      <button onClick={() => setEditing(true)} aria-label="renomear concurso" style={iconBtnStyle}><Pencil size={14} /></button>
      {canDelete && (
        <button onClick={onDelete} aria-label="excluir concurso" style={iconBtnStyle}><Trash2 size={14} /></button>
      )}
    </div>
  );
}

const inputStyle = {
  flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8,
  color: colors.text, fontSize: 14, padding: "9px 12px", boxSizing: "border-box", outline: "none",
};
const primaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.amber, color: "#241a08",
  border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, marginTop: 10,
};
const secondaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.surface2, color: colors.text,
  border: `1px solid ${colors.border}`, borderRadius: 8, padding: "0 12px",
};
const iconBtnStyle = {
  background: "transparent", border: "none", color: colors.textFaint, padding: 4, display: "flex", alignItems: "center",
};

const HEAT_COLORS = [colors.surface2, "#4A3417", "#7A5620", colors.amber];
const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ProgressoView({ activity }) {
  const { current, longest } = computeStreaks(activity);
  const weeks = buildHeatmapWeeks(activity);
  const totalDias = Object.keys(activity).filter((k) => activity[k] > 0).length;
  const totalCards = Object.values(activity).reduce((a, b) => a + b, 0);

  // Month labels above the columns where a new month starts.
  const monthLabels = weeks.map((week) => {
    const first = week[0];
    const d = fromISO(first.iso);
    return d.getDate() <= 7 ? MESES_ABR[d.getMonth()] : "";
  });

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>progresso</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        sua constância ao longo do tempo, somando todos os concursos.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 26 }}>
        <StatCard icon={<Flame size={16} color={colors.amber} />} label="sequência atual" value={`${current} dia${current !== 1 ? "s" : ""}`} />
        <StatCard icon={<Trophy size={16} color={colors.amber} />} label="recorde" value={`${longest} dia${longest !== 1 ? "s" : ""}`} />
        <StatCard icon={<Check size={16} color={colors.amber} />} label="cards concluídos" value={`${totalCards}`} sub={`em ${totalDias} dia${totalDias !== 1 ? "s" : ""}`} />
      </div>

      <SectionLabel text="últimas 18 semanas" />
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, overflowX: "auto" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {monthLabels.map((label, i) => (
              <div key={i} style={{ width: 13, fontSize: 10, color: colors.textFaint }}>{label}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {week.map((day) => (
                  <div
                    key={day.iso}
                    title={`${day.iso} · ${day.count} card${day.count !== 1 ? "s" : ""}`}
                    style={{
                      width: 13, height: 13, borderRadius: 3,
                      background: day.future ? "transparent" : HEAT_COLORS[heatLevel(day.count)],
                      border: day.future ? `1px dashed ${colors.borderSoft}` : "none",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: colors.textFaint }}>menos</span>
            {HEAT_COLORS.map((c, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
            ))}
            <span style={{ fontSize: 11, color: colors.textFaint }}>mais</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>{icon}<span style={{ fontSize: 12, color: colors.textMuted }}>{label}</span></div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
