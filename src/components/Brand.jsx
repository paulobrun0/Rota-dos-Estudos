import React from "react";
import { colors } from "../styles/colors.js";

export function Brand({ compact = false }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
    <svg aria-hidden="true" width="38" height="38" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      <rect width="64" height="64" rx="18" fill={colors.accent} />
      <path d="M18 45V22a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v23l-14-7z" fill={colors.onAccent} opacity=".22" />
      <path d="m23 41 9-22 9 22-9-5z" fill={colors.onAccent} />
      <circle cx="32" cy="29" r="3" fill={colors.accent} />
    </svg>
    <div><div className="sg" style={{ color: colors.text, fontSize: compact ? 16 : 20, fontWeight: 750 }}>Rota dos Estudos</div><div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>um passo mais perto</div></div>
  </div>;
}
