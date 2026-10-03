import React, { useEffect, useMemo, useState } from "react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import { fetchQuestionHistory } from "../api/questions.js";
import { QuizPractice } from "../components/QuizPractice.jsx";

export function CadernoView({ activeConcurso, updateTopicNotes, addTopicQuestions }) {
  const [mode, setMode] = useState("erros");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState({ entries: [], total: 0, summary: { total: 0, correct: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(null);

  useEffect(() => {
    if (mode === "anotacoes") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      fetchQuestionHistory({ concursoId: activeConcurso.id, onlyErrors: mode === "erros", search, offset: page * 30 })
        .then((result) => {
          if (!cancelled) setHistory((previous) => ({ ...result, entries: page === 0 ? result.entries : [...previous.entries, ...result.entries] }));
        })
        .catch((failure) => { if (!cancelled) setError(failure.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeConcurso.id, mode, search, page, refresh]);

  const notes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeConcurso.materias.flatMap((materia) => materia.topics.filter((topic) => (topic.notes || "").trim()).map((topic) => ({
      materiaId: materia.id, materiaName: materia.name, materiaColor: materia.color,
      topicId: topic.id, topicName: topic.name, notes: topic.notes,
      accuracyPct: topic.questionsTotal > 0 ? Math.round(topic.questionsCorrect / topic.questionsTotal * 100) : null,
    }))).filter((entry) => !query || `${entry.materiaName} ${entry.topicName} ${entry.notes}`.toLowerCase().includes(query));
  }, [activeConcurso, search]);

  function changeMode(value) { setMode(value); setPage(0); }
  function changeSearch(value) { setSearch(value); setPage(0); }
  function finishPractice() { setPractice(null); setPage(0); setRefresh((value) => value + 1); }

  return (
    <div>
      <h1 className="sg" style={{ fontSize: 20, margin: "0 0 6px" }}>caderno</h1>
      <p style={{ color: colors.textMuted, fontSize: 13.5 }}>revise seus erros, acompanhe as respostas e consulte suas anotações de {activeConcurso.name}.</p>
      <div aria-label="visão do caderno" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {[["erros", "erros para refazer"], ["historico", "histórico de questões"], ["anotacoes", "anotações"]].map(([value, label]) => (
          <button key={value} aria-pressed={mode === value} onClick={() => changeMode(value)} style={{ ...secondaryBtnStyle, borderColor: mode === value ? colors.teal : colors.border }}>{label}</button>
        ))}
      </div>
      <input aria-label="buscar no caderno" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="buscar por matéria, assunto ou texto…" style={{ ...inputStyle, marginBottom: 16 }} />
      {mode === "anotacoes" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.length === 0 && <p style={{ color: colors.textFaint }}>nenhuma anotação encontrada. escreva nos assuntos em edital; elas aparecem aqui.</p>}
          {notes.map((entry) => <CadernoEntry key={`${entry.materiaId}:${entry.topicId}`} entry={entry} updateTopicNotes={updateTopicNotes} />)}
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: colors.textMuted }}>{history.summary.total} respostas registradas • {history.summary.total ? Math.round(history.summary.correct / history.summary.total * 100) : 0}% de acerto</p>
          {error && <div role="alert" style={{ color: colors.red }}>{error} <button onClick={() => setRefresh((value) => value + 1)} style={secondaryBtnStyle}>tentar novamente</button></div>}
          {loading && <p role="status" style={{ color: colors.textMuted }}>carregando questões…</p>}
          {!loading && !error && history.entries.length === 0 && <p style={{ color: colors.textFaint }}>{mode === "erros" ? "nenhum erro pendente. as questões erradas nas práticas aparecem aqui; ao acertar de novo, saem desta lista." : "nenhuma questão encontrada. o histórico começa com as práticas feitas no aplicativo."}</p>}
          {!error && (!loading || page > 0) && <div style={{ display: "grid", gap: 12 }}>
            {history.entries.map((entry) => (
              <article key={entry.attemptId} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: colors.textMuted }}>{entry.question.materia} • {entry.question.assunto} • {entry.question.banca}{entry.question.ano ? ` • ${entry.question.ano}` : ""}</div>
                <p style={{ whiteSpace: "pre-wrap", color: colors.text, fontSize: 14 }}>{entry.question.enunciado}</p>
                <p style={{ fontSize: 12, color: entry.correct ? colors.teal : colors.red }}>{entry.correct ? "última resposta correta" : "última resposta incorreta"} • {entry.correctAttempts}/{entry.attempts} acertos • {new Date(entry.answeredAt).toLocaleDateString("pt-BR")}</p>
                <details style={{ fontSize: 13, color: colors.textMuted }}>
                  <summary>ver resposta e comentário</summary>
                  <p>sua resposta: {entry.selectedAnswer}</p><p>gabarito: {entry.question.gabarito}</p>
                  {entry.question.textoBase && <p style={{ whiteSpace: "pre-wrap" }}>{entry.question.textoBase}</p>}
                  {entry.question.comentario && <p style={{ whiteSpace: "pre-wrap" }}>{entry.question.comentario}</p>}
                </details>
                <button onClick={() => setPractice(entry)} style={{ ...secondaryBtnStyle, marginTop: 12 }}>refazer questão</button>
              </article>
            ))}
          </div>}
          {!error && history.entries.length < history.total && <button disabled={loading} onClick={() => setPage((value) => value + 1)} style={{ ...secondaryBtnStyle, marginTop: 16 }}>carregar mais questões</button>}
        </>
      )}
      {practice && <QuizPractice initialQuestionId={practice.question.id} assunto={practice.question.assunto} materia={practice.question.materia} concursoId={activeConcurso.id} materiaId={practice.materiaId} topicId={practice.topicId} onAnswer={(correct) => addTopicQuestions(practice.materiaId, practice.topicId, 1, correct ? 1 : 0)} onFinish={finishPractice} />}
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
