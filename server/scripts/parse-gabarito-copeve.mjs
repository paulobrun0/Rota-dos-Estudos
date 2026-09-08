// Reads a COPEVE/UFAL gabarito PDF: a single table with one "TIPO N" column
// per booklet variant, each row printed as "<questão> <resposta>" repeated
// per column on the same line — spacing between the columns is inconsistent
// (sometimes a space, sometimes glued), so pairs are found by regex scan
// rather than a fixed split.
//
//   node server/scripts/parse-gabarito-copeve.mjs <gabarito.pdf> [tipo, 1-based]

import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";

const PAR = /(\d{1,3})\s*(NULA|[A-E])\b/g;

export async function parseGabaritoCopeve(caminho, { colunas = 1 } = {}) {
  const { texto } = await pdfParaTexto(caminho, { colunas });
  const linhas = texto.split(/\r?\n/);

  const nTipos = (linhas.find((l) => /TIPO\s*1/.test(l)) || "").match(/TIPO\s*\d/g)?.length || 1;
  const porTipo = Array.from({ length: nTipos }, () => new Map());

  for (const linha of linhas) {
    if (/QUEST[ÃA]O|GABARITO|TIPO/i.test(linha)) continue;
    const pares = [...linha.matchAll(PAR)];
    if (pares.length === 0) continue;
    // Uma linha pode trazer os N tipos em sequência: [q,r]x nTipos.
    for (let t = 0; t < nTipos && t < pares.length; t++) {
      const [, numero, resposta] = pares[t];
      porTipo[t].set(Number(numero), resposta === "NULA" ? "X" : resposta);
    }
  }
  return porTipo;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , caminho, tipoArg] = process.argv;
  if (!caminho) {
    console.error("uso: node server/scripts/parse-gabarito-copeve.mjs <gabarito.pdf> [tipo, 1-based]");
    process.exit(1);
  }
  const porTipo = await parseGabaritoCopeve(caminho);
  const tipo = tipoArg ? Number(tipoArg) - 1 : 0;
  const mapa = porTipo[tipo];
  const ordenado = [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  console.log(`tipos encontrados: ${porTipo.length} | mostrando tipo ${tipo + 1}: ${ordenado.length} itens`);
  console.log(ordenado.map(([n, r]) => `${n}:${r}`).join(" "));
}
