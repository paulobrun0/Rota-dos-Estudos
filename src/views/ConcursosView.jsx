import React, { useState } from "react";
import { AlertTriangle, CalendarClock, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { colors } from "../styles/colors.js";
import { iconBtnStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";
import { examCountdownInfo } from "../lib/examCountdown.js";

export function ConcursosView({ concursos, activeConcursoId, newConcursoName, setNewConcursoName, addConcurso, selectConcurso, removeConcurso, renameConcurso, setExamDate, resetCycle }) {
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
            onExamDateChange={(date) => setExamDate(c.id, date)}
            onResetCycle={(keepHistory) => resetCycle(c.id, keepHistory)}
            canDelete={concursos.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

const BADGE_COLOR = { past: colors.textFaint, critical: colors.red, soon: colors.amber, normal: colors.textMuted };

function ConcursoCard({ concurso, isActive, onSelect, onDelete, onRename, onExamDateChange, onResetCycle, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(concurso.name);
  const [editingDate, setEditingDate] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState("keep");
  const [resetConfirmText, setResetConfirmText] = useState("");

  const totalTopics = concurso.materias.reduce((sum, m) => sum + m.topics.length, 0);
  const doneTopics = concurso.materias.reduce((sum, m) => sum + m.topics.filter((t) => t.status === "estudado").length, 0);
  const badgeInfo = examCountdownInfo(concurso.examDate);
  const badge = badgeInfo ? { text: badgeInfo.text, color: BADGE_COLOR[badgeInfo.level] } : null;

  function saveEdit() {
    if (draft.trim()) onRename(draft);
    else setDraft(concurso.name);
    setEditing(false);
  }

  function closeReset() {
    setResetOpen(false);
    setResetMode("keep");
    setResetConfirmText("");
  }

  function confirmReset() {
    if (resetConfirmText !== concurso.name) return;
    onResetCycle(resetMode === "keep");
    closeReset();
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${isActive ? colors.amber : colors.border}`, borderLeft: `3px solid ${concurso.color}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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

        <div style={{ marginTop: 6 }}>
          {editingDate ? (
            <input
              autoFocus
              type="date"
              defaultValue={concurso.examDate || ""}
              onBlur={(e) => { onExamDateChange(e.target.value); setEditingDate(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingDate(false); }}
              style={{ ...inputStyle, padding: "4px 8px", fontSize: 12.5 }}
            />
          ) : (
            <button
              onClick={() => setEditingDate(true)}
              style={{ background: "transparent", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <CalendarClock size={12} color={badge ? badge.color : colors.textFaint} />
              <span className="mono" style={{ fontSize: 11.5, color: badge ? badge.color : colors.textFaint }}>
                {badge ? badge.text : "definir data da prova"}
              </span>
            </button>
          )}
        </div>
      </div>

        {!isActive && (
          <button onClick={onSelect} style={{ ...secondaryBtnStyle, padding: "8px 14px", fontSize: 13 }}>estudar este</button>
        )}
        <button onClick={() => setEditing(true)} aria-label="renomear concurso" style={iconBtnStyle}><Pencil size={14} /></button>
        <button onClick={() => setResetOpen((o) => !o)} aria-label="reiniciar ciclo" title="reiniciar ciclo do zero" style={iconBtnStyle}><RotateCcw size={14} /></button>
        {canDelete && (
          <button onClick={onDelete} aria-label="excluir concurso" style={iconBtnStyle}><Trash2 size={14} /></button>
        )}
      </div>

      {resetOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={15} color={colors.red} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: colors.textMuted }}>
              isso volta todos os assuntos pra "pendente" e zera o plano do dia — não tem como desfazer.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setResetMode("keep")}
              style={{
                flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: resetMode === "keep" ? colors.tealSoft : colors.surface2,
                border: `1px solid ${resetMode === "keep" ? colors.teal : colors.border}`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: resetMode === "keep" ? colors.teal : colors.text }}>manter histórico</div>
              <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>guarda as passadas e o % de acerto de cada assunto</div>
            </button>
            <button
              onClick={() => setResetMode("full")}
              style={{
                flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: resetMode === "full" ? colors.redSoft : colors.surface2,
                border: `1px solid ${resetMode === "full" ? colors.red : colors.border}`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: resetMode === "full" ? colors.red : colors.text }}>apagar tudo</div>
              <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>remove também o histórico e as questões registradas</div>
            </button>
          </div>

          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            digite <b style={{ color: colors.text }}>{concurso.name}</b> pra confirmar:
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder={concurso.name}
              style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 13 }}
            />
            <button
              onClick={confirmReset}
              disabled={resetConfirmText !== concurso.name}
              style={{
                ...primaryBtnStyle, marginTop: 0, padding: "7px 14px", fontSize: 13,
                background: colors.red, opacity: resetConfirmText === concurso.name ? 1 : 0.4,
              }}
            >
              confirmar reset
            </button>
            <button onClick={closeReset} style={{ ...secondaryBtnStyle, padding: "7px 14px", fontSize: 13 }}>cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
