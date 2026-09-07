// Extracts text from a caderno de provas PDF preserving reading order.
// Booklets are printed in two columns, so a naive extraction interleaves them
// and the items come out scrambled; this splits each page down the middle and
// reads the left column before the right.
//
//   node server/scripts/pdf-para-texto.mjs <arquivo.pdf> [saida.txt]

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export async function pdfParaTexto(caminho, { colunas = 2 } = {}) {
  const data = new Uint8Array(fs.readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const partes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { width } = page.getViewport({ scale: 1 });
    const itens = (await page.getTextContent()).items
      .filter((i) => i.str !== undefined)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));

    const faixas = colunas === 1
      ? [itens]
      : [itens.filter((i) => i.x < width / 2), itens.filter((i) => i.x >= width / 2)];

    for (const faixa of faixas) {
      // Text runs on the same printed line share a y within rounding noise.
      const linhas = new Map();
      for (const it of faixa) {
        const chave = Math.round(it.y / 3) * 3;
        if (!linhas.has(chave)) linhas.set(chave, []);
        linhas.get(chave).push(it);
      }
      const texto = [...linhas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, arr]) => arr.sort((a, b) => a.x - b.x).map((i) => i.str).join("").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      if (texto) partes.push(texto);
    }
  }
  return { texto: partes.join("\n"), paginas: doc.numPages };
}

// Same extraction, but keeping the coordinates — the gabarito is a table
// where the answer sits under its item number, so position is the only link.
export async function pdfParaItensPosicionados(caminho) {
  const data = new Uint8Array(fs.readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const todos = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const itens = (await page.getTextContent()).items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ pagina: p, str: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
    todos.push(...itens);
  }
  return todos;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , entrada, saida] = process.argv;
  if (!entrada) {
    console.error("uso: node server/scripts/pdf-para-texto.mjs <arquivo.pdf> [saida.txt]");
    process.exit(1);
  }
  const { texto, paginas } = await pdfParaTexto(entrada);
  if (saida) {
    fs.writeFileSync(saida, texto, "utf8");
    console.log(`páginas: ${paginas} | chars: ${texto.length} -> ${saida}`);
  } else {
    console.log(texto.slice(0, 3000));
  }
}
