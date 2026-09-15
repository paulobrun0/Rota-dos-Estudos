import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "backups");
const RETENTION = 14;

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// SQLite's VACUUM INTO writes a fully consistent snapshot to a fresh file
// even while the live connection has an in-flight transaction — unlike a
// plain file copy, which could grab the .sqlite file mid-write and produce
// a torn/corrupt backup. The destination must not already exist, which the
// timestamped filename guarantees.
export function runBackup() {
  const file = path.join(BACKUP_DIR, `data-${timestamp()}.sqlite`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  pruneOldBackups();
  return file;
}

function pruneOldBackups() {
  const files = listBackups();
  for (const f of files.slice(RETENTION)) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
  }
}

export function listBackups() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sqlite"))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export { BACKUP_DIR };
