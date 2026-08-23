import React, { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { colors } from "../styles/colors.js";
import { iconBtnStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function ConcursosView({ concursos, activeConcursoId, newConcursoName, setNewConcursoName, addConcurso, selectConcurso, removeConcurso, renameConcurso }) {
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
