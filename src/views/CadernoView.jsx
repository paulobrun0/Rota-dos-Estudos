import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle } from "../styles/shared.js";

// Every topic note in the concurso, in one place — the "caderno de erros"
// concurseiros keep by hand, but pulling from notes that already live on
// each topic (see TopicEditalRow in EditalView) instead of a separate store,
// so there's nothing new to keep in sync. Useful for a last-week cram pass
// without hunting through every matéria's accordion in edital.
export function CadernoView({ activeConcurso, updateTopicNotes }) {
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    if (!activeConcurso) return [];
    const list = [];
    activeConcurso.materias.forEach((m) => {
      m.topics.forEach((t) => {
        const notes = (t.notes || "").trim();
        if (!notes) return;
        const accuracyPct = t.questionsTotal > 0 ? Math.round((t.questionsCorrect / t.questionsTotal) * 100) : null;
        list.push({ materiaId: m.id, materiaName: m.name, materiaColor: m.color, topicId: t.id, topicName: t.name, notes, accuracyPct });
      });
    });
    return list;
  }, [activeConcurso]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.materiaName.toLowerCase().includes(q) || e.topicName.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q));
  }, [entries, search]);

  if (!activeConcurso) return null;

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>caderno</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        todas as suas anotações de <b style={{ color: colors.text }}>{activeConcurso.name}</b> num lugar só — pegadinhas, pontos de atenção, o que errou. escreva nos assuntos em edital; aparece aqui automaticamente.
      </div>

      {entries.length === 0 ? (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>
          nenhuma anotação ainda. abra um assunto em edital e clique no ícone de nota pra escrever uma.
        </div>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={14} color={colors.textFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="buscar por matéria, assunto ou texto da anotação..."
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ color: colors.textFaint, fontSize: 14 }}>nenhuma anotação encontrada pra "{search}".</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((e) => (
                <CadernoEntry key={e.topicId} entry={e} updateTopicNotes={updateTopicNotes} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CadernoEntry({ entry: e, updateTopicNotes }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.notes);
  const good = e.accuracyPct !== null && e.accuracyPct >= 70;

  function save() {
    if (draft.trim() !== e.notes) updateTopicNotes(e.materiaId, e.topicId, draft);
    setEditing(false);
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${e.materiaColor}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 11.5, color: e.materiaColor, fontWeight: 600 }}>{e.materiaName}</span>
          <span style={{ fontSize: 13.5, color: colors.text, fontWeight: 600, marginLeft: 8 }}>{e.topicName}</span>
        </div>
        {e.accuracyPct !== null && (
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: good ? colors.teal : colors.red, flexShrink: 0 }}>
            {e.accuracyPct}% de acerto
          </span>
        )}
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={save}
          rows={3}
          style={{
            width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 6,
            color: colors.text, fontSize: 13, padding: 8, resize: "vertical", boxSizing: "border-box",
          }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          title="clique para editar"
          style={{ fontSize: 13, color: colors.textMuted, whiteSpace: "pre-wrap", cursor: "text" }}
        >
          {e.notes}
        </div>
      )}
    </div>
  );
}
