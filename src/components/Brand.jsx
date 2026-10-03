import React from "react";
import { colors } from "../styles/colors.js";

export function Brand({ compact = false }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
    <img src={`${import.meta.env.BASE_URL}brand.svg`} alt="" width="42" height="42" style={{ flexShrink: 0 }} />
    <div><div className="sg" style={{ color: colors.text, fontSize: compact ? 16 : 20, fontWeight: 750, lineHeight: 1.2 }}>Questão de Ritmo</div><div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>cada questão, um passo à frente</div></div>
  </div>;
}
