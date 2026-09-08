// Turns a COPEVE/UFAL caderno de provas (public PDF from copeve.ufal.br) into
// structured questions. Items are multiple choice (A-E): a "QUESTÃO NN" line
// (followed by a row of underscores) opens the item, the enunciado follows,
// then each alternative starts its own line as "A) texto" (no parentheses
// around the letter, unlike FGV's "(A) texto"). A bare matéria name in caps
// (PORTUGUÊS, MATEMÁTICA, ...) opens each subject's block.
//
//   node server/scripts/parse-prova-copeve.mjs <prova.pdf> [--json saida.json]

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";

const QUESTAO = /^QUEST[ÃA]O\s+0*(\d{1,3})\b/i;
const ALTERNATIVA = /^([A-E])\)\s*(.*)$/;

// Bare, all-caps subject headings that separate blocks of questions — the
// same shape FGV uses, but COPEVE prints them without any known-word list to
// check against, so anything short, all-caps and accent-letters-only that
// isn't itself a question/alternative line is treated as a heading.
const EH_CABECALHO = /^[A-ZÀ-Ú][A-ZÀ-Ú\s]{2,30}$/;

export function parseProvaCopeve(bruto) {
  const linhas = bruto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const marcos = [];
  linhas.forEach((linha, i) => { const m = linha.match(QUESTAO); if (m) marcos.push({ numero: Number(m[1]), i }); });

  const secoes = [];
  linhas.forEach((linha, i) => {
    if (QUESTAO.test(linha) || ALTERNATIVA.test(linha)) return;
    if (EH_CABECALHO.test(linha)) secoes.push({ nome: linha, i });
  });

  const itens = [];
  marcos.forEach((marco, k) => {
    const fim = k + 1 < marcos.length ? marcos[k + 1].i : linhas.length;
    const bloco = linhas.slice(marco.i + 1, fim);

    const alternativas = [];
    let corteEnunciado = bloco.length;
    for (let j = 0; j < bloco.length; j++) {
      const m = bloco[j].match(ALTERNATIVA);
      if (m) {
        if (corteEnunciado === bloco.length) corteEnunciado = j;
        alternativas.push({ letra: m[1], texto: m[2] });
      } else if (alternativas.length > 0) {
        const ultima = alternativas[alternativas.length - 1];
        ultima.texto = `${ultima.texto} ${bloco[j]}`.trim();
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
    console.error("uso: node server/scripts/parse-prova-copeve.mjs <prova.pdf> [--json saida.json]");
    process.exit(1);
  }
  const { texto } = await pdfParaTexto(arquivo);
  const { itens } = parseProvaCopeve(texto);
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
