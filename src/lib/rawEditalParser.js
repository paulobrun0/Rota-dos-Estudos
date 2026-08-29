// Parses the raw, numbered "conteúdo programático" text that Brazilian public
// exam editais use (mostly Cebraspe-style), e.g.:
//
//   LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos de gêneros
//   variados. 2 Reconhecimento de tipos e gêneros textuais. 3 Domínio da
//   ortografia oficial. 4 Domínio dos mecanismos de coesão textual. 4.1
//   Emprego de elementos de referenciação... 4.2 Emprego de tempos e modos
//   verbais. 5 Domínio da estrutura morfossintática do período. 5.1 ...
//
// into {name, topics} entries ready for mergeMateriaEntries — so pasting the
// edital verbatim "just works" instead of requiring the user to reformat it
// into "Matéria: assunto 1; assunto 2".
//
// Rule: a numbered item that has numbered children (e.g. "4" has "4.1",
// "4.2") is a grouping label, not something you'd mark "estudado" on its
// own — only its leaf descendants become topics. An item with no numbered
// children becomes a topic itself, UNLESS its wording matches a known
// "guarda-chuva" phrase (see UMBRELLA_EXPANSIONS below), in which case it's
// expanded into the real sub-topics it's known to cover even though this
// particular edital didn't spell them out.

// Known umbrella phrases (exact wording is highly standardized across
// editais that reuse this boilerplate) mapped to the granular sub-topics
// they actually cover, sourced from how question banks structure them.
// Add more entries here as new recurring cases come up.
const UMBRELLA_EXPANSIONS = [
  {
    // Matches the full ortografia cluster TecConcursos tracks as separate
    // question cadernos (00-06) — broader than the 3-item guess used
    // originally, confirmed against the real caderno list for Português.
    match: "domínio da ortografia oficial",
    topics: [
      "Ortografia - Casos Gerais e Emprego das Letras",
      "Fatos da Língua Portuguesa (Porque, Por Que, Porquê e Por Quê; Onde, Aonde e Donde; Há e A, etc)",
      "Inicial Maiúscula",
      "Acentuação",
      "Uso do Hífen",
      "Convenções de Escrita (Itálico, Siglas, etc)",
      "Questões Mescladas de Ortografia",
    ],
  },
  {
    // Cadernos 09-24 no TecConcursos — "classes de palavras" na prática
    // cobre cada classe gramatical (artigo, substantivo, adjetivo, verbo,
    // as seis famílias de pronome, advérbio, preposição, conjunção) como
    // um assunto próprio, não uma coisa só.
    match: "emprego das classes de palavras",
    topics: [
      "Artigo",
      "Adjetivo",
      "Substantivo",
      "Conjugação. Reconhecimento e Emprego dos Modos e Tempos Verbais",
      "Correlação Verbal",
      "Locução Verbal",
      "Questões Variadas de Verbo",
      "Pronomes Pessoais",
      "Pronomes Possessivos",
      "Pronomes Indefinidos",
      "Pronomes Demonstrativos",
      "Pronomes Relativos",
      "Questões Mescladas sobre Pronomes",
      "Advérbio",
      "Preposição",
      "Conjunção",
      "Questões Variadas de Classe de Palavras",
    ],
  },
];

function normalizeForMatch(text) {
  return text.trim().replace(/\.+$/, "").trim().toLowerCase();
}

function expandLeaf(text) {
  const normalized = normalizeForMatch(text);
  const hit = UMBRELLA_EXPANSIONS.find((u) => u.match === normalized);
  return hit ? hit.topics : [text.trim().replace(/\.+$/, "").trim()];
}

const LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os", "para", "com", "por", "no", "na", "nos", "nas"]);

function toTitleCasePt(text) {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.replace(/(^|[-(])(\p{L})/gu, (m, boundary, letter) => boundary + letter.toUpperCase());
    })
    .join(" ");
}

// Header: an ALL-CAPS run followed by ":" and immediately by the start of
// numbering ("1 " or "1."). Real editais always restart numbering at 1 for
// each matéria, which is what anchors this detection.
const HEADER_RE = /([A-ZÀ-Ý][A-ZÀ-Ý0-9°º,;()/–\-\s]{1,100}?):\s*(?=1[\s.])/g;

// Item marker: a number (optionally dotted, e.g. "4.1") that starts the
// block or follows ". " (end of the previous item's sentence), immediately
// followed by a capital letter/quote/paren — reduces false positives from
// unrelated numbers (like "Lei 8.112") appearing mid-sentence.
const ITEM_RE = /(?:^|(?<=\.\s))(\d{1,3}(?:\.\d{1,3})*)\s+(?=[A-ZÀ-Ý"“(])/g;

function flattenToLeaves(content) {
  const matches = [...content.matchAll(ITEM_RE)];
  if (matches.length === 0) return null;

  const items = matches.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    return { path: m[1], text: content.slice(start, end).trim() };
  });

  const hasChildren = (path) => items.some((it) => it.path !== path && it.path.startsWith(path + "."));
  const leaves = items.filter((it) => !hasChildren(it.path));
  return leaves.flatMap((leaf) => expandLeaf(leaf.text));
}

// Loosely compares matéria names for cross-referencing against the content
// bank — e.g. "Língua Portuguesa" (typed/derived from an edital) should
// match "Língua Portuguesa (Português)" (the bank's canonical name).
export function normalizeMateriaName(name) {
  return (name || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
}

// True if `text` contains numbered edital items ("1 Xxx. 2 Yyy...") whether
// or not it has a "MATÉRIA:" header — used to give a specific error message
// when the header is missing instead of the generic "wrong format" one.
export function looksLikeNumberedEdital(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return [...normalized.matchAll(ITEM_RE)].length > 0;
}

// Returns [{name, topics}] if `text` looks like raw numbered edital content,
// or null if it doesn't (so callers can fall back to the plain
// "Matéria: assunto 1; assunto 2" format).
//
// Some editais/páginas show the matéria name as a separate heading, so the
// copied numbered text has no inline "MATÉRIA:" prefix at all — just "1
// Xxx. 2 Yyy...". In that case `fallbackName` (typically whatever the user
// typed in the "nome da matéria" field) is used as the single matéria name.
export function parseRawEdital(text, fallbackName) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const headers = [...normalized.matchAll(HEADER_RE)];

  if (headers.length === 0) {
    const name = (fallbackName || "").trim();
    if (!name) return null;
    const topics = flattenToLeaves(normalized);
    return topics && topics.length > 0 ? [{ name, topics }] : null;
  }

  const entries = [];
  headers.forEach((h, i) => {
    const name = toTitleCasePt(h[1]);
    const contentStart = h.index + h[0].length;
    const contentEnd = i + 1 < headers.length ? headers[i + 1].index : normalized.length;
    const content = normalized.slice(contentStart, contentEnd);
    const topics = flattenToLeaves(content);
    if (name && topics && topics.length > 0) entries.push({ name, topics });
  });

  return entries.length > 0 ? entries : null;
}
