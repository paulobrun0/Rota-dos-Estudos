// Turns an FGV caderno de provas (public PDF from the banca's own site) into
// structured questions. FGV items are multiple choice (A-E), grouped under a
// matéria heading printed as its own line — unlike Cebraspe, there is no
// running "julgue os itens" command shared across a block; each item stands
// on its own with its five alternatives right below it.
//
//   node server/scripts/parse-prova-fgv.mjs <prova.pdf> [--json saida.json]

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";

const RUIDO = [
  /^FGV CONHECIMENTO$/i,
  /^-\s*\d+\s*-$/,
  /^={3,}/,
  /^Tipo \d+\s*[-–—]\s*\w+\s*[-–—]\s*Página \d+$/i,
  /^Tribunal Regional Federal/i,
  /^Analista Jud\b|^Técnico Jud\b/i, // rodapé abreviado com cargo/especialidade
];

const ALTERNATIVA = /^\(([A-E])\)\s*(.*)$/;

// The heading that opens each matéria's block is just a bare line with the
// matéria's name — nothing distinguishes it from ordinary prose structurally,
// so matching against the standard set of concurso subjects is what makes the
// detection reliable instead of guessing from capitalization.
export const CABECALHOS_CONHECIDOS = [
  "Língua Portuguesa", "Redação Oficial", "Literatura",
  "Direito Constitucional", "Direito Administrativo", "Direito Civil", "Direito Processual Civil",
  "Direito Penal", "Direito Processual Penal", "Direito Penal Militar", "Direito Processual Penal Militar",
  "Direitos Humanos", "Legislação Institucional", "Legislação Especial", "Direito Eleitoral",
  "Direito do Trabalho", "Direito Processual do Trabalho", "Direito Tributário", "Direito Empresarial",
  "Direito Previdenciário", "Direito Ambiental", "Direito Financeiro", "Direito Internacional",
  "Raciocínio Lógico", "Raciocínio Lógico-Matemático", "Raciocínio Lógico e Matemático", "Raciocínio Lógico Quantitativo",
  "Matemática", "Matemática Financeira", "Estatística", "Informática", "Noções de Informática",
  "Atualidades", "Conhecimentos Gerais", "Geografia", "História", "Criminologia", "Medicina Legal",
  "Sustentabilidade", "Administração Pública", "Administração Geral", "Gestão de Pessoas", "Ética no Serviço Público",
];
export const EH_CABECALHO = new RegExp(`^(Noções de |Legislação de )?(${CABECALHOS_CONHECIDOS.join("|")})$`, "i");

export function parseProvaFgv(bruto) {
  const linhas = bruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !RUIDO.some((r) => r.test(l)));

  // An item starts at a line that is only its number, immediately followed
  // by statement text and then five "(A) ..." alternatives — that shape is
  // what tells a question number apart from stray numbers in the statement.
  const marcos = [];
  linhas.forEach((linha, i) => {
    if (!/^\d{1,3}$/.test(linha)) return;
    for (let j = i + 1; j < Math.min(i + 25, linhas.length); j++) {
      if (ALTERNATIVA.test(linhas[j])) { marcos.push({ numero: Number(linha), i }); return; }
      if (/^\d{1,3}$/.test(linhas[j])) return; // outro número antes de achar alternativa: não é item
    }
  });

  const secoes = [];
  linhas.forEach((linha, i) => { if (EH_CABECALHO.test(linha)) secoes.push({ nome: linha, i }); });

  const itens = [];
  marcos.forEach((marco, k) => {
    const fim = k + 1 < marcos.length ? marcos[k + 1].i : linhas.length;
    const bloco = linhas.slice(marco.i + 1, fim);

    const alternativas = [];
    let corteEnunciado = bloco.length;
    for (let j = 0; j < bloco.length; j++) {
      if (EH_CABECALHO.test(bloco[j])) break; // cabeçalho da próxima matéria: fim do item
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
    console.error("uso: node server/scripts/parse-prova-fgv.mjs <prova.pdf> [--json saida.json]");
    process.exit(1);
  }
  const { texto } = await pdfParaTexto(arquivo);
  const { itens } = parseProvaFgv(texto);
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
