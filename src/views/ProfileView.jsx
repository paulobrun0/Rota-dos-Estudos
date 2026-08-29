import React, { useRef, useState } from "react";
import { KeyRound, Mail, Trash2, Upload, User } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";
import { updateProfile, changePassword, changeEmail, readImageAsDataUrl } from "../api/profile.js";

function Card({ title, description, children }) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>{description}</div>}
      {children}
    </div>
  );
}

function Feedback({ error, ok }) {
  if (error) return <div style={{ color: colors.red, fontSize: 12.5, marginTop: 10 }}>{error}</div>;
  if (ok) return <div style={{ color: colors.teal, fontSize: 12.5, marginTop: 10 }}>{ok}</div>;
  return null;
}

export function ProfileView({ user, onUserUpdate }) {
  const fileInputRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [username, setUsername] = useState(user?.username || "");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState({});

  const [emailPassword, setEmailPassword] = useState("");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState({});

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({});

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      await updateProfile({ avatar: dataUrl });
      onUserUpdate((u) => ({ ...u, avatar: dataUrl }));
    } catch (e) {
      setAvatarError(e.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarError("");
    setAvatarBusy(true);
    try {
      await updateProfile({ avatar: null });
      onUserUpdate((u) => ({ ...u, avatar: null }));
    } catch (e) {
      setAvatarError(e.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveUsername() {
    setUsernameMsg({});
    setUsernameBusy(true);
    try {
      await updateProfile({ username });
      onUserUpdate((u) => ({ ...u, username }));
      setUsernameMsg({ ok: "nome de usuário atualizado." });
    } catch (e) {
      setUsernameMsg({ error: e.message });
    } finally {
      setUsernameBusy(false);
    }
  }

  async function saveEmail() {
    setEmailMsg({});
    if (newEmail.trim().toLowerCase() === user.email) { setEmailMsg({ error: "esse já é o seu email atual." }); return; }
    setEmailBusy(true);
    try {
      const result = await changeEmail(emailPassword, newEmail);
      onUserUpdate((u) => ({ ...u, email: result.email }));
      setEmailPassword("");
      setEmailMsg({ ok: "email atualizado." });
    } catch (e) {
      setEmailMsg({ error: e.message });
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword() {
    setPasswordMsg({});
    if (newPassword !== confirmPassword) { setPasswordMsg({ error: "as senhas novas não coincidem." }); return; }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ ok: "senha atualizada." });
    } catch (e) {
      setPasswordMsg({ error: e.message });
    } finally {
      setPasswordBusy(false);
    }
  }

  const initials = (user?.username || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>perfil</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        gerencie sua foto, nome de usuário, email e senha.
      </div>

      <Card title="foto de perfil">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
            background: colors.surface2, border: `1px solid ${colors.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: colors.textFaint,
          }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={avatarBusy} onClick={() => fileInputRef.current?.click()} style={{ ...secondaryBtnStyle, padding: "8px 14px" }}>
              <Upload size={14} /> {avatarBusy ? "enviando..." : "trocar foto"}
            </button>
            {user?.avatar && (
              <button disabled={avatarBusy} onClick={removeAvatar} style={{ ...secondaryBtnStyle, padding: "8px 14px" }}>
                <Trash2 size={14} /> remover
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} style={{ display: "none" }} />
          </div>
        </div>
        <Feedback error={avatarError} />
      </Card>

      <Card title="nome de usuário" description="usado no ranking em vez do seu email. 3-24 caracteres: letras, números, _ ou .">
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <User size={14} color={colors.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu_nome" style={{ ...inputStyle, paddingLeft: 30, width: "100%" }} />
          </div>
          <button disabled={usernameBusy || !username.trim()} onClick={saveUsername} style={{ ...primaryBtnStyle, marginTop: 0 }}>salvar</button>
        </div>
        <Feedback {...usernameMsg} />
      </Card>

      <Card title="email">
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 10 }}>atual: <strong>{user?.email}</strong></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Mail size={14} color={colors.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo email" type="email" style={{ ...inputStyle, paddingLeft: 30, width: "100%" }} />
          </div>
          <input value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="senha atual (confirmação)" type="password" style={{ ...inputStyle, width: "100%" }} />
          <button disabled={emailBusy || !newEmail.trim() || !emailPassword} onClick={saveEmail} style={{ ...primaryBtnStyle, marginTop: 0, alignSelf: "flex-start" }}>
            trocar email
          </button>
        </div>
        <Feedback {...emailMsg} />
      </Card>

      <Card title="senha">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <KeyRound size={14} color={colors.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="senha atual" type="password" style={{ ...inputStyle, paddingLeft: 30, width: "100%" }} />
          </div>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="nova senha (mín. 6 caracteres)" type="password" style={{ ...inputStyle, width: "100%" }} />
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="confirmar nova senha" type="password" style={{ ...inputStyle, width: "100%" }} />
          <button disabled={passwordBusy || !currentPassword || !newPassword} onClick={savePassword} style={{ ...primaryBtnStyle, marginTop: 0, alignSelf: "flex-start" }}>
            trocar senha
          </button>
        </div>
        <Feedback {...passwordMsg} />
      </Card>
    </div>
  );
}
