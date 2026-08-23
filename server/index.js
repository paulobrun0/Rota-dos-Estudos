import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import db from "./db.js";
import { signToken, authMiddleware, COOKIE_NAME, COOKIE_OPTIONS } from "./auth.js";

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 4000;

const insertUser = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const findUserById = db.prepare("SELECT * FROM users WHERE id = ?");
const getData = db.prepare("SELECT value FROM user_data WHERE user_id = ?");
const upsertData = db.prepare(`
  INSERT INTO user_data (user_id, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "email válido e senha com 6+ caracteres são obrigatórios" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (findUserByEmail.get(normalizedEmail)) {
    return res.status(409).json({ error: "já existe uma conta com esse email" });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const info = insertUser.run(normalizedEmail, passwordHash);
  const token = signToken(info.lastInsertRowid);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ email: normalizedEmail });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = findUserByEmail.get(normalizedEmail);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "email ou senha incorretos" });
  }
  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ email: user.email });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const user = findUserById.get(req.userId);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  res.json({ email: user.email });
});

app.get("/api/data", authMiddleware, (req, res) => {
  const row = getData.get(req.userId);
  res.json({ value: row?.value ?? null });
});

app.put("/api/data", authMiddleware, (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "value deve ser uma string JSON" });
  upsertData.run(req.userId, value);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
