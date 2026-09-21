// See server-auth.test.js for why these env vars are set before a dynamic
// import of the server, and why this whole file needs Node 22.5+ (CI only).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, todayISO } from "../src/lib/date.js";

process.env.SQLITE_PATH = ":memory:";
process.env.AUTH_RATE_LIMIT = "1000";
// backup.js unconditionally mkdirSyncs this at import time — must be a real,
// isolated directory, not just a placeholder string (see server-auth.test.js).
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rota-estudos-test-backups-"));

const { default: app } = await import("../server/index.js");
const { default: db } = await import("../server/db.js");

let server;
let baseUrl;

before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
});

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get("set-cookie");
  const newCookie = setCookie ? setCookie.split(";")[0] : null;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, cookie: newCookie };
}

let userCounter = 0;
function freshEmail() {
  userCounter += 1;
  return `data-test-${userCounter}@example.com`;
}

async function registerFresh(password = "correct-horse-1") {
  const email = freshEmail();
  const res = await api("/api/register", { method: "POST", body: { email, password } });
  assert.equal(res.status, 200, `setup registration should succeed: ${JSON.stringify(res.body)}`);
  return { email, password, cookie: res.cookie };
}

function promoteToAdmin(email) {
  db.prepare("UPDATE users SET is_admin = 1 WHERE email = ?").run(email);
}

async function registerAdmin() {
  const user = await registerFresh();
  promoteToAdmin(user.email);
  return user;
}

const insertQuestion = db.prepare(`
  INSERT INTO questions (fonte, materia, assunto, banca, orgao, cargo, ano, tipo, texto_base, comando, enunciado, alternativas, gabarito, comentario)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
let fonteCounter = 0;
function seedQuestion({ assunto, banca, alternativas = ["A", "B", "C", "D"], gabarito = "A" }) {
  fonteCounter += 1;
  insertQuestion.run(`TEST-FONTE-${fonteCounter}`, "Português", assunto, banca, "Órgão Teste", "Cargo Teste", 2026, "multipla_escolha", null, null, "Enunciado de teste", JSON.stringify(alternativas), gabarito, null);
}

describe("GET/PUT /api/data", () => {
  test("a fresh account has no stored data yet", async () => {
    const { cookie } = await registerFresh();
    const res = await api("/api/data", { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.value, null);
  });

  test("rejects a non-string value", async () => {
    const { cookie } = await registerFresh();
    const res = await api("/api/data", { method: "PUT", cookie, body: { value: { not: "a string" } } });
    assert.equal(res.status, 400);
  });

  test("round-trips a JSON-encoded string exactly", async () => {
    const { cookie } = await registerFresh();
    const payload = JSON.stringify({ concursos: [], activity: { "2026-01-01": 3 } });
    const put = await api("/api/data", { method: "PUT", cookie, body: { value: payload } });
    assert.equal(put.status, 200);
    const get = await api("/api/data", { cookie });
    assert.equal(get.body.value, payload);
  });
});

describe("GET /api/health", () => {
  test("is public and reports ok", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeSeconds, "number");
    assert.ok(!Number.isNaN(Date.parse(body.serverTime)));
  });
});

describe("GET /api/questions", () => {
  test("requires an assunto", async () => {
    const { cookie } = await registerFresh();
    const res = await api("/api/questions", { cookie });
    assert.equal(res.status, 400);
  });

  test("returns matching questions with alternativas parsed back into an array", async () => {
    const { cookie } = await registerFresh();
    const assunto = `Crase ${freshEmail()}`;
    seedQuestion({ assunto, banca: "CEBRASPE" });
    const res = await api(`/api/questions?assunto=${encodeURIComponent(assunto)}`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.questions.length, 1);
    assert.deepEqual(res.body.questions[0].alternativas, ["A", "B", "C", "D"]);
    assert.equal(res.body.questions[0].assunto, assunto);
  });

  test("the banca filter narrows results to that banca only", async () => {
    const { cookie } = await registerFresh();
    const assunto = `Regência ${freshEmail()}`;
    seedQuestion({ assunto, banca: "CEBRASPE" });
    seedQuestion({ assunto, banca: "CEBRASPE" });
    seedQuestion({ assunto, banca: "FGV" });

    const all = await api(`/api/questions?assunto=${encodeURIComponent(assunto)}&limit=10`, { cookie });
    assert.equal(all.body.questions.length, 3);

    const filtered = await api(`/api/questions?assunto=${encodeURIComponent(assunto)}&banca=FGV`, { cookie });
    assert.equal(filtered.body.questions.length, 1);
    assert.ok(filtered.body.questions.every((q) => q.banca === "FGV"));
  });

  test("limit caps how many rows come back", async () => {
    const { cookie } = await registerFresh();
    const assunto = `Pontuação ${freshEmail()}`;
    seedQuestion({ assunto, banca: "CEBRASPE" });
    seedQuestion({ assunto, banca: "CEBRASPE" });
    const res = await api(`/api/questions?assunto=${encodeURIComponent(assunto)}&limit=1`, { cookie });
    assert.equal(res.body.questions.length, 1);
  });

  test("disabling the 'questoes' feature blocks the practice endpoint but leaves counts as an empty list, not an error", async () => {
    const admin = await registerAdmin();
    const normal = await registerFresh();
    await api("/api/admin/features/questoes", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } });

    const blocked = await api("/api/questions?assunto=Crase", { cookie: normal.cookie });
    assert.equal(blocked.status, 403);

    const counts = await api("/api/questions/counts", { cookie: normal.cookie });
    assert.equal(counts.status, 200);
    assert.deepEqual(counts.body.counts, []);

    await api("/api/admin/features/questoes", { method: "PATCH", cookie: admin.cookie, body: { enabled: true } });
  });
});

describe("GET /api/questions/counts", () => {
  test("groups by assunto + banca", async () => {
    const { cookie } = await registerFresh();
    const assunto = `Estatística ${freshEmail()}`;
    seedQuestion({ assunto, banca: "CEBRASPE" });
    seedQuestion({ assunto, banca: "CEBRASPE" });
    seedQuestion({ assunto, banca: "FGV" });

    const res = await api("/api/questions/counts", { cookie });
    assert.equal(res.status, 200);
    const cebraspeRow = res.body.counts.find((r) => r.assunto === assunto && r.banca === "CEBRASPE");
    const fgvRow = res.body.counts.find((r) => r.assunto === assunto && r.banca === "FGV");
    assert.equal(cebraspeRow.total, 2);
    assert.equal(fgvRow.total, 1);
  });
});

describe("GET /api/ranking", () => {
  async function setPlanData(cookie, value) {
    const res = await api("/api/data", { method: "PUT", cookie, body: { value: JSON.stringify(value) } });
    assert.equal(res.status, 200);
  }

  test("only includes users opted into the ranking, but isOptedIn reflects the caller's own setting either way", async () => {
    const optedIn = await registerFresh();
    const optedOut = await registerFresh();
    await api("/api/me", { method: "PATCH", cookie: optedOut.cookie, body: { showInRanking: false } });
    await setPlanData(optedIn.cookie, { concursos: [{ materias: [] }] });
    await setPlanData(optedOut.cookie, { concursos: [{ materias: [] }] });

    const asOptedIn = await api("/api/ranking", { cookie: optedIn.cookie });
    assert.equal(asOptedIn.status, 200);
    assert.equal(asOptedIn.body.isOptedIn, true);
    assert.ok(asOptedIn.body.users.some((u) => u.displayName === optedIn.email.split("@")[0]));
    assert.ok(!asOptedIn.body.users.some((u) => u.displayName === optedOut.email.split("@")[0]), "opted-out user is excluded entirely");

    const asOptedOut = await api("/api/ranking", { cookie: optedOut.cookie });
    assert.equal(asOptedOut.body.isOptedIn, false);
  });

  test("aggregates estudado/total and question accuracy per matéria", async () => {
    const user = await registerFresh();
    await setPlanData(user.cookie, {
      concursos: [{
        materias: [{
          name: "Português",
          topics: [
            { status: "estudado", questionsTotal: 10, questionsCorrect: 8 },
            { status: "pendente" },
          ],
        }],
      }],
    });

    const res = await api("/api/ranking", { cookie: user.cookie });
    const row = res.body.users.find((u) => u.displayName === user.email.split("@")[0]);
    assert.equal(row.totalEstudado, 1);
    const materia = row.materias.find((m) => m.name === "Português");
    assert.equal(materia.total, 2);
    assert.equal(materia.estudado, 1);
    assert.equal(materia.questionsTotal, 10);
    assert.equal(materia.questionsCorrect, 8);
  });

  test("a corrupted plan blob doesn't break the whole ranking — that user just shows zeroed stats", async () => {
    const user = await registerFresh();
    await setPlanData(user.cookie, { concursos: [] }); // creates the user_data row
    db.prepare("UPDATE user_data SET value = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)").run("{not valid json", user.email);

    const res = await api("/api/ranking", { cookie: user.cookie });
    assert.equal(res.status, 200);
    const row = res.body.users.find((u) => u.displayName === user.email.split("@")[0]);
    assert.equal(row.totalEstudado, 0);
    assert.deepEqual(row.materias, []);
  });

  test("day/week/month question periods only include activity within their own cutoff", async () => {
    const user = await registerFresh();
    const today = todayISO();
    await setPlanData(user.cookie, {
      concursos: [],
      questionActivity: {
        [today]: { total: 1, correct: 1 },
        [addDaysISO(today, -3)]: { total: 10, correct: 5 },
        [addDaysISO(today, -10)]: { total: 100, correct: 50 },
        [addDaysISO(today, -40)]: { total: 1000, correct: 500 },
      },
    });

    const res = await api("/api/ranking", { cookie: user.cookie });
    const name = user.email.split("@")[0];
    const day = res.body.questionPeriods.day.find((p) => p.displayName === name);
    const week = res.body.questionPeriods.week.find((p) => p.displayName === name);
    const month = res.body.questionPeriods.month.find((p) => p.displayName === name);

    assert.deepEqual({ total: day.total, correct: day.correct }, { total: 1, correct: 1 }, "day: today only");
    assert.deepEqual({ total: week.total, correct: week.correct }, { total: 11, correct: 6 }, "week: today + 3 days ago");
    assert.deepEqual({ total: month.total, correct: month.correct }, { total: 111, correct: 56 }, "month: today + 3d + 10d, not the 40-day-old entry");
  });

  test("disabling the 'ranking' feature blocks the whole endpoint", async () => {
    const admin = await registerAdmin();
    const normal = await registerFresh();
    await api("/api/admin/features/ranking", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } });
    assert.equal((await api("/api/ranking", { cookie: normal.cookie })).status, 403);
    await api("/api/admin/features/ranking", { method: "PATCH", cookie: admin.cookie, body: { enabled: true } });
  });
});
