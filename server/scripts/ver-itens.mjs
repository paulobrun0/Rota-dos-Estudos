// Prints the items of a parsed prova in a compact form, for deciding which
// topic each one belongs to (the prova never states it).
//
//   node server/scripts/ver-itens.mjs provas/cebraspe/pf-agente-2021.json 1-18

import fs from "node:fs";
import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , arquivo, intervalo = "1-20", limiteChars = "260"] = process.argv;
  const [ini, fim] = intervalo.split("-").map(Number);
  const dados = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const max = Number(limiteChars);

  for (const item of dados.itens) {
    if (item.numero < ini || item.numero > fim) continue;
    const gab = dados.gabarito[item.numero] || "?";
    const t = item.texto.length > max ? `${item.texto.slice(0, max)}…` : item.texto;
    console.log(`${item.numero} [${gab}] ${t}`);
  }
}
