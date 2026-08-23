import React from "react";
import { colors } from "../styles/colors.js";

export function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
        borderRadius: 8, border: "none", background: active ? colors.surface2 : "transparent",
        color: active ? colors.text : colors.textMuted, fontSize: 14, fontWeight: 500,
        textAlign: "left", width: "100%",
      }}
    >
      <span style={{ color: active ? colors.amber : colors.textFaint }}>{icon}</span>
      {label}
    </button>
  );
}
