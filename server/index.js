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
  generateRecoveryCode, formatRecoveryCode, normalizeRecoveryInput, generateTempPassword,
} from "./auth.js";
import { computeStreaks } from "../src/lib/streaks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// The tunnel/reverse proxy sits in front of us; trust its X-Forwarded-* so
// rate limiting keys on the real client IP instead of the tunnel's.
app.set("trust proxy", 1);

app.use(express.json());
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
const setUserSuspendedFlag = db.prepare("UPDATE users SET is_suspended = ? WHERE id = ?");
const setLastLogin = db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?");
const setShowInRanking = db.prepare("UPDATE users SET show_in_ranking = ? WHERE id = ?");
const listRankingData = db.prepare(`
  SELECT u.email, d.value
  FROM users u JOIN user_data d ON d.user_id = u.id
  WHERE u.show_in_ranking = 1 AND u.is_suspended = 0
`);

function blockSuspended(req, res, next) {
  const user = findUserById.get(req.userId);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  if (user.is_suspended) return res.status(403).json({ error: "esta conta foi suspensa" });
  next();
}
const requireAuth = [authMiddleware, blockSuspended];

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/register", authLimiter, (req, res) => {
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
  const token = signToken(info.lastInsertRowid);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
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
  setLastLogin.run(user.id);
  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
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
  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ email: user.email, recoveryCode: formatRecoveryCode(newRecoveryCode) });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = findUserById.get(req.userId);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  res.json({ email: user.email, isAdmin: !!user.is_admin, showInRanking: !!user.show_in_ranking });
});

app.patch("/api/me", requireAuth, (req, res) => {
  const { showInRanking } = req.body || {};
  if (typeof showInRanking !== "boolean") return res.status(400).json({ error: "showInRanking deve ser true ou false" });
  setShowInRanking.run(showInRanking ? 1 : 0, req.userId);
  res.json({ ok: true });
});

// Aggregate, read-only view across every opted-in user's plan data: total
// topics studied and per-matéria counts (matched by lowercased name), so
// people can see how they compare without exposing notes or plan details.
app.get("/api/ranking", requireAuth, (req, res) => {
  const rows = listRankingData.all();
  const users = rows.map((row) => {
    const displayName = row.email.split("@")[0];
    let parsed;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      return { displayName, totalEstudado: 0, questionsTotal: 0, questionsCorrect: 0, materias: [] };
    }
    const materiaMap = new Map();
    let questionsTotal = 0;
    let questionsCorrect = 0;
    for (const concurso of parsed?.concursos || []) {
      for (const materia of concurso?.materias || []) {
        const key = (materia.name || "").trim().toLowerCase();
        if (!key) continue;
        const entry = materiaMap.get(key) || { name: materia.name.trim(), estudado: 0, total: 0 };
        for (const topic of materia.topics || []) {
          entry.total += 1;
          if (topic.status === "estudado") entry.estudado += 1;
          questionsTotal += topic.questionsTotal || 0;
          questionsCorrect += topic.questionsCorrect || 0;
        }
        materiaMap.set(key, entry);
      }
    }
    const materias = [...materiaMap.values()];
    const totalEstudado = materias.reduce((sum, m) => sum + m.estudado, 0);
    return { displayName, totalEstudado, questionsTotal, questionsCorrect, materias };
  });
  res.json({ users, isOptedIn: !!findUserById.get(req.userId)?.show_in_ranking });
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

const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
