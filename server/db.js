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

// A random value rotated on every login/register/password-reset and baked
// into that request's JWT — a token whose embedded value no longer matches
// the row (because a later login overwrote it) is a session that's been
// superseded, so only the most recent login for an email stays valid.
try {
  db.exec("ALTER TABLE users ADD COLUMN session_token TEXT");
} catch {
  // column already exists
}

// Per-account brute-force guard, separate from the IP-based rate limiter on
// the route itself — that one resets the moment an attacker rotates IPs,
// this one doesn't. failed_login_attempts resets to 0 on any successful
// login; locked_until is cleared the same way and otherwise just expires.
try {
  db.exec("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN locked_until TEXT");
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

// Global on/off switches an admin can flip from the app itself — e.g.
// turning off question practice without a deploy. A key with no row here is
// treated as enabled (see isFeatureEnabled in index.js): existing behavior
// stays unchanged until an admin explicitly disables something.
db.exec(`
  CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// A record of every account-affecting action an admin takes — who did what
// to whom, and when — so "who suspended this account?" or "who reset my
// password?" has an answer. Denormalizes both emails (rather than joining
// against users.id at read time) so the log stays readable even after the
// target account is later renamed or deleted.
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_email TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Web Push subscriptions — one row per device/browser a user has opted in
// on, since a single account can have several. `endpoint` alone uniquely
// identifies a subscription (it encodes the specific push service and
// device); re-subscribing the same endpoint (e.g. re-granting permission)
// just refreshes its keys rather than creating a duplicate.
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
`);

// Tiny generic key-value store for small bits of process state that need to
// survive a restart — e.g. "was today's reminder already sent" (see
// dailyReminder.js), so a redeploy mid-day can't cause a duplicate.
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export default db;
