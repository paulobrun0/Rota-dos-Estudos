import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeNumberedEdital, normalizeMateriaName, parseRawEdital } from "../src/lib/rawEditalParser.js";

describe("parseRawEdital", () => {
  test("a header followed by numbered items with a nested group produces only leaf topics", () => {
    const text = "LÍNGUA PORTUGUESA: 1 Compreensão de textos. 2 Domínio da estrutura. 3 Coesão. 3.1 Referenciação. 3.2 Conectivos.";
    const entries = parseRawEdital(text);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, "Língua Portuguesa");
    // "3" has children ("3.1", "3.2") so it becomes a grouping label, not a topic itself.
    assert.deepEqual(entries[0].topics, ["Compreensão de textos", "Domínio da estrutura", "Referenciação", "Conectivos"]);
  });

  test("multiple headers in the same paste each get their own entry", () => {
    const text = "DIREITO PENAL: 1 Princípios. 2 Crime. INFORMÁTICA: 1 Hardware. 2 Software.";
    const entries = parseRawEdital(text);
    assert.deepEqual(entries.map((e) => e.name), ["Direito Penal", "Informática"]);
    assert.deepEqual(entries[0].topics, ["Princípios", "Crime"]);
    assert.deepEqual(entries[1].topics, ["Hardware", "Software"]);
  });

  test("no header at all falls back to fallbackName, as long as the text still looks numbered", () => {
    const text = "1 Primeiro assunto. 2 Segundo assunto.";
    const entries = parseRawEdital(text, "Matéria Avulsa");
    assert.deepEqual(entries, [{ name: "Matéria Avulsa", topics: ["Primeiro assunto", "Segundo assunto"] }]);
  });

  test("no header and no fallbackName returns null instead of guessing a name", () => {
    assert.equal(parseRawEdital("1 Primeiro. 2 Segundo.", ""), null);
  });

  test("plain prose with no numbering and no header returns null (caller falls back to the manual format)", () => {
    assert.equal(parseRawEdital("Direito Administrativo: Regime Jurídico; Poderes Administrativos"), null);
  });

  // Regression: a matéria whose numbering restarts partway through (e.g. two
  // Roman-numeral-labeled sub-blocks that each start their own "1, 2, 3...")
  // used to compare item paths across the WHOLE flat list, so a leaf in one
  // block could be wrongly treated as a group just because an unrelated
  // block reused the same number with real children of its own — silently
  // dropping that leaf's topic entirely. This is exactly the shape found in
  // the real PC-AL 2026 edital's "Tecnologia da Informação e Segurança
  // Cibernética" section, which had to be split into two matérias by hand
  // to work around it before this fix.
  test("numbering that restarts mid-matéria doesn't let one block's children swallow another block's leaf", () => {
    const text =
      "TECNOLOGIA DA INFORMAÇÃO E SEGURANÇA CIBERNÉTICA: " +
      "1 Primeiro do bloco I. 2 Segundo do bloco I. 3 Terceiro do bloco I. " +
      "1 Primeiro do bloco II. 2 Segundo do bloco II. 3 Terceiro do bloco II. 3.1 Sub do terceiro do bloco II.";
    const entries = parseRawEdital(text);
    assert.equal(entries.length, 1);
    // Bloco I's own "3" has no children within its own block, so it must
    // survive as a real topic even though bloco II's unrelated "3" does have
    // a "3.1" — before the fix, "Terceiro do bloco I" was silently dropped.
    assert.deepEqual(entries[0].topics, [
      "Primeiro do bloco I",
      "Segundo do bloco I",
      "Terceiro do bloco I",
      "Primeiro do bloco II",
      "Segundo do bloco II",
      "Sub do terceiro do bloco II",
    ]);
  });

  test("a duplicated item number (a real editais typo) doesn't crash — both copies just survive as separate leaves", () => {
    const text = "DIREITOS HUMANOS: 1 Primeiro. 2 Segundo. 2 Segundo repetido por erro do edital.";
    const entries = parseRawEdital(text);
    assert.deepEqual(entries[0].topics, ["Primeiro", "Segundo", "Segundo repetido por erro do edital"]);
  });

  test("known umbrella phrase 'domínio da ortografia oficial' expands into its real sub-topics", () => {
    const text = "PORTUGUÊS: 1 Domínio da ortografia oficial. 2 Pontuação.";
    const entries = parseRawEdital(text);
    assert.deepEqual(entries[0].topics, [
      "Ortografia - Casos Gerais e Emprego das Letras",
      "Fatos da Língua Portuguesa (Porque, Por Que, Porquê e Por Quê; Onde, Aonde e Donde; Há e A, etc)",
      "Inicial Maiúscula",
      "Acentuação",
      "Uso do Hífen",
      "Convenções de Escrita (Itálico, Siglas, etc)",
      "Questões Mescladas de Ortografia",
      "Pontuação",
    ]);
  });

  test("known umbrella phrase 'emprego das classes de palavras' expands into its real sub-topics", () => {
    const text = "PORTUGUÊS: 1 Emprego das classes de palavras.";
    const entries = parseRawEdital(text);
    assert.deepEqual(entries[0].topics, [
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
    ]);
  });

  test("an umbrella phrase only expands on an exact match — similar-but-longer wording is left as its own topic", () => {
    const text = "PORTUGUÊS: 1 Domínio da ortografia oficial em casos especiais. 2 Domínio da ortografia oficial.";
    const entries = parseRawEdital(text);
    assert.equal(entries[0].topics[0], "Domínio da ortografia oficial em casos especiais", "not an exact match, left untouched");
    assert.equal(entries[0].topics.length, 1 + 7, "the exact match on item 2 still expands into the 7 sub-topics");
  });
});

describe("looksLikeNumberedEdital", () => {
  test("true for Cebraspe-style numbered text", () => {
    assert.equal(looksLikeNumberedEdital("1 Primeiro item. 2 Segundo item."), true);
  });

  test("false for the plain 'Matéria: assunto 1; assunto 2' format", () => {
    assert.equal(looksLikeNumberedEdital("Direito Administrativo: Regime Jurídico; Poderes Administrativos"), false);
  });

  test("false for plain prose with no numbering at all", () => {
    assert.equal(looksLikeNumberedEdital("Estudar bastante e revisar todo santo dia."), false);
  });
});

describe("normalizeMateriaName", () => {
  test("strips a trailing parenthetical qualifier", () => {
    assert.equal(normalizeMateriaName("Língua Portuguesa (Português)"), "língua portuguesa");
  });

  test("lowercases and trims regardless of qualifier", () => {
    assert.equal(normalizeMateriaName("  Direito Administrativo  "), "direito administrativo");
  });

  test("matches names that only differ by a bank qualifier", () => {
    assert.equal(normalizeMateriaName("Raciocínio Lógico"), normalizeMateriaName("Raciocínio Lógico (RLM)"));
  });

  test("handles null/undefined without throwing", () => {
    assert.equal(normalizeMateriaName(null), "");
    assert.equal(normalizeMateriaName(undefined), "");
  });
});
