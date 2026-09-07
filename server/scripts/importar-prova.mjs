// Imports one prova into the question bank, from the PDFs the banca itself
// publishes. Reads the parsed cache produced by indexar-provas.mjs and a small
// config describing the prova:
//
//   {
//     "arquivo": "pf-agente-2021.json",
//     "banca": "CEBRASPE (CESPE)",
//     "orgao": "PF",
//     "cargo": "Agente de Polícia Federal",
//     "ano": 2021,
//     "materia": "Português",
//     "assuntos": {
//       "1": "Interpretação de Textos (Compreensão)",
//       "40": ["Informática", "Windows 10"]
//     }
//   }
//
// Only the items listed in `assuntos` are imported — that map is also what
// assigns each item to a topic, since nothing in the prova states which topic
// an item belongs to. A plain string uses the config's `materia`; a pair
// [matéria, assunto] overrides it, so one prova can be classified across every
// matéria it covers in a single pass. Items the banca annulled are skipped.
//
//   node server/scripts/importar-prova.mjs <config.json>

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import db from "../db.js";

const upsert = db.prepare(`
  INSERT INTO questions
    (fonte, materia, assunto, banca, orgao, cargo, ano, tipo, texto_base, comando, enunciado, alternativas, gabarito)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(fonte) DO UPDATE SET
    materia = excluded.materia, assunto = excluded.assunto, banca = excluded.banca,
    orgao = excluded.orgao, cargo = excluded.cargo, ano = excluded.ano, tipo = excluded.tipo,
    texto_base = excluded.texto_base, comando = excluded.comando,
    enunciado = excluded.enunciado, alternativas = excluded.alternativas, gabarito = excluded.gabarito
`);

const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function importarProva(config, { baseDir = "." } = {}) {
  const dados = JSON.parse(fs.readFileSync(path.resolve(baseDir, config.arquivo), "utf8"));
  const resultado = { importados: 0, anulados: 0, semGabarito: 0, naoEncontrados: [] };

  for (const [numeroStr, valor] of Object.entries(config.assuntos)) {
    const numero = Number(numeroStr);
    const [materia, assunto] = Array.isArray(valor) ? valor : [config.materia, valor];
    const item = dados.itens.find((i) => i.numero === numero);
    if (!item) { resultado.naoEncontrados.push(numero); continue; }

    const resposta = dados.gabarito[numero];
    if (!resposta) { resultado.semGabarito++; continue; }
    if (resposta === "X") { resultado.anulados++; continue; }

    const multiplaEscolha = Array.isArray(item.alternativas) && item.alternativas.length > 0 && item.alternativas[0].letra;
    const alternativas = multiplaEscolha ? item.alternativas.map((a) => a.texto) : ["Certo", "Errado"];
    const gabaritoFinal = multiplaEscolha
      ? item.alternativas.find((a) => a.letra === resposta)?.texto ?? resposta
      : resposta === "C"
        ? "CERTO"
        : "ERRADO";

    upsert.run(
      `${slug(config.banca)}/${slug(config.orgao)}/${config.ano}/${slug(config.cargo || "geral")}/item-${numero}`,
      materia,
      assunto,
      config.banca,
      config.orgao ?? null,
      config.cargo ?? null,
      config.ano ?? null,
      multiplaEscolha ? "MULTIPLA_ESCOLHA" : "CERTO_ERRADO",
      item.textoBase ?? null,
      item.comando || null,
      item.enunciado ?? item.texto,
      JSON.stringify(alternativas),
      gabaritoFinal,
    );
    resultado.importados++;
  }

  return resultado;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const caminhos = process.argv.slice(2);
  if (caminhos.length === 0) {
    console.error("uso: node server/scripts/importar-prova.mjs <config.json> [outro.json ...]");
    process.exit(1);
  }
  for (const caminho of caminhos) {
    const config = JSON.parse(fs.readFileSync(caminho, "utf8"));
    const r = importarProva(config, { baseDir: path.dirname(path.resolve(caminho)) });
    console.log(`${path.basename(caminho)}: importados ${r.importados} | anulados ${r.anulados} | sem gabarito ${r.semGabarito}${r.naoEncontrados.length ? ` | ausentes ${r.naoEncontrados.join(",")}` : ""}`);
  }
  console.log("total no banco:", db.prepare("SELECT COUNT(*) AS n FROM questions").get().n);
}
