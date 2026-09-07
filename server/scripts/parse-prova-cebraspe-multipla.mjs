// Turns a Cebraspe multiple-choice caderno (used for officer-level concursos,
// unlike the certo/errado format soldado-level ones use) into structured
// questions. Items are "Questão N" followed by a bare-letter alternative
// list (A .. E, no parentheses), grouped under an ALL-CAPS matéria heading
// printed as its own line.
//
//   node server/scripts/parse-prova-cebraspe-multipla.mjs <prova.pdf> [--json saida.json]

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";
import { EH_CABECALHO as EH_MATERIA_CONHECIDA } from "./parse-prova-fgv.mjs";

const RUIDO = [
  /^CEBRASPE\b/i,
  /^-\s*\d+\s*-$/,
  /^Espaço livre/i,
  /^-{0,2}\s*PROVA OBJETIVA\s*-{0,2}$/i,
  /^-- .* --$/,
  /^LEIA COM ATENÇÃO/i,
  /^Texto \d[A-Z]\d(-[IVX]+)?$/i,
];

const INICIO_ITEM = /^Questão\s+(\d+)\s*$/i;
const ALTERNATIVA = /^([A-E])\s+(.*)$/;
// Um cabeçalho de matéria é uma linha toda em maiúsculas (com acentos), sem
// dígitos — o que a distingue de uma alternativa (que começa com uma letra
// solta) ou de uma frase comum do enunciado. Mas alguns cadernos imprimem o
// nome da matéria em title case ("Língua Portuguesa"), daí também aceitar
// qualquer nome da lista de matérias conhecidas independente de caixa.
const EH_CABECALHO_MAIUSCULA = /^[A-ZÀ-Ú][A-ZÀ-Ú\s]{3,60}$/;
const EH_CABECALHO_MATERIA = { test: (l) => EH_CABECALHO_MAIUSCULA.test(l) || EH_MATERIA_CONHECIDA.test(l) };

export function parseProvaMultipla(bruto) {
  const linhas = bruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !RUIDO.some((r) => r.test(l)));

  const marcos = [];
  linhas.forEach((linha, i) => {
    const m = linha.match(INICIO_ITEM);
    if (m) marcos.push({ numero: Number(m[1]), i });
  });

  const secoes = [];
  linhas.forEach((linha, i) => {
    if (marcos.some((m) => m.i === i)) return;
    if (EH_CABECALHO_MATERIA.test(linha) && !ALTERNATIVA.test(linha)) secoes.push({ nome: linha, i });
  });

  const itens = [];
  marcos.forEach((marco, k) => {
    const fim = k + 1 < marcos.length ? marcos[k + 1].i : linhas.length;
    const bloco = linhas.slice(marco.i + 1, fim);

    // O enunciado às vezes começa uma frase com uma letra maiúscula solta
    // seguida de espaço ("A administração..."), que bate com a mesma regex
    // de alternativa. Só a sequência A,B,C,D,E realmente consecutiva (a
    // última encontrada) é a lista de alternativas de verdade.
    let alternativas = [];
    let corteEnunciado = bloco.length;
    let candidatoAtual = [];
    let inicioAtual = bloco.length;
    const proximaLetra = (l) => String.fromCharCode(l.charCodeAt(0) + 1);

    for (let j = 0; j < bloco.length; j++) {
      if (EH_CABECALHO_MATERIA.test(bloco[j]) && !ALTERNATIVA.test(bloco[j])) break;
      const m = bloco[j].match(ALTERNATIVA);
      if (m) {
        const esperada = candidatoAtual.length === 0 ? "A" : proximaLetra(candidatoAtual[candidatoAtual.length - 1].letra);
        if (m[1] === esperada) {
          if (candidatoAtual.length === 0) inicioAtual = j;
          candidatoAtual.push({ letra: m[1], texto: m[2] });
        } else if (m[1] === "A") {
          candidatoAtual = [{ letra: "A", texto: m[2] }];
          inicioAtual = j;
        } else if (candidatoAtual.length > 0) {
          candidatoAtual[candidatoAtual.length - 1].texto += ` ${bloco[j]}`.trim();
          continue;
        }
        if (candidatoAtual.length === 5) {
          alternativas = candidatoAtual;
          corteEnunciado = inicioAtual;
        }
      } else if (candidatoAtual.length > 0) {
        candidatoAtual[candidatoAtual.length - 1].texto = `${candidatoAtual[candidatoAtual.length - 1].texto} ${bloco[j]}`.trim();
      }
    }

    const secao = [...secoes].reverse().find((s) => s.i < marco.i);
    itens.push({
      numero: marco.numero,
      materia: secao ? secao.nome : null,
      enunciado: bloco.slice(0, corteEnunciado).join(" ").replace(/\s+/g, " ").trim(),
      alternativas,
    });
  });

  return { itens };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("uso: node server/scripts/parse-prova-cebraspe-multipla.mjs <prova.pdf> [--json saida.json]");
    process.exit(1);
  }
  const { texto } = await pdfParaTexto(arquivo);
  const { itens } = parseProvaMultipla(texto);
  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx > -1 && process.argv[jsonIdx + 1]) {
    fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ itens }, null, 2), "utf8");
    console.log(`itens: ${itens.length} -> ${process.argv[jsonIdx + 1]}`);
  } else {
    console.log(`itens: ${itens.length}\n`);
    for (const i of itens.slice(0, 3)) {
      console.log(`[${i.numero}] materia=${i.materia} | alts=${i.alternativas.length}`);
      console.log(`  ${i.enunciado.slice(0, 110)}\n`);
    }
  }
}
