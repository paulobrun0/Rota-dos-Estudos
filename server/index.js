import "dotenv/config";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
import { brazilIsoDaysAgo } from "./brazilTime.js";
import { runBackup, listBackups } from "./backup.js";
import { isPushConfigured, removeSubscription, saveSubscription, vapidPublicKey } from "./push.js";
import { startDailyReminderSchedule } from "./dailyReminder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// The tunnel/reverse proxy sits in front of us; trust its X-Forwarded-* so
// rate limiting keys on the real client IP instead of the tunnel's.
app.set("trust proxy", 1);

// Hash of index.html's inline theme-detection <script> — lets CSP allow
// exactly that known script without a blanket 'unsafe-inline' for scripts.
// If that inline script's content ever changes, regenerate with:
//   node -e "const c=require('fs').readFileSync('dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r\n/g,'\n');console.log(require('crypto').createHash('sha256').update(c).digest('base64'))"
// The `.replace(/\r\n/g,'\n')` matters: browsers normalize line endings
// during HTML parsing before hashing a script's source text, so hashing the
// raw (possibly CRLF, depending on how the file was checked out) bytes
// gives a value the browser will never actually produce — hash the
// LF-normalized text instead, which is what the browser sees regardless of
// the file's on-disk line endings. A stale/wrong hash just breaks the theme
// flash-prevention silently (CSP blocks it, no console-visible app crash),
// not the app itself, but is worth keeping accurate.
const THEME_SCRIPT_HASH = "'sha256-FTLGSifcjvisP4NXmqpyVK2XYL4H4Vg+psG8E/XjYCw='";

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' ${THEME_SCRIPT_HASH}`,
      // React sets element.style directly, which CSP treats the same as an
      // inline style="" attribute — there's no avoiding 'unsafe-inline' here
      // short of a CSS-in-JS engine that supports nonces, which this app
      // doesn't use. Lower severity than an inline-script hole, in any case.
      // fonts.googleapis.com is the app's own @import for Space Grotesk/
      // Inter/JetBrains Mono (see App.jsx) — its stylesheet in turn points
      // at fonts.gstatic.com for the actual font files, hence font-src too.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // Browsers only act on this over an actual HTTPS response, so it's a
  // no-op (not a foot-gun) on the rare plain-HTTP request that reaches here.
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

const PORT = process.env.PORT || 4000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Overridable so tests that need many auth calls (unrelated to testing the
  // limiter itself) aren't throttled by it — unset in dev/production, where
  // it's always the real 20.
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
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
const bumpFailedLogin = db.prepare("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?");
const lockAccount = db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = ? WHERE id = ?");
const clearLoginLock = db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?");
const insertAuditLog = db.prepare(`
  INSERT INTO admin_audit_log (admin_id, admin_email, action, target_email, details) VALUES (?, ?, ?, ?, ?)
`);
const listAuditLog = db.prepare("SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT ?");
const setShowInRanking = db.prepare("UPDATE users SET show_in_ranking = ? WHERE id = ?");
const setReminderHour = db.prepare("UPDATE users SET reminder_hour = ? WHERE id = ?");
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
  // No `code` distinguishes "never existed" from "deleted after this token
  // was issued" — both mean the same thing to the client: whatever session
  // it thought it had is gone, and AuthGate's periodic check (see
  // SESSION_INVALID there) uses this to boot an already-open tab right away
  // instead of leaving it looking logged-in until its next real API call.
  if (!user) return res.status(401).json({ error: "não autenticado", code: "SESSION_INVALID" });
  if (user.is_suspended) return res.status(403).json({ error: "esta conta foi suspensa", code: "SUSPENDED" });
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

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;

function logAdminAction(req, action, targetEmail, details) {
  insertAuditLog.run(req.userId, req.user.email, action, targetEmail || null, details || null);
}

app.post("/api/register", authLimiter, (req, res) => {
  if (!isFeatureEnabled("cadastro")) return res.status(403).json({ error: "novos cadastros estão desativados no momento" });
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "email válido e senha com 8+ caracteres são obrigatórios" });
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

  // Checked before touching bcrypt at all: a locked account shouldn't pay
  // (or let an attacker pay) for a password comparison it can't act on
  // anyway. Distinct from the route's own IP-based rate limiter — that one
  // resets the moment an attacker switches IPs, this one is tied to the
  // account itself and doesn't care which IP is asking.
  if (user?.locked_until && user.locked_until > new Date().toISOString()) {
    return res.status(429).json({ error: `conta temporariamente bloqueada por muitas tentativas — tente novamente em ${LOGIN_LOCK_MINUTES} minutos` });
  }

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    if (user) {
      const attempts = user.failed_login_attempts + 1;
      if (attempts >= LOGIN_ATTEMPT_LIMIT) {
        lockAccount.run(new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000).toISOString(), user.id);
      } else {
        bumpFailedLogin.run(user.id);
      }
    }
    return res.status(401).json({ error: "email ou senha incorretos" });
  }
  if (user.is_suspended) return res.status(403).json({ error: "esta conta foi suspensa" });
  if (!user.is_admin && !isFeatureEnabled("manutencao")) {
    return res.status(503).json({ error: "o app está em manutenção no momento — tente novamente em instantes" });
  }
  clearLoginLock.run(user.id);
  setLastLogin.run(user.id);
  issueSession(res, user.id);
  res.json({ email: user.email });
});

app.post("/api/reset-password", authLimiter, (req, res) => {
  const { email, recoveryCode, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "a nova senha precisa ter 8+ caracteres" });
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
    username: user.username || null, avatar: user.avatar || null, reminderHour: user.reminder_hour,
  });
});

app.patch("/api/me", requireAuth, (req, res) => {
  const { showInRanking, username, avatar, reminderHour } = req.body || {};

  if (showInRanking !== undefined) {
    if (typeof showInRanking !== "boolean") return res.status(400).json({ error: "showInRanking deve ser true ou false" });
    setShowInRanking.run(showInRanking ? 1 : 0, req.userId);
  }

  if (reminderHour !== undefined) {
    if (!Number.isInteger(reminderHour) || reminderHour < 0 || reminderHour > 23) {
      return res.status(400).json({ error: "reminderHour deve ser um número inteiro entre 0 e 23" });
    }
    setReminderHour.run(reminderHour, req.userId);
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

// Public: the client needs this to call pushManager.subscribe(), and it's
// not secret — VAPID's public key is meant to be handed out (it's how the
// push service later verifies OUR server signed the message, not a way to
// authenticate the client).
app.get("/api/push/vapid-public-key", (req, res) => {
  if (!isPushConfigured()) return res.status(503).json({ error: "notificações não configuradas no servidor" });
  res.json({ publicKey: vapidPublicKey() });
});

app.post("/api/push/subscribe", requireAuth, (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: "subscription inválida" });
  }
  saveSubscription(req.userId, subscription);
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== "string" || !endpoint) return res.status(400).json({ error: "endpoint é obrigatório" });
  removeSubscription(req.userId, endpoint);
  res.json({ ok: true });
});

app.post("/api/me/change-password", authLimiter, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = findUserById.get(req.userId);
  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "senha atual incorreta" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "a nova senha precisa ter 8+ caracteres" });
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

// Aggregate, read-only view across every opted-in user's plan data: total
// topics studied, per-matéria counts (matched by lowercased name), and
// questions solved per period — so people can see how they compare without
// exposing notes or plan details, only aggregate counts.
app.get("/api/ranking", requireAuth, (req, res) => {
  if (!isFeatureEnabled("ranking")) return res.status(403).json({ error: "o ranking está desativado no momento" });
  const rows = listRankingData.all();
  // Brazil-shifted, not the server's own UTC date — see brazilTime.js for
  // why: questionActivity's keys are dates the client computed in its own
  // (Brazil) local time, and a plain UTC "today" here would disagree with
  // that for about 3 hours every evening.
  const dayCutoff = brazilIsoDaysAgo(0);
  const weekCutoff = brazilIsoDaysAgo(6);
  const monthCutoff = brazilIsoDaysAgo(29);

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
    logAdminAction(req, "change_email", target.email, `novo email: ${normalizedEmail}`);
  }

  if (isAdmin !== undefined) {
    if (typeof isAdmin !== "boolean") return res.status(400).json({ error: "isAdmin deve ser true ou false" });
    if (targetId === req.userId && !isAdmin) {
      return res.status(400).json({ error: "você não pode remover seu próprio acesso de administrador" });
    }
    setUserAdminFlag.run(isAdmin ? 1 : 0, targetId);
    logAdminAction(req, isAdmin ? "grant_admin" : "revoke_admin", target.email);
  }

  if (isSuspended !== undefined) {
    if (typeof isSuspended !== "boolean") return res.status(400).json({ error: "isSuspended deve ser true ou false" });
    if (targetId === req.userId && isSuspended) {
      return res.status(400).json({ error: "você não pode suspender sua própria conta" });
    }
    setUserSuspendedFlag.run(isSuspended ? 1 : 0, targetId);
    logAdminAction(req, isSuspended ? "suspend_user" : "unsuspend_user", target.email);
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
  logAdminAction(req, "reset_password", target.email);
  res.json({ email: target.email, newPassword, recoveryCode: formatRecoveryCode(newRecoveryCode) });
});

app.delete("/api/admin/users/:id", adminOnly, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.userId) return res.status(400).json({ error: "você não pode excluir sua própria conta por aqui" });
  const target = findUserById.get(targetId);
  if (!target) return res.status(404).json({ error: "usuário não encontrado" });
  deleteUserData.run(targetId);
  deleteUserById.run(targetId);
  logAdminAction(req, "delete_user", target.email);
  res.json({ ok: true });
});

app.get("/api/admin/audit-log", adminOnly, (req, res) => {
  const rows = listAuditLog.all(200).map((r) => ({
    id: r.id, adminEmail: r.admin_email, action: r.action, targetEmail: r.target_email, details: r.details, createdAt: r.created_at,
  }));
  res.json({ entries: rows });
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
  logAdminAction(req, enabled ? "enable_feature" : "disable_feature", null, key);
  res.json({ ok: true, key, enabled });
});

app.get("/api/admin/backups", adminOnly, (req, res) => {
  res.json({ backups: listBackups() });
});

app.post("/api/admin/backups", adminOnly, (req, res) => {
  const file = runBackup();
  logAdminAction(req, "run_backup", null, path.basename(file));
  res.json({ backups: listBackups() });
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

// True only when this file is the actual entry point (`node server/index.js`,
// which is how `npm run dev:server` and production both start it) — not when
// some other module (a test, importing `app` to drive it with its own
// ephemeral `.listen(0)`) merely imports it. Keeps building the Express app
// itself side-effect-free to import, while `node server/index.js` still does
// everything it always did.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // One on startup (covers a VM that stays up for weeks without a deploy —
  // otherwise it could go a long time before its first snapshot), then every
  // 12h for the life of the process. Ties the backup schedule to the app's
  // own process rather than an external cron job, so it needs nothing set up
  // on the host beyond the app itself — a `systemctl restart` just resumes it.
  const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
  try {
    runBackup();
  } catch (err) {
    console.error("backup inicial falhou:", err.message);
  }
  setInterval(() => {
    try {
      runBackup();
    } catch (err) {
      console.error("backup periódico falhou:", err.message);
    }
  }, BACKUP_INTERVAL_MS);

  if (isPushConfigured()) startDailyReminderSchedule();

  app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
}

export default app;
