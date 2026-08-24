import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const COOKIE_NAME = "token";

// Excludes visually ambiguous characters (0/O, 1/I/L) so a hand-copied code
// is less likely to get mistyped.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Canonical form: 12 characters, no separators — what actually gets hashed
// and compared. Display formatting (dashes) is a presentation concern only.
export function generateRecoveryCode() {
  const bytes = crypto.randomBytes(12);
  let raw = "";
  for (let i = 0; i < 12; i++) raw += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  return raw;
}

export function formatRecoveryCode(raw) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

// Strips whatever punctuation/whitespace/casing the user typed or pasted
// back (e.g. with or without dashes) down to the canonical form.
export function normalizeRecoveryInput(input) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export function signToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "30d" });
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "não autenticado" });
  try {
    req.userId = jwt.verify(token, SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: "sessão inválida" });
  }
}
