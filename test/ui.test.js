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

test('integrated plan generates one shared row and saves one completion across editais after reload',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const a=makeConcurso('Integrado A',0),b=makeConcurso('Integrado B',1);a.id='a';b.id='b';
 a.materias=[{id:'am',name:'Português',topics:[{id:'at',name:'Crase',status:'pendente'}]}];b.materias=[{id:'bm',name:'Língua Portuguesa',topics:[{id:'bt',name:'Crase',status:'pendente'}]}];
 let stored={concursos:[a,b],activeConcursoId:'a',availableHoursPerWeek:7,activity:{},questionActivity:{},studyMinutes:{}};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.revision,revision);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 const props={user:{email:'unified@example.com'},onLogout(){},onUserUpdate(){}};render(React.createElement(App,props));fireEvent.click(await screen.findByRole('button',{name:'plano integrado',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Gerar plano de hoje'}));await waitFor(()=>assert.ok(stored.unifiedPlans));assert.equal(screen.getAllByRole('button',{name:'Concluir Crase'}).length,1);assert.ok(screen.getByText('Conteúdo comum'));
 fireEvent.click(screen.getByRole('button',{name:'Concluir Crase'}));fireEvent.change(screen.getByLabelText('Questões do estudo integrado'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Acertos do estudo integrado'),{target:{value:'8'}});fireEvent.click(screen.getByRole('button',{name:'Salvar conclusão'}));
 await waitFor(()=>assert.equal(Object.values(stored.activity).reduce((n,v)=>n+v,0),1));assert.equal(Object.values(stored.questionActivity).reduce((n,v)=>n+v.total,0),10);assert.equal(stored.concursos[0].materias[0].topics[0].questionsTotal,10);assert.equal(stored.concursos[1].materias[0].topics[0].questionsTotal,undefined);assert.equal(stored.concursos[1].materias[0].topics[0].status,'estudado');
 fireEvent.click(screen.getByRole('button',{name:'Atualizar plano de hoje'}));assert.equal(screen.queryByRole('button',{name:'Concluir Crase'}),null);
 cleanup();render(React.createElement(App,props));fireEvent.click(await screen.findByRole('button',{name:'plano integrado',exact:true}));assert.ok(await screen.findByText('Concluído',{exact:true}));
});

test('integrated plan reports missing availability and cancels recording without completion',async()=>{
 const UnifiedPlanView=(await vite.ssrLoadModule('/src/views/UnifiedPlanView.jsx')).UnifiedPlanView;
 const {saveUnifiedPlan}=await import('../src/lib/unifiedPlan.js');
 const today=(await import('../src/lib/date.js')).todayISO();const settings={concursoIds:['a','b'],minutesPerTopic:30};const data={concursos:[{id:'a',name:'A',materias:[{id:'m1',name:'Português',topics:[{id:'t1',name:'Crase',status:'pendente'}]}]},{id:'b',name:'B',materias:[{id:'m2',name:'Português',topics:[{id:'t2',name:'Crase',status:'pendente'}]}]}]};
 const completed=[];const props={data,onHours(){},onSettings(){},onGenerate:s=>saveUnifiedPlan(data,s,today),onComplete:(...args)=>completed.push(args)};
 const view=render(React.createElement(UnifiedPlanView,props));fireEvent.click(screen.getByRole('button',{name:'Gerar plano de hoje'}));assert.match(screen.getByRole('alert').textContent,/horas/);
 const saved=saveUnifiedPlan({...data,availableHoursPerWeek:7},settings,today);view.rerender(React.createElement(UnifiedPlanView,{...props,data:saved}));fireEvent.click(screen.getByRole('button',{name:'Concluir Crase'}));fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}));assert.equal(completed.length,0);
});

test('new learning dashboard records a single session, shares practice and reloads the account',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const a=makeConcurso('Plano visual',0),b=makeConcurso('Outro edital',1);a.id='a';b.id='b';a.materias=[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}];b.materias=[{id:'bm',name:'Português',topics:[{id:'bt',name:'Crase',status:'pendente'}]}];
 let stored={concursos:[a,b],activeConcursoId:'a',activity:{},questionActivity:{},studyMinutes:{},studyPreferences:{dailyHours:Object.fromEntries(['dom','seg','ter','qua','qui','sex','sab'].map(day=>[day,1]))}};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.revision,revision);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 const props={user:{email:'learning@example.com',displayName:'Aluno de demonstração'},onLogout(){},onUserUpdate(){}};render(React.createElement(App,props));await screen.findByRole('button',{name:'Concluir sessão do painel'});
 fireEvent.change(screen.getByLabelText('Questões da sessão do painel'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Acertos da sessão do painel'),{target:{value:'8'}});fireEvent.click(screen.getByRole('button',{name:'Concluir sessão do painel'}));
 await waitFor(()=>assert.equal(stored.studySessions?.length,1));assert.equal(Object.values(stored.activity).reduce((n,c)=>n+c,0),1);assert.equal(Object.values(stored.questionActivity).reduce((n,b)=>n+b.total,0),10);assert.equal(stored.concursos[0].materias[0].topics[0].questionsTotal,10);assert.equal(stored.concursos[1].materias[0].topics[0].questionsTotal,undefined);
 fireEvent.click(screen.getByRole('button',{name:'desempenho',exact:true}));assert.ok(await screen.findByText('Desempenho por assunto'));
 cleanup();render(React.createElement(App,props));await screen.findByRole('button',{name:'planejamento',exact:true});assert.equal(stored.studySessions.length,1);
});

test('planning dependencies are validated and configured changes preserve question counts',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const c=makeConcurso('Configuração',0);c.id='c';c.materias=[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente',questionsTotal:40,questionsCorrect:30}]}];let stored={concursos:[c],activeConcursoId:'c',activity:{},questionActivity:{},studyMinutes:{}};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 render(React.createElement(App,{user:{email:'planning@example.com'},onLogout(){},onUserUpdate(){}}));fireEvent.click(await screen.findByRole('button',{name:'planejamento',exact:true}));
 fireEvent.change(screen.getByLabelText('Modo de Português'),{target:{value:'mixed'}});fireEvent.change(screen.getByLabelText('Horas de seg'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Salvar planejamento'}));
 await waitFor(()=>assert.equal(stored.concursos[0].materias[0].learning?.mode,'mixed'));assert.equal(stored.studyPreferences.dailyHours.seg,2);assert.equal(stored.concursos[0].materias[0].topics[0].questionsTotal,40);assert.equal(stored.concursos[0].materias[0].topics[0].crossStudy,undefined);
});

test('external review and study marks persist, archive reversibly and do not add question activity',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const c=makeConcurso('Anotações',0);c.id='c';c.materias=[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}];let stored={concursos:[c],activeConcursoId:'c',activity:{},questionActivity:{},studyMinutes:{}};let revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};
 render(React.createElement(App,{user:{email:'notes@example.com'},onLogout(){},onUserUpdate(){}}));fireEvent.click(await screen.findByRole('button',{name:'caderno de revisão',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Nova questão externa'}));fireEvent.change(screen.getByLabelText('Matéria e assunto'),{target:{value:JSON.stringify(['m','t'])}});fireEvent.change(screen.getByLabelText('Link da questão externa'),{target:{value:'https://example.com/questao'}});fireEvent.click(screen.getByRole('button',{name:'Adicionar questão externa'}));await waitFor(()=>assert.equal(stored.externalReviews?.length,1));fireEvent.click(screen.getByRole('button',{name:'Acertei',exact:true}));await waitFor(()=>assert.equal(stored.externalReviews[0].reviews.length,1));assert.deepEqual(stored.questionActivity,{});
 fireEvent.click(screen.getByRole('button',{name:'minhas marcações',exact:true}));fireEvent.change(screen.getByLabelText('Matéria e assunto'),{target:{value:JSON.stringify(['m','t'])}});fireEvent.change(screen.getByLabelText('Trecho da marcação'),{target:{value:'Trecho de exemplo próprio'}});fireEvent.click(screen.getByRole('button',{name:'Salvar marcação'}));await waitFor(()=>assert.equal(stored.studyMarks?.length,1));fireEvent.click(screen.getByRole('button',{name:'Arquivar marcação'}));await waitFor(()=>assert.equal(stored.studyMarks[0].archived,true));fireEvent.click(screen.getByLabelText('Mostrar marcações arquivadas'));fireEvent.click(screen.getByRole('button',{name:'Restaurar marcação'}));await waitFor(()=>assert.equal(stored.studyMarks[0].archived,false));assert.deepEqual(stored.activity,{});
});

test('extension imports require a valid preview and explicit confirmation before adding marks',async()=>{
 const StudyToolsView=(await vite.ssrLoadModule('/src/views/StudyToolsView.jsx')).StudyToolsView;const imports=[];const date=(await import('../src/lib/date.js')).todayISO();const payload={format:'ritmo-marks-v1',marks:[{id:'capture',text:'Exemplo próprio',note:'Revisar',url:'https://example.com',color:'yellow',date}]};
 render(React.createElement(StudyToolsView,{concurso:{id:'c',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase'}]}]},data:{},onImport:entries=>imports.push(entries),onCommunity(){}}));
 fireEvent.change(screen.getByLabelText('Assunto das marcações importadas'),{target:{value:JSON.stringify(['m','t'])}});fireEvent.change(screen.getByLabelText('Arquivo de marcações'),{target:{files:[{size:200,text:async()=>JSON.stringify(payload)}]}});
 await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Conferir importação de marcações'})));fireEvent.click(screen.getByRole('button',{name:'Conferir importação de marcações'}));await screen.findByRole('button',{name:'Confirmar importação de marcações'});assert.equal(imports.length,0);fireEvent.click(screen.getByRole('button',{name:'Confirmar importação de marcações'}));assert.equal(imports.length,1);assert.equal(imports[0][0].topicId,'t');
});

test('public visual demo uses synthetic state and never requests private account data',async()=>{
 const {LearningPreview,previewData}=(await vite.ssrLoadModule('/src/views/LearningPreview.jsx'));const {validatePlanData}=await import('../src/lib/planValidation.js');validatePlanData(previewData());let calls=0;globalThis.fetch=async()=>{calls++;throw Error('A demonstração não pode acessar APIs.');};
 render(React.createElement(LearningPreview));assert.ok(screen.getByText(/Prévia com dados fictícios/));fireEvent.click(screen.getByRole('button',{name:'Concluir sessão do painel'}));fireEvent.click(screen.getByRole('button',{name:'Desempenho',exact:true}));await screen.findByText('Desempenho por assunto');assert.equal(calls,0);
});

test('notebook catalog creates topic-linked bank entries and filters saved links',async()=>{
 const {NotebookCatalogView}=await vite.ssrLoadModule('/src/views/NotebookCatalogView.jsx');let created;
 const concurso={id:'c',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase'}]}]};const props={concurso,data:{questionNotebooks:[{id:'old',concursoId:'c',materiaId:'m',topicId:'t',title:'Caderno FGV',bank:'FGV',url:'https://example.com/fgv'},{id:'other',concursoId:'c',materiaId:'m',topicId:'t',title:'Caderno Cespe',bank:'Cebraspe',url:'https://example.com/cespe'}]},onAdd:e=>created=e,onRemove(){}};
 render(React.createElement(NotebookCatalogView,props));fireEvent.change(screen.getByLabelText('Filtrar banca'),{target:{value:'FGV'}});assert.ok(screen.getByText('Caderno FGV'));assert.equal(screen.queryByText('Caderno Cespe'),null);
 fireEvent.change(screen.getByLabelText('Assunto'),{target:{value:JSON.stringify(['m','t'])}});fireEvent.change(screen.getByLabelText('Título do caderno'),{target:{value:'Meu caderno'}});fireEvent.change(screen.getByLabelText('Banca',{exact:true}),{target:{value:'FGV'}});fireEvent.change(screen.getByLabelText('Link do caderno'),{target:{value:'https://example.com/meu'}});fireEvent.click(screen.getByRole('button',{name:'Adicionar caderno por banca'}));assert.equal(created.topicId,'t');assert.equal(created.bank,'FGV');assert.equal(created.concursoId,'c');
});

test('dashboard restores paused time for the same account and keeps other accounts isolated',async()=>{
 const {LearningDashboard}=await vite.ssrLoadModule('/src/views/LearningDashboard.jsx');const {todayISO}=await import('../src/lib/date.js');const data={concursos:[{id:'c',name:'Meu edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}],settings:{minutesPerMateria:30}}],studyPreferences:{dailyHours:Object.fromEntries(['dom','seg','ter','qua','qui','sex','sab'].map(d=>[d,1]))}};
 const key=`ritmo-session:${JSON.stringify(['timer@example.com','c',todayISO()])}`;localStorage.setItem(key,JSON.stringify({materiaId:'m',topicId:'t',elapsedMs:125000,startedAt:null}));let saved;
 const props={data,concurso:data.concursos[0],user:{email:'timer@example.com'},onComplete:(ref,result)=>saved=result,onGoal(){},onNavigate(){}};render(React.createElement(LearningDashboard,props));assert.equal(screen.getByLabelText('Tempo desta sessão').textContent,'02:05');fireEvent.click(screen.getByRole('button',{name:'Concluir sessão do painel'}));assert.equal(saved.elapsedSeconds,125);assert.equal(localStorage.getItem(key),null);cleanup();render(React.createElement(LearningDashboard,{...props,user:{email:'another@example.com'}}));assert.equal(screen.getByLabelText('Tempo desta sessão').textContent,'00:00');
});

test('ranking sorts accuracy with a minimum sample and keeps the area filter across metrics',async()=>{
 const {RankingView}=await vite.ssrLoadModule('/src/views/RankingView.jsx');const users=[{displayName:'Aluno A',studyArea:'fiscal',streak:3,totalEstudado:2,materias:[]},{displayName:'Aluno B',studyArea:'fiscal',streak:1,totalEstudado:1,materias:[]},{displayName:'Aluno C',studyArea:'policial',streak:0,totalEstudado:1,materias:[]}];globalThis.fetch=async()=>response({users,isOptedIn:true,questionPeriods:{day:[{displayName:'Aluno A',studyArea:'fiscal',total:20,correct:14},{displayName:'Aluno B',studyArea:'fiscal',total:10,correct:9},{displayName:'Aluno C',studyArea:'policial',total:3,correct:3}]}});
 render(React.createElement(RankingView,{currentDisplayName:'Aluno A',studyArea:'fiscal',onGoToSettings(){}}));const region=screen.getByRole('region',{name:'Ranking de questões'});await waitFor(()=>assert.match(region.textContent,/Aluno C/));fireEvent.click(screen.getByRole('button',{name:'Por aproveitamento'}));assert.equal(region.textContent.includes('Aluno C'),false);assert.ok(region.textContent.indexOf('Aluno B')<region.textContent.indexOf('Aluno A'));fireEvent.click(screen.getByRole('button',{name:'Minha área',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Por volume'}));assert.equal(region.textContent.includes('Aluno C'),false);assert.ok(screen.getByText('Sequência de estudo'));
});

test('notebook batch preview requires confirmation and practice captures questions, accuracy and time',async()=>{
 const {NotebookCatalogView}=await vite.ssrLoadModule('/src/views/NotebookCatalogView.jsx');const concurso={id:'c',name:'Edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}]};const data={concursos:[concurso],questionNotebooks:[{id:'book',concursoId:'c',materiaId:'m',topicId:'t',title:'Meu TEC',bank:'FGV',url:'https://www.tecconcursos.com.br/example-book'}]};const imports=[],practices=[];
 render(React.createElement(NotebookCatalogView,{data,concurso,onAdd(){},onRemove(){},onImport:entries=>imports.push(entries),onPractice:(ref,result)=>practices.push({ref,result})}));assert.ok(screen.getByText('Meu TEC'));fireEvent.change(screen.getByLabelText('Lista de cadernos para importar'),{target:{value:'materia;assunto;banca;titulo;url\nPortuguês;Crase;FGV;Novo caderno;https://example.com/novo'}});fireEvent.click(screen.getByRole('button',{name:'Conferir cadernos importados'}));assert.equal(imports.length,0);assert.ok(screen.getByText('Novo caderno'));fireEvent.click(screen.getByRole('button',{name:'Confirmar importação de cadernos'}));assert.equal(imports.length,1);
 fireEvent.click(screen.getByRole('button',{name:'Registrar prática'}));fireEvent.change(screen.getByLabelText('Questões resolvidas no caderno'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Acertos no caderno'),{target:{value:'8'}});fireEvent.change(screen.getByLabelText('Minutos de prática'),{target:{value:'15'}});fireEvent.click(screen.getByRole('button',{name:'Salvar prática do caderno'}));assert.equal(practices.length,1);assert.equal(practices[0].ref.topicId,'t');assert.equal(practices[0].result.notebookId,'book');assert.equal(practices[0].result.total,10);assert.equal(practices[0].result.minutes,15);
});

test('TEC notebook saves to account, appears on topic links after reload, and practice updates totals only once',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const c=makeConcurso('Edital TEC',0);c.id='c';c.materias=[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}];let stored={concursos:[c],activeConcursoId:'c',activity:{},questionActivity:{},studyMinutes:{}},revision=1;
 globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.revision,revision);stored=JSON.parse(body.value);return response({revision:++revision});}if(path==='/api/data')return response({value:JSON.stringify(stored),revision});return response(path.includes('counts')?{counts:[]}:{materias:[]});};const props={user:{email:'tec-test@example.com'},onLogout(){},onUserUpdate(){}};
 render(React.createElement(App,props));fireEvent.click(await screen.findByRole('button',{name:'questões avulsas',exact:true}));fireEvent.change(screen.getByLabelText('Assunto',{exact:true}),{target:{value:JSON.stringify(['m','t'])}});fireEvent.change(screen.getByLabelText('Título do caderno'),{target:{value:'TEC pessoal'}});fireEvent.change(screen.getByLabelText('Banca',{exact:true}),{target:{value:'Cebraspe'}});fireEvent.change(screen.getByLabelText('Link do caderno'),{target:{value:'https://www.tecconcursos.com.br/example-notebook'}});fireEvent.click(screen.getByRole('button',{name:'Adicionar caderno por banca'}));await waitFor(()=>assert.equal(stored.questionNotebooks?.length,1));fireEvent.click(screen.getByRole('button',{name:'Registrar prática'}));fireEvent.change(screen.getByLabelText('Questões resolvidas no caderno'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Acertos no caderno'),{target:{value:'8'}});fireEvent.click(screen.getByRole('button',{name:'Salvar prática do caderno'}));await waitFor(()=>assert.equal(stored.questionEvents?.length,1));assert.equal(stored.questionActivity[stored.questionEvents[0].date].total,10);assert.equal(stored.concursos[0].materias[0].topics[0].notebookLinks,undefined);
 cleanup();render(React.createElement(App,props));assert.ok(await screen.findByRole('link',{name:'abrir caderno TEC pessoal'}));assert.equal(stored.questionEvents.length,1);
});

test('switching dashboard topics preserves each timer and resumes only the selected topic',async()=>{
 const {LearningDashboard}=await vite.ssrLoadModule('/src/views/LearningDashboard.jsx');const {todayISO}=await import('../src/lib/date.js');const c={id:'c',name:'Edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'},{id:'t2',name:'Verbos',status:'pendente'}]}],settings:{minutesPerMateria:30}},data={concursos:[c],studyPreferences:{dailyHours:Object.fromEntries(['dom','seg','ter','qua','qui','sex','sab'].map(d=>[d,2]))}};const key=`ritmo-session:${JSON.stringify(['switch@example.com','c',todayISO()])}`;localStorage.setItem(key,JSON.stringify({materiaId:'m',topicId:'t',elapsedMs:125000,startedAt:null}));render(React.createElement(LearningDashboard,{data,concurso:c,user:{email:'switch@example.com'},onComplete(){},onGoal(){},onNavigate(){}}));assert.equal(screen.getByLabelText('Tempo desta sessão').textContent,'02:05');fireEvent.click(screen.getAllByRole('button',{name:'Selecionar tarefa'})[1]);assert.equal(screen.getByLabelText('Tempo desta sessão').textContent,'00:00');fireEvent.click(screen.getAllByRole('button',{name:'Selecionar tarefa'})[0]);assert.equal(screen.getByLabelText('Tempo desta sessão').textContent,'02:05');assert.ok(screen.getByRole('button',{name:'Iniciar sessão de estudo'}));
});
test('catalog paginates long lists, searches accent-insensitively and resets page on filtering',async()=>{
 const {NotebookCatalogView}=await vite.ssrLoadModule('/src/views/NotebookCatalogView.jsx');const c={id:'c',name:'Edital',materias:[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}]},data={concursos:[c],questionNotebooks:Array.from({length:51},(_,i)=>({id:`n${i}`,concursoId:'c',materiaId:'m',topicId:'t',title:i===50?'Último caderno':`Caderno ${i}`,bank:'FGV',url:`https://example.com/${i}`}))};render(React.createElement(NotebookCatalogView,{data,concurso:c,onAdd(){},onRemove(){}}));assert.equal(screen.queryByText('Último caderno'),null);fireEvent.click(screen.getByRole('button',{name:'Próxima página dos cadernos'}));assert.ok(screen.getByText('Último caderno'));fireEvent.change(screen.getByLabelText('Buscar no catálogo de cadernos'),{target:{value:'ultimo'}});assert.ok(screen.getByText('Último caderno'));assert.match(document.body.textContent,/1 cadernos · página 1 de 1/);
});

test('plan recovery uses account identity and remains stable across an email change',async()=>{
 const {makeConcurso}=await import('../src/data/model.js');const c=makeConcurso('Conta estável',0);c.id='stable';c.materias=[{id:'m',name:'Português',topics:[{id:'t',name:'Crase',status:'pendente'}]}];const saved={concursos:[c],activeConcursoId:'stable',activity:{}},pending=structuredClone(saved);pending.concursos[0].name='Alteração pendente da conta';localStorage.setItem('rota-plan-pending:account:42',JSON.stringify({value:JSON.stringify(pending),revision:1}));localStorage.setItem('rota-plan-pending:new@example.com',JSON.stringify({value:JSON.stringify({...saved,concursos:[]}),revision:1}));globalThis.fetch=async(path,options={})=>{if(path==='/api/data'&&options.method==='PUT')return response({error:'Offline'},503);if(path==='/api/data')return response({value:JSON.stringify(saved),revision:1});return response(path.includes('counts')?{counts:[]}:{materias:[]});};const props={user:{id:42,email:'old@example.com'},onLogout(){},onUserUpdate(){}};const view=render(React.createElement(App,props));await screen.findAllByText('Alteração pendente da conta');view.rerender(React.createElement(App,{...props,user:{id:42,email:'new@example.com'}}));assert.ok(screen.getAllByText('Alteração pendente da conta').length>0);assert.ok(localStorage.getItem('rota-plan-pending:account:42'));
});
