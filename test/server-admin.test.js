// See server-auth.test.js for why these env vars are set before a dynamic
// import of the server, and why this whole file needs Node 22.5+ (CI only).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.SQLITE_PATH = ":memory:";
process.env.AUTH_RATE_LIMIT = "1000";
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rota-estudos-test-backups-"));

const { default: app } = await import("../server/index.js");
const { default: db } = await import("../server/db.js");

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
  return `admin-test-${userCounter}@example.com`;
}

async function registerFresh(password = "correct-horse-1") {
  const email = freshEmail();
  const res = await api("/api/register", { method: "POST", body: { email, password } });
  assert.equal(res.status, 200, `setup registration should succeed: ${JSON.stringify(res.body)}`);
  return { email, password, cookie: res.cookie };
}

// Bootstraps an admin directly through the DB — there's no API for this by
// design (the only way to grant admin is an existing admin's PATCH), so
// tests have to seed the very first one the same way a real deploy would
// (a manual SQL statement against the production database).
function promoteToAdmin(email) {
  db.prepare("UPDATE users SET is_admin = 1 WHERE email = ?").run(email);
}

async function registerAdmin() {
  const user = await registerFresh();
  promoteToAdmin(user.email);
  return user;
}

function idFor(email, users) {
  return users.find((u) => u.email === email)?.id;
}

describe("admin routes reject non-admins", () => {
  test("every admin route returns 403 for a logged-in, non-admin user", async () => {
    const { cookie } = await registerFresh();
    const routes = [
      ["GET", "/api/admin/users"],
      ["PATCH", "/api/admin/users/1"],
      ["POST", "/api/admin/users/1/reset-password"],
      ["DELETE", "/api/admin/users/1"],
      ["GET", "/api/admin/audit-log"],
      ["POST", "/api/admin/content-bank"],
      ["DELETE", "/api/admin/content-bank/1"],
      ["GET", "/api/admin/features"],
      ["PATCH", "/api/admin/features/questoes"],
      ["GET", "/api/admin/backups"],
      ["POST", "/api/admin/backups"],
    ];
    for (const [method, path] of routes) {
      const res = await api(path, { method, cookie });
      assert.equal(res.status, 403, `${method} ${path} should be admin-only`);
    }
  });
});

describe("user management", () => {
  test("admin lists users, including streak/activity summaries", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh();
    const res = await api("/api/admin/users", { cookie: admin.cookie });
    assert.equal(res.status, 200);
    const row = res.body.users.find((u) => u.email === target.email);
    assert.ok(row, "the newly registered user shows up in the admin list");
    assert.equal(row.isAdmin, false);
    assert.equal(row.isSuspended, false);
    assert.equal(row.currentStreak, 0);
    assert.equal(row.longestStreak, 0);
    assert.equal(row.activeDays, 0);
  });

  test("granting and revoking admin works, but an admin can't revoke their own access", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);
    const adminId = idFor(admin.email, users);

    const grant = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { isAdmin: true } });
    assert.equal(grant.status, 200);
    assert.equal((await api("/api/me", { cookie: target.cookie })).body.isAdmin, true);

    const revoke = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { isAdmin: false } });
    assert.equal(revoke.status, 200);
    assert.equal((await api("/api/me", { cookie: target.cookie })).body.isAdmin, false);

    const selfRevoke = await api(`/api/admin/users/${adminId}`, { method: "PATCH", cookie: admin.cookie, body: { isAdmin: false } });
    assert.equal(selfRevoke.status, 400, "an admin can't remove their own admin access");
  });

  test("suspending a user blocks their existing session with a SUSPENDED code, and an admin can't suspend themselves", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);
    const adminId = idFor(admin.email, users);

    const suspend = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { isSuspended: true } });
    assert.equal(suspend.status, 200);

    const blocked = await api("/api/me", { cookie: target.cookie });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "SUSPENDED");

    const loginWhileSuspended = await api("/api/login", { method: "POST", body: { email: target.email, password: target.password } });
    assert.equal(loginWhileSuspended.status, 403);

    const selfSuspend = await api(`/api/admin/users/${adminId}`, { method: "PATCH", cookie: admin.cookie, body: { isSuspended: true } });
    assert.equal(selfSuspend.status, 400, "an admin can't suspend their own account");

    const unsuspend = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { isSuspended: false } });
    assert.equal(unsuspend.status, 200);
  });

  test("changing a user's email rejects an address already taken by someone else", async () => {
    const admin = await registerAdmin();
    const existing = await registerFresh();
    const target = await registerFresh();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);

    const conflict = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { email: existing.email } });
    assert.equal(conflict.status, 409);

    const newEmail = freshEmail();
    const ok = await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { email: newEmail } });
    assert.equal(ok.status, 200);
  });

  test("patching a nonexistent user id returns 404", async () => {
    const admin = await registerAdmin();
    const res = await api("/api/admin/users/999999999", { method: "PATCH", cookie: admin.cookie, body: { isAdmin: true } });
    assert.equal(res.status, 404);
  });
});

describe("admin password reset", () => {
  test("issues a working temporary password and invalidates the target's existing session", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh("original-pass-1");
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);

    const reset = await api(`/api/admin/users/${targetId}/reset-password`, { method: "POST", cookie: admin.cookie });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.email, target.email);
    assert.ok(reset.body.newPassword);
    assert.ok(reset.body.recoveryCode);

    assert.equal((await api("/api/me", { cookie: target.cookie })).status, 401, "old session invalidated by the reset");
    assert.equal((await api("/api/login", { method: "POST", body: { email: target.email, password: "original-pass-1" } })).status, 401, "old password no longer works");
    assert.equal((await api("/api/login", { method: "POST", body: { email: target.email, password: reset.body.newPassword } })).status, 200, "new temporary password works");
  });
});

describe("delete user", () => {
  test("an admin can't delete their own account through this route", async () => {
    const admin = await registerAdmin();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const adminId = idFor(admin.email, users);
    const res = await api(`/api/admin/users/${adminId}`, { method: "DELETE", cookie: admin.cookie });
    assert.equal(res.status, 400);
  });

  test("deleting a user invalidates their session and a repeat delete 404s", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);

    const del = await api(`/api/admin/users/${targetId}`, { method: "DELETE", cookie: admin.cookie });
    assert.equal(del.status, 200);

    const staleCheck = await api("/api/me", { cookie: target.cookie });
    assert.equal(staleCheck.status, 401);
    assert.equal(staleCheck.body.code, "SESSION_INVALID");

    const repeat = await api(`/api/admin/users/${targetId}`, { method: "DELETE", cookie: admin.cookie });
    assert.equal(repeat.status, 404);
  });
});

describe("audit log", () => {
  test("admin actions are recorded and readable by an admin", async () => {
    const admin = await registerAdmin();
    const target = await registerFresh();
    const { body: { users } } = await api("/api/admin/users", { cookie: admin.cookie });
    const targetId = idFor(target.email, users);
    await api(`/api/admin/users/${targetId}`, { method: "PATCH", cookie: admin.cookie, body: { isSuspended: true } });

    const log = await api("/api/admin/audit-log", { cookie: admin.cookie });
    assert.equal(log.status, 200);
    const entry = log.body.entries.find((e) => e.action === "suspend_user" && e.targetEmail === target.email);
    assert.ok(entry, "the suspend action shows up in the audit log");
    assert.equal(entry.adminEmail, admin.email);
  });
});

describe("content bank", () => {
  test("any logged-in user can read it, only an admin can write to it", async () => {
    const admin = await registerAdmin();
    const normal = await registerFresh();
    const materiaName = `Test Matéria ${freshEmail()}`;

    const upsert = await api("/api/admin/content-bank", {
      method: "POST",
      cookie: admin.cookie,
      body: { materias: [{ name: materiaName, topics: ["A", "B", " "] }, { name: "  ", topics: ["ignored"] }, { name: "No Topics", topics: [] }] },
    });
    assert.equal(upsert.status, 200);
    assert.equal(upsert.body.count, 1, "only the one valid entry (blank-name and empty-topics entries are skipped)");

    const read = await api("/api/content-bank", { cookie: normal.cookie });
    assert.equal(read.status, 200);
    const entry = read.body.materias.find((m) => m.name === materiaName);
    assert.deepEqual(entry.topics, ["A", "B"], "blank topic strings are dropped and the rest trimmed");

    const del = await api(`/api/admin/content-bank/${entry.id}`, { method: "DELETE", cookie: admin.cookie });
    assert.equal(del.status, 200);
    const readAfter = await api("/api/content-bank", { cookie: normal.cookie });
    assert.ok(!readAfter.body.materias.some((m) => m.id === entry.id));
  });

  test("re-upserting the same matéria name updates it instead of duplicating it", async () => {
    const admin = await registerAdmin();
    const name = `Upsert Test ${freshEmail()}`;
    await api("/api/admin/content-bank", { method: "POST", cookie: admin.cookie, body: { materias: [{ name, topics: ["Original"] }] } });
    await api("/api/admin/content-bank", { method: "POST", cookie: admin.cookie, body: { materias: [{ name, topics: ["Updated"] }] } });

    const read = await api("/api/content-bank", { cookie: admin.cookie });
    const matches = read.body.materias.filter((m) => m.name === name);
    assert.equal(matches.length, 1, "no duplicate row for the same name");
    assert.deepEqual(matches[0].topics, ["Updated"]);
  });
});

describe("feature flags", () => {
  test("lists all known features, defaulting to enabled", async () => {
    const admin = await registerAdmin();
    const res = await api("/api/admin/features", { cookie: admin.cookie });
    assert.equal(res.status, 200);
    const keys = res.body.features.map((f) => f.key).sort();
    assert.deepEqual(keys, ["cadastro", "manutencao", "questoes", "ranking"]);
    assert.ok(res.body.features.every((f) => f.enabled === true), "nothing has been toggled off yet");
  });

  test("rejects an unknown key or a non-boolean value", async () => {
    const admin = await registerAdmin();
    assert.equal((await api("/api/admin/features/not-a-real-feature", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } })).status, 404);
    assert.equal((await api("/api/admin/features/ranking", { method: "PATCH", cookie: admin.cookie, body: { enabled: "nope" } })).status, 400);
  });

  test("toggling ranking off is reflected on the next read, and the ranking route itself starts rejecting", async () => {
    const admin = await registerAdmin();
    const off = await api("/api/admin/features/ranking", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } });
    assert.equal(off.status, 200);
    const after = await api("/api/admin/features", { cookie: admin.cookie });
    assert.equal(after.body.features.find((f) => f.key === "ranking").enabled, false);
    assert.equal((await api("/api/ranking", { cookie: admin.cookie })).status, 403);

    await api("/api/admin/features/ranking", { method: "PATCH", cookie: admin.cookie, body: { enabled: true } });
  });
});

describe("maintenance mode", () => {
  test("disabling 'manutencao' blocks ordinary users but not admins, and re-enabling restores access", async () => {
    const admin = await registerAdmin();
    const normal = await registerFresh();

    const off = await api("/api/admin/features/manutencao", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } });
    assert.equal(off.status, 200);

    const blockedMe = await api("/api/me", { cookie: normal.cookie });
    assert.equal(blockedMe.status, 503);
    assert.equal(blockedMe.body.code, "MAINTENANCE");

    const blockedLogin = await api("/api/login", { method: "POST", body: { email: normal.email, password: normal.password } });
    assert.equal(blockedLogin.status, 503);

    assert.equal((await api("/api/me", { cookie: admin.cookie })).status, 200, "admins bypass maintenance mode");

    const on = await api("/api/admin/features/manutencao", { method: "PATCH", cookie: admin.cookie, body: { enabled: true } });
    assert.equal(on.status, 200);
    assert.equal((await api("/api/me", { cookie: normal.cookie })).status, 200, "access restored once maintenance is back off");
  });
});

describe("cadastro (registration) flag", () => {
  test("disabling it blocks new registrations, and re-enabling restores them", async () => {
    const admin = await registerAdmin();
    await api("/api/admin/features/cadastro", { method: "PATCH", cookie: admin.cookie, body: { enabled: false } });

    const blocked = await api("/api/register", { method: "POST", body: { email: freshEmail(), password: "password123" } });
    assert.equal(blocked.status, 403);

    await api("/api/admin/features/cadastro", { method: "PATCH", cookie: admin.cookie, body: { enabled: true } });
    const allowed = await api("/api/register", { method: "POST", body: { email: freshEmail(), password: "password123" } });
    assert.equal(allowed.status, 200);
  });
});

describe("backups", () => {
  test("starts empty, and running one now produces a real entry", async () => {
    const admin = await registerAdmin();
    const before = await api("/api/admin/backups", { cookie: admin.cookie });
    assert.equal(before.status, 200);
    assert.deepEqual(before.body.backups, []);

    const run = await api("/api/admin/backups", { method: "POST", cookie: admin.cookie });
    assert.equal(run.status, 200);
    assert.equal(run.body.backups.length, 1);
    assert.match(run.body.backups[0].name, /\.sqlite$/);
    assert.ok(run.body.backups[0].sizeBytes > 0);
  });
});
