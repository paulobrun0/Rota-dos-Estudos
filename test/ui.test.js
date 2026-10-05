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
let vite, App, QuizPractice, TopicLinksEditor, TopicLinkButtons, CadernoView, SimuladosView, EditalTemplateImporter, ConciliacaoView;
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
  SimuladosView = (await vite.ssrLoadModule("/src/views/SimuladosView.jsx")).SimuladosView;
  EditalTemplateImporter = (await vite.ssrLoadModule("/src/components/EditalTemplateImporter.jsx")).EditalTemplateImporter;
  ConciliacaoView = (await vite.ssrLoadModule("/src/views/ConciliacaoView.jsx")).ConciliacaoView;
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

test('a template preview does not import until confirmed and can be cancelled',()=>{
 const imports=[];render(React.createElement(EditalTemplateImporter,{onImport:c=>imports.push(c)}));
 fireEvent.click(screen.getByRole('button',{name:'Modelo inicial · Tribunais'}));assert.equal(imports.length,0);
 fireEvent.click(screen.getByRole('button',{name:'Cancelar prévia'}));assert.equal(imports.length,0);
 fireEvent.click(screen.getByRole('button',{name:'Modelo inicial · Tribunais'}));fireEvent.click(screen.getByRole('button',{name:'Importar como novo concurso'}));assert.equal(imports.length,1);assert.equal(imports[0].materias.length,3);
});
test('simulado entry persists only valid positive question counts with weights',()=>{
 const saves=[];render(React.createElement(SimuladosView,{concurso:{banca:'FGV',materias:[{id:'m',name:'Português'}]},onSave:e=>saves.push(e)}));
 fireEvent.click(screen.getByRole('button',{name:'Registrar simulado'}));fireEvent.change(screen.getByLabelText('Nome do simulado'),{target:{value:'Treino 1'}});
 fireEvent.submit(screen.getByRole('button',{name:'Salvar simulado'}).closest('form'));assert.equal(saves.length,0);assert.ok(screen.getByRole('alert'));
 fireEvent.change(screen.getByLabelText('Questões de Português'),{target:{value:'20'}});fireEvent.change(screen.getByLabelText('Acertos de Português'),{target:{value:'16'}});fireEvent.change(screen.getByLabelText('Peso de Português'),{target:{value:'2'}});
 fireEvent.submit(screen.getByRole('button',{name:'Salvar simulado'}).closest('form'));assert.equal(saves.length,1);assert.equal(saves[0].rows[0].correct,16);assert.equal(saves[0].rows[0].weight,2);
});
test('materials are staged with the notebook editor and saved together',()=>{
 const materials=[];render(React.createElement(TopicLinksEditor,{topic:{name:'Crase'},onSave(){},onSaveMaterials:m=>materials.push(m),onClose(){}}));
 fireEvent.change(screen.getByLabelText('Nome do material'),{target:{value:'Aula de Crase'}});fireEvent.change(screen.getByLabelText('Link do material'),{target:{value:'https://example.com/aula.pdf'}});
 fireEvent.click(screen.getByRole('button',{name:'Adicionar material à lista'}));assert.equal(materials.length,0);
 fireEvent.click(screen.getByRole('button',{name:'salvar links'}));assert.equal(materials[0][0].name,'Aula de Crase');assert.equal(materials[0][0].type,'pdf');
});

 test('simulado deletion requires confirmation and passes the selected id',()=>{
 const removed=[];const oldConfirm=window.confirm;
 const concurso={materias:[],simulados:[{id:'exam',name:'Treino',date:'2026-10-03',minutes:30,rows:[{materiaId:'m',materiaName:'Português',total:20,correct:16,weight:1}]}]};
 try{render(React.createElement(SimuladosView,{concurso,onRemove:id=>removed.push(id)}));
 window.confirm=()=>false;fireEvent.click(screen.getByRole('button',{name:'Excluir',exact:true}));assert.equal(removed.length,0);
 window.confirm=()=>true;fireEvent.click(screen.getByRole('button',{name:'Excluir',exact:true}));assert.deepEqual(removed,['exam']);
 }finally{window.confirm=oldConfirm;}
 });

test('comparing editais exposes distinct coverage and skip only after a user click',()=>{
 const skips=[];const concursos=[{id:'a',name:'Tribunal',materias:[{id:'am',name:'Português',topics:[{id:'at',name:'Crase',status:'estudado',questionsTotal:20,questionsCorrect:16},{id:'other',name:'Pontuação',status:'pendente'}]}]},{id:'b',name:'Prefeitura',materias:[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'1. Crase',status:'pendente'}]}]}];
 render(React.createElement(ConciliacaoView,{concursos,activeConcursoId:'a',onSkip:ref=>skips.push(ref),onUndo(){},onLink(){},onUnlink(){}}));assert.equal(skips.length,0);assert.equal(screen.getAllByText('50%',{exact:true}).length,3);assert.equal(screen.getAllByText('100%',{exact:true}).length,2);
 fireEvent.click(screen.getByRole('button',{name:'Pular assunto já praticado',exact:true}));assert.deepEqual(skips,[{concursoId:'b',materiaId:'bm',topicId:'bt'}]);assert.equal(concursos[1].materias[0].topics[0].status,'pendente');
 fireEvent.change(screen.getByLabelText('Segundo edital',{exact:true}),{target:{value:'a'}});assert.match(screen.getByRole('alert').textContent,/dois editais diferentes/);
});

test('question completion in one edital is visible in another, saves once and persists optional skip',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const a=makeConcurso('Tribunal',0),b=makeConcurso('Prefeitura',1);a.id='a';b.id='b';a.settings.materiasPerDay=1;b.settings.materiasPerDay=1;a.settings.minutesPerMateria=0;b.settings.minutesPerMateria=0;
 a.materias=[{id:'am',name:'Português',topics:[{id:'at',name:'Crase',status:'pendente',questionsTotal:20,questionsCorrect:16}]}];b.materias=[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'1. Crase',status:'pendente'}]}];
 let stored={concursos:[a,b],activeConcursoId:'b',activity:{},questionActivity:{},studyMinutes:{},studyDays:['dom','seg','ter','qua','qui','sex','sab']};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.revision,revision);stored=JSON.parse(body.value);revision++;return response({revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 render(React.createElement(App,{user:{email:'shared@example.com'},onLogout(){},onUserUpdate(){}}));fireEvent.click(await screen.findByRole('button',{name:'hoje',exact:true}));fireEvent.click(await screen.findByRole('button',{name:'marcar como estudado',exact:true}));fireEvent.change(screen.getByPlaceholderText('feitas'),{target:{value:'5'}});fireEvent.change(screen.getByPlaceholderText('acertos'),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'concluir',exact:true}));
 await waitFor(()=>assert.equal(stored.concursos[1].materias[0].topics[0].questionsTotal,5));fireEvent.click(screen.getByRole('button',{name:'conciliar editais',exact:true}));assert.ok(await screen.findByText('19/25',{exact:true}));assert.ok(screen.getByText('5 questões em outros editais · 60% de acertos',{exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Pular assunto já praticado',exact:true}));await waitFor(()=>assert.equal(stored.concursos[0].materias[0].topics[0].skippedFromShared,true));assert.equal(Object.values(stored.questionActivity).reduce((n,b)=>n+b.total,0),5);assert.equal(Object.values(stored.activity).reduce((n,c)=>n+c,0),1);assert.equal(stored.concursos[0].materias[0].topics[0].questionsTotal,20);assert.ok(stored.concursos.every(c=>c.materias.every(m=>m.topics.every(t=>t.crossStudy===undefined))));
 cleanup();render(React.createElement(App,{user:{email:'shared@example.com'},onLogout(){},onUserUpdate(){}}));await screen.findByRole('button',{name:'conciliar editais',exact:true});fireEvent.click(screen.getByRole('button',{name:'conciliar editais',exact:true}));await screen.findByRole('button',{name:'Voltar a estudar',exact:true});
});

test('conciliation saves weekly availability and materia weights through explicit controls',()=>{
 const hours=[],weights=[];const concursos=[{id:'a',name:'A',examDate:'2026-12-01',materias:[{id:'am',name:'Português',topics:[{id:'at',name:'Crase',status:'pendente'}]}]},{id:'b',name:'B',materias:[{id:'bm',name:'Português',topics:[{id:'bt',name:'Crase',status:'pendente'}]}]}];
 render(React.createElement(ConciliacaoView,{concursos,activeConcursoId:'a',onHours:n=>hours.push(n),onWeight:(...args)=>weights.push(args)}));
 fireEvent.change(screen.getByLabelText('Horas disponíveis por semana'),{target:{value:'10'}});assert.deepEqual(hours,[10]);
 fireEvent.click(screen.getByText('Ajustar importância das matérias'));const input=screen.getByLabelText('Peso de Português em A');fireEvent.change(input,{target:{value:'3'}});fireEvent.blur(input);assert.deepEqual(weights,[['a','am',3]]);
 fireEvent.change(input,{target:{value:'-1'}});fireEvent.blur(input);assert.equal(weights.length,1);
});

test('deleting a source edital preserves practice in the account and after reloading',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const a=makeConcurso('Fonte',0),b=makeConcurso('Destino',1);a.id='a';b.id='b';
 a.materias=[{id:'am',name:'Português',topics:[{id:'at',name:'Crase',status:'pendente',questionsTotal:80,questionsCorrect:64,lastPracticeDate:'2026-10-03'}]}];
 b.materias=[{id:'bm',name:'Português',topics:[{id:'bt',name:'Crase',status:'pendente'}]}];
 let stored={concursos:[a,b],activeConcursoId:'b',activity:{},questionActivity:{},studyMinutes:{}};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.revision,revision);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 const props={user:{email:'archive@example.com'},onLogout(){},onUserUpdate(){}};
 render(React.createElement(App,props));fireEvent.click(await screen.findByRole('button',{name:'concursos',exact:true}));fireEvent.click(screen.getAllByRole('button',{name:'excluir concurso'})[0]);
 await waitFor(()=>assert.equal(stored.practiceArchive?.length,1));assert.equal(stored.concursos.length,1);assert.equal(stored.practiceArchive[0].topic.questionsTotal,80);assert.deepEqual(stored.activity,{});assert.ok(screen.getByText('Histórico preservado'));
 cleanup();render(React.createElement(App,props));fireEvent.click(await screen.findByRole('button',{name:'hoje',exact:true}));assert.ok(await screen.findByText('80 questões em outros editais · 80% de acertos',{exact:true}));assert.ok(screen.getByRole('button',{name:'Pular assunto já praticado',exact:true}));
});
