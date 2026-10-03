import { Router } from "express";

export function questionPayload(row) {
  return {
    id: row.id, fonte: row.fonte, materia: row.materia, assunto: row.assunto,
    banca: row.banca, orgao: row.orgao, cargo: row.cargo, ano: row.ano,
    tipo: row.tipo, textoBase: row.texto_base, comando: row.comando,
    enunciado: row.enunciado, alternativas: JSON.parse(row.alternativas),
    gabarito: row.gabarito, comentario: row.comentario,
  };
}

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const identifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 100;

export function createQuestionsRouter(db, requireAuth, isFeatureEnabled) {
  const router = Router();
  router.use(["/questions", "/question-attempts", "/question-history"], requireAuth);
  const getQuestion = db.prepare("SELECT * FROM questions WHERE id = ?");
  const getAttempt = db.prepare("SELECT * FROM question_attempts WHERE user_id = ? AND attempt_id = ?");
  const insertAttempt = db.prepare(`
    INSERT INTO question_attempts (user_id, attempt_id, question_id, concurso_id, materia_id, topic_id, selected_answer, correct, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  router.get("/questions", (req, res) => {
    if (!isFeatureEnabled("questoes")) return res.status(403).json({ error: "a prática de questões está desativada no momento" });
    const assunto = typeof req.query.assunto === "string" ? req.query.assunto.trim() : "";
    if (!assunto) return res.status(400).json({ error: "assunto é obrigatório" });
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 10, 1), 50);
    const filters = ["assunto = ?"];
    const values = [assunto];
    for (const field of ["banca", "materia"]) {
      if (typeof req.query[field] === "string" && req.query[field].trim()) {
        filters.push(`${field} = ?`);
        values.push(req.query[field].trim());
      }
    }
    const rows = db.prepare(`SELECT * FROM questions WHERE ${filters.join(" AND ")} ORDER BY RANDOM() LIMIT ?`).all(...values, limit);
    res.json({ questions: rows.map(questionPayload) });
  });

  router.get("/questions/counts", (req, res) => {
    const counts = isFeatureEnabled("questoes") ? db.prepare("SELECT materia, assunto, banca, COUNT(*) AS total FROM questions GROUP BY materia, assunto, banca").all() : [];
    res.json({ counts });
  });

  router.get("/questions/:id", (req, res) => {
    if (!isFeatureEnabled("questoes")) return res.status(403).json({ error: "a prática de questões está desativada no momento" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "id de questão inválido" });
    const question = getQuestion.get(id);
    if (!question) return res.status(404).json({ error: "questão não encontrada" });
    res.json({ question: questionPayload(question) });
  });

  router.post("/question-attempts", (req, res) => {
    if (!isFeatureEnabled("questoes")) return res.status(403).json({ error: "a prática de questões está desativada no momento" });
    const { attemptId, questionId, concursoId, materiaId, topicId, selectedAnswer } = req.body || {};
    if (![attemptId, concursoId, materiaId, topicId].every(identifier) || !Number.isSafeInteger(questionId) || typeof selectedAnswer !== "string" || selectedAnswer.length > 20000) {
      return res.status(400).json({ error: "tentativa de resposta inválida" });
    }
    const previous = getAttempt.get(req.userId, attemptId);
    if (previous) {
      if (previous.question_id !== questionId || previous.concurso_id !== concursoId || previous.materia_id !== materiaId || previous.topic_id !== topicId || previous.selected_answer !== selectedAnswer) {
        return res.status(409).json({ error: "identificador de tentativa já usado para outra resposta" });
      }
      return res.json({ attemptId, correct: !!previous.correct, gabarito: JSON.parse(previous.snapshot).gabarito, duplicate: true });
    }
    const question = getQuestion.get(questionId);
    if (!question) return res.status(404).json({ error: "questão não encontrada" });
    const payload = questionPayload(question);
    if (!payload.alternativas.includes(selectedAnswer)) return res.status(400).json({ error: "resposta não pertence às alternativas da questão" });
    const correct = normalize(selectedAnswer) === normalize(question.gabarito);
    insertAttempt.run(req.userId, attemptId, questionId, concursoId, materiaId, topicId, selectedAnswer, correct ? 1 : 0, JSON.stringify(payload));
    res.json({ attemptId, correct, gabarito: payload.gabarito, duplicate: false });
  });

  router.get("/question-history", (req, res) => {
    const concursoId = req.query.concursoId;
    if (!identifier(concursoId)) return res.status(400).json({ error: "concurso é obrigatório" });
    const onlyErrors = req.query.onlyErrors === "true";
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 30, 1), 100);
    const offset = Math.max(Math.trunc(Number(req.query.offset)) || 0, 0);
    const latest = `WITH latest AS (
      SELECT MAX(id) AS last_id, COUNT(*) AS attempts, SUM(correct) AS correct_attempts
      FROM question_attempts WHERE user_id = ? AND concurso_id = ?
      GROUP BY materia_id, topic_id, question_id
    )`;
    const filters = [];
    const values = [req.userId, concursoId];
    if (onlyErrors) filters.push("a.correct = 0");
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filters.push("a.snapshot LIKE ? ESCAPE '\\'");
      values.push(`%${req.query.search.trim().replace(/[\\%_]/g, "\\$&")}%`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = db.prepare(`${latest}
      SELECT a.*, l.attempts, l.correct_attempts FROM latest l
      JOIN question_attempts a ON a.id = l.last_id ${where}
      ORDER BY a.id DESC LIMIT ? OFFSET ?
    `).all(...values, limit, offset);
    const count = db.prepare(`${latest} SELECT COUNT(*) AS total FROM latest l JOIN question_attempts a ON a.id = l.last_id ${where}`).get(...values).total;
    const summary = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct FROM question_attempts WHERE user_id = ? AND concurso_id = ?").get(req.userId, concursoId);
    res.json({
      total: count, summary,
      entries: rows.map((row) => ({
        attemptId: row.attempt_id, question: JSON.parse(row.snapshot),
        materiaId: row.materia_id, topicId: row.topic_id,
        selectedAnswer: row.selected_answer, correct: !!row.correct,
        attempts: row.attempts, correctAttempts: row.correct_attempts,
        answeredAt: `${row.created_at.replace(" ", "T")}Z`,
      })),
    });
  });
  return router;
}
