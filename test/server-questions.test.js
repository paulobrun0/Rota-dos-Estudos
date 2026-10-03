import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

process.env.SQLITE_PATH = ":memory:";
process.env.AUTH_RATE_LIMIT = "1000";
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rota-question-test-"));
const { default: app } = await import("../server/index.js");
const { default: db } = await import("../server/db.js");
let server, baseUrl;
before(() => { server = app.listen(0); baseUrl = `http://127.0.0.1:${server.address().port}`; });
after(() => { server.close(); fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true }); });

async function api(url, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function register() {
  return (await api("/api/register", { method: "POST", body: { email: `${crypto.randomUUID()}@example.com`, password: "valid-password-123" } })).cookie;
}

function seed(materia = "Português", assunto = "Crase") {
  const result = db.prepare("INSERT INTO questions (fonte, materia, assunto, banca, tipo, enunciado, alternativas, gabarito) VALUES (?, ?, ?, 'FGV', 'multipla_escolha', 'Qual alternativa?', ?, 'A')").run(crypto.randomUUID(), materia, assunto, JSON.stringify(["A", "B"]));
  return Number(result.lastInsertRowid);
}

test("each answer is evaluated server-side, deduplicated and isolated by account and concurso", async () => {
  const cookie = await register();
  const questionId = seed();
  const answer = { attemptId: crypto.randomUUID(), questionId, concursoId: "concurso-1", materiaId: "materia-1", topicId: "topic-1", selectedAnswer: "B", correct: true };
  const first = await api("/api/question-attempts", { cookie, method: "POST", body: answer });
  assert.equal(first.status, 200);
  assert.equal(first.body.correct, false, "the client cannot claim a wrong answer was correct");
  const retry = await api("/api/question-attempts", { cookie, method: "POST", body: answer });
  assert.equal(retry.body.duplicate, true);
  assert.equal((await api("/api/question-attempts", { cookie, method: "POST", body: { ...answer, selectedAnswer: "A" } })).status, 409);
  const errors = await api("/api/question-history?concursoId=concurso-1&onlyErrors=true", { cookie });
  assert.equal(errors.body.total, 1);
  assert.equal(errors.body.entries[0].attempts, 1);
  const other = await register();
  assert.equal((await api("/api/question-history?concursoId=concurso-1", { cookie: other })).body.total, 0);
  assert.equal((await api("/api/question-history?concursoId=another", { cookie })).body.total, 0);
  await api("/api/question-attempts", { cookie, method: "POST", body: { ...answer, attemptId: crypto.randomUUID(), selectedAnswer: "A" } });
  assert.equal((await api("/api/question-history?concursoId=concurso-1&onlyErrors=true", { cookie })).body.total, 0);
  const history = await api("/api/question-history?concursoId=concurso-1", { cookie });
  assert.deepEqual(history.body.summary, { total: 2, correct: 1 });
  assert.equal(history.body.entries[0].attempts, 2);
  assert.equal(history.body.entries[0].correctAttempts, 1);
});

test("history keeps the answered question snapshot and filters search before pagination", async () => {
  const cookie = await register();
  const questionId = seed("Direito", "Atos 100%_válidos");
  await api("/api/question-attempts", { cookie, method: "POST", body: { attemptId: crypto.randomUUID(), questionId, concursoId: "c", materiaId: "m", topicId: "t", selectedAnswer: "B" } });
  db.prepare("UPDATE questions SET enunciado = 'Conteúdo novo' WHERE id = ?").run(questionId);
  const history = await api("/api/question-history?concursoId=c&search=100%25_v%C3%A1lidos", { cookie });
  assert.equal(history.body.total, 1);
  assert.equal(history.body.entries[0].question.enunciado, "Qual alternativa?");
});

test("question lists distinguish identically named topics from different matérias", async () => {
  const cookie = await register();
  const assunto = crypto.randomUUID();
  seed("Direito Constitucional", assunto);
  seed("Direito Administrativo", assunto);
  const questions = await api(`/api/questions?assunto=${assunto}&materia=Direito%20Administrativo`, { cookie });
  assert.equal(questions.body.questions.length, 1);
  assert.equal(questions.body.questions[0].materia, "Direito Administrativo");
  assert.equal((await api(`/api/questions?assunto=${assunto}&limit=1.5`, { cookie })).status, 200);
});

test("invalid alternatives, unauthenticated access and disabled practice cannot write attempts", async () => {
  const questionId = seed();
  const answer = { attemptId: crypto.randomUUID(), questionId, concursoId: "c", materiaId: "m", topicId: "t", selectedAnswer: "unlisted" };
  assert.equal((await api("/api/question-attempts", { method: "POST", body: answer })).status, 401);
  const cookie = await register();
  assert.equal((await api("/api/question-attempts", { cookie, method: "POST", body: answer })).status, 400);
  db.prepare("INSERT OR REPLACE INTO feature_flags (key, enabled) VALUES ('questoes', 0)").run();
  assert.equal((await api("/api/question-attempts", { cookie, method: "POST", body: { ...answer, selectedAnswer: "A" } })).status, 403);
  db.prepare("UPDATE feature_flags SET enabled = 1 WHERE key = 'questoes'").run();
});
