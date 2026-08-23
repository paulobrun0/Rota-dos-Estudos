import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const COOKIE_NAME = "token";

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
