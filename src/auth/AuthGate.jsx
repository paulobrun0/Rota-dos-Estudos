import React, { useEffect, useState } from "react";
import App from "../App.jsx";
import { colors } from "../styles/colors.js";
import { fetchCurrentUser, logoutUser } from "./api.js";
import { LoginForm } from "./LoginForm.jsx";
import { UpdateBanner } from "../components/UpdateBanner.jsx";

// How often an idle-but-open tab re-checks that its session is still the
// live one for its account — a second login elsewhere (see server's
// requireCurrentUser) invalidates this one server-side immediately, but a
// tab doing nothing wouldn't otherwise notice until its next real API call.
const SESSION_CHECK_MS = 30_000;

export default function AuthGate() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [kickedReason, setKickedReason] = useState("");

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => { setUser(u); setStatus("authed"); })
      .catch(() => setStatus("anon"));
  }, []);

  useEffect(() => {
    if (status !== "authed") return;
    const id = setInterval(() => {
      fetchCurrentUser().catch((e) => {
        if (e.code === "SESSION_SUPERSEDED" || e.code === "MAINTENANCE") {
          setKickedReason(e.message);
          setUser(null);
          setStatus("anon");
        }
        // Any other failure (e.g. a network blip) is left alone — the next
        // real API call the user makes will surface it properly instead of
        // this background check bouncing them out over a fluke.
      });
    }, SESSION_CHECK_MS);
    return () => clearInterval(id);
  }, [status]);

  async function handleLogout() {
    await logoutUser().catch(() => {});
    setKickedReason("");
    setUser(null);
    setStatus("anon");
  }

  // The login/register/reset responses only carry {email} — fetch the full
  // profile (isAdmin, username, avatar, showInRanking) right after, instead
  // of running with a partial user object until the next page reload.
  async function handleAuthed() {
    setStatus("loading");
    setKickedReason("");
    try {
      setUser(await fetchCurrentUser());
      setStatus("authed");
    } catch {
      setStatus("anon");
    }
  }

  let content;
  if (status === "loading") {
    content = (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, color: colors.textMuted, fontFamily: "Inter, system-ui, sans-serif" }}>
        carregando...
      </div>
    );
  } else if (status === "anon") {
    content = <LoginForm onAuthed={handleAuthed} noticeMessage={kickedReason} />;
  } else {
    content = <App user={user} onLogout={handleLogout} onUserUpdate={setUser} />;
  }

  return (
    <>
      {content}
      <UpdateBanner />
    </>
  );
}
