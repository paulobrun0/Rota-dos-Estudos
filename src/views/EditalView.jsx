import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { colors } from "../styles/colors.js";
import { iconBtnStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function EditalView({ concurso, bulkText, setBulkText, parseBulk, error, newMateriaName, setNewMateriaName, addMateria, addTopics, removeMateria, removeTopic, topicDrafts, setTopicDrafts }) {
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

      {concurso.materias.map((m) => (
        <MateriaEditalCard
          key={m.id}
          materia={m}
          topicDraft={topicDrafts[m.id] || ""}
          setTopicDraft={(v) => setTopicDrafts((d) => ({ ...d, [m.id]: v }))}
          addTopics={addTopics}
          removeMateria={removeMateria}
          removeTopic={removeTopic}
        />
      ))}
    </div>
  );
}

function MateriaEditalCard({ materia: m, topicDraft, setTopicDraft, addTopics, removeMateria, removeTopic }) {
  const [collapsed, setCollapsed] = useState(false);
  const pendentes = m.topics.filter((t) => t.status === "pendente").length;
  const estudados = m.topics.length - pendentes;

  function submitTopic() {
    if (!topicDraft.trim()) return;
    addTopics(m.id, [topicDraft]);
    setTopicDraft("");
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${m.color}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", padding: 0, marginBottom: collapsed ? 0 : 10, textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: colors.textFaint, display: "flex" }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 12, color: colors.textMuted }}>{estudados}/{m.topics.length} estudados</span>
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
