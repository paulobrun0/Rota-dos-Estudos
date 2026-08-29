import React, { useEffect, useState } from "react";
import App from "../App.jsx";
import { colors } from "../styles/colors.js";
import { fetchCurrentUser, logoutUser } from "./api.js";
import { LoginForm } from "./LoginForm.jsx";

export default function AuthGate() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => { setUser(u); setStatus("authed"); })
      .catch(() => setStatus("anon"));
  }, []);

  async function handleLogout() {
    await logoutUser().catch(() => {});
    setUser(null);
    setStatus("anon");
  }

  // The login/register/reset responses only carry {email} — fetch the full
  // profile (isAdmin, username, avatar, showInRanking) right after, instead
  // of running with a partial user object until the next page reload.
  async function handleAuthed() {
    setStatus("loading");
    try {
      setUser(await fetchCurrentUser());
      setStatus("authed");
    } catch {
      setStatus("anon");
    }
  }

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, color: colors.textMuted, fontFamily: "Inter, system-ui, sans-serif" }}>
        carregando...
      </div>
    );
  }

  if (status === "anon") {
    return <LoginForm onAuthed={handleAuthed} />;
  }

  return <App user={user} onLogout={handleLogout} onUserUpdate={setUser} />;
}
