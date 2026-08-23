import React, { useState } from "react";
import { colors } from "../styles/colors.js";
import { loginUser, registerUser } from "./api.js";

const inputStyle = {
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "9px 10px",
  color: colors.text,
  fontSize: 13,
};

export function LoginForm({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = mode === "login" ? await loginUser(email, password) : await registerUser(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: 320, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
          {mode === "login" ? "entrar" : "criar conta"}
        </div>
        <input
          type="email"
          placeholder="email"
          value={email}
          required
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="senha (mín. 6 caracteres)"
          value={password}
          required
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <div style={{ color: colors.red, fontSize: 12.5 }}>{error}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{ background: colors.amber, border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 600, fontSize: 13, color: colors.bg }}
        >
          {busy ? "aguarde..." : mode === "login" ? "entrar" : "criar conta"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 12.5, padding: 0 }}
        >
          {mode === "login" ? "não tem conta? criar uma" : "já tem conta? entrar"}
        </button>
      </form>
    </div>
  );
}
