import React, { useEffect, useMemo, useState } from "react";
import { Ban, Check, Download, Flame, KeyRound, Pencil, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import { fetchUsers, deleteUser, setUserAdmin, setUserSuspended, setUserEmail, resetUserPassword } from "../api/admin.js";

function formatDate(iso) {
  if (!iso) return "nunca";
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function daysAgo(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 86400000;
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(users) {
  const headers = ["email", "criado_em", "ultimo_login", "admin", "suspenso", "streak_atual", "streak_recorde", "dias_ativos"];
  const rows = users.map((u) => [
    u.email, u.createdAt, u.lastLoginAt || "", u.isAdmin ? "sim" : "não", u.isSuspended ? "sim" : "não",
    u.currentStreak, u.longestStreak, u.activeDays,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const actionBtnStyle = (color) => ({
  background: "transparent", border: "none", color, display: "flex", alignItems: "center", padding: 5, borderRadius: 6,
});

function EmailCell({ user, isSelf, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed || trimmed === user.email) { setEditing(false); setDraft(user.email); return; }
    setSaving(true);
    setErr("");
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            autoFocus
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(user.email); setEditing(false); setErr(""); } }}
            style={{ ...inputStyle, padding: "4px 8px", fontSize: 12.5 }}
          />
          <button onClick={save} disabled={saving} style={actionBtnStyle(colors.teal)}><Check size={14} /></button>
          <button onClick={() => { setDraft(user.email); setEditing(false); setErr(""); }} style={actionBtnStyle(colors.textFaint)}><X size={14} /></button>
        </div>
        {err && <div style={{ fontSize: 11, color: colors.red }}>{err}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
      {isSelf && (
        <span className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: colors.amberSoft, color: colors.amber, flexShrink: 0 }}>você</span>
      )}
      <button onClick={() => setEditing(true)} aria-label="editar email" title="editar email" style={actionBtnStyle(colors.textFaint)}>
        <Pencil size={11} />
      </button>
    </div>
  );
}

export function AdminView({ currentUserEmail }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");
  const [resetResult, setResetResult] = useState(null);

  function load() {
    fetchUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function run(id, fn) {
    setError("");
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(u) {
    if (!window.confirm(`gerar uma nova senha temporária para ${u.email}? a senha atual dela deixa de funcionar.`)) return;
    setError("");
    setBusyId(u.id);
    try {
      const result = await resetUserPassword(u.id);
      setResetResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`excluir a conta de ${u.email}? isso apaga o plano de estudos dela também. não tem volta.`)) return;
    run(u.id, () => deleteUser(u.id));
  }

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.email.toLowerCase().includes(q)) : users;
  }, [users, query]);

  const stats = useMemo(() => {
    if (!users) return null;
    return {
      total: users.length,
      admins: users.filter((u) => u.isAdmin).length,
      suspended: users.filter((u) => u.isSuspended).length,
      activeWeek: users.filter((u) => daysAgo(u.lastLoginAt) <= 7).length,
    };
  }, [users]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>administração</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
            gerencie as contas cadastradas no app.
          </div>
        </div>
        {users && (
          <button onClick={() => exportCsv(users)} style={{ ...secondaryBtnStyle, padding: "8px 14px", flexShrink: 0 }}>
            <Download size={14} /> exportar CSV
          </button>
        )}
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {[
            ["usuários", stats.total],
            ["admins", stats.admins],
            ["suspensos", stats.suspended],
            ["ativos (7d)", stats.activeWeek],
          ].map(([label, value]) => (
            <div key={label} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 11, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: colors.redSoft, color: colors.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {resetResult && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.amber}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16, position: "relative" }}>
          <button onClick={() => setResetResult(null)} style={{ ...actionBtnStyle(colors.textFaint), position: "absolute", top: 8, right: 8 }}><X size={14} /></button>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>nova senha gerada para {resetResult.email}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 8 }}>copie e repasse com segurança — não fica salva em lugar nenhum além daqui.</div>
          <div className="mono" style={{ display: "flex", gap: 20, fontSize: 14 }}>
            <div>senha: <strong>{resetResult.newPassword}</strong></div>
            <div>código de recuperação: <strong>{resetResult.recoveryCode}</strong></div>
          </div>
        </div>
      )}

      {users && (
        <div style={{ position: "relative", marginBottom: 14, maxWidth: 320 }}>
          <Search size={14} color={colors.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar por email"
            style={{ ...inputStyle, paddingLeft: 30, width: "100%" }}
          />
        </div>
      )}

      {filtered && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "auto" }}>
          <div style={{ minWidth: 880 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 80px 110px 110px 110px 140px", gap: 8, padding: "10px 16px", background: colors.surface2, fontSize: 11, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <div>email</div>
              <div>streak</div>
              <div>criada em</div>
              <div>último login</div>
              <div>status</div>
              <div>ações</div>
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "16px", fontSize: 13, color: colors.textFaint }}>nenhum usuário encontrado.</div>
            )}
            {filtered.map((u) => {
              const isSelf = u.email === currentUserEmail;
              return (
                <div
                  key={u.id}
                  style={{ display: "grid", gridTemplateColumns: "1.6fr 80px 110px 110px 110px 140px", gap: 8, alignItems: "center", padding: "12px 16px", borderTop: `1px solid ${colors.border}`, fontSize: 13, opacity: busyId === u.id ? 0.5 : 1 }}
                >
                  <EmailCell user={u} isSelf={isSelf} onSave={(email) => run(u.id, () => setUserEmail(u.id, email))} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: u.currentStreak > 0 ? colors.amber : colors.textFaint, fontSize: 12.5 }}>
                    <Flame size={13} /> {u.currentStreak}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(u.createdAt)}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(u.lastLoginAt)}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {u.isAdmin && <span className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: colors.amberSoft, color: colors.amber }}>admin</span>}
                    {u.isSuspended && <span className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: colors.redSoft, color: colors.red }}>suspenso</span>}
                    {!u.isAdmin && !u.isSuspended && <span style={{ fontSize: 12, color: colors.textFaint }}>—</span>}
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button
                      onClick={() => run(u.id, () => setUserAdmin(u.id, !u.isAdmin))}
                      disabled={busyId === u.id || (isSelf && u.isAdmin)}
                      aria-label={u.isAdmin ? "remover admin" : "tornar admin"}
                      title={u.isAdmin ? "remover admin" : "tornar admin"}
                      style={actionBtnStyle(u.isAdmin ? colors.amber : colors.textFaint)}
                    >
                      <ShieldCheck size={15} />
                    </button>
                    <button
                      onClick={() => run(u.id, () => setUserSuspended(u.id, !u.isSuspended))}
                      disabled={busyId === u.id || isSelf}
                      aria-label={u.isSuspended ? "reativar conta" : "suspender conta"}
                      title={u.isSuspended ? "reativar conta" : "suspender conta"}
                      style={actionBtnStyle(u.isSuspended ? colors.red : colors.textFaint)}
                    >
                      <Ban size={15} />
                    </button>
                    <button
                      onClick={() => handleResetPassword(u)}
                      disabled={busyId === u.id}
                      aria-label="resetar senha"
                      title="resetar senha"
                      style={actionBtnStyle(colors.textFaint)}
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={busyId === u.id || isSelf}
                      aria-label="excluir usuário"
                      title="excluir usuário"
                      style={actionBtnStyle(colors.textFaint)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
