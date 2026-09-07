// Adds a matéria's missing topics (per diff-topicos-tecconcursos.mjs)
// straight into the user's saved edital data, as new "pendente" topics —
// the same shape the app itself creates when a topic is added by hand.
//
// A topic whose name names a specific Brazilian state (or "Legislação ... do
// Estado/Município ...") is regional; by the user's own call, those are
// skipped for now and left for a later pass, since most of their study plan
// targets national/federal content. Pass --incluir-regionais to keep them.
//
//   node server/scripts/adicionar-topicos-faltantes.mjs "<slug>" "<Matéria>" [--incluir-regionais] [--aplicar]
//
// Without --aplicar it only prints what would be added (dry run).

import { pathToFileURL } from "node:url";
import db from "../db.js";
import { uid } from "../../src/lib/id.js";
import { diffMateria } from "./diff-topicos-tecconcursos.mjs";

// Alagoas fica de fora da lista de exclusão: parte dos concursos do ciclo
// atual do usuário é estadual (PM AL, PC AL), então esses tópicos são
// relevantes agora — os demais estados ficam para uma conferência futura.
const ESTADOS = [
  "Acre", "Amapá", "Amazonas", "Bahia", "Ceará", "Espírito Santo", "Goiás",
  "Maranhão", "Mato Grosso do Sul", "Mato Grosso", "Minas Gerais", "Pará", "Paraíba", "Paraná",
  "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
  "Distrito Federal",
];
// \b trata letras acentuadas como "não-palavra", então falha bem no limite
// de nomes como "Paraná" ou "Ceará" (o "á" final quebra o boundary). Usar
// lookaround baseado em \p{L} evita isso.
const RE_ESTADO = new RegExp(`(?<![\\p{L}])(${ESTADOS.join("|")})(?![\\p{L}])`, "iu");
const RE_REGIONAL = /Legisla[çc][ãa]o (Estadual|Municipal)|do Estado d[eoa]\b|\bda RIDE\b/i;

export function ehRegional(nomeTopico) {
  return RE_ESTADO.test(nomeTopico) || RE_REGIONAL.test(nomeTopico);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , slug, materiaNome] = process.argv;
  const incluirRegionais = process.argv.includes("--incluir-regionais");
  const aplicar = process.argv.includes("--aplicar");
  if (!slug || !materiaNome) {
    console.error('uso: node server/scripts/adicionar-topicos-faltantes.mjs "<slug>" "<Matéria>" [--incluir-regionais] [--aplicar]');
    process.exit(1);
  }

  const { faltando } = await diffMateria(slug, materiaNome);
  const selecionados = incluirRegionais ? faltando : faltando.filter((f) => !ehRegional(f.nome));
  const pulados = faltando.length - selecionados.length;

  console.log(`${materiaNome}: ${selecionados.length} tópicos a adicionar${pulados ? ` (${pulados} regionais pulados)` : ""}.`);
  selecionados.forEach((f) => console.log(`  + ${f.nome}`));

  if (!aplicar) {
    console.log("\n(dry run — rode de novo com --aplicar para gravar)");
    process.exit(0);
  }

  const row = db.prepare("SELECT value FROM user_data WHERE user_id = 2").get();
  const data = JSON.parse(row.value);
  const materia = data.concursos[0].materias.find((m) => m.name === materiaNome);
  if (!materia) throw new Error(`matéria "${materiaNome}" não encontrada`);

  for (const f of selecionados) {
    materia.topics.push({ id: uid(), name: f.nome, status: "pendente", mastered: false });
  }

  db.prepare("UPDATE user_data SET value = ?, updated_at = datetime('now') WHERE user_id = 2").run(JSON.stringify(data));
  console.log(`\ngravado. ${materiaNome} agora tem ${materia.topics.length} tópicos.`);
}
