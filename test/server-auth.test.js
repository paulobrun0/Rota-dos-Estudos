// Integration tests against the real Express app (server/index.js) and a
// throwaway in-memory SQLite database (server/db.js honors SQLITE_PATH).
// `node:sqlite` doesn't exist before Node 22.5 — see package.json's
// "engines" field — so this file only runs where that's available (CI).
//
// Both env vars below must be set BEFORE server/index.js (and, transitively,
// server/db.js) is evaluated, which is why the import is dynamic: a static
// `import` would be hoisted ahead of these assignments.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.SQLITE_PATH = ":memory:";
process.env.AUTH_RATE_LIMIT = "1000"; // real rate limiting has its own test file
// backup.js unconditionally mkdirSyncs this at import time regardless of
// whether any test here calls a backup route — needs to be a real,
// isolated path, not just a placeholder string.
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

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get("set-cookie");
  const newCookie = setCookie ? setCookie.split(";")[0] : null;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, cookie: newCookie };
}

let userCounter = 0;
function freshEmail() {
  userCounter += 1;
  return `auth-test-${userCounter}@example.com`;
}

async function registerFresh(password = "correct-horse-1") {
  const email = freshEmail();
  const res = await api("/api/register", { method: "POST", body: { email, password } });
  assert.equal(res.status, 200, `setup registration should succeed: ${JSON.stringify(res.body)}`);
  return { email, password, cookie: res.cookie, recoveryCode: res.body.recoveryCode };
}

describe("POST /api/register", () => {
  test("rejects an invalid email", async () => {
    const res = await api("/api/register", { method: "POST", body: { email: "not-an-email", password: "password123" } });
    assert.equal(res.status, 400);
  });

  test("rejects a password shorter than 8 characters", async () => {
    const res = await api("/api/register", { method: "POST", body: { email: freshEmail(), password: "short" } });
    assert.equal(res.status, 400);
  });

  test("succeeds, lowercases the email, sets a session cookie, and returns a dashed recovery code", async () => {
    const email = "Mixed-Case@Example.com";
    const res = await api("/api/register", { method: "POST", body: { email, password: "password123" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, "mixed-case@example.com");
    assert.match(res.body.recoveryCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.ok(res.cookie, "a session cookie should be issued immediately on registration");
  });

  test("rejects a duplicate email regardless of case", async () => {
    const { email } = await registerFresh();
    const res = await api("/api/register", { method: "POST", body: { email: email.toUpperCase(), password: "password123" } });
    assert.equal(res.status, 409);
  });
});

describe("POST /api/login", () => {
  test("rejects a nonexistent email with the same generic message as a wrong password", async () => {
    const res = await api("/api/login", { method: "POST", body: { email: freshEmail(), password: "whatever1" } });
    assert.equal(res.status, 401);
  });

  test("rejects a wrong password for a real account", async () => {
    const { email } = await registerFresh("correct-horse-1");
    const res = await api("/api/login", { method: "POST", body: { email, password: "wrong-password" } });
    assert.equal(res.status, 401);
  });

  test("succeeds with the right credentials and issues a session cookie", async () => {
    const { email, password } = await registerFresh("correct-horse-1");
    const res = await api("/api/login", { method: "POST", body: { email, password } });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
    assert.ok(res.cookie);
  });

  // Regression-style coverage for the account lockout, separate from the
  // per-IP rate limiter (see server-rate-limit.test.js): 5 wrong passwords
  // lock the ACCOUNT for 15 minutes, so even the 6th attempt with the
  // CORRECT password is rejected without a lockout message, not a normal
  // "wrong password" one.
  test("locks the account after 5 wrong passwords, blocking even a correct 6th attempt", async () => {
    const { email, password } = await registerFresh("correct-horse-1");
    for (let i = 0; i < 5; i++) {
      const res = await api("/api/login", { method: "POST", body: { email, password: "wrong-password" } });
      assert.equal(res.status, 401, `attempt ${i + 1} should be a plain wrong-password rejection`);
    }
    const lockedOut = await api("/api/login", { method: "POST", body: { email, password } });
    assert.equal(lockedOut.status, 429);
  });
});

describe("session lifecycle", () => {
  test("GET /api/me returns the expected shape and defaults for a fresh account", async () => {
    const { email, cookie } = await registerFresh();
    const res = await api("/api/me", { cookie });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      email, isAdmin: false, showInRanking: true, username: null, avatar: null, reminderHour: 19,
    });
  });

  test("logging in again from a second device invalidates the first device's cookie", async () => {
    const { email, password, cookie: device1 } = await registerFresh();
    const loginRes = await api("/api/login", { method: "POST", body: { email, password } });
    const device2 = loginRes.cookie;

    const staleCheck = await api("/api/me", { cookie: device1 });
    assert.equal(staleCheck.status, 401);
    assert.equal(staleCheck.body.code, "SESSION_SUPERSEDED");

    const freshCheck = await api("/api/me", { cookie: device2 });
    assert.equal(freshCheck.status, 200);
  });

  test("logout clears the server-side session, so the old cookie stops working", async () => {
    const { cookie } = await registerFresh();
    const logoutRes = await api("/api/logout", { method: "POST", cookie });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await api("/api/me", { cookie });
    assert.equal(afterLogout.status, 401);
  });

  test("logout-all rotates the caller's own cookie forward while invalidating whatever was current before", async () => {
    const { email, password, cookie: deviceA } = await registerFresh();
    const loginB = await api("/api/login", { method: "POST", body: { email, password } });
    const deviceB = loginB.cookie; // now the only valid session — deviceA is already stale

    const logoutAll = await api("/api/me/logout-all", { method: "POST", cookie: deviceB });
    assert.equal(logoutAll.status, 200);
    const deviceB2 = logoutAll.cookie;
    assert.ok(deviceB2, "logout-all re-issues a fresh cookie for the caller's own request");

    assert.equal((await api("/api/me", { cookie: deviceB2 })).status, 200, "the caller keeps working, on the new cookie");
    assert.equal((await api("/api/me", { cookie: deviceB })).status, 401, "the cookie that called logout-all is itself superseded by the new one");
    assert.equal((await api("/api/me", { cookie: deviceA })).status, 401, "already-stale deviceA stays stale");
  });
});

describe("POST /api/reset-password", () => {
  test("rejects a wrong recovery code", async () => {
    const { email } = await registerFresh();
    const res = await api("/api/reset-password", { method: "POST", body: { email, recoveryCode: "0000-0000-0000", newPassword: "newpassword1" } });
    assert.equal(res.status, 401);
  });

  test("succeeds with the right code, returns a new one-time recovery code, and the new password logs in", async () => {
    const { email, recoveryCode } = await registerFresh();
    const res = await api("/api/reset-password", { method: "POST", body: { email, recoveryCode, newPassword: "newpassword1" } });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.recoveryCode, recoveryCode);
    assert.ok(res.cookie, "resetting also logs the user in");

    const login = await api("/api/login", { method: "POST", body: { email, password: "newpassword1" } });
    assert.equal(login.status, 200);
  });

  test("the old recovery code is single-use — it stops working after one reset", async () => {
    const { email, recoveryCode } = await registerFresh();
    await api("/api/reset-password", { method: "POST", body: { email, recoveryCode, newPassword: "newpassword1" } });
    const reuse = await api("/api/reset-password", { method: "POST", body: { email, recoveryCode, newPassword: "anotherpass1" } });
    assert.equal(reuse.status, 401);
  });
});

describe("PATCH /api/me", () => {
  test("showInRanking must be a boolean", async () => {
    const { cookie } = await registerFresh();
    const res = await api("/api/me", { method: "PATCH", cookie, body: { showInRanking: "yes" } });
    assert.equal(res.status, 400);
  });

  test("reminderHour must be an integer between 0 and 23", async () => {
    const { cookie } = await registerFresh();
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { reminderHour: 24 } })).status, 400);
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { reminderHour: -1 } })).status, 400);
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { reminderHour: 5.5 } })).status, 400);
    const ok = await api("/api/me", { method: "PATCH", cookie, body: { reminderHour: 8 } });
    assert.equal(ok.status, 200);
    assert.equal((await api("/api/me", { cookie })).body.reminderHour, 8);
  });

  test("username must be 3-24 chars of letters/digits/underscore/dot, and unique", async () => {
    const { cookie } = await registerFresh();
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { username: "ab" } })).status, 400, "too short");
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { username: "a".repeat(25) } })).status, 400, "too long");
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { username: "bad name!" } })).status, 400, "bad characters");

    const taken = await registerFresh();
    await api("/api/me", { method: "PATCH", cookie: taken.cookie, body: { username: "claimed_name" } });
    const conflict = await api("/api/me", { method: "PATCH", cookie, body: { username: "claimed_name" } });
    assert.equal(conflict.status, 409);

    const ok = await api("/api/me", { method: "PATCH", cookie, body: { username: "a.valid_name" } });
    assert.equal(ok.status, 200);
    assert.equal((await api("/api/me", { cookie })).body.username, "a.valid_name");
  });

  test("avatar must be a data: URL of an accepted image type, under the size cap, and null clears it", async () => {
    const { cookie } = await registerFresh();
    assert.equal((await api("/api/me", { method: "PATCH", cookie, body: { avatar: "not-a-data-url" } })).status, 400);
    assert.equal(
      (await api("/api/me", { method: "PATCH", cookie, body: { avatar: `data:image/png;base64,${"A".repeat(1_500_001)}` } })).status,
      400,
      "oversized avatar rejected",
    );
    const validAvatar = "data:image/png;base64,AAAA";
    const ok = await api("/api/me", { method: "PATCH", cookie, body: { avatar: validAvatar } });
    assert.equal(ok.status, 200);
    assert.equal((await api("/api/me", { cookie })).body.avatar, validAvatar);

    const cleared = await api("/api/me", { method: "PATCH", cookie, body: { avatar: null } });
    assert.equal(cleared.status, 200);
    assert.equal((await api("/api/me", { cookie })).body.avatar, null);
  });
});

describe("POST /api/me/change-password", () => {
  test("rejects the wrong current password", async () => {
    const { cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-password", { method: "POST", cookie, body: { currentPassword: "wrong", newPassword: "newpassword1" } });
    assert.equal(res.status, 401);
  });

  test("rejects a new password shorter than 8 characters", async () => {
    const { cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-password", { method: "POST", cookie, body: { currentPassword: "correct-horse-1", newPassword: "short" } });
    assert.equal(res.status, 400);
  });

  test("on success, rotates the session (old cookie stops working) and the new password logs in", async () => {
    const { email, cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-password", { method: "POST", cookie, body: { currentPassword: "correct-horse-1", newPassword: "newpassword1" } });
    assert.equal(res.status, 200);
    assert.ok(res.cookie);

    assert.equal((await api("/api/me", { cookie })).status, 401, "old cookie invalidated by the password change");
    assert.equal((await api("/api/me", { cookie: res.cookie })).status, 200, "new cookie from the response works");
    assert.equal((await api("/api/login", { method: "POST", body: { email, password: "newpassword1" } })).status, 200);
  });
});

describe("POST /api/me/change-email", () => {
  test("rejects the wrong current password", async () => {
    const { cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-email", { method: "POST", cookie, body: { currentPassword: "wrong", newEmail: freshEmail() } });
    assert.equal(res.status, 401);
  });

  test("rejects an invalid new email", async () => {
    const { cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-email", { method: "POST", cookie, body: { currentPassword: "correct-horse-1", newEmail: "not-an-email" } });
    assert.equal(res.status, 400);
  });

  test("rejects an email already used by another account", async () => {
    const other = await registerFresh();
    const { cookie } = await registerFresh("correct-horse-1");
    const res = await api("/api/me/change-email", { method: "POST", cookie, body: { currentPassword: "correct-horse-1", newEmail: other.email } });
    assert.equal(res.status, 409);
  });

  test("succeeds and the account is reachable under the new email", async () => {
    const { cookie, password } = await registerFresh("correct-horse-1");
    const newEmail = freshEmail();
    const res = await api("/api/me/change-email", { method: "POST", cookie, body: { currentPassword: "correct-horse-1", newEmail } });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, newEmail);
    assert.equal((await api("/api/login", { method: "POST", body: { email: newEmail, password } })).status, 200);
  });
});
