import React from "react";
import { Check, Clock, AlertTriangle } from "./Icons.jsx";
import { colors } from "../styles/colors.js";
import { secondaryBtnStyle } from "../styles/shared.js";
import { todayISO } from "../lib/date.js";

export function SaveStatus({ sync, data, onRetry }) {
  const messages = {
    pending: "alterações aguardando salvamento…",
    saving: "salvando…",
    saved: "progresso salvo",
    "save-error": "não foi possível salvar; suas alterações continuam nesta aba",
    conflict: "o plano foi alterado em outra aba. salve uma cópia antes de recarregar",
  };
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rota-estudos-pendente-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const problem = ["save-error", "conflict"].includes(sync.status);
  return (
    <div role="status" aria-live="polite" style={{ fontSize: 12, color: problem ? colors.red : colors.textFaint, paddingBottom: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      {problem ? <AlertTriangle size={16} /> : sync.status === "saved" ? <Check size={16} color={colors.success} /> : <Clock size={16} />}
      <span>{messages[sync.status]}</span>
      {problem && <span>{sync.error}</span>}
      {sync.status === "save-error" && <button style={secondaryBtnStyle} onClick={onRetry}>tentar salvar novamente</button>}
      {problem && <button style={secondaryBtnStyle} onClick={download}>baixar minhas alterações</button>}
      {sync.status === "conflict" && <button style={secondaryBtnStyle} onClick={() => { if (window.confirm("Recarregar descarta as alterações desta aba. Você já baixou uma cópia?")) window.location.reload(); }}>recarregar plano do servidor</button>}
    </div>
  );
}
