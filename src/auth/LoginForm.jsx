import React, { useState } from "react";
import { Brand } from "../components/Brand.jsx";
import { BookOpen, Target, NotebookText } from "../components/Icons.jsx";
import { colors } from "../styles/colors.js";
import { loginUser, registerUser, resetPassword } from "./api.js";

const inputStyle = {
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "12px 14px",
  color: colors.text,
  fontSize: 14,
};

const TITLES = {
  login: "entrar",
  register: "criar conta",
  reset: "recuperar acesso",
};

function RecoveryCodeReveal({ email, code, freshAccount, onContinue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: 340, background: colors.surface, border: `1px solid ${colors.accent}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
          {freshAccount ? "guarde seu código de recuperação" : "seu novo código de recuperação"}
        </div>
        <div style={{ fontSize: 12.5, color: colors.textMuted }}>
          é a única forma de recuperar o acesso de <b style={{ color: colors.text }}>{email}</b> caso esqueça a senha — não tem como reenviar depois.
          {!freshAccount && " o código anterior parou de funcionar."}
        </div>
        <div
          className="mono"
          style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px 12px", fontSize: 18, letterSpacing: 1, textAlign: "center", color: colors.accent }}
        >
          {code}
        </div>
        <button
          type="button"
          onClick={copy}
          style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: colors.text }}
        >
          {copied ? "copiado!" : "copiar código"}
        </button>
        <button
          type="button"
          onClick={onContinue}
          style={{ background: colors.accent, border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 600, fontSize: 13, color: colors.onAccent }}
        >
          já guardei, continuar
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ onAuthed, noticeMessage }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setRecoveryCode("");
    setNewPassword("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        onAuthed(await loginUser(email, password));
        return;
      }
      if (mode === "register") {
        const result = await registerUser(email, password);
        setReveal({ email: result.email, code: result.recoveryCode, freshAccount: true });
        return;
      }
      const result = await resetPassword(email, recoveryCode, newPassword);
      setReveal({ email: result.email, code: result.recoveryCode, freshAccount: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (reveal) {
    return (
      <RecoveryCodeReveal
        email={reveal.email}
        code={reveal.code}
        freshAccount={reveal.freshAccount}
        onContinue={() => onAuthed({ email: reveal.email })}
      />
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <h1 className="sg">Sua aprovação<br /><span style={{ color: colors.accent }}>ganha ritmo aqui.</span></h1>
        <p>Transforme um edital inteiro em passos possíveis. Organize seus estudos, revise o que importa e veja sua evolução.</p>
        <div className="auth-features"><span><BookOpen size={20} color={colors.accent} />Planeje</span><span><NotebookText size={20} color={colors.accent} />Pratique</span><span><Target size={20} color={colors.accent} />Evolua</span></div>
      </section>
      <form className="auth-form" onSubmit={submit} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <div><h2 className="sg" style={{ fontSize: 26, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>{TITLES[mode]}</h2><p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 8px" }}>{mode === "login" ? "Bom te ver por aqui. Vamos dar o próximo passo?" : mode === "register" ? "Crie seu espaço e comece a organizar seus estudos." : "Use seu código de recuperação para voltar à sua conta."}</p></div>

        {noticeMessage && (
          <div style={{ background: colors.accentSoft, color: colors.accent, borderRadius: 8, padding: "9px 12px", fontSize: 12.5 }}>
            {noticeMessage}
          </div>
        )}

        <input
          type="email"
          aria-label="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          required
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {mode !== "reset" && (
          <input
            type="password"
            aria-label="senha"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="senha (mín. 8 caracteres)"
            value={password}
            required
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        )}

        {mode === "reset" && (
          <>
            <input
              type="text"
              aria-label="código de recuperação"
              placeholder="código de recuperação"
              value={recoveryCode}
              required
              onChange={(e) => setRecoveryCode(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <input
              type="password"
              aria-label="nova senha"
              autoComplete="new-password"
              placeholder="nova senha (mín. 8 caracteres)"
              value={newPassword}
              required
              minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        {error && <div style={{ color: colors.red, fontSize: 12.5 }} role="alert">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{ background: colors.accent, border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 600, fontSize: 13, color: colors.onAccent }}
        >
          {busy ? "aguarde..." : mode === "login" ? "entrar" : mode === "register" ? "criar conta" : "redefinir senha"}
        </button>

        {mode === "login" && (
          <>
            <button type="button" onClick={() => switchMode("register")} style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 12.5, padding: 0 }}>
              não tem conta? criar uma
            </button>
            <button type="button" onClick={() => switchMode("reset")} style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 12.5, padding: 0 }}>
              esqueci minha senha
            </button>
          </>
        )}
        {mode !== "login" && (
          <button type="button" onClick={() => switchMode("login")} style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 12.5, padding: 0 }}>
            voltar para login
          </button>
        )}
      </form>
    </div>
  );
}
