import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { uid } from "../src/lib/id.js";

describe("uid", () => {
  test("returns a non-empty lowercase base36 string", () => {
    const id = uid();
    assert.equal(typeof id, "string");
    assert.ok(id.length > 0);
    assert.ok(/^[a-z0-9]+$/.test(id));
  });

  test("two calls produce different ids", () => {
    assert.notEqual(uid(), uid());
  });
});
