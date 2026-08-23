import React, { useRef, useState } from "react";
import { Download, Moon, Sun, Upload } from "lucide-react";
import { colors } from "../styles/colors.js";
import { primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";
import { todayISO } from "../lib/date.js";
import { migrate } from "../data/model.js";

export function AjustesView({ theme, setTheme, data, onImport }) {
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState(false);

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
        <div style={{ display: "flex", gap: 8 }}>
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
