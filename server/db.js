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

try {
  db.exec("ALTER TABLE users ADD COLUMN username TEXT");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
} catch {
  // column already exists
}

// NULLs are all distinct under a unique index, so this is safe to run
// before anyone has set a username.
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");

// Shared catalog of matéria/assunto trees (e.g. extracted from TecConcursos),
// available to every user so they can import a ready-made structure into
// their own concurso instead of typing it out or scraping it themselves.
db.exec(`
  CREATE TABLE IF NOT EXISTS content_bank_materias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    topics TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Question bank built from the provas and gabaritos the bancas publish
// themselves. `fonte` identifies the item in its original prova, so
// re-importing the same prova updates instead of duplicating, and `assunto`
// matches a topic name in the matéria trees above — that is how a question
// reaches the topic a user is studying.
//
// Cebraspe items share a base text and a command across a block of items, so
// both are kept alongside the item's own statement; a multiple-choice question
// from FCC/FGV simply leaves texto_base null and fills alternativas.
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fonte TEXT UNIQUE NOT NULL,
    materia TEXT NOT NULL,
    assunto TEXT NOT NULL,
    banca TEXT NOT NULL,
    orgao TEXT,
    cargo TEXT,
    ano INTEGER,
    tipo TEXT NOT NULL,
    texto_base TEXT,
    comando TEXT,
    enunciado TEXT NOT NULL,
    alternativas TEXT NOT NULL,
    gabarito TEXT NOT NULL,
    comentario TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_questions_assunto ON questions(materia, assunto);
  CREATE INDEX IF NOT EXISTS idx_questions_banca ON questions(banca);
`);

export default db;
