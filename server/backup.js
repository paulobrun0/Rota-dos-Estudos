import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable for the same reason as SQLITE_PATH in db.js — tests get their
// own throwaway directory instead of writing into the real backups/ folder.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
const REPLICA_DIR = process.env.BACKUP_REPLICA_DIR;
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
  const file = path.join(BACKUP_DIR, `data-${timestamp()}-${crypto.randomUUID()}.sqlite`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  if (REPLICA_DIR) {
    fs.mkdirSync(REPLICA_DIR, { recursive: true });
    const target = path.join(REPLICA_DIR, path.basename(file));
    const temporary = `${target}.partial`;
    try {
      fs.copyFileSync(file, temporary, fs.constants.COPYFILE_EXCL);
      const digest = (name) => crypto.createHash("sha256").update(fs.readFileSync(name)).digest("hex");
      if (digest(file) !== digest(temporary)) throw new Error("cópia do backup não confere");
      fs.renameSync(temporary, target);
      pruneOldBackups(REPLICA_DIR);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  pruneOldBackups();
  return file;
}

function pruneOldBackups(directory = BACKUP_DIR) {
  const files = listBackups(directory);
  for (const f of files.slice(RETENTION)) {
    fs.unlinkSync(path.join(directory, f.name));
  }
}

export function listBackups(directory = BACKUP_DIR) {
  return fs
    .readdirSync(directory)
    .filter((f) => f.endsWith(".sqlite"))
    .map((name) => {
      const stat = fs.statSync(path.join(directory, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export { BACKUP_DIR };
