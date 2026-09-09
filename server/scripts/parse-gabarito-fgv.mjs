// Reads an FGV "gabarito" PDF: a table of item number -> letter (A-E),
// usually repeated once per prova "tipo" (the same items reshuffled across
// printed booklet variants, to prevent copying between neighbors). Unlike
// Cebraspe's table, FGV's reads correctly as a single text column — the
// number and letter rows already alternate in printed order.
//
//   node server/scripts/parse-gabarito-fgv.mjs <gabarito.pdf> [tipo]
//
// Without `tipo`, all blocks found are returned, keyed by their heading.

import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";

// A section can be a short "PROVA TIPO 1" or a full cargo name ending in
// "... - TIPO 1" (concursos with several cargos list one gabarito block per
// cargo+tipo combination) — the whole line becomes the block's key either
// way, so blocks for different cargos never collide even when their answers
// happen to coincide.
const COR = "BRANCA|AMARELA|AZUL|VERDE|ROSA|CINZA";
const CABECALHO_TIPO = new RegExp(`(?:PROVA\\s+)?TIPO\\s+\\d+(?:\\s*(?:[-–—]\\s*(?:${COR})|\\((?:${COR})\\)))?\\s*$`, "i");

export async function parseGabaritoFgv(caminho) {
  const { texto } = await pdfParaTexto(caminho, { colunas: 1 });
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const blocos = new Map(); // rótulo do tipo -> Map(numero -> letra)
  let atual = null;
  let numerosPendentes = null;

  for (const linha of linhas) {
    if (CABECALHO_TIPO.test(linha)) {
      atual = linha;
      if (!blocos.has(atual)) blocos.set(atual, new Map());
      numerosPendentes = null;
      continue;
    }
    if (!atual) continue;

    const soNumeros = linha.match(/^(\d{1,3}(?:\s+\d{1,3}){1,19})$/);
    if (soNumeros) { numerosPendentes = soNumeros[1].split(/\s+/).map(Number); continue; }

    const soLetras = linha.match(/^([A-E](?:\s+[A-E]){1,19})$/);
    if (soLetras && numerosPendentes) {
      const letras = soLetras[1].split(/\s+/);
      const mapa = blocos.get(atual);
      numerosPendentes.forEach((n, i) => { if (letras[i]) mapa.set(n, letras[i]); });
      numerosPendentes = null;
    }
  }

  return blocos;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , caminho, tipo] = process.argv;
  if (!caminho) {
    console.error("uso: node server/scripts/parse-gabarito-fgv.mjs <gabarito.pdf> [tipo]");
    process.exit(1);
  }
  const blocos = await parseGabaritoFgv(caminho);
  for (const [rotulo, mapa] of blocos) {
    if (tipo && !rotulo.toLowerCase().includes(tipo.toLowerCase())) continue;
    const ordenado = [...mapa.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`TIPO ${rotulo}: ${ordenado.length} itens`);
    console.log(ordenado.map(([n, l]) => `${n}:${l}`).join(" "));
  }
}
