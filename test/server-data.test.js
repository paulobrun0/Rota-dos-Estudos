// See server-auth.test.js for why these env vars are set before a dynamic
// import of the server, and why this whole file needs Node 22.5+ (CI only).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { brazilIsoDaysAgo } from "../server/brazilTime.js";

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
  if (path === "/api/data" && method === "PUT" && body?.revision === undefined && cookie) {
    const current = await api(path, { cookie });
    body = { ...body, revision: current.body.revision };
  }
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
  test("rejects malformed JSON and unexpected structure without replacing stored data", async () => {
    const { cookie } = await registerFresh();
    const value = JSON.stringify({ concursos: [] });
    await api("/api/data", { method: "PUT", cookie, body: { value, revision: 0 } });
    for (const invalid of ["{oops", "null", JSON.stringify({ hello: "world" }), JSON.stringify({ concursos: [{ id: "c", name: "C", materias: "oops" }] })]) {
      assert.equal((await api("/api/data", { method: "PUT", cookie, body: { value: invalid, revision: 1 } })).status, 400);
    }
    assert.equal((await api("/api/data", { cookie })).body.value, value);
  });

  test("stale revisions and missing revisions never overwrite the current plan", async () => {
    const { cookie } = await registerFresh();
    const value = JSON.stringify({ concursos: [] });
    const first = await api("/api/data", { method: "PUT", cookie, body: { value, revision: 0 } });
    assert.equal(first.body.revision, 1);
    const stale = await api("/api/data", { method: "PUT", cookie, body: { value: JSON.stringify({ concursos: [], activity: { "2026-10-03": 1 } }), revision: 0 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "PLAN_CONFLICT");
    const missing = await fetch(`${baseUrl}/api/data`, { method: "PUT", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    assert.equal(missing.status, 428);
    assert.equal((await api("/api/data", { cookie })).body.revision, 1);
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
    const valid = { ...value, concursos: (value.concursos || []).map((c, i) => ({
      ...c, id: `concurso-${i}`, name: "Meu concurso", materias: c.materias.map((m, j) => ({
        ...m, id: `materia-${j}`, topics: m.topics.map((t, k) => ({ ...t, id: `topic-${k}`, name: `Assunto ${k}` })),
      })),
    })) };
    const res = await api("/api/data", { method: "PUT", cookie, body: { value: JSON.stringify(valid) } });
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
    // Built the same way the route itself computes "today" (Brazil-shifted,
    // not the test runner's own local/UTC clock) so this test is correct
    // regardless of which timezone CI happens to run in.
    await setPlanData(user.cookie, {
      concursos: [],
      questionActivity: {
        [brazilIsoDaysAgo(0)]: { total: 1, correct: 1 },
        [brazilIsoDaysAgo(3)]: { total: 10, correct: 5 },
        [brazilIsoDaysAgo(10)]: { total: 100, correct: 50 },
        [brazilIsoDaysAgo(40)]: { total: 1000, correct: 500 },
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

test('manual topic equivalence and optional skip survive API reload without copying question counts', async () => {
  const { makeConcurso } = await import('../src/data/model.js');
  const { applySharedSkip } = await import('../src/lib/sharedSkip.js');
  const user = await registerFresh(), other = await registerFresh();
  const source = makeConcurso('Origem', 0), target = makeConcurso('Destino', 1);
  source.materias = [{ id: 'source-m', name: 'Português', topics: [{ id: 'source-t', name: 'Crase', status: 'pendente', questionsTotal: 20, questionsCorrect: 16, equivalenceKey: 'shared:api-test' }] }];
  target.materias = [{ id: 'target-m', name: 'Língua Portuguesa', topics: [{ id: 'target-t', name: 'Emprego da crase', status: 'pendente', equivalenceKey: 'shared:api-test' }] }];
  const plan = { concursos: [source, target], activeConcursoId: target.id, activity: {}, questionActivity: {} };
  const skipped = applySharedSkip(plan, { concursoId: target.id, materiaId: 'target-m', topicId: 'target-t' }, '2026-10-03');
  assert.equal((await api('/api/data', { method: 'PUT', cookie: user.cookie, body: { value: JSON.stringify(skipped) } })).status, 200);
  const restored = JSON.parse((await api('/api/data', { cookie: user.cookie })).body.value);
  assert.deepEqual(restored, skipped);
  assert.equal(restored.concursos[1].materias[0].topics[0].skippedFromShared, true);
  assert.equal(restored.concursos[1].materias[0].topics[0].questionsTotal, undefined);
  assert.equal((await api('/api/data', { cookie: other.cookie })).body.value, null);
  const invalid = structuredClone(skipped); invalid.concursos[1].materias[0].topics[0].skippedFromShared = 'true';
  assert.equal((await api('/api/data', { method: 'PUT', cookie: user.cookie, body: { value: JSON.stringify(invalid) } })).status, 400);
  assert.deepEqual(JSON.parse((await api('/api/data', { cookie: user.cookie })).body.value), skipped);
});

test('preserved topic history survives API reload and malformed archives cannot overwrite it', async () => {
  const { preservePractice } = await import('../src/lib/practiceHistory.js');
  const { buildPracticeIndex, decorateConcurso } = await import('../src/lib/editalCompatibility.js');
  const user = await registerFresh();
  const original = { concursos: [
    { id:'archive-source',name:'Origem',materias:[{id:'m1',name:'Português',topics:[{id:'t1',name:'Crase',questionsTotal:80,questionsCorrect:64,lastPracticeDate:'2026-10-03',history:[{date:'2026-10-03',questionsTotal:80,questionsCorrect:64}]}]}]},
    { id:'target',name:'Destino',materias:[{id:'m2',name:'Língua Portuguesa',weight:2,topics:[{id:'t2',name:'Crase',status:'pendente'}]}]}
  ],activeConcursoId:'target',availableHoursPerWeek:10 };
  const saved = preservePractice(original,{...original,concursos:[original.concursos[1]]});
  assert.equal((await api('/api/data',{method:'PUT',cookie:user.cookie,body:{value:JSON.stringify(saved)}})).status,200);
  const restored=JSON.parse((await api('/api/data',{cookie:user.cookie})).body.value);
  assert.deepEqual(restored,saved);
  assert.equal(decorateConcurso(restored.concursos[0],buildPracticeIndex(restored.concursos,restored.practiceArchive)).materias[0].topics[0].crossStudy.otherTotal,80);
  const invalid=structuredClone(saved);invalid.practiceArchive[0].topic.questionsCorrect=81;
  assert.equal((await api('/api/data',{method:'PUT',cookie:user.cookie,body:{value:JSON.stringify(invalid)}})).status,400);
  assert.deepEqual(JSON.parse((await api('/api/data',{cookie:user.cookie})).body.value),saved);
});
