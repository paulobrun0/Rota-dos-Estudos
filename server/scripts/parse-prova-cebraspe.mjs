// Turns a Cebraspe caderno de provas (public PDF from the banca's own site)
// into structured questions. Cebraspe items are certo/errado and usually hang
// off a shared base text ("Texto 1A18-I") plus a command line, so an item only
// makes sense with both carried along.
//
//   node server/scripts/parse-prova-cebraspe.mjs <prova.txt> [--json saida.json]
//
// The .txt comes from extracting the PDF with column order preserved; the
// gabarito is applied separately, from the banca's official answer key.

import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Page headers and the answer-sheet boilerplate are printed inside the same
// text flow as the items; left in, they get glued onto commands.
const RUIDO = [
  /^CEBRASPE\b/i,
  /^CESPE\b/i,
  /^Espaço livre/i,
  /^={3,}/,
  /campo designado com o código/i,
  /ausência de marcação|marcação de mais de uma opção/i,
  /^Nas questões a seguir/i,
  /^-\s*\d+\s*-$/,
  /^Folha de\b/i,
  /^Assertiva:/i,
  /^LEIA COM ATENÇÃO/i,
  /^(OBSERVAÇÕES|INFORMAÇÕES ADICIONAIS):/i,
];

// Booklet control codes ("760CB1_01N100633") printed at the start of a line.
const CODIGO_CONTROLE = /^\d{3,4}[A-Z]{1,4}\d[A-Za-z0-9_]*\s*/;

// The sentence telling the candidate what to do with the items that follow.
const FIM_COMANDO = /julgue\s+(os|o)\s+(itens?|próximo|seguinte)/i;
const INICIO_TEXTO = /^Texto\s+([0-9A-Z][0-9A-Z\-]*)\s*$/i;
const FIM_DE_FRASE = /[.?!)”"]\s*$/;

const junta = (arr) => arr.join(" ").replace(/\s+/g, " ").trim();

// Walks back from the line that closes a command to where that sentence
// started — the previous line that ended cleanly.
function inicioDaFrase(linhas, fim) {
  let i = fim;
  while (i > 0 && !FIM_DE_FRASE.test(linhas[i - 1])) i--;
  return i;
}

// Splits one stretch of lines into (item continuation, base text, command),
// in the order Cebraspe prints them.
function fatiar(regiao) {
  const iTexto = regiao.findIndex((l) => INICIO_TEXTO.test(l));
  const iFimComando = regiao.findIndex((l) => FIM_COMANDO.test(l));

  let comando = null;
  let iInicioComando = -1;
  if (iFimComando >= 0) {
    iInicioComando = inicioDaFrase(regiao, iFimComando);
    comando = junta(regiao.slice(iInicioComando, iFimComando + 1));
  }

  let texto = null;
  if (iTexto >= 0) {
    const fim = iInicioComando > iTexto ? iInicioComando : regiao.length;
    texto = { id: regiao[iTexto].match(INICIO_TEXTO)[1], conteudo: junta(regiao.slice(iTexto + 1, fim)) };
  }

  const cortes = [iTexto, iInicioComando].filter((i) => i >= 0);
  const corte = cortes.length ? Math.min(...cortes) : regiao.length;
  return { continuacao: regiao.slice(0, corte), texto, comando };
}

// Alguns cadernos certo/errado mais recentes numeram cada item como
// "Questão 6" em vez de um "6" solto — normaliza para o formato que o resto
// do parser já entende.
const LINHA_QUESTAO = /^Questão\s+(\d+)\s*$/i;

export function parseProva(bruto) {
  const linhas = bruto
    .split(/\r?\n/)
    .map((l) => l.trim().replace(CODIGO_CONTROLE, ""))
    .map((l) => { const m = l.match(LINHA_QUESTAO); return m ? m[1] : l; })
    .filter((l) => l && !RUIDO.some((r) => r.test(l)));

  // Items are numbered in an unbroken run, which is the most reliable anchor
  // in a booklet where everything else varies. The cover page also carries
  // numbered instructions ("1 Ao receber este caderno..."), so the run is
  // picked by length: the real items always form the longest chain.
  const candidatos = [];
  linhas.forEach((linha, i) => {
    const m = linha.match(/^(\d{1,3})\s+(.+)$/);
    if (m) candidatos.push({ numero: Number(m[1]), i, primeiraLinha: m[2] });
  });

  const seguir = (inicio) => {
    const cadeia = [inicio];
    let esperado = inicio.numero + 1;
    for (const c of candidatos) {
      if (c.i <= cadeia[cadeia.length - 1].i) continue;
      if (c.numero === esperado) { cadeia.push(c); esperado++; }
    }
    return cadeia;
  };

  // The cover-page chain and the real one can come out the same length (the
  // cover's 1-7 then latches onto the real items further down). They start at
  // the same number, so the tie is broken by position: the real items are the
  // ones printed after the instructions.
  let marcos = [];
  for (const c of candidatos) {
    const cadeia = seguir(c);
    const melhor =
      cadeia.length > marcos.length ||
      (cadeia.length === marcos.length && cadeia[0].numero === marcos[0].numero && cadeia[0].i > marcos[0].i);
    if (marcos.length === 0 || melhor) marcos = cadeia;
  }

  const textos = new Map();
  const itens = [];
  let comandoAtual = "";

  const preambulo = fatiar(linhas.slice(0, marcos.length ? marcos[0].i : linhas.length));
  if (preambulo.texto) textos.set(preambulo.texto.id, preambulo.texto.conteudo);
  if (preambulo.comando) comandoAtual = preambulo.comando;

  marcos.forEach((marco, k) => {
    const fim = k + 1 < marcos.length ? marcos[k + 1].i : linhas.length;
    const { continuacao, texto, comando } = fatiar(linhas.slice(marco.i + 1, fim));

    itens.push({ numero: marco.numero, comando: comandoAtual, texto: junta([marco.primeiraLinha, ...continuacao]) });

    if (texto) textos.set(texto.id, texto.conteudo);
    if (comando) comandoAtual = comando;
  });

  // The command names the base text it refers to ("...do texto 1A18-I...").
  for (const item of itens) {
    const ref = item.comando.match(/texto\s+([0-9A-Z][0-9A-Z\-]*)/i);
    item.textoBaseId = ref && textos.has(ref[1]) ? ref[1] : null;
    item.textoBase = item.textoBaseId ? textos.get(item.textoBaseId) : null;
  }

  return { itens, textos: Object.fromEntries(textos) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("uso: node server/scripts/parse-prova-cebraspe.mjs <prova.txt> [--json saida.json]");
    process.exit(1);
  }
  const { itens, textos } = parseProva(fs.readFileSync(arquivo, "utf8"));
  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx > -1 && process.argv[jsonIdx + 1]) {
    fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ itens, textos }, null, 2), "utf8");
    console.log(`itens: ${itens.length} | textos-base: ${Object.keys(textos).length} -> ${process.argv[jsonIdx + 1]}`);
  } else {
    console.log(`itens: ${itens.length} | textos-base: ${Object.keys(textos).length}\n`);
    for (const i of itens.slice(0, 4)) {
      console.log(`[${i.numero}] textoBase=${i.textoBaseId} (${i.textoBase ? i.textoBase.length : 0} chars)`);
      console.log(`  comando: ${i.comando.slice(0, 100)}`);
      console.log(`  item: ${i.texto.slice(0, 110)}\n`);
    }
  }
}
