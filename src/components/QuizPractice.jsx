import React, { useEffect, useRef, useState } from "react";
import { colors } from "../styles/colors.js";
import { secondaryBtnStyle } from "../styles/shared.js";
import { fetchQuestions, fetchQuestion, recordQuestionAttempt } from "../api/questions.js";

const norm = (s) => String(s ?? "").trim().toLowerCase();

// The API caps a single batch at 50 (server/index.js), so "todas" never asks
// for more than that even when the topic has a bigger bank behind it.
const LIMITE_MAXIMO = 50;
const OPCOES_PADRAO = [5, 10, 15, 20];

// Inline practice panel for a topic: pulls real questions from the bank
// (banca-published provas, not user-generated) for `assunto`, lets the user
// answer them one at a time with immediate feedback, and reports the final
// tally back to the caller — which decides how those counts get recorded.
// `disponivel` (the topic's total question count) drives the quantity picker
// shown before fetching, so the user isn't offered more than actually exists.
export function QuizPractice({ assunto, materia, concursoId, materiaId, topicId, initialQuestionId, disponivel, onAnswer, onFinish }) {
  const [quantidade, setQuantidade] = useState(initialQuestionId ? 1 : null);
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [selectedCorrect, setSelectedCorrect] = useState(false);
  const [answerGabarito, setAnswerGabarito] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answerError, setAnswerError] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerDraft, setAnswerDraft] = useState(null);
  const dialog = useRef(null);
  const close = useRef(null);
  const attemptIds = useRef(new Map());
  const submitting = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    if (!quantidade) return;
    let cancelled = false;
    const request = initialQuestionId ? fetchQuestion(initialQuestionId).then((result) => ({ questions: [result.question] })) : fetchQuestions({ assunto, materia, limit: quantidade });
    request
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
  }, [assunto, materia, quantidade, initialQuestionId]);

  function finish(finalCorrect, answeredCount) {
    if (finished.current) return;
    finished.current = true;
    onFinish(answeredCount, finalCorrect);
  }

  async function pick(alt) {
    if (selected !== null || submitting.current) return;
    if (answerDraft !== null && answerDraft !== alt) return;
    setAnswerDraft(alt);
    submitting.current = true;
    setAnswerBusy(true);
    setAnswerError("");
    try {
      if (!attemptIds.current.has(index)) attemptIds.current.set(index, crypto.randomUUID());
      const result = await recordQuestionAttempt({
        attemptId: attemptIds.current.get(index), questionId: questions[index].id,
        concursoId, materiaId, topicId, selectedAnswer: alt,
      });
      setSelectedCorrect(result.correct);
      setAnswerGabarito(result.gabarito);
      setSelected(alt);
      onAnswer?.(result.correct);
    } catch (error) {
      setAnswerError(`${error.message}. Não foi possível confirmar o registro da resposta; tente novamente.`);
    } finally {
      submitting.current = false;
      setAnswerBusy(false);
    }
  }

  function next(isLast) {
    const wasCorrect = selectedCorrect;
    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);
    if (isLast) {
      finish(nextCorrect, index + 1);
      return;
    }
    setCorrectCount(nextCorrect);
    setSelected(null);
    setAnswerGabarito(null);
    setSelectedCorrect(false);
    setAnswerDraft(null);
    setIndex((i) => i + 1);
  }

  // Lets the user bail out before working through the whole batch — whatever
  // was actually answered still counts (including the current question, if
  // it's already been picked but "próxima" hasn't been pressed yet).
  function stopEarly() {
    if (submitting.current) return;
    if (selected) {
      const wasCorrect = selectedCorrect;
      finish(correctCount + (wasCorrect ? 1 : 0), index + 1);
    } else {
      finish(correctCount, index);
    }
  }

  close.current = stopEarly;
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.focus();
    function keydown(event) {
      if (event.key === "Escape") close.current?.();
      if (event.key !== "Tab" || !dialog.current) return;
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
      if (!elements.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, []);

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto",
  };
  const cardStyle = {
    background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14,
    padding: 20, width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  };

  if (!quantidade) {
    const teto = Math.min(disponivel || LIMITE_MAXIMO, LIMITE_MAXIMO);
    const opcoes = OPCOES_PADRAO.filter((n) => n < teto);
    return (
      <div style={overlayStyle} onClick={() => onFinish(0, 0)}>
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="prática de questões" style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 14, color: colors.text, fontWeight: 600, marginBottom: 4 }}>quantas questões?</div>
          <div style={{ fontSize: 12.5, color: colors.textFaint, marginBottom: 14 }}>{disponivel || 0} disponíveis para este assunto</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {opcoes.map((n) => (
              <button
                key={n}
                onClick={() => setQuantidade(n)}
                style={{ ...secondaryBtnStyle, padding: "10px 18px", fontSize: 14, fontWeight: 600 }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setQuantidade(teto)}
              style={{ ...secondaryBtnStyle, padding: "10px 18px", fontSize: 14, fontWeight: 600, border: `1px solid ${colors.success}`, color: colors.success }}
            >
              todas ({teto})
            </button>
          </div>
          <button onClick={() => onFinish(0, 0)} style={{ background: "transparent", border: "none", padding: 0, marginTop: 16, fontSize: 12, color: colors.textFaint, textDecoration: "underline" }}>
            cancelar
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={overlayStyle} onClick={() => onFinish(0, 0)}>
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="prática de questões" style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 13, color: colors.textMuted }}>{error}</div>
          <button onClick={() => onFinish(0, 0)} style={{ ...secondaryBtnStyle, marginTop: 12, padding: "6px 12px", fontSize: 12 }}>fechar</button>
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div style={overlayStyle} onClick={() => onFinish(0, 0)}>
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="prática de questões" style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 13, color: colors.textFaint }}>carregando questões...</div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={overlayStyle} onClick={() => onFinish(0, 0)}>
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="prática de questões" style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 13, color: colors.textMuted }}>nenhuma questão encontrada para este assunto.</div>
          <button onClick={() => onFinish(0, 0)} style={{ ...secondaryBtnStyle, marginTop: 12, padding: "6px 12px", fontSize: 12 }}>fechar</button>
        </div>
      </div>
    );
  }

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const answered = selected !== null;
  const isCorrect = answered && selectedCorrect;

  return (
    <div style={overlayStyle} onClick={stopEarly}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="prática de questões" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 11.5, color: colors.textFaint }}>
            questão {index + 1} de {questions.length}
          </span>
          <span className="mono" style={{ fontSize: 11.5, color: colors.textFaint }}>
            {current.banca}{current.orgao ? ` · ${current.orgao}` : ""}{current.ano ? ` · ${current.ano}` : ""}
          </span>
          <button onClick={stopEarly} style={{ background: "transparent", border: "none", padding: 0, fontSize: 11.5, color: colors.textFaint, textDecoration: "underline" }}>
            encerrar prática
          </button>
        </div>

        {current.textoBase && (
          <div style={{
            fontSize: 13.5, lineHeight: 1.55, color: colors.textMuted, background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 8, padding: 14, marginBottom: 12, whiteSpace: "pre-wrap",
          }}>
            {current.textoBase}
          </div>
        )}

        {current.comando && (
          <div style={{ fontSize: 13.5, color: colors.textMuted, fontStyle: "italic", marginBottom: 8 }}>{current.comando}</div>
        )}

        <div style={{ fontSize: 15, lineHeight: 1.5, color: colors.text, marginBottom: 14, whiteSpace: "pre-wrap" }}>{current.enunciado}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {current.alternativas.map((alt, i) => {
            const isThisCorrect = answered && norm(alt) === norm(answerGabarito ?? current.gabarito);
            const isThisWrongPick = answered && alt === selected && !isThisCorrect;
            return (
              <button
                key={i}
                onClick={() => pick(alt)}
                disabled={answered || answerBusy || (answerDraft !== null && answerDraft !== alt)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8, fontSize: 13.5, lineHeight: 1.45, cursor: answered ? "default" : "pointer",
                  border: `1px solid ${isThisCorrect ? colors.success : isThisWrongPick ? colors.red : colors.border}`,
                  background: isThisCorrect ? colors.successSoft : isThisWrongPick ? colors.redSoft : colors.surface2,
                  color: colors.text,
                }}
              >
                <b style={{ marginRight: 6 }}>{String.fromCharCode(65 + i)}</b> {alt}
              </button>
            );
          })}
        </div>

        {answerBusy && <p role="status" style={{ color: colors.textMuted }}>registrando resposta…</p>}
        {answerError && <div role="alert" style={{ color: colors.red }}>{answerError} <button onClick={() => pick(answerDraft)} style={secondaryBtnStyle}>tentar registrar resposta</button></div>}
        {answered && current.comentario && <p style={{ color: colors.textMuted, whiteSpace: "pre-wrap" }}>{current.comentario}</p>}
        {answered && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: isCorrect ? colors.success : colors.red }}>
              {isCorrect ? "certo!" : `errado — resposta: ${answerGabarito ?? current.gabarito}`}
            </span>
            <button onClick={() => next(isLast)} style={{ ...secondaryBtnStyle, padding: "7px 16px", fontSize: 13 }}>
              {isLast ? "concluir" : "próxima"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
