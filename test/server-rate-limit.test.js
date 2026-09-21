// Deliberately does NOT set AUTH_RATE_LIMIT — this is the one file that
// exercises the real default (20 requests / 15 minutes / IP) that protects
// /api/register, /api/login, /api/reset-password and /api/me/change-password.
// See server-auth.test.js for why SQLITE_PATH must be set before the
// dynamic import, and why this file needs Node 22.5+ (CI only).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.SQLITE_PATH = ":memory:";
// backup.js unconditionally mkdirSyncs this at import time — must be a real,
// isolated directory (see server-auth.test.js).
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rota-estudos-test-backups-"));

const { default: app } = await import("../server/index.js");

let server;
let baseUrl;

before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
});

async function register(email) {
  return fetch(`${baseUrl}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
}

describe("the per-IP auth rate limiter", () => {
  test("allows the real default of 20 requests, then blocks the 21st with 429", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await register(`rate-limit-${i}@example.com`);
      assert.notEqual(res.status, 429, `request ${i + 1} of 20 should not be rate-limited yet`);
    }
    const res21 = await register("rate-limit-21@example.com");
    assert.equal(res21.status, 429, "the 21st request within the window should be rate-limited");
  });
});
