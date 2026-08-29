// One-off loader: reads the indented matéria/assunto outline (produced by the
// browser console extractor from TecConcursos) and upserts it into the
// content_bank_materias table, so every user can import from it later.
//
// Usage:
//   node server/scripts/seed-content-bank.js "C:\path\to\materias-assuntos.txt"

import fs from "node:fs";
import db from "../db.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("uso: node server/scripts/seed-content-bank.js <caminho-do-txt>");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf-8");
const rawLines = raw.split(/\r?\n/);

const materias = [];
let current = null;

for (const rawLine of rawLines) {
  if (!rawLine.trim()) continue;
  const leadingSpaces = rawLine.match(/^ */)[0].length;
  const depth = Math.round(leadingSpaces / 2);
  const name = rawLine.trim();

  if (depth === 0) {
    current = { name, topics: [] };
    materias.push(current);
    continue;
  }

  if (!current) continue; // stray indented line before any matéria — skip
  if (name === "Questões sem classificação de assunto") continue;
  if (!current.topics.includes(name)) current.topics.push(name);
}

const usable = materias.filter((m) => m.name && m.topics.length > 0);

const upsert = db.prepare(`
  INSERT INTO content_bank_materias (name, topics, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(name) DO UPDATE SET topics = excluded.topics, updated_at = excluded.updated_at
`);

let totalTopics = 0;
for (const m of usable) {
  upsert.run(m.name, JSON.stringify(m.topics));
  totalTopics += m.topics.length;
}

console.log(`ok: ${usable.length} matérias / ${totalTopics} assuntos gravados no banco (${materias.length - usable.length} descartadas por não terem assuntos).`);
