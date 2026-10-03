import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { restoreBackup } from "../server/restore.js";

test("restores a validated snapshot and keeps the previous database available", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rota-restore-"));
  try {
    const source = path.join(dir, "backup.sqlite");
    const target = path.join(dir, "data.sqlite");
    const original = new DatabaseSync(source);
    original.exec("CREATE TABLE users (id INTEGER, email TEXT, password_hash TEXT); CREATE TABLE user_data (user_id INTEGER, value TEXT); INSERT INTO user_data VALUES (1, 'preserved');");
    original.close();
    const previous = new DatabaseSync(target);
    previous.exec("CREATE TABLE old_data (value TEXT)");
    previous.close();
    assert.throws(() => restoreBackup({ source, target }), /pare a API/);
    const result = restoreBackup({ source, target, serverStopped: true });
    assert.ok(fs.existsSync(result.previous));
    const restored = new DatabaseSync(target);
    assert.equal(restored.prepare("SELECT value FROM user_data").get().value, "preserved");
    restored.close();
    const invalid = path.join(dir, "invalid.sqlite");
    fs.writeFileSync(invalid, "not sqlite");
    assert.throws(() => restoreBackup({ source: invalid, target, serverStopped: true }));
    const unchanged = new DatabaseSync(target);
    assert.equal(unchanged.prepare("SELECT value FROM user_data").get().value, "preserved");
    unchanged.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
