// Reads a Cebraspe "gabaritos oficiais definitivos" PDF. The answer key is a
// table where each answer (C, E or X for anulado) is printed directly under
// its item number, so the pairing is positional — reading the text linearly
// loses the alignment.
//
//   node server/scripts/parse-gabarito-cebraspe.mjs <gabarito.pdf>

import { pathToFileURL } from "node:url";
import { pdfParaItensPosicionados } from "./pdf-para-texto.mjs";

const TOLERANCIA_X = 6; // pt — a resposta fica centralizada sob o número

// Certo/errado usa C/E/X; provas de múltipla escolha para oficiais usam A-E
// (mais X para anulada) na mesma disposição de tabela.
export async function parseGabarito(caminho, { letras = /^[CEX]$/ } = {}) {
  const itens = await pdfParaItensPosicionados(caminho);

  const numeros = itens.filter((i) => /^\d{1,3}$/.test(i.str));
  const respostas = itens.filter((i) => letras.test(i.str));

  const gabarito = new Map();
  for (const resp of respostas) {
    // O número correspondente está logo acima, na mesma coluna.
    const candidatos = numeros
      .filter((n) => n.pagina === resp.pagina && n.y > resp.y && Math.abs(n.x - resp.x) <= TOLERANCIA_X)
      .sort((a, b) => a.y - b.y);
    if (candidatos.length === 0) continue;
    const numero = Number(candidatos[0].str);
    if (!gabarito.has(numero)) gabarito.set(numero, resp.str);
  }

  return gabarito;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("uso: node server/scripts/parse-gabarito-cebraspe.mjs <gabarito.pdf>");
    process.exit(1);
  }
  const g = await parseGabarito(caminho);
  const ordenado = [...g.entries()].sort((a, b) => a[0] - b[0]);
  console.log(`itens no gabarito: ${ordenado.length}`);
  console.log(ordenado.map(([n, r]) => `${n}:${r}`).join(" "));
}
