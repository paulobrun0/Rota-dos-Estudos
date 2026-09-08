import React, { useEffect, useState } from "react";
import { colors } from "../styles/colors.js";
import { secondaryBtnStyle } from "../styles/shared.js";
import { fetchQuestions } from "../api/questions.js";

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Inline practice panel for a topic: pulls real questions from the bank
// (banca-published provas, not user-generated) for `assunto`, lets the user
// answer them one at a time with immediate feedback, and reports the final
// tally back to the caller — which decides how those counts get recorded.
export function QuizPractice({ assunto, onFinish }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchQuestions({ assunto, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setQuestions(res.questions || []);
      })
      .catch(() => {
        if (!cancelled) setError("não foi possível carregar as questões agora.");
      });
    return () => {
      cancelled = true;
    };
  }, [assunto]);

  function finish(finalCorrect, answeredCount) {
    onFinish(answeredCount, finalCorrect);
  }

  function pick(alt) {
    if (selected) return;
    setSelected(alt);
  }

  function next(isLast) {
    const wasCorrect = norm(selected) === norm(current.gabarito);
    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);
    if (isLast) {
      finish(nextCorrect, index + 1);
      return;
    }
    setCorrectCount(nextCorrect);
    setSelected(null);
    setIndex((i) => i + 1);
  }

  // Lets the user bail out before working through the whole batch — whatever
  // was actually answered still counts (including the current question, if
  // it's already been picked but "próxima" hasn't been pressed yet).
  function stopEarly() {
    if (selected) {
      const wasCorrect = norm(selected) === norm(current.gabarito);
      finish(correctCount + (wasCorrect ? 1 : 0), index + 1);
    } else {
      finish(correctCount, index);
    }
  }

  const boxStyle = { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` };

  if (error) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 12.5, color: colors.textMuted }}>{error}</div>
        <button onClick={() => onFinish(0, 0)} style={{ ...secondaryBtnStyle, marginTop: 8, padding: "6px 12px", fontSize: 12 }}>fechar</button>
      </div>
    );
  }

  if (!questions) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 12.5, color: colors.textFaint }}>carregando questões...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 12.5, color: colors.textMuted }}>nenhuma questão encontrada para este assunto.</div>
        <button onClick={() => onFinish(0, 0)} style={{ ...secondaryBtnStyle, marginTop: 8, padding: "6px 12px", fontSize: 12 }}>fechar</button>
      </div>
    );
  }

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const answered = selected !== null;
  const isCorrect = answered && norm(selected) === norm(current.gabarito);

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 11, color: colors.textFaint }}>
          questão {index + 1} de {questions.length}
        </span>
        <span className="mono" style={{ fontSize: 11, color: colors.textFaint }}>
          {current.banca}{current.orgao ? ` · ${current.orgao}` : ""}{current.ano ? ` · ${current.ano}` : ""}
        </span>
        <button onClick={stopEarly} style={{ background: "transparent", border: "none", padding: 0, fontSize: 11, color: colors.textFaint, textDecoration: "underline" }}>
          encerrar prática
        </button>
      </div>

      {current.textoBase && (
        <div style={{
          fontSize: 12.5, color: colors.textMuted, background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 8, padding: 10, marginBottom: 8, maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap",
        }}>
          {current.textoBase}
        </div>
      )}

      {current.comando && (
        <div style={{ fontSize: 13, color: colors.textMuted, fontStyle: "italic", marginBottom: 6 }}>{current.comando}</div>
      )}

      <div style={{ fontSize: 14, color: colors.text, marginBottom: 10, whiteSpace: "pre-wrap" }}>{current.enunciado}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {current.alternativas.map((alt, i) => {
          const isThisCorrect = answered && norm(alt) === norm(current.gabarito);
          const isThisWrongPick = answered && alt === selected && !isThisCorrect;
          return (
            <button
              key={i}
              onClick={() => pick(alt)}
              disabled={answered}
              style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 13, cursor: answered ? "default" : "pointer",
                border: `1px solid ${isThisCorrect ? colors.teal : isThisWrongPick ? colors.red : colors.border}`,
                background: isThisCorrect ? colors.tealSoft : isThisWrongPick ? colors.redSoft : colors.surface2,
                color: colors.text,
              }}
            >
              <b style={{ marginRight: 6 }}>{String.fromCharCode(65 + i)}</b> {alt}
            </button>
          );
        })}
      </div>

      {answered && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: isCorrect ? colors.teal : colors.red }}>
            {isCorrect ? "certo!" : `errado — resposta: ${current.gabarito}`}
          </span>
          <button onClick={() => next(isLast)} style={{ ...secondaryBtnStyle, padding: "6px 14px", fontSize: 12.5 }}>
            {isLast ? "concluir" : "próxima"}
          </button>
        </div>
      )}
    </div>
  );
}
