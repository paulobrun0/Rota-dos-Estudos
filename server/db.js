import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "data.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    value TEXT,
    updated_at TEXT
  );
`);

// Added after the tables above already shipped — guarded so it's a no-op
// against a database that already has the column.
try {
  db.exec("ALTER TABLE users ADD COLUMN recovery_code_hash TEXT");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN show_in_ranking INTEGER NOT NULL DEFAULT 1");
} catch {
  // column already exists
}

export default db;
