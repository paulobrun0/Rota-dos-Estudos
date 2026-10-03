import { SharedPractice } from "../components/SharedPractice.jsx";
import { filterTopics } from "../lib/studyInsights.js";
import { TopicLinkButtons, TopicLinksEditor } from "../components/TopicLinks.jsx";
import { getTopicLinks } from "../lib/topicLinks.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Library, Link2, Plus, StickyNote, Trash2, X } from "../components/Icons.jsx";
import { colors } from "../styles/colors.js";
import { iconBtnStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function EditalView({ concurso, bulkText, setBulkText, parseBulk, error, bulkHintMatches, useContentBankTopicsFor, newMateriaName, setNewMateriaName, addMateria, addTopics, removeMateria, removeTopic, moveMateria, reorderMaterias, updateTopicNotes, updateTopicLink, updateTopicMaterials, skipShared, undoShared, topicDrafts, setTopicDrafts, contentBank, importFromBank }) {
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

  // Lives here (not inside each card) so "expandir todas"/"recolher todas"
  // can drive every card at once, while a single card's own toggle still
  // works independently — not being in this set just means collapsed,
  // which is why a newly added matéria starts collapsed with no extra
  // bookkeeping needed.
  const [topicFilter, setTopicFilter] = useState({query:"", status:"all", sort:"original"});
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
              <div key={m.materiaName} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: colors.accent, fontSize: 12.5 }}>
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

      {concurso.materias.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
          <button onClick={() => setExpandedIds(new Set(concurso.materias.map((m) => m.id)))} style={{ background: "transparent", border: "none", padding: 0, fontSize: 12.5, color: colors.accent, cursor: "pointer" }}>
            expandir todas
          </button>
          <button onClick={() => setExpandedIds(new Set())} style={{ background: "transparent", border: "none", padding: 0, fontSize: 12.5, color: colors.accent, cursor: "pointer" }}>
            recolher todas
          </button>
        </div>
      )}

      <div className="filter-bar" style={{marginBottom:16}}><input aria-label="Buscar assunto no edital" placeholder="Buscar assunto" value={topicFilter.query} onChange={e=>setTopicFilter({...topicFilter,query:e.target.value})} style={inputStyle}/><select aria-label="Situação dos assuntos" value={topicFilter.status} onChange={e=>setTopicFilter({...topicFilter,status:e.target.value})} style={inputStyle}><option value="all">Todos os assuntos</option><option value="pending">Pendentes</option><option value="studied">Estudados</option><option value="due">Revisões previstas</option></select><select aria-label="Ordenar assuntos" value={topicFilter.sort} onChange={e=>setTopicFilter({...topicFilter,sort:e.target.value})} style={inputStyle}><option value="original">Ordem do edital</option><option value="accuracy">Menores acertos</option><option value="review">Próxima revisão</option><option value="name">Nome do assunto</option></select></div>
      {concurso.materias.map((m, index) => (
        <MateriaEditalCard
          key={m.id}
          materia={m}
          topicFilter={topicFilter}
          isFirst={index === 0}
          isLast={index === concurso.materias.length - 1}
          topicDraft={topicDrafts[m.id] || ""}
          setTopicDraft={(v) => setTopicDrafts((d) => ({ ...d, [m.id]: v }))}
          addTopics={addTopics}
          removeMateria={removeMateria}
          removeTopic={removeTopic}
          moveMateria={moveMateria}
          skipShared={skipShared} undoShared={undoShared} updateTopicMaterials={updateTopicMaterials} updateTopicNotes={updateTopicNotes}
          updateTopicLink={updateTopicLink}
          onDragHandlePointerDown={(e) => startDrag(m, e)}
          isDragging={dragState?.id === m.id}
          isDropTarget={overId === m.id && dragState && dragState.id !== m.id}
          isExpanded={expandedIds.has(m.id) || Boolean(topicFilter.query) || topicFilter.status !== "all"}
          onToggleExpanded={() => toggleExpanded(m.id)}
        />
      ))}
    </div>
  );
}

function ContentBankImporter({ concurso, contentBank, importFromBank }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // bankMateriaId -> Set<topicName> — which individual assuntos are picked,
  // not just which matérias, so a matéria with 80 assuntos doesn't have to
  // come in all-or-nothing.
  const [selected, setSelected] = useState(() => new Map());
  const [expanded, setExpanded] = useState(() => new Set());
  const [feedback, setFeedback] = useState("");

  // Per matéria name, the assuntos the user already has — lets the topic
  // list mark exactly which ones are already in the edital instead of just
  // flagging the whole matéria as "already added".
  const ownedTopicsByMateria = useMemo(() => {
    const map = new Map();
    concurso.materias.forEach((m) => {
      map.set(m.name.toLowerCase(), new Set(m.topics.map((t) => t.name.toLowerCase())));
    });
    return map;
  }, [concurso.materias]);

  // A search term matches either the matéria name (show every assunto) or
  // individual assunto names (narrow that matéria's list down to just the
  // matches) — `matchedTopics: null` means "show them all".
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contentBank.map((m) => ({ ...m, matchedTopics: null }));
    return contentBank
      .map((m) => {
        const nameMatches = m.name.toLowerCase().includes(q);
        if (nameMatches) return { ...m, matchedTopics: null };
        const matchedTopics = m.topics.filter((t) => t.toLowerCase().includes(q));
        return matchedTopics.length > 0 ? { ...m, matchedTopics } : null;
      })
      .filter(Boolean);
  }, [contentBank, search]);

  function visibleTopicsFor(m) {
    return m.matchedTopics || m.topics;
  }

  // Only adds/removes whichever topics are currently VISIBLE (the search
  // might be narrowing `topics` down to a few matches) — replacing the whole
  // per-matéria set outright would silently drop any selection made earlier
  // under a different (or no) search filter.
  function toggleMateria(m) {
    const topics = visibleTopicsFor(m);
    setSelected((prev) => {
      const current = prev.get(m.id) || new Set();
      const allSelected = topics.length > 0 && topics.every((t) => current.has(t));
      const updated = new Set(current);
      topics.forEach((t) => (allSelected ? updated.delete(t) : updated.add(t)));
      const next = new Map(prev);
      if (updated.size === 0) next.delete(m.id);
      else next.set(m.id, updated);
      return next;
    });
  }

  function toggleTopic(bankId, topicName) {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(bankId) || []);
      if (current.has(topicName)) current.delete(topicName);
      else current.add(topicName);
      if (current.size === 0) next.delete(bankId);
      else next.set(bankId, current);
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalSelected = useMemo(() => {
    let total = 0;
    selected.forEach((set) => { total += set.size; });
    return total;
  }, [selected]);

  function handleImport() {
    if (totalSelected === 0) return;
    const count = importFromBank(selected);
    setFeedback(count > 0 ? `${count} assunto(s) importado(s).` : "nada de novo — já estavam no seu edital.");
    setSelected(new Map());
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
          {contentBank.length} matéria(s) prontas no banco compartilhado — importe a matéria inteira ou só os assuntos que interessam.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar matéria ou assunto..."
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 10 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 12, fontSize: 12.5, color: colors.textFaint }}>nenhuma matéria ou assunto encontrado.</div>
            )}
            {filtered.map((m) => {
              const topics = visibleTopicsFor(m);
              const ownedSet = ownedTopicsByMateria.get(m.name.toLowerCase()) || new Set();
              const ownedCount = topics.filter((t) => ownedSet.has(t.toLowerCase())).length;
              const selectedSet = selected.get(m.id);
              const selectedCount = selectedSet ? topics.filter((t) => selectedSet.has(t)).length : 0;
              const isExpanded = expanded.has(m.id) || Boolean(m.matchedTopics);
              return (
                <div key={m.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={selectedCount > 0 && selectedCount === topics.length}
                      onChange={() => toggleMateria(m)}
                      title="selecionar todos os assuntos listados dessa matéria"
                    />
                    <button
                      onClick={() => toggleExpanded(m.id)}
                      aria-label={isExpanded ? "recolher assuntos" : "ver assuntos"}
                      style={{ background: "transparent", border: "none", padding: 2, display: "flex", color: colors.textFaint }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span style={{ flex: 1, color: colors.text, cursor: "pointer" }} onClick={() => toggleExpanded(m.id)}>{m.name}</span>
                    <span className="mono" style={{ fontSize: 11, color: colors.textFaint }}>
                      {selectedCount > 0 ? `${selectedCount}/${topics.length}` : topics.length} assunto{topics.length !== 1 ? "s" : ""}
                    </span>
                    {ownedCount > 0 && (
                      <span style={{ fontSize: 10.5, color: colors.success }}>
                        {ownedCount === topics.length ? "já no edital" : `${ownedCount} já no edital`}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: 34, paddingBottom: 6 }}>
                      {topics.map((topicName) => {
                        const topicAlready = ownedSet.has(topicName.toLowerCase());
                        const topicSelected = selectedSet?.has(topicName) || false;
                        return (
                          <label
                            key={topicName}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 0", fontSize: 12.5, cursor: "pointer" }}
                          >
                            <input type="checkbox" checked={topicSelected} onChange={() => toggleTopic(m.id, topicName)} />
                            <span style={{ flex: 1, color: topicAlready ? colors.textFaint : colors.text }}>{topicName}</span>
                            {topicAlready && <span style={{ fontSize: 10, color: colors.success }}>já no edital</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={handleImport} disabled={totalSelected === 0} style={{ ...primaryBtnStyle, marginTop: 0, opacity: totalSelected === 0 ? 0.5 : 1 }}>
              <Plus size={14} /> importar {totalSelected > 0 ? `(${totalSelected})` : ""}
            </button>
            {feedback && <span style={{ fontSize: 12, color: colors.textMuted }}>{feedback}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function MateriaEditalCard({ materia: m, topicFilter, isFirst, isLast, topicDraft, setTopicDraft, addTopics, removeMateria, removeTopic, moveMateria, updateTopicNotes, updateTopicLink, updateTopicMaterials, skipShared, undoShared, onDragHandlePointerDown, isDragging, isDropTarget, isExpanded, onToggleExpanded }) {
  const collapsed = !isExpanded;
  const visibleTopics = filterTopics(m.topics, topicFilter);
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
        background: colors.surface, border: `1px solid ${isDropTarget ? colors.accent : colors.border}`,
        borderLeft: `3px solid ${m.color}`, borderRadius: 10, padding: 16, marginBottom: 12,
        opacity: isDragging ? 0.4 : 1, transition: "opacity 0.1s, border-color 0.1s",
      }}
    >
      <button
        className="materia-heading"
        onClick={onToggleExpanded}
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
            <div className="topic-table-wrap" tabIndex={0} role="region" aria-label={`Tabela de assuntos de ${m.name}`}><table className="topic-table edital-topics-table" aria-label={`Assuntos de ${m.name}`}><thead><tr><th scope="col">Assunto</th><th scope="col">Situação</th><th scope="col">Questões</th><th scope="col">Cadernos</th><th scope="col">Ações</th></tr></thead><tbody>
              {visibleTopics.map((t) => (
                <TopicEditalRow key={t.id} materiaId={m.id} topic={t} removeTopic={removeTopic} skipShared={skipShared} undoShared={undoShared} updateTopicMaterials={updateTopicMaterials} updateTopicNotes={updateTopicNotes} updateTopicLink={updateTopicLink} />
              ))}
            </tbody></table>{!visibleTopics.length && <p className="muted" style={{padding:12}}>Nenhum assunto neste filtro.</p>}</div>
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

function TopicEditalRow({ materiaId, topic: t, removeTopic, updateTopicNotes, updateTopicLink, updateTopicMaterials, skipShared, undoShared }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState(t.notes || "");
  const hasNotes = (t.notes || "").trim().length > 0;

  const [linkOpen, setLinkOpen] = useState(false);
  const hasLink = Object.values(getTopicLinks(t)).some(Boolean);

  function saveIfChanged() {
    if (draft !== (t.notes || "")) updateTopicNotes(materiaId, t.id, draft);
  }



  return <>
    <tr>
      <td data-label="Assunto" style={{ color: colors.text, textDecoration: t.mastered ? "line-through" : "none" }}>{t.name}<SharedPractice topic={t} onSkip={() => skipShared(materiaId, t.id)} onUndo={() => undoShared(materiaId, t.id)} /></td>
      <td data-label="Situação"><span className="topic-status" style={{ color: t.mastered ? colors.success : t.status === "estudado" ? colors.accent : colors.textMuted, background: t.status === "estudado" ? colors.accentSoft : colors.surface2 }}>{t.mastered ? "dominado" : t.status === "estudado" ? "estudado" : "pendente"}</span></td>
      <td data-label="Questões"><span className="mono">{(t.crossStudy?.total ?? t.questionsTotal) > 0 ? `${t.crossStudy?.correct ?? t.questionsCorrect}/${t.crossStudy?.total ?? t.questionsTotal}` : "—"}</span>{(t.crossStudy?.total ?? t.questionsTotal) > 0 && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{Math.round((t.crossStudy?.correct ?? t.questionsCorrect) / (t.crossStudy?.total ?? t.questionsTotal) * 100)}% de acertos</div>}</td>
      <td data-label="Cadernos"><div className="topic-actions"><TopicLinkButtons topic={t} /><button type="button" onClick={() => setLinkOpen(o => !o)} aria-label={`buscar questões de ${t.name}`} style={{ ...secondaryBtnStyle, marginTop: 0, padding: "4px 8px", fontSize: 11 }}>Buscar questões</button><button onClick={() => setLinkOpen(o => !o)} aria-label="link do caderno de questões" aria-expanded={linkOpen} title="Editar links dos cadernos" style={{ ...iconBtnStyle, color: hasLink ? colors.success : colors.textFaint }}><Link2 size={16} /></button></div></td>
      <td data-label="Ações"><div className="topic-actions"><button onClick={() => setNotesOpen(o => !o)} aria-label="anotações do assunto" aria-expanded={notesOpen} title="Anotações" style={{ ...iconBtnStyle, color: hasNotes ? colors.accent : colors.textFaint }}><StickyNote size={16} /></button><button onClick={() => removeTopic(materiaId, t.id)} aria-label={`excluir assunto ${t.name}`} title="Excluir assunto" style={iconBtnStyle}><X size={16} /></button></div></td>
    </tr>
    {(linkOpen || notesOpen) && <tr className="topic-detail"><td colSpan={5}>
      {linkOpen && <TopicLinksEditor topic={t} onSaveMaterials={(materials) => updateTopicMaterials(materiaId, t.id, materials)} onSave={(links) => updateTopicLink(materiaId, t.id, links)} onClose={() => setLinkOpen(false)} />}
      {notesOpen && <label style={{ display: "grid", gap: 6, fontSize: 12, color: colors.textMuted }}>Anotações — {t.name}<textarea value={draft} onChange={e => setDraft(e.target.value)} onBlur={saveIfChanged} placeholder="observações, pegadinhas, pontos de atenção..." rows={3} style={{ ...inputStyle, width: "100%", resize: "vertical" }} /></label>}
    </td></tr>}
  </>;
}
