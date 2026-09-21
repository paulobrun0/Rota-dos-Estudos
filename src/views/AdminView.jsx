import React, { useEffect, useMemo, useState } from "react";
import { Ban, Check, DatabaseBackup, Download, Flame, History, KeyRound, Pencil, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, Users, X } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import {
  fetchUsers, deleteUser, setUserAdmin, setUserSuspended, setUserEmail, resetUserPassword,
  fetchFeatures, setFeatureEnabled, fetchAuditLog, fetchBackups, runBackupNow,
} from "../api/admin.js";

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

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      style={{
        width: 38, height: 22, borderRadius: 20, border: "none", flexShrink: 0, position: "relative",
        background: checked ? colors.teal : colors.border, opacity: disabled ? 0.5 : 1, transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: "50%",
          background: colors.bg, transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function FeaturesPanel() {
  const [features, setFeatures] = useState(null);
  const [error, setError] = useState("");
  // A Set of in-flight keys, not a single scalar — toggling one feature
  // while another's request is still pending must not clear the first
  // one's busy/disabled state out from under it.
  const [busyKeys, setBusyKeys] = useState(() => new Set());

  function load() {
    fetchFeatures()
      .then((r) => setFeatures(r.features))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function toggle(key, enabled) {
    setError("");
    setBusyKeys((prev) => new Set(prev).add(key));
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      await setFeatureEnabled(key, enabled);
    } catch (e) {
      setError(e.message);
      setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 16 }}>
        ligue ou desligue recursos do app para todo mundo, na hora — sem precisar publicar uma nova versão.
      </div>

      {error && (
        <div style={{ background: colors.redSoft, color: colors.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!features && !error && <div style={{ fontSize: 13, color: colors.textFaint }}>carregando...</div>}

      {features && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
          {features.map((f, i) => (
            <div
              key={f.key}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px",
                borderTop: i > 0 ? `1px solid ${colors.border}` : "none", opacity: busyKeys.has(f.key) ? 0.6 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, textTransform: "capitalize" }}>{f.label}</div>
                <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                  {f.enabled ? "ativo para todos os usuários" : "desativado para todos os usuários"}
                </div>
              </div>
              <Switch checked={f.enabled} disabled={busyKeys.has(f.key)} onChange={(v) => toggle(f.key, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTION_LABELS = {
  grant_admin: "tornou admin",
  revoke_admin: "removeu admin",
  suspend_user: "suspendeu",
  unsuspend_user: "reativou",
  reset_password: "resetou a senha de",
  delete_user: "excluiu",
  change_email: "trocou o email de",
  enable_feature: "ativou o recurso",
  disable_feature: "desativou o recurso",
  run_backup: "gerou um backup manual",
};

function AuditLogPanel() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuditLog()
      .then((r) => setEntries(r.entries))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 16 }}>
        últimas 200 ações administrativas — quem fez o quê, e quando.
      </div>

      {error && (
        <div style={{ background: colors.redSoft, color: colors.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!entries && !error && <div style={{ fontSize: 13, color: colors.textFaint }}>carregando...</div>}
      {entries && entries.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>nenhuma ação registrada ainda.</div>}

      {entries && entries.length > 0 && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
          {entries.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", padding: "10px 16px", fontSize: 12.5,
                borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
              }}
            >
              <span style={{ color: colors.textFaint, flexShrink: 0 }}>{formatDate(e.createdAt)}</span>
              <span style={{ color: colors.text }}>
                <b>{e.adminEmail}</b> {ACTION_LABELS[e.action] || e.action}
                {e.targetEmail && <> <b>{e.targetEmail}</b></>}
                {e.details && <span style={{ color: colors.textMuted }}> · {e.details}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupsPanel() {
  const [backups, setBackups] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  function load() {
    fetchBackups()
      .then((r) => setBackups(r.backups))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleRunNow() {
    setError("");
    setRunning(true);
    try {
      const r = await runBackupNow();
      setBackups(r.backups);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: colors.textMuted }}>
          snapshot completo do banco a cada 12h, direto no servidor — guarda os últimos 14. um backup também roda sempre que o app inicia.
        </div>
        <button disabled={running} onClick={handleRunNow} style={{ ...secondaryBtnStyle, padding: "8px 14px", flexShrink: 0 }}>
          <RefreshCw size={14} /> {running ? "gerando..." : "fazer backup agora"}
        </button>
      </div>

      {error && (
        <div style={{ background: colors.redSoft, color: colors.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!backups && !error && <div style={{ fontSize: 13, color: colors.textFaint }}>carregando...</div>}
      {backups && backups.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>nenhum backup ainda.</div>}

      {backups && backups.length > 0 && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
          {backups.map((b, i) => (
            <div
              key={b.name}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", fontSize: 12.5,
                borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <DatabaseBackup size={14} color={colors.textFaint} style={{ flexShrink: 0 }} />
                <span className="mono" style={{ color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
              </div>
              <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                <span className="mono" style={{ color: colors.textFaint }}>{formatBytes(b.sizeBytes)}</span>
                <span style={{ color: colors.textFaint }}>{new Date(b.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminView({ currentUserEmail, onUserUpdate }) {
  const [section, setSection] = useState("usuarios");
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  // A Set of in-flight user ids, not a single scalar — starting an action on
  // one row while another row's own action is still pending must not clear
  // that other row's busy/disabled guard out from under it.
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [resetResult, setResetResult] = useState(null);

  function load() {
    fetchUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function setBusy(id, isBusy) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function run(id, fn) {
    setError("");
    setBusy(id, true);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(id, false);
    }
  }

  async function handleResetPassword(u) {
    if (!window.confirm(`gerar uma nova senha temporária para ${u.email}? a senha atual dela deixa de funcionar.`)) return;
    setError("");
    setBusy(u.id, true);
    try {
      const result = await resetUserPassword(u.id);
      setResetResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(u.id, false);
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
            gerencie as contas e os recursos do app.
          </div>
        </div>
        {section === "usuarios" && users && (
          <button onClick={() => exportCsv(users)} style={{ ...secondaryBtnStyle, padding: "8px 14px", flexShrink: 0 }}>
            <Download size={14} /> exportar CSV
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: `1px solid ${colors.border}` }}>
        {[
          ["usuarios", "usuários", Users],
          ["recursos", "recursos", SlidersHorizontal],
          ["auditoria", "auditoria", History],
          ["backups", "backups", DatabaseBackup],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 4px 10px", marginRight: 14, fontSize: 13, fontWeight: 600,
              color: section === key ? colors.text : colors.textFaint,
              borderBottom: `2px solid ${section === key ? colors.teal : "transparent"}`,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {section === "recursos" && <FeaturesPanel />}
      {section === "auditoria" && <AuditLogPanel />}
      {section === "backups" && <BackupsPanel />}

      {section === "usuarios" && stats && (
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

      {section === "usuarios" && error && (
        <div style={{ background: colors.redSoft, color: colors.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {section === "usuarios" && resetResult && (
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

      {section === "usuarios" && users && (
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

      {section === "usuarios" && filtered && (
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
                  style={{ display: "grid", gridTemplateColumns: "1.6fr 80px 110px 110px 110px 140px", gap: 8, alignItems: "center", padding: "12px 16px", borderTop: `1px solid ${colors.border}`, fontSize: 13, opacity: busyIds.has(u.id) ? 0.5 : 1 }}
                >
                  <EmailCell
                    user={u}
                    isSelf={isSelf}
                    onSave={(email) => run(u.id, async () => {
                      await setUserEmail(u.id, email);
                      // currentUserEmail comes from the top-level logged-in
                      // user, not from this table's own `users` list — if an
                      // admin edits their own row here without this, isSelf
                      // goes stale on the very next render and every
                      // self-protection guard below (can't suspend/demote/
                      // delete "yourself") silently stops applying to them.
                      if (isSelf) onUserUpdate((prev) => ({ ...prev, email }));
                    })}
                  />
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
                      disabled={busyIds.has(u.id) || (isSelf && u.isAdmin)}
                      aria-label={u.isAdmin ? "remover admin" : "tornar admin"}
                      title={u.isAdmin ? "remover admin" : "tornar admin"}
                      style={actionBtnStyle(u.isAdmin ? colors.amber : colors.textFaint)}
                    >
                      <ShieldCheck size={15} />
                    </button>
                    <button
                      onClick={() => run(u.id, () => setUserSuspended(u.id, !u.isSuspended))}
                      disabled={busyIds.has(u.id) || isSelf}
                      aria-label={u.isSuspended ? "reativar conta" : "suspender conta"}
                      title={u.isSuspended ? "reativar conta" : "suspender conta"}
                      style={actionBtnStyle(u.isSuspended ? colors.red : colors.textFaint)}
                    >
                      <Ban size={15} />
                    </button>
                    <button
                      onClick={() => handleResetPassword(u)}
                      disabled={busyIds.has(u.id)}
                      aria-label="resetar senha"
                      title="resetar senha"
                      style={actionBtnStyle(colors.textFaint)}
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={busyIds.has(u.id) || isSelf}
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
