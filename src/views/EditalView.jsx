import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, GripVertical, Library, Link2, Plus, StickyNote, Trash2, X } from "lucide-react";
import { colors } from "../styles/colors.js";
import { iconBtnStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function EditalView({ concurso, bulkText, setBulkText, parseBulk, error, bulkHintMatches, useContentBankTopicsFor, newMateriaName, setNewMateriaName, addMateria, addTopics, removeMateria, removeTopic, moveMateria, reorderMaterias, updateTopicNotes, updateTopicLink, topicDrafts, setTopicDrafts, contentBank, importFromBank }) {
  // Drag state lives here (not in each card) since a drag needs to know
  // about every OTHER card too — which one the pointer is currently over,
  // to highlight it as the drop target. `dragState` also drives the little
  // floating label that follows the pointer; `dragIdRef`/`overIdRef` mirror
  // the same ids into refs purely so the pointerup handler (attached once
  // per drag gesture, not re-attached on every pointermove) always reads
  // the latest values instead of a stale closure.
  const [dragState, setDragState] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null);
  const overIdRef = useRef(null);

  function startDrag(m, e) {
    e.preventDefault();
    dragIdRef.current = m.id;
    overIdRef.current = null;
    setDragState({ id: m.id, x: e.clientX, y: e.clientY, name: m.name, color: m.color });
    setOverId(null);
  }

  useEffect(() => {
    if (!dragState) return;
    function onMove(e) {
      setDragState((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-materia-id]");
      const id = row ? row.getAttribute("data-materia-id") : null;
      overIdRef.current = id;
      setOverId(id);
    }
    function onUp() {
      const fromId = dragIdRef.current;
      const toId = overIdRef.current;
      if (fromId && toId && fromId !== toId) reorderMaterias(fromId, toId);
      dragIdRef.current = null;
      overIdRef.current = null;
      setDragState(null);
      setOverId(null);
      // The browser fires a "click" right after this pointerup, landing on
      // whichever collapse-toggle button happens to sit under the release
      // point (the original card, or the drop target if the drag moved
      // over another one) — swallow that one click so a drag never also
      // toggles a card open/closed as a side effect.
      window.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.id]);

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>edital</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        matérias e assuntos de <b style={{ color: colors.text }}>{concurso.name}</b>. cadastre manualmente ou importe várias de uma vez. a ordem das matérias abaixo define a ordem do rodízio diário — arraste pelo ⠿ ou use as setas para reorganizar.
      </div>

      {dragState && (
        <div
          style={{
            position: "fixed", left: dragState.x + 14, top: dragState.y + 10, zIndex: 1000, pointerEvents: "none",
            background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${dragState.color}`,
            borderRadius: 8, padding: "8px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            fontSize: 13.5, fontWeight: 700, color: colors.text, maxWidth: 240,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {dragState.name}
        </div>
      )}

      {contentBank && contentBank.length > 0 && (
        <ContentBankImporter concurso={concurso} contentBank={contentBank} importFromBank={importFromBank} />
      )}

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>importar em lote</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 10 }}>
          uma matéria por linha, no formato <span className="mono" style={{ color: colors.textMuted }}>matéria: assunto 1; assunto 2; assunto 3</span>
          <br />
          também aceita o edital colado do jeito que sai do PDF, com numeração (ex: <span className="mono" style={{ color: colors.textMuted }}>LÍNGUA PORTUGUESA: 1 Compreensão... 2 Reconhecimento...</span>) — o sistema identifica a matéria e quebra os itens automaticamente.
          <br />
          se colar só a numeração, sem o nome da matéria na frente (ex: <span className="mono" style={{ color: colors.textMuted }}>1 Compreensão... 2 Reconhecimento...</span>), digite o nome no campo "nome da matéria" logo abaixo antes de clicar em importar.
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
        {bulkHintMatches && bulkHintMatches.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {bulkHintMatches.map((m) => (
              <div key={m.materiaName} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: colors.amber, fontSize: 12.5 }}>
                <Library size={13} style={{ flexShrink: 0 }} />
                <span>
                  o banco tem uma versão mais detalhada de "{m.materiaName}": {m.bankEntry.topics.length} assuntos (o texto colado só deu {m.importedCount}).
                </span>
                <button
                  onClick={() => useContentBankTopicsFor(m.materiaName, m.bankEntry.id)}
                  style={{ ...secondaryBtnStyle, padding: "3px 10px", fontSize: 12, height: 24, flexShrink: 0 }}
                >
                  usar os {m.bankEntry.topics.length} do banco
                </button>
              </div>
            ))}
          </div>
        )}
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

      {concurso.materias.map((m, index) => (
        <MateriaEditalCard
          key={m.id}
          materia={m}
          isFirst={index === 0}
          isLast={index === concurso.materias.length - 1}
          topicDraft={topicDrafts[m.id] || ""}
          setTopicDraft={(v) => setTopicDrafts((d) => ({ ...d, [m.id]: v }))}
          addTopics={addTopics}
          removeMateria={removeMateria}
          removeTopic={removeTopic}
          moveMateria={moveMateria}
          updateTopicNotes={updateTopicNotes}
          updateTopicLink={updateTopicLink}
          onDragHandlePointerDown={(e) => startDrag(m, e)}
          isDragging={dragState?.id === m.id}
          isDropTarget={overId === m.id && dragState && dragState.id !== m.id}
        />
      ))}
    </div>
  );
}

function ContentBankImporter({ concurso, contentBank, importFromBank }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [feedback, setFeedback] = useState("");

  const ownedNames = useMemo(() => new Set(concurso.materias.map((m) => m.name.toLowerCase())), [concurso.materias]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contentBank.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [contentBank, search]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImport() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const count = importFromBank(ids);
    setFeedback(count > 0 ? `${count} assunto(s) importado(s).` : "nada de novo — já estavam no seu edital.");
    setSelected(new Set());
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "transparent", border: "none", padding: 0, textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
          <Library size={14} /> importar do banco de matérias
        </div>
        <span style={{ color: colors.textFaint, display: "flex" }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>

      {!open && (
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 6 }}>
          {contentBank.length} matéria(s) prontas no banco compartilhado — importe direto pro seu edital sem digitar nada.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar matéria..."
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 10 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 12, fontSize: 12.5, color: colors.textFaint }}>nenhuma matéria encontrada.</div>
            )}
            {filtered.map((m) => {
              const already = ownedNames.has(m.name.toLowerCase());
              return (
                <label
                  key={m.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13,
                    borderTop: `1px solid ${colors.border}`, cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  <span style={{ flex: 1, color: colors.text }}>{m.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: colors.textFaint }}>{m.topics.length} assuntos</span>
                  {already && <span style={{ fontSize: 10.5, color: colors.teal }}>já no edital</span>}
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={handleImport} disabled={selected.size === 0} style={{ ...primaryBtnStyle, marginTop: 0, opacity: selected.size === 0 ? 0.5 : 1 }}>
              <Plus size={14} /> importar {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
            {feedback && <span style={{ fontSize: 12, color: colors.textMuted }}>{feedback}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function MateriaEditalCard({ materia: m, isFirst, isLast, topicDraft, setTopicDraft, addTopics, removeMateria, removeTopic, moveMateria, updateTopicNotes, updateTopicLink, onDragHandlePointerDown, isDragging, isDropTarget }) {
  const [collapsed, setCollapsed] = useState(false);
  const pendentes = m.topics.filter((t) => t.status === "pendente").length;
  const estudados = m.topics.length - pendentes;

  function submitTopic() {
    if (!topicDraft.trim()) return;
    addTopics(m.id, [topicDraft]);
    setTopicDraft("");
  }

  return (
    <div
      data-materia-id={m.id}
      style={{
        background: colors.surface, border: `1px solid ${isDropTarget ? colors.amber : colors.border}`,
        borderLeft: `3px solid ${m.color}`, borderRadius: 10, padding: 16, marginBottom: 12,
        opacity: isDragging ? 0.4 : 1, transition: "opacity 0.1s, border-color 0.1s",
      }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", padding: 0, marginBottom: collapsed ? 0 : 10, textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            role="button"
            aria-label="arrastar para reordenar"
            title="arrastar para reordenar"
            onPointerDown={(e) => { e.stopPropagation(); onDragHandlePointerDown(e); }}
            style={{ ...iconBtnStyle, cursor: "grab", touchAction: "none" }}
          >
            <GripVertical size={15} />
          </span>
          <span style={{ color: colors.textFaint, display: "flex" }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 12, color: colors.textMuted }}>{estudados}/{m.topics.length} estudados</span>
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span
              role="button"
              aria-label="mover matéria para cima"
              onClick={(e) => { e.stopPropagation(); if (!isFirst) moveMateria(m.id, -1); }}
              style={{ ...iconBtnStyle, opacity: isFirst ? 0.3 : 1, cursor: isFirst ? "default" : "pointer" }}
            >
              <ArrowUp size={14} />
            </span>
            <span
              role="button"
              aria-label="mover matéria para baixo"
              onClick={(e) => { e.stopPropagation(); if (!isLast) moveMateria(m.id, 1); }}
              style={{ ...iconBtnStyle, opacity: isLast ? 0.3 : 1, cursor: isLast ? "default" : "pointer" }}
            >
              <ArrowDown size={14} />
            </span>
          </span>
          <span
            role="button"
            aria-label="excluir matéria"
            onClick={(e) => { e.stopPropagation(); removeMateria(m.id); }}
            style={iconBtnStyle}
          >
            <Trash2 size={14} />
          </span>
        </div>
      </button>

      {!collapsed && (
        <>
          {m.topics.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {m.topics.map((t) => (
                <TopicEditalRow key={t.id} materiaId={m.id} topic={t} removeTopic={removeTopic} updateTopicNotes={updateTopicNotes} updateTopicLink={updateTopicLink} />
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={topicDraft}
              onChange={(e) => setTopicDraft(e.target.value)}
              placeholder="novo assunto"
              onKeyDown={(e) => { if (e.key === "Enter") submitTopic(); }}
              style={{ ...inputStyle, fontSize: 13, padding: "7px 10px" }}
            />
            <button onClick={submitTopic} style={{ ...secondaryBtnStyle, marginTop: 0 }}>
              <Plus size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TopicEditalRow({ materiaId, topic: t, removeTopic, updateTopicNotes, updateTopicLink }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState(t.notes || "");
  const hasNotes = (t.notes || "").trim().length > 0;

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState(t.link || "");
  const hasLink = (t.link || "").trim().length > 0;

  function saveIfChanged() {
    if (draft !== (t.notes || "")) updateTopicNotes(materiaId, t.id, draft);
  }

  function saveLinkIfChanged() {
    if (linkDraft !== (t.link || "")) updateTopicLink(materiaId, t.id, linkDraft.trim());
  }

  return (
    <div style={{ background: colors.surface2, borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5 }}>
        <span style={{ color: t.status === "estudado" ? colors.textMuted : colors.text, textDecoration: t.mastered ? "line-through" : "none" }}>{t.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {t.questionsTotal > 0 && (
            <span className="mono" style={{ fontSize: 10.5, color: colors.textFaint }}>
              {t.questionsCorrect}/{t.questionsTotal} questões
            </span>
          )}
          {t.mastered && <span style={{ fontSize: 11, color: colors.teal }}>dominado</span>}
          {hasLink && (
            <a href={t.link} target="_blank" rel="noreferrer" aria-label="abrir caderno de questões" style={{ ...iconBtnStyle, color: colors.teal }}>
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => setLinkOpen((o) => !o)}
            aria-label="link do caderno de questões"
            style={{ ...iconBtnStyle, color: hasLink ? colors.teal : colors.textFaint }}
          >
            <Link2 size={13} />
          </button>
          <button
            onClick={() => setNotesOpen((o) => !o)}
            aria-label="anotações do assunto"
            style={{ ...iconBtnStyle, color: hasNotes ? colors.amber : colors.textFaint }}
          >
            <StickyNote size={13} />
          </button>
          <button onClick={() => removeTopic(materiaId, t.id)} style={iconBtnStyle}><X size={13} /></button>
        </div>
      </div>

      {linkOpen && (
        <input
          autoFocus
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          onBlur={saveLinkIfChanged}
          onKeyDown={(e) => { if (e.key === "Enter") { saveLinkIfChanged(); setLinkOpen(false); } }}
          placeholder="link do caderno de questões (ex: TecConcursos)"
          style={{
            width: "100%", marginTop: 6, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6,
            color: colors.text, fontSize: 12.5, padding: "6px 8px", boxSizing: "border-box",
          }}
        />
      )}

      {notesOpen && (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveIfChanged}
          placeholder="observações, pegadinhas, pontos de atenção..."
          rows={2}
          style={{
            width: "100%", marginTop: 6, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6,
            color: colors.text, fontSize: 12.5, padding: 8, resize: "vertical", boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}
