import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen, CalendarDays, ChevronRight, Flame, GraduationCap, ListChecks, Settings, Sparkles, Target,
} from "lucide-react";
import { colors } from "./styles/colors.js";
import { PALETTE, defaultSettings, defaultData, makeConcurso, migrate } from "./data/model.js";
import { addDaysISO, todayISO, weekStart } from "./lib/date.js";
import { buildDayPlan } from "./lib/planner.js";
import { computeStreaks } from "./lib/streaks.js";
import { uid } from "./lib/id.js";
import { useTheme } from "./lib/useTheme.js";
import { useSessionTimers } from "./lib/useSessionTimers.js";
import { fetchPlanData, savePlanData } from "./api/planData.js";
import { NavItem } from "./components/NavItem.jsx";
import { EmptyConcursoState } from "./components/EmptyConcursoState.jsx";
import { DiaView } from "./views/DiaView.jsx";
import { SemanaView } from "./views/SemanaView.jsx";
import { EditalView } from "./views/EditalView.jsx";
import { MetasView } from "./views/MetasView.jsx";
import { ConcursosView } from "./views/ConcursosView.jsx";
import { ProgressoView } from "./views/ProgressoView.jsx";
import { AjustesView } from "./views/AjustesView.jsx";

export default function App({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekAnchor, setWeekAnchor] = useState(weekStart(todayISO()));
  const [bulkText, setBulkText] = useState("");
  const [newMateriaName, setNewMateriaName] = useState("");
  const [newConcursoName, setNewConcursoName] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({});
  const [error, setError] = useState("");
  const [theme, setTheme] = useTheme();
  const sessionTimers = useSessionTimers();
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const value = await fetchPlanData();
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
        const c = makeConcurso("Meu concurso", 0);
        setData({ concursos: [c], activeConcursoId: c.id, activity: {} });
      }
      loaded.current = true;
    })();
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

  function importData(imported) {
    setData(imported);
    setSelectedDate(todayISO());
    setTab("dia");
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
        <NavItem icon={<Settings size={16} />} label="ajustes" active={tab === "ajustes"} onClick={() => setTab("ajustes")} />

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginTop: 8 }}>
          <div style={{ fontSize: 11, color: colors.textFaint, padding: "0 10px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.email}
          </div>
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

        {tab === "progresso" && <ProgressoView activity={data.activity || {}} activeConcurso={activeConcurso} />}

        {tab === "ajustes" && (
          <AjustesView theme={theme} setTheme={setTheme} data={data} onImport={importData} />
        )}

        {tab !== "concursos" && tab !== "progresso" && tab !== "ajustes" && !activeConcurso && (
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
