// Diffs a matéria's topic tree registered in the user's own edital against
// the official taxonomy TecConcursos publishes on its (public, no-login-
// required) matéria page — the same site the question bank's classification
// is meant to match against. Prints leaf topics present on the site but
// missing from the app, ordered by how many questions the site has for them
// (a rough priority signal, not something imported into the bank).
//
//   node server/scripts/diff-topicos-tecconcursos.mjs "<slug-tecconcursos>" "<Nome da Matéria no app>"

import { pathToFileURL } from "node:url";
import db from "../db.js";

function normaliza(nome) {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[;.,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A página embute a árvore inteira como JSON (`var jsonMateria = {...}`) —
// bem mais confiável que ler o HTML renderizado, que colapsa/paginação certos
// ramos (foi assim que "Geografia de Alagoas" ficou de fora de uma leitura só
// de HTML). Uma folha é um nó sem `filhos`.
export async function buscarAssuntosTecConcursos(slug) {
  const html = await (await fetch(`https://www.tecconcursos.com.br/materias/${slug}`)).text();
  const m = html.match(/var jsonMateria = (\{.*?\});/s);
  if (!m) throw new Error(`jsonMateria não encontrado na página de "${slug}"`);
  const raiz = JSON.parse(m[1]);

  const folhas = [];
  const percorrer = (assuntos) => {
    for (const a of assuntos || []) {
      if (!a.filhos || a.filhos.length === 0) folhas.push({ nome: a.nome, questoes: a.totalQuestoes || 0 });
      else percorrer(a.filhos);
    }
  };
  percorrer(raiz.assuntos);
  return folhas;
}

export function topicosDaMateria(materiaNome) {
  const row = db.prepare("SELECT value FROM user_data WHERE user_id = 2").get();
  const data = JSON.parse(row.value);
  const materia = data.concursos[0].materias.find((m) => m.name === materiaNome);
  if (!materia) throw new Error(`matéria "${materiaNome}" não encontrada no app`);
  return materia.topics.map((t) => t.name);
}

// "Sem Classificação de Assunto" é o balde de questões que o próprio
// TecConcursos ainda não etiquetou — não é um assunto de verdade pra copiar.
const NAO_E_TOPICO_REAL = new Set(["sem classificacao de assunto"]);

export async function diffMateria(slug, materiaNome) {
  const doSite = await buscarAssuntosTecConcursos(slug);
  const doApp = new Set(topicosDaMateria(materiaNome).map(normaliza));
  const faltando = doSite
    .filter((f) => !NAO_E_TOPICO_REAL.has(normaliza(f.nome)) && !doApp.has(normaliza(f.nome)))
    .sort((a, b) => b.questoes - a.questoes);
  return { totalSite: doSite.length, totalApp: doApp.size, faltando };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , slug, materiaNome] = process.argv;
  if (!slug || !materiaNome) {
    console.error('uso: node server/scripts/diff-topicos-tecconcursos.mjs "<slug>" "<Nome da Matéria>"');
    process.exit(1);
  }
  const { totalSite, totalApp, faltando } = await diffMateria(slug, materiaNome);
  console.log(`${materiaNome}: site tem ${totalSite} tópicos, app tem ${totalApp}. Faltando: ${faltando.length}`);
  faltando.forEach((f) => console.log(`  ${String(f.questoes).padStart(6)}  ${f.nome}`));
}
