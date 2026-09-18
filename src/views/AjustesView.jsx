import React, { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Download, Eye, EyeOff, Moon, Sun, Upload, Volume2, VolumeX } from "lucide-react";
import { colors } from "../styles/colors.js";
import { primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";
import { todayISO } from "../lib/date.js";
import { migrate } from "../data/model.js";
import { playCompleteSound } from "../lib/sound.js";
import { setRankingVisibility } from "../api/ranking.js";
import { updateProfile } from "../api/profile.js";
import { getExistingSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from "../api/push.js";
import { WeekdayToggle } from "../components/WeekdayToggle.jsx";
import { WEEKDAY_KEYS } from "../lib/planner.js";

const REMINDER_HOURS = Array.from({ length: 24 }, (_, h) => h);
const ALL_DAYS = [...WEEKDAY_KEYS];

export function AjustesView({ theme, setTheme, soundEnabled, setSoundEnabled, data, onImport, user, onUserUpdate, studyDays, setStudyDays }) {
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState(false);
  const [rankingBusy, setRankingBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    if (!pushSupported()) {
      setPushSubscribed(false);
      return;
    }
    getExistingSubscription()
      .then((sub) => setPushSubscribed(Boolean(sub)))
      .catch(() => setPushSubscribed(false));
  }, []);

  async function togglePush(value) {
    setPushError("");
    setPushBusy(true);
    try {
      if (value) await subscribeToPush();
      else await unsubscribeFromPush();
      setPushSubscribed(value);
    } catch (e) {
      setPushError(e.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function changeReminderHour(hour) {
    setReminderError("");
    setReminderBusy(true);
    try {
      await updateProfile({ reminderHour: hour });
      onUserUpdate((u) => ({ ...u, reminderHour: hour }));
    } catch (e) {
      setReminderError(e.message);
    } finally {
      setReminderBusy(false);
    }
  }

  async function toggleRanking(value) {
    setRankingBusy(true);
    try {
      await setRankingVisibility(value);
      onUserUpdate((u) => ({ ...u, showInRanking: value }));
    } catch {
      // keep current state on failure — the button just won't reflect a change
    } finally {
      setRankingBusy(false);
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ciclo-estudos-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImportOk(false);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = migrate(JSON.parse(reader.result));
        const confirmed = window.confirm(
          "Importar vai substituir todos os dados atuais (concursos, matérias, planos e histórico). Continuar?"
        );
        if (!confirmed) return;
        onImport(parsed);
        setImportOk(true);
      } catch (err) {
        setImportError("Não foi possível ler esse arquivo. Confira se é um backup exportado por aqui.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>ajustes</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        aparência e backup dos seus dados.
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>aparência</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setTheme("dark")}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${theme === "dark" ? colors.amber : colors.border}`, color: theme === "dark" ? colors.amber : colors.text }}
          >
            <Moon size={14} /> escuro
          </button>
          <button
            onClick={() => setTheme("light")}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${theme === "light" ? colors.amber : colors.border}`, color: theme === "light" ? colors.amber : colors.text }}
          >
            <Sun size={14} /> claro
          </button>
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>som</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
          toca um aviso sonoro sempre que um assunto é marcado como concluído.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setSoundEnabled(true)}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${soundEnabled ? colors.amber : colors.border}`, color: soundEnabled ? colors.amber : colors.text }}
          >
            <Volume2 size={14} /> ativado
          </button>
          <button
            onClick={() => setSoundEnabled(false)}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${!soundEnabled ? colors.amber : colors.border}`, color: !soundEnabled ? colors.amber : colors.text }}
          >
            <VolumeX size={14} /> desativado
          </button>
          {soundEnabled && (
            <button onClick={playCompleteSound} style={{ ...secondaryBtnStyle, padding: "8px 14px" }}>
              testar
            </button>
          )}
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>notificações</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
          um lembrete no horário que você escolher, só se você ainda não tiver estudado nada naquele dia. precisa manter o app instalado/aberto no navegador para funcionar.
        </div>
        {!pushSupported() ? (
          <div style={{ fontSize: 12.5, color: colors.textFaint }}>seu navegador não suporta notificações push.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              disabled={pushBusy || pushSubscribed === null}
              onClick={() => togglePush(true)}
              style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${pushSubscribed ? colors.amber : colors.border}`, color: pushSubscribed ? colors.amber : colors.text }}
            >
              <Bell size={14} /> ativado
            </button>
            <button
              disabled={pushBusy || pushSubscribed === null}
              onClick={() => togglePush(false)}
              style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${pushSubscribed === false ? colors.amber : colors.border}`, color: pushSubscribed === false ? colors.amber : colors.text }}
            >
              <BellOff size={14} /> desativado
            </button>
            {pushSubscribed && (
              <>
                <span style={{ fontSize: 12.5, color: colors.textMuted }}>às</span>
                <select
                  disabled={reminderBusy}
                  value={user?.reminderHour ?? 19}
                  onChange={(e) => changeReminderHour(Number(e.target.value))}
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, padding: "8px 10px", cursor: "pointer" }}
                >
                  {REMINDER_HOURS.map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
        {pushError && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 10 }}>{pushError}</div>}
        {reminderError && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 10 }}>{reminderError}</div>}
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>dias de estudo</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
          marque os dias que você pretende estudar. num dia de fora, sua sequência não quebra — ela só espera você voltar.
        </div>
        <WeekdayToggle value={studyDays || ALL_DAYS} onChange={setStudyDays} />
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>ranking</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
          controla se outras pessoas te veem no ranking de assuntos estudados. seus assuntos, anotações e planos nunca ficam visíveis — só a contagem.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={rankingBusy}
            onClick={() => toggleRanking(true)}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${user?.showInRanking ? colors.amber : colors.border}`, color: user?.showInRanking ? colors.amber : colors.text }}
          >
            <Eye size={14} /> apareço no ranking
          </button>
          <button
            disabled={rankingBusy}
            onClick={() => toggleRanking(false)}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${!user?.showInRanking ? colors.amber : colors.border}`, color: !user?.showInRanking ? colors.amber : colors.text }}
          >
            <EyeOff size={14} /> fico de fora
          </button>
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>backup dos dados</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
          exporte um arquivo com todos os concursos, matérias, planos e histórico — ou importe um backup anterior.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportData} style={{ ...primaryBtnStyle, marginTop: 0 }}>
            <Download size={14} /> exportar JSON
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...secondaryBtnStyle, padding: "9px 16px" }}>
            <Upload size={14} /> importar JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{ display: "none" }} />
        </div>
        {importError && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 10 }}>{importError}</div>}
        {importOk && <div style={{ color: colors.teal, fontSize: 12.5, marginTop: 10 }}>dados importados com sucesso.</div>}
      </div>
    </div>
  );
}
