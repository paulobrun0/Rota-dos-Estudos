import { test } from "node:test";
import assert from "node:assert/strict";
import { getTopicLinks, questionSearchTerm, buildQconcursosSearch } from "../src/lib/topicLinks.js";

test("legacy links keep their platform and explicit links take precedence", () => {
  assert.deepEqual(getTopicLinks({ link: "https://www.tecconcursos.com.br/cadernos/1" }), { tec: "https://www.tecconcursos.com.br/cadernos/1" });
  assert.deepEqual(getTopicLinks({ link: "https://www.qconcursos.com/cadernos/1", links: { qconcursos: "" } }), { qconcursos: "" });
  assert.deepEqual(getTopicLinks({ link: "javascript:alert(1)" }), {});
});

test("question searches remove edital numbering and encode topic text as one query", () => {
  assert.equal(questionSearchTerm({ name: "  5.7 Emprego do sinal indicativo de crase" }), "Emprego do sinal indicativo de crase");
  const url = new URL(buildQconcursosSearch("Crase & regência? #1"));
  assert.equal(url.origin, "https://www.qconcursos.com");
  assert.equal(url.searchParams.get("q"), "Crase & regência? #1");
  assert.equal(url.hash, "");
  assert.equal(buildQconcursosSearch("  "), null);
  assert.equal(questionSearchTerm({ name: "9.784/1999" }), "9.784/1999");
});
