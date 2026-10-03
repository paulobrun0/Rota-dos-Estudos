import { test } from "node:test";
import assert from "node:assert/strict";
import { getTopicLinks } from "../src/lib/topicLinks.js";

test("legacy links keep their platform and explicit links take precedence", () => {
  assert.deepEqual(getTopicLinks({ link: "https://www.tecconcursos.com.br/cadernos/1" }), { tec: "https://www.tecconcursos.com.br/cadernos/1" });
  assert.deepEqual(getTopicLinks({ link: "https://www.qconcursos.com/cadernos/1", links: { qconcursos: "" } }), { qconcursos: "" });
  assert.deepEqual(getTopicLinks({ link: "javascript:alert(1)" }), {});
});
