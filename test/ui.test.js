import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import React from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "localStorage", "navigator"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, cleanup, screen, fireEvent, waitFor } = await import("@testing-library/react");
let vite, App, QuizPractice, TopicLinksEditor, TopicLinkButtons, CadernoView;
const originalFetch = globalThis.fetch;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const question = { id: 1, assunto: "Crase", materia: "Português", enunciado: "Escolha a alternativa", alternativas: ["A", "B"], gabarito: "A", banca: "FGV" };

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  App = (await vite.ssrLoadModule("/src/App.jsx")).default;
  QuizPractice = (await vite.ssrLoadModule("/src/components/QuizPractice.jsx")).QuizPractice;
  const links = await vite.ssrLoadModule("/src/components/TopicLinks.jsx");
  TopicLinksEditor = links.TopicLinksEditor;
  TopicLinkButtons = links.TopicLinkButtons;
  CadernoView = (await vite.ssrLoadModule("/src/views/CadernoView.jsx")).CadernoView;
});
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });
after(async () => { await vite.close(); dom.window.close(); });

test("a failed plan read shows retry without writing a replacement plan", async () => {
  const writes = [];
  let fail = true;
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/data" && options.method === "PUT") { writes.push(options.body); return response({ revision: 1 }); }
    if (path === "/api/data") return fail ? response({ error: "rede indisponível" }, 503) : response({ value: '{"concursos":[],"activity":{}}', revision: 0 });
    return response(path.includes("counts") ? { counts: [] } : { materias: [] });
  };
  render(React.createElement(React.StrictMode, null, React.createElement(App, { user: { email: "test@example.com" }, onLogout() {}, onUserUpdate() {} })));
  await screen.findByText(/Nenhum dado foi substituído/);
  assert.equal(writes.length, 0);
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "tentar novamente" }));
  await waitFor(() => assert.ok(writes.length > 0), { timeout: 3000 });
  await screen.findByText("progresso salvo");
});

test("a plan conflict exposes export and retains a browser recovery copy", async () => {
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/data" && options.method === "PUT") return response({ error: "versão alterada", code: "PLAN_CONFLICT" }, 409);
    if (path === "/api/data") return response({ value: '{"concursos":[],"activity":{}}', revision: 2 });
    return response(path.includes("counts") ? { counts: [] } : { materias: [] });
  };
  render(React.createElement(App, { user: { email: "conflict@example.com" }, onLogout() {}, onUserUpdate() {} }));
  await screen.findByText(/o plano foi alterado em outra aba/);
  assert.ok(screen.getByRole("button", { name: "baixar minhas alterações" }));
  assert.equal(JSON.parse(localStorage.getItem("rota-plan-pending:conflict@example.com")).revision, 2);
});

test("quiz retries the same answer id and reports the server result only once", async () => {
  const attempts = [];
  const answered = [];
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/questions/1") return response({ question });
    const attempt = JSON.parse(options.body);
    attempts.push(attempt);
    if (attempts.length === 1) throw new Error("resposta de rede perdida");
    return response({ correct: false, gabarito: "A", duplicate: true });
  };
  const finished = [];
  render(React.createElement(QuizPractice, { initialQuestionId: 1, concursoId: "c", materiaId: "m", topicId: "t", onAnswer: (value) => answered.push(value), onFinish: (...args) => finished.push(args) }));
  fireEvent.click(await screen.findByRole("button", { name: "B B" }));
  fireEvent.click(await screen.findByRole("button", { name: "tentar registrar resposta" }));
  await screen.findByText("errado — resposta: A");
  assert.equal(attempts[0].attemptId, attempts[1].attemptId);
  assert.deepEqual(answered, [false]);
  fireEvent.click(screen.getByRole("button", { name: "concluir" }));
  assert.equal(finished.length, 1);
});

test("Qconcursos and Tec links coexist and preserve an older link during editing", () => {
  const topic = { id: "t", link: "https://www.tecconcursos.com.br/cadernos/1" };
  const saved = [];
  const editor = render(React.createElement(TopicLinksEditor, { topic, onSave: (value) => saved.push(value), onClose() {} }));
  fireEvent.change(screen.getByLabelText("Qconcursos"), { target: { value: "https://www.qconcursos.com/cadernos/2" } });
  fireEvent.click(screen.getByRole("button", { name: "salvar links" }));
  assert.equal(saved[0].tec, topic.link);
  editor.unmount();
  render(React.createElement(TopicLinkButtons, { topic: { links: saved[0] } }));
  assert.equal(screen.getByRole("link", { name: "abrir Tec Concursos" }).href, topic.link);
  assert.equal(screen.getByRole("link", { name: "abrir Qconcursos" }).href, saved[0].qconcursos);
});

test("refazer in the caderno loads the current question and updates practice counts", async () => {
  const entry = { attemptId: "a", question, materiaId: "m", topicId: "t", correct: false, selectedAnswer: "B", attempts: 1, correctAttempts: 0, answeredAt: "2026-10-03T12:00:00Z" };
  let corrected = false;
  globalThis.fetch = async (path) => {
    if (path.startsWith("/api/question-history")) return response({ entries: corrected ? [] : [entry], total: corrected ? 0 : 1, summary: { total: corrected ? 2 : 1, correct: corrected ? 1 : 0 } });
    if (path === "/api/questions/1") return response({ question });
    corrected = true;
    return response({ correct: true, gabarito: "A" });
  };
  const counts = [];
  render(React.createElement(CadernoView, { activeConcurso: { id: "c", name: "Concurso", materias: [] }, updateTopicNotes() {}, addTopicQuestions: (...args) => counts.push(args) }));
  fireEvent.click(await screen.findByRole("button", { name: "refazer questão" }));
  fireEvent.click(await screen.findByRole("button", { name: "A A" }));
  await screen.findByText("certo!");
  fireEvent.click(screen.getByRole("button", { name: "concluir" }));
  await screen.findByText(/nenhum erro pendente/);
  assert.deepEqual(counts, [["m", "t", 1, 1]]);
});

test("external question search uses the topic and offers a manual TEC fallback without overwriting notebooks", async () => {
  const topic = { name: "5.7 Crase", links: { tec: "https://www.tecconcursos.com.br/questoes/cadernos/123" } };
  const saved = [];
  render(React.createElement(TopicLinksEditor, { topic, onSave: value => saved.push(value), onClose() {} }));
  const field = screen.getByLabelText("Assunto para buscar");
  assert.equal(field.value, "Crase");
  fireEvent.change(field, { target: { value: "Crase & regência" } });
  assert.equal(new URL(screen.getByRole("link", { name: /Buscar no Qconcursos/ }).href).searchParams.get("q"), "Crase & regência");
  fireEvent.click(screen.getByRole("button", { name: "Copiar assunto para o TEC" }));
  await waitFor(() => assert.match(screen.getByRole("status").textContent, /copie manualmente/));
  assert.equal(saved.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "salvar links" }));
  assert.equal(saved[0].tec, topic.links.tec);
});
