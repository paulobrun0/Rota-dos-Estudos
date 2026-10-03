import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rota-replica-test-"));
process.env.SQLITE_PATH = ":memory:";
process.env.BACKUP_DIR = path.join(directory, "local");
process.env.BACKUP_REPLICA_DIR = path.join(directory, "external");
const { default: db } = await import("../server/db.js");
const { runBackup } = await import("../server/backup.js");
after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });

test("replicas contain the same consistent database and leave no partial files", () => {
  db.prepare("INSERT INTO users (email, password_hash) VALUES ('replica@example.com', 'hashed')").run();
  const backup = runBackup();
  const replica = path.join(process.env.BACKUP_REPLICA_DIR, path.basename(backup));
  assert.deepEqual(fs.readFileSync(replica), fs.readFileSync(backup));
  const snapshot = new DatabaseSync(replica, { readOnly: true });
  assert.equal(snapshot.prepare("SELECT email FROM users").get().email, "replica@example.com");
  snapshot.close();
  assert.ok(fs.readdirSync(process.env.BACKUP_REPLICA_DIR).every((name) => name.endsWith(".sqlite")));
});

test("an unavailable replica reports the failure while retaining a local snapshot", () => {
  fs.rmSync(process.env.BACKUP_REPLICA_DIR, { recursive: true });
  fs.writeFileSync(process.env.BACKUP_REPLICA_DIR, "not a directory");
  assert.throws(runBackup);
  assert.equal(fs.readdirSync(process.env.BACKUP_DIR).filter((name) => name.endsWith(".sqlite")).length, 2);
});
