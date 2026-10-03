import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

export function inspectBackup(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare("PRAGMA integrity_check").all();
    if (rows.length !== 1 || Object.values(rows[0])[0] !== "ok") throw new Error("backup SQLite corrompido");
    for (const [table, columns] of Object.entries({ users: ["id", "email", "password_hash"], user_data: ["user_id", "value"] })) {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) throw new Error("arquivo não é um backup do Rota dos Estudos");
      const names = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
      if (!columns.every((column) => names.includes(column))) throw new Error("schema do backup não é compatível com o Rota dos Estudos");
    }
  } finally {
    db.close();
  }
}

// Only run while the API is stopped. The previous database and its sidecars
// remain next to the target for rollback; the original backup is never moved.
export function restoreBackup({ source, target, serverStopped = false }) {
  if (!serverStopped) throw new Error("pare a API antes de restaurar o banco");
  if (path.resolve(source) === path.resolve(target)) throw new Error("origem e destino precisam ser diferentes");
  inspectBackup(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const suffix = crypto.randomUUID();
  const temporary = `${target}.restoring-${suffix}`;
  const previous = `${target}.before-restore-${suffix}`;
  const archived = [];
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    inspectBackup(temporary);
    for (const sidecar of ["", "-wal", "-shm"]) {
      if (fs.existsSync(`${target}${sidecar}`)) {
        fs.renameSync(`${target}${sidecar}`, `${previous}${sidecar}`);
        archived.push(sidecar);
      }
    }
    fs.renameSync(temporary, target);
    return { target, previous: archived.length ? previous : null };
  } catch (error) {
    for (const sidecar of archived.reverse()) fs.renameSync(`${previous}${sidecar}`, `${target}${sidecar}`);
    throw error;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const source = args[args.indexOf("--source") + 1];
  const target = args[args.indexOf("--target") + 1];
  if (!args.includes("--source") || !args.includes("--target") || !source || !target) {
    console.error("Uso: npm run restore -- --source backup.sqlite --target server/data.sqlite --server-stopped");
    process.exitCode = 1;
  } else {
    try {
      console.log(restoreBackup({ source, target, serverStopped: args.includes("--server-stopped") }));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
