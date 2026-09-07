// Extracts every prova PDF in a folder once and writes the parsed items next
// to it as JSON, then prints a compact index: each prova's command blocks with
// their item ranges. Reading the commands is enough to tell where the Língua
// Portuguesa block sits, without opening the whole booklet.
//
//   node server/scripts/indexar-provas.mjs provas/cebraspe
//
// Pairs are matched by filename: "<nome>-prova.pdf" with "<nome>-gabarito.pdf".

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pdfParaTexto } from "./pdf-para-texto.mjs";
import { parseProva } from "./parse-prova-cebraspe.mjs";
import { parseGabarito } from "./parse-gabarito-cebraspe.mjs";
import { parseProvaFgv } from "./parse-prova-fgv.mjs";
import { parseGabaritoFgv } from "./parse-gabarito-fgv.mjs";
import { parseProvaMultipla } from "./parse-prova-cebraspe-multipla.mjs";

// Cebraspe items share a running command across a block and answer certo/
// errado; FGV/FCC items are self-contained multiple choice (A-E) grouped
// under a matéria heading. Each format needs its own prova+gabarito reader,
// selected by which banca folder is being indexed.
async function processarCebraspe(caminhoProva, caminhoGabarito) {
  const { texto } = await pdfParaTexto(caminhoProva);
  const { itens, textos } = parseProva(texto);
  const gabarito = fs.existsSync(caminhoGabarito) ? Object.fromEntries(await parseGabarito(caminhoGabarito)) : {};
  return { itens, textos, gabarito };
}

async function processarMultiplaEscolha(caminhoProva, caminhoGabarito, tipo) {
  const { texto } = await pdfParaTexto(caminhoProva);
  const { itens } = parseProvaFgv(texto);
  let gabarito = {};
  if (fs.existsSync(caminhoGabarito)) {
    const blocos = await parseGabaritoFgv(caminhoGabarito);
    const chave = tipo ? [...blocos.keys()].find((k) => k.toLowerCase().includes(tipo.toLowerCase())) : null;
    const mapa = chave ? blocos.get(chave) : blocos.values().next().value;
    if (mapa) gabarito = Object.fromEntries(mapa);
  }
  return { itens, textos: {}, gabarito };
}

// Cebraspe multiple-choice (officer-level) uses the same A-E gabarito table
// as FGV but its own item parser ("Questão N" + ALL-CAPS matéria headings).
async function processarCebraspeMultipla(caminhoProva, caminhoGabarito, tipo) {
  const { texto } = await pdfParaTexto(caminhoProva);
  const { itens } = parseProvaMultipla(texto);
  const gabarito = fs.existsSync(caminhoGabarito)
    ? Object.fromEntries(await parseGabarito(caminhoGabarito, { letras: /^[A-EX]$/ }))
    : {};
  return { itens, textos: {}, gabarito };
}

const PROCESSADORES = {
  cebraspe: processarCebraspe,
  "cebraspe-multipla": processarCebraspeMultipla,
  fgv: processarMultiplaEscolha,
  fcc: processarMultiplaEscolha,
};

// nomeDaPasta.json ao lado de <banca>/ pode fixar { "formato": "fgv", "tipo": "1" }
// por prova, para provas cujo booklet vem embaralhado em variantes.
function lerMeta(pasta, nome, formatoPadrao) {
  const metaPath = path.join(pasta, `${nome}.meta.json`);
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  return { formato: meta.formato || formatoPadrao, tipo: meta.tipo || null };
}

export async function indexarPasta(pasta, { formato } = {}) {
  const bancaPadrao = formato || (/fgv/i.test(pasta) ? "fgv" : /fcc/i.test(pasta) ? "fcc" : "cebraspe");
  const provas = fs.readdirSync(pasta).filter((f) => /-prova\.pdf$/i.test(f)).sort();
  const relatorio = [];

  for (const arquivo of provas) {
    const nome = arquivo.replace(/-prova\.pdf$/i, "");
    const jsonPath = path.join(pasta, `${nome}.json`);
    const gabaritoPath = path.join(pasta, `${nome}-gabarito.pdf`);
    const { formato: formatoProva, tipo } = lerMeta(pasta, nome, bancaPadrao);

    let dados;
    if (fs.existsSync(jsonPath)) {
      dados = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } else {
      try {
        const processar = PROCESSADORES[formatoProva] || processarCebraspe;
        const { itens, textos, gabarito } = await processar(path.join(pasta, arquivo), gabaritoPath, tipo);
        dados = { nome, itens, textos, gabarito };
        fs.writeFileSync(jsonPath, JSON.stringify(dados), "utf8");
      } catch (e) {
        relatorio.push({ nome, erro: e.message });
        continue;
      }
    }

    // Agrupa itens consecutivos que compartilham comando (Cebraspe) ou
    // matéria (FGV/FCC) — o que existir no formato da prova.
    const blocos = [];
    for (const item of dados.itens) {
      const chave = item.comando ?? item.materia;
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.chave === chave) ultimo.fim = item.numero;
      else blocos.push({ chave, inicio: item.numero, fim: item.numero });
    }

    relatorio.push({
      nome,
      itens: dados.itens.length,
      comGabarito: Object.keys(dados.gabarito).length,
      blocos,
    });
  }
  return relatorio;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pasta = process.argv[2];
  if (!pasta) {
    console.error("uso: node server/scripts/indexar-provas.mjs <pasta>");
    process.exit(1);
  }
  const limite = Number(process.argv[3]) || 8; // quantos blocos mostrar por prova
  for (const r of await indexarPasta(pasta)) {
    if (r.erro) { console.log(`\n### ${r.nome} — ERRO: ${r.erro}`); continue; }
    console.log(`\n### ${r.nome} — ${r.itens} itens, ${r.comGabarito} no gabarito`);
    for (const b of r.blocos.slice(0, limite)) {
      console.log(`  ${b.inicio}-${b.fim}: ${String(b.chave || "").slice(0, 105)}`);
    }
    if (r.blocos.length > limite) console.log(`  ... +${r.blocos.length - limite} blocos`);
  }
}
