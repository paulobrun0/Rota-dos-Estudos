import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import db from "./db.js";
import {
  signToken, authMiddleware, requireAdmin, COOKIE_NAME, COOKIE_OPTIONS,
  generateRecoveryCode, formatRecoveryCode, normalizeRecoveryInput, generateTempPassword, generateSessionToken,
} from "./auth.js";
import { computeStreaks } from "../src/lib/streaks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// The tunnel/reverse proxy sits in front of us; trust its X-Forwarded-* so
// rate limiting keys on the real client IP instead of the tunnel's.
app.set("trust proxy", 1);

app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

const PORT = process.env.PORT || 4000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const insertUser = db.prepare("INSERT INTO users (email, password_hash, recovery_code_hash) VALUES (?, ?, ?)");
const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const findUserById = db.prepare("SELECT * FROM users WHERE id = ?");
const updateCredentials = db.prepare("UPDATE users SET password_hash = ?, recovery_code_hash = ? WHERE id = ?");
const getData = db.prepare("SELECT value FROM user_data WHERE user_id = ?");
const upsertData = db.prepare(`
  INSERT INTO user_data (user_id, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const listUsers = db.prepare(`
  SELECT u.id, u.email, u.created_at, u.is_admin, u.is_suspended, u.last_login_at, d.updated_at AS data_updated_at, d.value AS data_value
  FROM users u LEFT JOIN user_data d ON d.user_id = u.id
  ORDER BY u.created_at ASC
`);
const deleteUserData = db.prepare("DELETE FROM user_data WHERE user_id = ?");
const deleteUserById = db.prepare("DELETE FROM users WHERE id = ?");
const setUserAdminFlag = db.prepare("UPDATE users SET is_admin = ? WHERE id = ?");
const updateUserEmail = db.prepare("UPDATE users SET email = ? WHERE id = ?");
const findUserByUsername = db.prepare("SELECT id FROM users WHERE username = ?");
const updateProfile = db.prepare("UPDATE users SET username = COALESCE(?, username), avatar = COALESCE(?, avatar) WHERE id = ?");
const clearAvatar = db.prepare("UPDATE users SET avatar = NULL WHERE id = ?");
const updateOwnPassword = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
const setUserSuspendedFlag = db.prepare("UPDATE users SET is_suspended = ? WHERE id = ?");
const setSessionToken = db.prepare("UPDATE users SET session_token = ? WHERE id = ?");
const setLastLogin = db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?");
const setShowInRanking = db.prepare("UPDATE users SET show_in_ranking = ? WHERE id = ?");
const listRankingData = db.prepare(`
  SELECT u.email, u.username, u.avatar, d.value
  FROM users u JOIN user_data d ON d.user_id = u.id
  WHERE u.show_in_ranking = 1 AND u.is_suspended = 0
`);
const listBankMaterias = db.prepare("SELECT id, name, topics FROM content_bank_materias ORDER BY name COLLATE NOCASE ASC");
const upsertBankMateria = db.prepare(`
  INSERT INTO content_bank_materias (name, topics, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(name) DO UPDATE SET topics = excluded.topics, updated_at = excluded.updated_at
`);
const deleteBankMateria = db.prepare("DELETE FROM content_bank_materias WHERE id = ?");
const listQuestionsByAssunto = db.prepare(
  "SELECT * FROM questions WHERE assunto = ? ORDER BY RANDOM() LIMIT ?",
);
const listQuestionsByAssuntoBanca = db.prepare(
  "SELECT * FROM questions WHERE assunto = ? AND banca = ? ORDER BY RANDOM() LIMIT ?",
);
const countQuestionsByAssunto = db.prepare(
  "SELECT assunto, banca, COUNT(*) AS total FROM questions GROUP BY assunto, banca",
);
const getFeatureFlag = db.prepare("SELECT enabled FROM feature_flags WHERE key = ?");
const listFeatureFlags = db.prepare("SELECT key, enabled FROM feature_flags");
const upsertFeatureFlag = db.prepare(`
  INSERT INTO feature_flags (key, enabled, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
`);

// Recursos que um admin pode ligar/desligar pelo próprio app — chave -> rótulo
// exibido na aba de administração. Adicionar um recurso novo é só acrescentar
// uma linha aqui e checar isFeatureEnabled onde ele precisa ser aplicado.
const FEATURES = {
  questoes: "acesso às questões (praticar)",
  ranking: "ranking entre usuários",
  cadastro: "cadastro de novas contas",
  manutencao: "login de usuários comuns (modo manutenção)",
};

// No row for `key` means the feature has never been touched — defaults to
// enabled so existing behavior is unaffected until an admin flips it off.
function isFeatureEnabled(key) {
  const row = getFeatureFlag.get(key);
  return row ? !!row.enabled : true;
}

// Single DB lookup backing the rest of the chain: blocks a suspended account,
// and — since only the most recently issued token for an account stays valid
// (a login elsewhere rotates users.session_token) — rejects a request whose
// JWT carries an older, superseded session_token.
function requireCurrentUser(req, res, next) {
  const user = findUserById.get(req.userId);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  if (user.is_suspended) return res.status(403).json({ error: "esta conta foi suspensa" });
  // Strict, not just "if a session_token is set": after an explicit logout
  // session_token is cleared to null, and a stale cookie's decoded token
  // still carries its old (non-null) sessionToken, so a loose falsy-guard
  // here would let that supposedly-logged-out cookie keep working. A token
  // issued before this feature shipped has no sessionToken at all (decodes
  // as undefined) and a fresh account row starts at null — those also
  // legitimately differ, so everyone re-logs in once when this ships.
  if (user.session_token !== req.sessionToken) {
    return res.status(401).json({ error: "sua conta foi acessada em outro lugar — essa sessão foi encerrada", code: "SESSION_SUPERSEDED" });
  }
  if (!user.is_admin && !isFeatureEnabled("manutencao")) {
    return res.status(503).json({ error: "o app está em manutenção no momento", code: "MAINTENANCE" });
  }
  req.user = user;
  next();
}
const requireAuth = [authMiddleware, requireCurrentUser];

// Rotates the session token, signs a fresh JWT around it, and sets the
// cookie — every place that logs someone in (register, login, password
// reset) funnels through here so each is a single "this is now the only
// valid session" event.
function issueSession(res, userId) {
  const sessionToken = generateSessionToken();
  setSessionToken.run(sessionToken, userId);
  const token = signToken(userId, sessionToken);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/register", authLimiter, (req, res) => {
  if (!isFeatureEnabled("cadastro")) return res.status(403).json({ error: "novos cadastros estão desativados no momento" });
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "email válido e senha com 6+ caracteres são obrigatórios" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (findUserByEmail.get(normalizedEmail)) {
    return res.status(409).json({ error: "já existe uma conta com esse email" });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = bcrypt.hashSync(recoveryCode, 10);
  const info = insertUser.run(normalizedEmail, passwordHash, recoveryHash);
  issueSession(res, info.lastInsertRowid);
  res.json({ email: normalizedEmail, recoveryCode: formatRecoveryCode(recoveryCode) });
});

app.post("/api/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = findUserByEmail.get(normalizedEmail);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "email ou senha incorretos" });
  }
  if (user.is_suspended) return res.status(403).json({ error: "esta conta foi suspensa" });
  if (!user.is_admin && !isFeatureEnabled("manutencao")) {
    return res.status(503).json({ error: "o app está em manutenção no momento — tente novamente em instantes" });
  }
  setLastLogin.run(user.id);
  issueSession(res, user.id);
  res.json({ email: user.email });
});

app.post("/api/reset-password", authLimiter, (req, res) => {
  const { email, recoveryCode, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "a nova senha precisa ter 6+ caracteres" });
  }
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = findUserByEmail.get(normalizedEmail);
  const suppliedCode = normalizeRecoveryInput(recoveryCode);
  if (!user || !user.recovery_code_hash || !suppliedCode || !bcrypt.compareSync(suppliedCode, user.recovery_code_hash)) {
    return res.status(401).json({ error: "email ou código de recuperação incorretos" });
  }
  // The code is single-use: a fresh one replaces it, so reusing an old one
  // (e.g. from a leaked note) won't work after this reset.
  const newRecoveryCode = generateRecoveryCode();
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const recoveryHash = bcrypt.hashSync(newRecoveryCode, 10);
  updateCredentials.run(passwordHash, recoveryHash, user.id);
  issueSession(res, user.id);
  res.json({ email: user.email, recoveryCode: formatRecoveryCode(newRecoveryCode) });
});

app.post("/api/logout", authMiddleware, (req, res) => {
  // Clears the server-side session_token too, not just the cookie — so a
  // copy of the old cookie (already on disk somewhere, say) can't keep
  // working after an explicit logout.
  setSessionToken.run(null, req.userId);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    email: user.email, isAdmin: !!user.is_admin, showInRanking: !!user.show_in_ranking,
    username: user.username || null, avatar: user.avatar || null,
  });
});

app.patch("/api/me", requireAuth, (req, res) => {
  const { showInRanking, username, avatar } = req.body || {};

  if (showInRanking !== undefined) {
    if (typeof showInRanking !== "boolean") return res.status(400).json({ error: "showInRanking deve ser true ou false" });
    setShowInRanking.run(showInRanking ? 1 : 0, req.userId);
  }

  if (username !== undefined) {
    const trimmed = typeof username === "string" ? username.trim() : "";
    if (trimmed.length < 3 || trimmed.length > 24 || !/^[a-zA-Z0-9_.]+$/.test(trimmed)) {
      return res.status(400).json({ error: "nome de usuário deve ter 3-24 caracteres (letras, números, _ ou .)" });
    }
    const existing = findUserByUsername.get(trimmed);
    if (existing && existing.id !== req.userId) return res.status(409).json({ error: "esse nome de usuário já está em uso" });
    updateProfile.run(trimmed, null, req.userId);
  }

  if (avatar !== undefined) {
    if (avatar === null) {
      clearAvatar.run(req.userId);
    } else {
      if (typeof avatar !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(avatar)) {
        return res.status(400).json({ error: "avatar deve ser uma imagem PNG, JPEG ou WEBP" });
      }
      if (avatar.length > 1_500_000) return res.status(400).json({ error: "imagem muito grande" });
      updateProfile.run(null, avatar, req.userId);
    }
  }

  res.json({ ok: true });
});

// Rotates the session token and re-issues a fresh cookie for THIS request —
// every other device's cookie still carries the old value, so it stops
// passing requireCurrentUser's check on its next request, while this one
// keeps working uninterrupted.
app.post("/api/me/logout-all", requireAuth, (req, res) => {
  issueSession(res, req.userId);
  res.json({ ok: true });
});

app.post("/api/me/change-password", authLimiter, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = findUserById.get(req.userId);
  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "senha atual incorreta" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "a nova senha precisa ter 6+ caracteres" });
  }
  updateOwnPassword.run(bcrypt.hashSync(newPassword, 10), req.userId);
  // If the old password had leaked, changing it should also kick out
  // whoever was using it — same rotate-and-recookie as /api/me/logout-all.
  issueSession(res, req.userId);
  res.json({ ok: true });
});

app.post("/api/me/change-email", authLimiter, requireAuth, (req, res) => {
  const { currentPassword, newEmail } = req.body || {};
  const user = findUserById.get(req.userId);
  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "senha atual incorreta" });
  }
  if (!isValidEmail(newEmail)) return res.status(400).json({ error: "email inválido" });
  const normalizedEmail = newEmail.trim().toLowerCase();
  const existing = findUserByEmail.get(normalizedEmail);
  if (existing && existing.id !== req.userId) return res.status(409).json({ error: "já existe uma conta com esse email" });
  updateUserEmail.run(normalizedEmail, req.userId);
  res.json({ email: normalizedEmail });
});

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Aggregate, read-only view across every opted-in user's plan data: total
// topics studied, per-matéria counts (matched by lowercased name), and
// questions solved per period — so people can see how they compare without
// exposing notes or plan details, only aggregate counts.
app.get("/api/ranking", requireAuth, (req, res) => {
  if (!isFeatureEnabled("ranking")) return res.status(403).json({ error: "o ranking está desativado no momento" });
  const rows = listRankingData.all();
  const dayCutoff = isoDaysAgo(0);
  const weekCutoff = isoDaysAgo(6);
  const monthCutoff = isoDaysAgo(29);

  const users = [];
  const periodTotals = { day: [], week: [], month: [] };

  for (const row of rows) {
    const displayName = row.username || row.email.split("@")[0];
    const avatar = row.avatar || null;
    let parsed;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      users.push({ displayName, avatar, totalEstudado: 0, questionsTotal: 0, questionsCorrect: 0, materias: [] });
      continue;
    }

    const materiaMap = new Map();
    let questionsTotal = 0;
    let questionsCorrect = 0;
    for (const concurso of parsed?.concursos || []) {
      for (const materia of concurso?.materias || []) {
        const key = (materia.name || "").trim().toLowerCase();
        if (!key) continue;
        const entry = materiaMap.get(key) || { name: materia.name.trim(), estudado: 0, total: 0, questionsTotal: 0, questionsCorrect: 0 };
        for (const topic of materia.topics || []) {
          entry.total += 1;
          if (topic.status === "estudado") entry.estudado += 1;
          entry.questionsTotal += topic.questionsTotal || 0;
          entry.questionsCorrect += topic.questionsCorrect || 0;
          questionsTotal += topic.questionsTotal || 0;
          questionsCorrect += topic.questionsCorrect || 0;
        }
        materiaMap.set(key, entry);
      }
    }
    const materias = [...materiaMap.values()];
    const totalEstudado = materias.reduce((sum, m) => sum + m.estudado, 0);
    users.push({ displayName, avatar, totalEstudado, questionsTotal, questionsCorrect, materias });

    const sums = { day: { total: 0, correct: 0 }, week: { total: 0, correct: 0 }, month: { total: 0, correct: 0 } };
    for (const [iso, entry] of Object.entries(parsed?.questionActivity || {})) {
      const total = entry?.total || 0;
      const correct = entry?.correct || 0;
      if (iso >= dayCutoff) { sums.day.total += total; sums.day.correct += correct; }
      if (iso >= weekCutoff) { sums.week.total += total; sums.week.correct += correct; }
      if (iso >= monthCutoff) { sums.month.total += total; sums.month.correct += correct; }
    }
    for (const period of ["day", "week", "month"]) {
      if (sums[period].total > 0) periodTotals[period].push({ displayName, avatar, ...sums[period] });
    }
  }

  for (const period of ["day", "week", "month"]) periodTotals[period].sort((a, b) => b.total - a.total);

  res.json({ users, questionPeriods: periodTotals, isOptedIn: !!findUserById.get(req.userId)?.show_in_ranking });
});

const adminOnly = [...requireAuth, requireAdmin(findUserById)];

app.get("/api/admin/users", adminOnly, (req, res) => {
  const users = listUsers.all().map((u) => {
    let streak = { current: 0, longest: 0 };
    let activeDays = 0;
    if (u.data_value) {
      try {
        const activity = JSON.parse(u.data_value)?.activity || {};
        streak = computeStreaks(activity);
        activeDays = Object.keys(activity).filter((k) => activity[k] > 0).length;
      } catch {
        // corrupted/unexpected blob — fall back to zeroed stats
      }
    }
    return {
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      isAdmin: !!u.is_admin,
      isSuspended: !!u.is_suspended,
      lastLoginAt: u.last_login_at,
      dataUpdatedAt: u.data_updated_at,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      activeDays,
    };
  });
  res.json({ users });
});

app.patch("/api/admin/users/:id", adminOnly, (req, res) => {
  const targetId = Number(req.params.id);
  const { isAdmin, isSuspended, email } = req.body || {};
  const target = findUserById.get(targetId);
  if (!target) return res.status(404).json({ error: "usuário não encontrado" });

  if (email !== undefined) {
    if (!isValidEmail(email)) return res.status(400).json({ error: "email inválido" });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = findUserByEmail.get(normalizedEmail);
    if (existing && existing.id !== targetId) return res.status(409).json({ error: "já existe uma conta com esse email" });
    updateUserEmail.run(normalizedEmail, targetId);
  }

  if (isAdmin !== undefined) {
    if (typeof isAdmin !== "boolean") return res.status(400).json({ error: "isAdmin deve ser true ou false" });
    if (targetId === req.userId && !isAdmin) {
      return res.status(400).json({ error: "você não pode remover seu próprio acesso de administrador" });
    }
    setUserAdminFlag.run(isAdmin ? 1 : 0, targetId);
  }

  if (isSuspended !== undefined) {
    if (typeof isSuspended !== "boolean") return res.status(400).json({ error: "isSuspended deve ser true ou false" });
    if (targetId === req.userId && isSuspended) {
      return res.status(400).json({ error: "você não pode suspender sua própria conta" });
    }
    setUserSuspendedFlag.run(isSuspended ? 1 : 0, targetId);
  }

  res.json({ ok: true });
});

app.post("/api/admin/users/:id/reset-password", adminOnly, (req, res) => {
  const targetId = Number(req.params.id);
  const target = findUserById.get(targetId);
  if (!target) return res.status(404).json({ error: "usuário não encontrado" });
  const newPassword = generateTempPassword();
  const newRecoveryCode = generateRecoveryCode();
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const recoveryHash = bcrypt.hashSync(newRecoveryCode, 10);
  updateCredentials.run(passwordHash, recoveryHash, targetId);
  // The old password (whatever anyone still had it) shouldn't keep a
  // session alive after this — same reasoning as the user's own
  // change-password route, just without a cookie to re-issue here since
  // it's the admin's browser making this request, not the target's.
  setSessionToken.run(null, targetId);
  res.json({ email: target.email, newPassword, recoveryCode: formatRecoveryCode(newRecoveryCode) });
});

app.delete("/api/admin/users/:id", adminOnly, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.userId) return res.status(400).json({ error: "você não pode excluir sua própria conta por aqui" });
  const target = findUserById.get(targetId);
  if (!target) return res.status(404).json({ error: "usuário não encontrado" });
  deleteUserData.run(targetId);
  deleteUserById.run(targetId);
  res.json({ ok: true });
});

// Read-only for any logged-in user: the shared catalog they can import
// matérias/assuntos from into their own concurso.
app.get("/api/content-bank", requireAuth, (req, res) => {
  const materias = listBankMaterias.all().map((row) => {
    let topics = [];
    try {
      topics = JSON.parse(row.topics);
    } catch {
      topics = [];
    }
    return { id: row.id, name: row.name, topics };
  });
  res.json({ materias });
});

// Admin-only: bulk upsert (by matéria name) the shared catalog.
app.post("/api/admin/content-bank", adminOnly, (req, res) => {
  const { materias } = req.body || {};
  if (!Array.isArray(materias)) return res.status(400).json({ error: "materias deve ser uma lista" });
  let count = 0;
  for (const m of materias) {
    const name = typeof m?.name === "string" ? m.name.trim() : "";
    const topics = Array.isArray(m?.topics) ? m.topics.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
    if (!name || topics.length === 0) continue;
    upsertBankMateria.run(name, JSON.stringify(topics));
    count++;
  }
  res.json({ ok: true, count });
});

app.delete("/api/admin/content-bank/:id", adminOnly, (req, res) => {
  deleteBankMateria.run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/admin/features", adminOnly, (req, res) => {
  const rows = new Map(listFeatureFlags.all().map((r) => [r.key, !!r.enabled]));
  const features = Object.keys(FEATURES).map((key) => ({
    key, label: FEATURES[key], enabled: rows.has(key) ? rows.get(key) : true,
  }));
  res.json({ features });
});

app.patch("/api/admin/features/:key", adminOnly, (req, res) => {
  const { key } = req.params;
  const { enabled } = req.body || {};
  if (!FEATURES[key]) return res.status(404).json({ error: "recurso desconhecido" });
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled deve ser true ou false" });
  upsertFeatureFlag.run(key, enabled ? 1 : 0);
  res.json({ ok: true, key, enabled });
});

// Questions for the topic a user is studying. `assunto` is the topic name as
// it appears in their edital, which is why the matéria trees and the question
// bank are kept on the same naming.
app.get("/api/questions", requireAuth, (req, res) => {
  if (!isFeatureEnabled("questoes")) return res.status(403).json({ error: "a prática de questões está desativada no momento" });
  const assunto = typeof req.query.assunto === "string" ? req.query.assunto.trim() : "";
  if (!assunto) return res.status(400).json({ error: "assunto é obrigatório" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const banca = typeof req.query.banca === "string" ? req.query.banca.trim() : "";
  const rows = banca
    ? listQuestionsByAssuntoBanca.all(assunto, banca, limit)
    : listQuestionsByAssunto.all(assunto, limit);
  res.json({
    questions: rows.map((r) => ({
      id: r.id,
      fonte: r.fonte,
      materia: r.materia,
      assunto: r.assunto,
      banca: r.banca,
      orgao: r.orgao,
      cargo: r.cargo,
      ano: r.ano,
      tipo: r.tipo,
      textoBase: r.texto_base,
      comando: r.comando,
      enunciado: r.enunciado,
      alternativas: JSON.parse(r.alternativas),
      gabarito: r.gabarito,
      comentario: r.comentario,
    })),
  });
});

// How many questions exist per topic, so the UI can tell which topics can
// already be practised and which have nothing yet.
app.get("/api/questions/counts", requireAuth, (req, res) => {
  // Empty counts, not an error: the UI derives the "praticar (N)" button
  // straight from this, so an empty list already hides it everywhere without
  // any extra plumbing — and a disabled feature isn't really an error case.
  res.json({ counts: isFeatureEnabled("questoes") ? countQuestionsByAssunto.all() : [] });
});

app.get("/api/data", requireAuth, (req, res) => {
  const row = getData.get(req.userId);
  res.json({ value: row?.value ?? null });
});

app.put("/api/data", requireAuth, (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "value deve ser uma string JSON" });
  upsertData.run(req.userId, value);
  res.json({ ok: true });
});

// Public, unauthenticated — just enough for a simple status page to show
// the app is up, with no account or usage data exposed.
app.get("/api/health", (req, res) => {
  let dbOk = true;
  try {
    db.prepare("SELECT 1").get();
  } catch {
    dbOk = false;
  }
  res.json({ status: dbOk ? "ok" : "degraded", uptimeSeconds: Math.floor(process.uptime()), serverTime: new Date().toISOString() });
});

app.get("/status", (req, res) => {
  res.sendFile("status.html", { root: __dirname });
});

const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
