import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("production refuses missing, weak and example JWT secrets", () => {
  for (const secret of ["", "short", "replace-with-a-long-random-string"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./server/auth.js')"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", JWT_SECRET: secret }, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET/);
  }
  const valid = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./server/auth.js')"], { env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "a-valid-production-secret-with-more-than-32-characters" } });
  assert.equal(valid.status, 0);
});
